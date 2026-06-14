#!/usr/bin/env node
/**
 * Bulk-add STEM members to public.member_allowlist (the membership gate).
 * Idempotent — re-running is safe (ON CONFLICT DO NOTHING).
 *
 * Requires SUPABASE_DB_URL (see .env.example).
 *
 * Usage:
 *   # pass emails as arguments:
 *   node --env-file=.env.local scripts/allowlist-add.mjs a@snu.ac.kr b@snu.ac.kr
 *
 *   # or from a file (one email per line; blank lines and # comments ignored):
 *   node --env-file=.env.local scripts/allowlist-add.mjs --file members.txt
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("ERROR: SUPABASE_DB_URL is not set. See .env.example.");
  process.exit(1);
}
const domain = (process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN ?? "snu.ac.kr").toLowerCase();

// Collect emails from --file and/or positional args.
const args = process.argv.slice(2);
let raw = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--file") {
    const path = args[++i];
    if (!path) { console.error("ERROR: --file needs a path."); process.exit(1); }
    raw.push(...readFileSync(path, "utf8").split(/\r?\n/));
  } else {
    raw.push(args[i]);
  }
}

// Normalize, drop comments/blanks, dedupe.
const emails = [...new Set(
  raw.map((s) => s.split("#")[0].trim().toLowerCase()).filter(Boolean),
)];

if (emails.length === 0) {
  console.error("No emails given. Pass them as args or via --file <path>.");
  process.exit(1);
}

// Warn (don't block) on emails that won't pass the domain half of the gate.
const offDomain = emails.filter((e) => !(e.endsWith(`@${domain}`) || e.endsWith(`.${domain}`)));
for (const e of offDomain) {
  console.warn(`! ${e} is not @${domain} — it will be allowlisted but still blocked by the domain gate.`);
}

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  let added = 0;
  for (const email of emails) {
    const r = await client.query(
      `insert into public.member_allowlist (email, note)
       values ($1, $2) on conflict (email) do nothing`,
      [email, "beta member"],
    );
    const isNew = r.rowCount === 1;
    if (isNew) added++;
    console.log(`  ${isNew ? "+" : "="} ${email}${isNew ? "" : " (already present)"}`);
  }
  const total = await client.query("select count(*)::int n from public.member_allowlist");
  console.log(`\n✓ ${added} added, ${emails.length - added} already present. Allowlist total: ${total.rows[0].n}`);
} catch (e) {
  console.error(`\n✗ failed: ${e.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
