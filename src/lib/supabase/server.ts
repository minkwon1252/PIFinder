import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options?: CookieOptions };
import { publicEnv } from "@/lib/env";

/**
 * Server Supabase client bound to the request cookies. Uses the anon key, so
 * RLS still applies — this is the correct client for reading/writing user data
 * in server components and server actions.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component without a mutable cookie store.
          // Session refresh is handled in middleware, so this is safe to ignore.
        }
      },
    },
  });
}
