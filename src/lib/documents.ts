import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractText, getDocumentProxy } from "unpdf";

/**
 * Extracts text from a user's private uploaded documents (CV + optional "story"
 * file) so the LLM can ground story generation in their real background.
 *
 * Files live in the private `cvs` bucket; we download them with the service-role
 * admin client (server-only) and parse PDFs with unpdf (serverless-friendly).
 * Text is trimmed to keep token usage bounded. All failures degrade gracefully
 * to "no document text" rather than breaking generation.
 */
const MAX_PER_DOC = 6000;
const MAX_TOTAL = 9000;

export interface StoryDoc {
  label: string;
  text: string;
}

const clean = (t: string) => (t ?? "").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();

export async function loadUserStoryDocs(userId: string): Promise<StoryDoc[]> {
  const admin = createAdminClient();
  const { data: docs } = await admin
    .from("uploaded_documents")
    .select("kind, file_name, storage_path, created_at")
    .eq("user_id", userId)
    .in("kind", ["cv", "statement"])
    .order("created_at", { ascending: false });

  const out: StoryDoc[] = [];
  const seen = new Set<string>();
  let total = 0;

  for (const d of docs ?? []) {
    if (seen.has(d.kind) || total >= MAX_TOTAL) continue; // most-recent per kind
    seen.add(d.kind);
    const text = await extractOne(admin, d.storage_path as string, d.file_name as string);
    if (!text) continue;
    const clipped = text.slice(0, Math.min(MAX_PER_DOC, MAX_TOTAL - total));
    out.push({ label: d.kind === "cv" ? `CV (${d.file_name})` : `Story file (${d.file_name})`, text: clipped });
    total += clipped.length;
  }
  return out;
}

async function extractOne(
  admin: ReturnType<typeof createAdminClient>,
  path: string,
  fileName: string,
): Promise<string | null> {
  try {
    const { data, error } = await admin.storage.from("cvs").download(path);
    if (error || !data) return null;
    const lower = (fileName ?? "").toLowerCase();
    if (lower.endsWith(".pdf")) {
      const buf = new Uint8Array(await data.arrayBuffer());
      const pdf = await getDocumentProxy(buf);
      const { text } = await extractText(pdf, { mergePages: true });
      return clean(typeof text === "string" ? text : (text as string[]).join("\n"));
    }
    if (lower.endsWith(".txt") || lower.endsWith(".md")) {
      return clean(await data.text());
    }
    // .doc/.docx and other formats aren't parsed yet — skipped, not fabricated.
    return null;
  } catch {
    return null;
  }
}
