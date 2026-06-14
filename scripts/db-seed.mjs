#!/usr/bin/env node
/**
 * Seeds reference data (schools, departments, screening questions, sample
 * professors) via `psql`. Safe to re-run (uses ON CONFLICT).
 *
 * Usage:
 *   node --env-file=.env.local scripts/db-seed.mjs
 */
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("ERROR: SUPABASE_DB_URL is not set. See .env.example.");
  process.exit(1);
}

const path = join(process.cwd(), "supabase", "seed.sql");
console.log("→ seeding from supabase/seed.sql");
try {
  execFileSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-f", path], {
    stdio: "inherit",
  });
  console.log("✓ seed complete");
} catch {
  console.error("✗ seed failed");
  process.exit(1);
}
