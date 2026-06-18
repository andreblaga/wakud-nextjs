import { createClient } from "@/lib/supabase/server";
import type { Role, SessionUser } from "@/lib/permissions";

/**
 * Resolve the current signed-in user and their role on the server.
 * Returns null when there is no session (or Supabase env isn't configured).
 *
 * Session refresh is handled in middleware.ts — here we only read.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = createClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle<{ role: Role }>();

  return {
    id: user.id,
    email: user.email ?? null,
    role: data?.role ?? null,
  };
}
