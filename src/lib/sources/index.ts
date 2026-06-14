import { MockAdapter } from "./mock";
import { OpenAlexAdapter } from "./openalex";
import { SemanticScholarAdapter } from "./semantic-scholar";
import { OfficialPageAdapter } from "./official-page";
import type { ProfessorSourceAdapter } from "./types";

export * from "./types";

/**
 * Source registry. The MVP pipeline uses the mock adapter; set the env-driven
 * flag (or pass `live: true`) to enable real adapters in Phase 3.
 */
export function getSourceAdapters(opts?: { live?: boolean }): ProfessorSourceAdapter[] {
  if (opts?.live) {
    return [
      new OfficialPageAdapter(),
      new OpenAlexAdapter(),
      new SemanticScholarAdapter(),
    ];
  }
  return [new MockAdapter()];
}
