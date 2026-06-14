#!/usr/bin/env node
/**
 * Applies SQL migrations in supabase/migrations in order, using the `pg` driver
 * (no `psql` binary required). Each file is sent as a single statement so that
 * dollar-quoted functions and DO blocks execute correctly, within one implicit
 * transaction per file.
 *
 * Requires SUPABASE_DB_URL (see .env.example). For Supabase use the direct
 * connection or session pooler URI (port 5432).
 *
 * Usage:
 *   node --env-file=.env.local scripts/db-migrate.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

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

const client = new pg.Client({
  connectionString: dbUrl,
  // Supabase requires SSL; the managed cert chain is trusted by Supabase but
  // we relax verification to avoid local CA issues.
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  for (const file of files) {
    const sql = readFileSync(join(dir, file), "utf8");
    process.stdout.write(`→ applying ${file} ... `);
    await client.query(sql);
    console.log("ok");
  }
  console.log("✓ all migrations applied");
} catch (e) {
  console.error(`\n✗ migration failed: ${e.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
