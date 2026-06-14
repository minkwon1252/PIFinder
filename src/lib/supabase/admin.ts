import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * SERVICE-ROLE client. Bypasses RLS. NEVER import this into a client component.
 * The "server-only" import above makes the build fail if that is attempted.
 *
 * Use ONLY for:
 *   - the membership gate (reading member_allowlist before a profile exists)
 *   - writing audit_logs
 *   - admin bootstrap
 *   - trusted server-side migrations/seeds
 */
export function createAdminClient() {
  const { serviceRoleKey } = serverEnv();
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return createClient(publicEnv.supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
