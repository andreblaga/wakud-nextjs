import "server-only";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { createClient, type ServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient, type AdminSupabaseClient } from "@/lib/supabase/admin";
import type { FormState } from "@/lib/form-state";

export type AdminContext = {
  /** Service-role client: Auth admin API + RLS-free writes to user_roles. */
  service: AdminSupabaseClient;
  /** The acting admin's own session client — used so audit rows are stamped with them. */
  supabase: ServerSupabaseClient;
  userId: string;
};

/**
 * Gate an admin-only action server-side.
 *
 * Deliberately checks isAdmin(), not canWrite(): gm holds "*" for business
 * writes and would pass any canWrite() check, but must not reach user
 * management or system settings.
 *
 * Every admin server action calls this itself — the page-level redirect in
 * app/admin/page.tsx hides the UI but is not a security boundary, since server
 * actions are reachable by direct POST.
 */
export async function requireAdmin(): Promise<{ admin: AdminContext } | { error: FormState }> {
  const user = await getSessionUser();
  if (!user) return { error: { ok: false, formError: "You must be signed in." } };
  if (!isAdmin(user.role)) {
    return { error: { ok: false, formError: "Admin only — your role can't manage users." } };
  }

  const supabase = createClient();
  if (!supabase) return { error: { ok: false, formError: "Supabase isn't configured." } };

  const service = createAdminClient();
  if (!service) {
    return {
      error: {
        ok: false,
        formError:
          "SUPABASE_SERVICE_ROLE_KEY isn't set on the server — user management is unavailable.",
      },
    };
  }

  return { admin: { service, supabase, userId: user.id } };
}
