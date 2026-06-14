#!/usr/bin/env node
/**
 * Applies SQL migrations in supabase/migrations in order, using `psql`.
 * Requires SUPABASE_DB_URL (see .env.example) and the `psql` client installed.
 *
 * Usage:
 *   SUPABASE_DB_URL=postgres://... node scripts/db-migrate.mjs
 * Or with a dotenv loader:
 *   node --env-file=.env.local scripts/db-migrate.mjs
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("ERROR: SUPABASE_DB_URL is not set. See .env.example.");
  process.exit(1);
}

const dir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.error("No migration files found in supabase/migrations.");
  process.exit(1);
}

for (const file of files) {
  const path = join(dir, file);
  console.log(`→ applying ${file}`);
  try {
    execFileSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-f", path], {
      stdio: "inherit",
    });
  } catch (e) {
    console.error(`✗ migration ${file} failed`);
    process.exit(1);
  }
}
console.log("✓ all migrations applied");
