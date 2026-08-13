import type { Role } from "@/lib/permissions";

/** One row of the admin user table: auth account + assigned role. */
export type AdminUser = {
  id: string;
  email: string;
  role: Role | null;
  /** False when the account is banned (our "deactivated"). */
  active: boolean;
  lastSignInAt: string | null;
};
