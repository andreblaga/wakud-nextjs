/**
 * Roles and write-permission model.
 *
 * Reads are open to every signed-in user (mirrors the RLS SELECT policies in
 * supabase/setup.sql). Writes are gated by role here in the UI to match the
 * RLS intent — the database is the real boundary; this just hides/disables
 * actions a role can't perform.
 */

export type Role = "gm" | "operations" | "sales" | "finance";

/** The minimal session shape shared between server (lib/auth) and client (SessionProvider). */
export type SessionUser = {
  id: string;
  email: string | null;
  role: Role | null;
};

/** Human-readable label for each role. */
export const ROLE_LABELS: Record<Role, string> = {
  gm: "General Manager",
  operations: "Operations",
  sales: "Sales",
  finance: "Finance",
};

/**
 * Write domains each role owns. `gm` writes everything ("*").
 * Domains are coarse feature areas, referenced by RoleGate/canWrite.
 */
const WRITE_DOMAINS: Record<Role, string[]> = {
  gm: ["*"],
  sales: ["deals", "contracts", "sales-forecast"],
  operations: ["production", "inventory", "logistics", "quality"],
  finance: ["finance", "invoices"],
};

/** Whether `role` may write within `domain`. */
export function canWrite(role: Role | null | undefined, domain: string): boolean {
  if (!role) return false;
  const domains = WRITE_DOMAINS[role];
  if (!domains) return false;
  return domains.includes("*") || domains.includes(domain);
}
