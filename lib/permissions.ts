/**
 * Roles and write-permission model.
 *
 * Reads are open to every signed-in user (mirrors the RLS SELECT policies in
 * supabase/setup.sql). Writes are gated by role here in the UI to match the
 * RLS intent — the database is the real boundary; this just hides/disables
 * actions a role can't perform. Per-table write rules live in
 * supabase/roles-rls.sql.
 *
 * Role model, top to bottom:
 *   admin            — superuser: everything, plus user management & settings
 *   gm               — full *business* write access; no user mgmt / settings
 *   operations/sales/finance — domain write access
 *   executive_viewer — read-only oversight (no write domains at all)
 */

export type Role =
  | "admin"
  | "gm"
  | "operations"
  | "sales"
  | "finance"
  | "executive_viewer";

/** Every role, in seniority order — used by the admin screen's role picker. */
export const ROLES: Role[] = [
  "admin",
  "gm",
  "operations",
  "sales",
  "finance",
  "executive_viewer",
];

/** The minimal session shape shared between server (lib/auth) and client (SessionProvider). */
export type SessionUser = {
  id: string;
  email: string | null;
  role: Role | null;
};

/** Human-readable label for each role. */
export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  gm: "General Manager",
  operations: "Operations",
  sales: "Sales",
  finance: "Finance",
  executive_viewer: "Executive Viewer",
};

/** Type guard for role strings coming from the DB or a form post. */
export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as string[]).includes(value);
}

/**
 * Write domains each role owns. `admin` and `gm` write everything ("*").
 * Domains are coarse feature areas, referenced by RoleGate/canWrite.
 *
 * Not listed here, deliberately:
 *   - Discussions (channels/messages) is not domain-gated in the UI — it
 *     writes straight from the browser client, so RLS is its only gate and
 *     every role including executive_viewer may post. See roles-rls.sql.
 *   - Admin areas are gated by isAdmin(), never by canWrite() — gm is "*"
 *     and would otherwise pass a canWrite(gm, "users") check.
 */
const WRITE_DOMAINS: Record<Role, string[]> = {
  admin: ["*"],
  gm: ["*"],
  // contracts are admin/gm-only at the DB (see roles-rls.sql); sales writes
  // deals, not the contracts behind them. "prices" covers prices/price_feeds,
  // which anyone who trades, bills or buys UCO may record — no UI for it yet,
  // but the DB matrix allows it and the two should not drift.
  sales: ["deals", "prices", "tasks"],
  operations: ["production", "inventory", "logistics", "quality", "prices", "tasks"],
  finance: ["finance", "invoices", "prices", "tasks"],
  // Read-only oversight: no write domains, so canWrite() is false everywhere.
  executive_viewer: [],
};

/** Whether `role` may write within `domain`. */
export function canWrite(role: Role | null | undefined, domain: string): boolean {
  if (!role) return false;
  const domains = WRITE_DOMAINS[role];
  if (!domains) return false;
  return domains.includes("*") || domains.includes(domain);
}

/**
 * Whether `role` may reach admin-only areas (user management, system
 * settings/assumptions). Use this — never canWrite — to gate /admin: gm holds
 * "*" for business writes but is deliberately excluded from system powers.
 */
export function isAdmin(role: Role | null | undefined): boolean {
  return role === "admin";
}
