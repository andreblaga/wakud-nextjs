"use client";

// eslint-disable-next-line import/no-unresolved
import { useFormState, useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { ROLES, ROLE_LABELS } from "@/lib/permissions";
import type { AdminUser } from "./types";
import SecretNotice from "./SecretNotice";
import { setUserRole, setUserActive, resetPassword } from "./actions";

function formatDate(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Submits on change — no separate Save button per row. */
function RoleSelect({ role }: { role: string }) {
  const { pending } = useFormStatus();
  return (
    <span className="inline-flex items-center gap-1.5">
      <select
        name="role"
        defaultValue={role}
        disabled={pending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:opacity-60"
      >
        {role === "" && <option value="">— no role —</option>}
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
      {pending && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
    </span>
  );
}

function ActiveButton({ active }: { active: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-lg px-2.5 py-1 text-xs font-medium disabled:opacity-60 ${
        active
          ? "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          : "bg-amber-50 text-amber-800 hover:bg-amber-100"
      }`}
    >
      {pending ? "…" : active ? "Deactivate" : "Reactivate"}
    </button>
  );
}

function ResetButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-60"
    >
      {pending ? "…" : "Reset password"}
    </button>
  );
}

export default function UserRow({ user, isSelf }: { user: AdminUser; isSelf: boolean }) {
  const [roleState, roleAction] = useFormState(setUserRole, INITIAL_FORM_STATE);
  const [activeState, activeAction] = useFormState(setUserActive, INITIAL_FORM_STATE);
  const [resetState, resetAction] = useFormState(resetPassword, INITIAL_FORM_STATE);
  const error = roleState.formError ?? activeState.formError ?? resetState.formError;

  return (
    <>
      <tr className="border-b border-slate-50 align-middle">
        <td className="px-5 py-3">
          <span className={user.active ? "text-slate-900" : "text-slate-400 line-through"}>
            {user.email}
          </span>
          {isSelf && <span className="ml-2 text-[11px] text-slate-400">you</span>}
          {!user.role && (
            <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
              no role
            </span>
          )}
          {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
        </td>

        <td className="px-3 py-3">
          <form action={roleAction}>
            <input type="hidden" name="user_id" value={user.id} />
            <RoleSelect role={user.role ?? ""} />
          </form>
        </td>

        <td className="px-3 py-3 text-xs text-slate-500">{formatDate(user.lastSignInAt)}</td>

        <td className="px-5 py-3">
          <div className="flex items-center justify-end gap-1">
            <form
              action={resetAction}
              onSubmit={(e) => {
                if (
                  !window.confirm(
                    `Reset the password for ${user.email}? Their current password stops working immediately.`,
                  )
                ) {
                  e.preventDefault();
                }
              }}
            >
              <input type="hidden" name="user_id" value={user.id} />
              <ResetButton />
            </form>

            {isSelf ? (
              <span className="px-2.5 text-xs text-slate-300">—</span>
            ) : (
              <form action={activeAction}>
                <input type="hidden" name="user_id" value={user.id} />
                <input type="hidden" name="active" value={String(!user.active)} />
                <ActiveButton active={user.active} />
              </form>
            )}
          </div>
        </td>
      </tr>

      {/* Full-width row: the new password needs room, and it's shown only once. */}
      {resetState.ok && (
        <tr className="border-b border-slate-50">
          <td colSpan={4} className="px-5 pb-3">
            <SecretNotice message={resetState.message} secret={resetState.secret} />
          </td>
        </tr>
      )}
    </>
  );
}
