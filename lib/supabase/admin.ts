import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/** The non-null service-role client type. */
export type AdminSupabaseClient = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * Service-role Supabase client — bypasses RLS and can reach the Auth admin API
 * (createUser, listUsers, updateUserById).
 *
 * SERVER ONLY. The `server-only` import above makes importing this from a
 * client component a build error: SUPABASE_SERVICE_ROLE_KEY is not
 * NEXT_PUBLIC_-prefixed and must never reach the browser.
 *
 * Use this only for operations that genuinely need to escape RLS — user
 * provisioning in app/admin, and (later) the SharePoint sync job. Ordinary
 * reads and writes go through lib/supabase/server.ts so RLS still applies.
 *
 * Returns null when the key isn't configured, so the admin screen can show a
 * clear message instead of crashing.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createSupabaseClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
