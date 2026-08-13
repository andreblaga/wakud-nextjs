"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin";
import { zodErrors } from "@/lib/form-actions";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/permissions";
import type { FormState } from "@/lib/form-state";

const roleSchema = z.enum(ROLES as [Role, ...Role[]]);

const newUserSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  role: roleSchema,
  // Blank means "generate one for me".
  password: z.string().trim().min(8, "At least 8 characters").optional().or(z.literal("")),
});

/** A readable, high-entropy temporary password (~19 chars, url-safe). */
function generatePassword(): string {
  return `Wakud-${randomBytes(9).toString("base64url")}`;
}

/**
 * Create an auth user and assign their role, in one step.
 *
 * Uses the service-role client: creating auth users is not something the anon
 * key can do. The user is created pre-confirmed with a temporary password,
 * which is returned once in the form state for the admin to pass on — there is
 * no self-serve password reset yet (P1 auth hardening).
 */
export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { admin } = gate;

  const parsed = newUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };

  const email = parsed.data.email.toLowerCase();
  const role = parsed.data.role;
  const password = parsed.data.password ? parsed.data.password : generatePassword();
  const generated = !parsed.data.password;

  const { data, error } = await admin.service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) return { ok: false, formError: error.message };

  const userId = data.user?.id;
  if (!userId) return { ok: false, formError: "User was created but no id came back." };

  // Service client: user_roles is admin-only at the DB, and this write is the
  // one that makes the account usable.
  const { error: roleError } = await admin.service
    .from("user_roles")
    .upsert({ user_id: userId, role } as never, { onConflict: "user_id" });
  if (roleError) {
    return {
      ok: false,
      formError: `Account created for ${email}, but the role failed to save: ${roleError.message}. Set it below.`,
    };
  }

  await logAudit(admin.supabase, {
    userId: admin.userId,
    action: "create",
    entityType: "user",
    entityId: userId,
    newValue: { email, role },
  });

  revalidatePath("/admin");
  return {
    ok: true,
    message: generated
      ? `Created ${email} as ${ROLE_LABELS[role]}. Temporary password: ${password} — copy it now, it won't be shown again.`
      : `Created ${email} as ${ROLE_LABELS[role]}.`,
  };
}

/** Change an existing user's role. */
export async function setUserRole(_prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { admin } = gate;

  const userId = String(formData.get("user_id") ?? "");
  const parsedRole = roleSchema.safeParse(formData.get("role"));
  if (!userId || !parsedRole.success) return { ok: false, formError: "Pick a valid user and role." };
  const role = parsedRole.data;

  // Guard against the last admin locking themselves out of user management.
  if (userId === admin.userId && role !== "admin") {
    return { ok: false, formError: "You can't remove your own admin role." };
  }

  const { data: existing } = await admin.service
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle<{ role: string }>();

  const { error } = await admin.service
    .from("user_roles")
    .upsert({ user_id: userId, role } as never, { onConflict: "user_id" });
  if (error) return { ok: false, formError: error.message };

  await logAudit(admin.supabase, {
    userId: admin.userId,
    action: "update",
    entityType: "user_role",
    entityId: userId,
    oldValue: existing,
    newValue: { role },
  });

  revalidatePath("/admin");
  return { ok: true, message: `Role updated to ${ROLE_LABELS[role]}.` };
}

/**
 * Deactivate or reactivate an account.
 *
 * Ban rather than delete: audit_log and deals reference auth.users(id), so a
 * delete would either cascade or fail. A banned user cannot sign in and their
 * existing sessions stop refreshing.
 */
export async function setUserActive(_prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { admin } = gate;

  const userId = String(formData.get("user_id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!userId) return { ok: false, formError: "No user selected." };

  if (userId === admin.userId && !active) {
    return { ok: false, formError: "You can't deactivate your own account." };
  }

  const { error } = await admin.service.auth.admin.updateUserById(userId, {
    // ~100 years for "off"; "none" clears the ban.
    ban_duration: active ? "none" : "876000h",
  });
  if (error) return { ok: false, formError: error.message };

  await logAudit(admin.supabase, {
    userId: admin.userId,
    action: "update",
    entityType: "user",
    entityId: userId,
    newValue: { active },
  });

  revalidatePath("/admin");
  return { ok: true, message: active ? "Account reactivated." : "Account deactivated." };
}
