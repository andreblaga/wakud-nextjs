import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { isAdmin, isRole, ROLE_LABELS, ROLES, type Role } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminUser } from "./types";
import NewUserForm from "./NewUserForm";
import UserRow from "./UserRow";

export const dynamic = "force-dynamic";

/** Rank for display order: most privileged first, unassigned last. */
function roleRank(role: Role | null): number {
  return role ? ROLES.indexOf(role) : ROLES.length;
}

export default async function AdminPage() {
  const session = await getSessionUser();
  // Not a security boundary on its own — each server action re-checks. This
  // just keeps the page out of non-admin hands.
  if (!isAdmin(session?.role)) redirect("/");

  const service = createAdminClient();
  if (!service) {
    return (
      <div>
        <PageHeader
          title="Admin"
          description="User provisioning & roles"
          icon={ShieldAlert}
        />
        <Card className="p-5 text-sm text-slate-600">
          <p className="font-medium text-slate-900">Service-role key missing</p>
          <p className="mt-1">
            User management needs <code className="rounded bg-slate-100 px-1">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
            set on the server. Add it to <code className="rounded bg-slate-100 px-1">.env.local</code> locally and to
            the Vercel project environment for production, then reload.
          </p>
        </Card>
      </div>
    );
  }

  const [{ data: authData, error: authError }, { data: roleRows }] = await Promise.all([
    service.auth.admin.listUsers({ perPage: 200 }),
    service.from("user_roles").select("user_id, role"),
  ]);

  const roleByUser = new Map<string, Role | null>(
    (roleRows ?? []).map((r) => {
      const row = r as { user_id: string; role: string };
      return [row.user_id, isRole(row.role) ? row.role : null];
    }),
  );

  const users: AdminUser[] = (authData?.users ?? [])
    .map((u) => {
      // banned_until is present on the admin API response but not in the
      // published User type; a future ban date means "deactivated".
      const bannedUntil = (u as { banned_until?: string | null }).banned_until ?? null;
      return {
        id: u.id,
        email: u.email ?? "(no email)",
        role: roleByUser.get(u.id) ?? null,
        active: !bannedUntil || new Date(bannedUntil) <= new Date(),
        lastSignInAt: u.last_sign_in_at ?? null,
      };
    })
    .sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.email.localeCompare(b.email));

  const unassigned = users.filter((u) => !u.role).length;

  return (
    <div>
      <PageHeader
        title="Admin"
        description="User provisioning & roles — admin only"
        icon={ShieldAlert}
      />

      {authError && (
        <Card className="mb-6 p-4 text-sm text-red-700">
          Couldn&apos;t load users: {authError.message}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Users <span className="font-normal text-slate-400">({users.length})</span>
              </h2>
              {unassigned > 0 && (
                <span className="text-xs text-amber-700">
                  {unassigned} without a role — they can sign in but can&apos;t do anything
                </span>
              )}
            </div>

            {users.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">
                No users yet. Create the first one on the right.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-2 font-medium">User</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium">Last sign-in</th>
                    <th className="px-5 py-2 text-right font-medium">Account</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <UserRow key={u.id} user={u} isSelf={u.id === session?.id} />
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <p className="mt-3 text-xs text-slate-400">
            Roles decide what each person can write. Reads are open to everyone signed in.{" "}
            {ROLE_LABELS.executive_viewer} is read-only across every module (but can take part in
            Discussions).
          </p>
        </div>

        <div>
          <NewUserForm />
        </div>
      </div>
    </div>
  );
}
