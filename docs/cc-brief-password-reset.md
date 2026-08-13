# Claude Code Brief — Admin: per-user password reset button

_Written 2026-08-13. Small addition to the existing `/admin` screen. Fits alongside the auth-hardening work._

## Goal

On `/admin`, add a per-user **"Reset password"** action (in the ACCOUNT column, next to Deactivate) that lets an admin regenerate a user's password in one click and see the new temporary password once. This is the admin-driven counterpart to the self-serve reset (which is separate, still pending).

## Server action — `app/admin/actions.ts`

Add `resetPassword(_prev, formData)`, mirroring `setUserActive`:

- Gate with `requireAdmin()` (same as the others).
- Read `user_id` from `formData`. Read optional `password`; **blank → generate** via the existing `generatePassword()`.
- Call `admin.service.auth.admin.updateUserById(userId, { password })`.
- `logAudit(admin.supabase, { userId: admin.userId, action: "update", entityType: "user", entityId: userId, newValue: { password_reset: true } })`. **Do NOT put the plaintext password in the audit log, logs, or anywhere persistent.**
- `revalidatePath("/admin")`.
- Return, echoing the password **once** only when generated:
  - generated: `{ ok: true, message: "Password reset for {email}. New temporary password: {password} — copy it now, it won't be shown again." }`
  - admin typed their own: `{ ok: true, message: "Password updated for {email}." }`
- No self-guard needed (an admin resetting their own password is fine).

## UI — `app/admin/UserRow.tsx`

- Add a third `useFormState(resetPassword, INITIAL_FORM_STATE)` and a small **"Reset password"** button in the ACCOUNT cell beside `ActiveButton` (a subtle text button, same sizing).
- Wrap it in a `<form action={resetAction}>` with a hidden `user_id`. Default behaviour = generate (omit the password field). MVP is one-click generate; a custom-password input is optional/nice-to-have.
- Add a `confirm()` on submit ("Reset this user's password? Their current password stops working.") to avoid accidents.
- **Surface the returned password prominently and once** — the row currently only renders `error`. Add a success line (e.g. green, monospace) showing `resetState.message` with the new password, ideally with a copy-to-clipboard button, since it isn't retrievable later. Include the reset state's `formError` in the existing error display too.

## Acceptance

- Admin clicks Reset on a user → confirm → new temp password shown once, copyable; the user can sign in with it immediately.
- Plaintext password never hits the audit log or server logs.
- Action re-checks `requireAdmin` (defence in depth — server actions are reachable by direct POST).
- `next build` passes; `next` stays 14.2.35.
- Update `BUILD-PLAN.md` / `project.md` §9a as usual.
