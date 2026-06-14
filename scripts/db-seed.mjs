#!/usr/bin/env node
/**
 * Seeds reference data (schools, departments, screening questions, sample
 * professors) from supabase/seed.sql, using the `pg` driver (no `psql` binary
 * required). The seed is written to be safe to re-run (uses ON CONFLICT).
 *
 * Requires SUPABASE_DB_URL (see .env.example). For Supabase use the direct
 * connection or session pooler URI (port 5432).
 *
 * Usage:
 *   node --env-file=.env.local scripts/db-seed.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("ERROR: SUPABASE_DB_URL is not set. See .env.example.");
  process.exit(1);
}

const path = join(process.cwd(), "supabase", "seed.sql");

const client = new pg.Client({
  connectionString: dbUrl,
  // Supabase requires SSL; the managed cert chain is trusted by Supabase but
  // we relax verification to avoid local CA issues.
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log("→ seeding from supabase/seed.sql ...");
  await client.query(readFileSync(path, "utf8"));
  console.log("✓ seed complete");
} catch (e) {
  console.error(`\n✗ seed failed: ${e.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
