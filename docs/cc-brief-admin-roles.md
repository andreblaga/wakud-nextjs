# Claude Code Brief — Admin & Executive-Viewer roles + user provisioning

_Written 2026-08-13 for a fresh Claude Code session. Self-contained. Implements the P1 "access & security" items from `docs/go-live-plan.md`._

## Context (read these first)

WakudOS is a Next.js 14 (App Router) + TypeScript + Tailwind app backed by Supabase, managing a biodiesel facility (Barka, Oman). Shared source of truth: **`project.md`**; phased plan: **`BUILD-PLAN.md`**; remaining-work map: **`docs/go-live-plan.md`**. Phases 0–4 are built (auth, live read pages, write flows, Excel export, tasks, discussions, notifications). Keep `next` pinned at **14.2.35**.

Current role model lives in **`lib/permissions.ts`**: `Role = "gm" | "operations" | "sales" | "finance"`, with `ROLE_LABELS`, `WRITE_DOMAINS` (`gm: ["*"]`), and `canWrite(role, domain)`. Role is resolved server-side in **`lib/auth.ts`** (`getSessionUser`) from the `user_roles` table and shared to the client via **`components/SessionProvider.tsx`**; write UI is gated by **`components/RoleGate.tsx`**. DB helper `public.has_role(_user_id, _role)` is **generic** — it matches any role string, so it needs no change.

## Decision being implemented

Two new roles (confirmed by Andre):

- **`admin`** — superuser, sits **above** GM. Full business write access **plus** the things GM must NOT touch: user/role management and system settings/assumptions. Andre is the only admin.
- **`executive_viewer`** — **read-only** across every module (oversight for the Utopia execs). No writes, no admin areas.

GM keeps full *business* write access but **loses** user management and system-settings/assumptions.

## Already done (DB)

`supabase/roles-admin-viewer.sql` widens the `user_roles` CHECK constraint to allow `admin` and `executive_viewer`. Assume it has been run (verify: `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.user_roles'::regclass AND contype='c';` should list all six roles). `lib/supabase/types.ts` needs no regen for this (the column is `text`, not an enum).

## Task A — extend the role model in code

In `lib/permissions.ts`:

- Add both roles to the `Role` union and to `ROLE_LABELS` (`admin: "Admin"`, `executive_viewer: "Executive Viewer"`).
- `WRITE_DOMAINS`: `admin: ["*"]`; `executive_viewer: []` (no write domains).
- Add a helper `export function isAdmin(role: Role | null | undefined): boolean` returning `role === "admin"`. Use this — **not** `canWrite` — to gate admin-only areas, because `gm` is `["*"]` and would otherwise pass a `canWrite(gm, "users")` check.
- Confirm `canWrite(executive_viewer, anything)` returns `false` (empty domains → it will).

## Task B — RLS updates (new migration, e.g. `supabase/roles-rls.sql`)

Current policies in `supabase/setup.sql` reference `has_role(auth.uid(),'gm')`. Update:

- **Role management → admin-only.** Replace policy `"GM can manage roles"` on `user_roles` with an admin equivalent (`USING (public.has_role(auth.uid(),'admin'))`). This enforces "GM can't manage users" at the DB.
- **Remove the self-escalation hole.** Drop policy `"Users can insert own role"` on `user_roles` — it currently lets any authenticated user insert their *own* role row with any value (self-promote to gm). Provisioning is admin-only now.
- **Contracts:** add `admin` alongside `gm` on `"GM can manage contracts"` / `"GM can update contracts"` (admin is a superuser).
- **Note / defer:** most data tables still have permissive `"Auth can insert ... WITH CHECK (true)"` policies, so at the DB level *any* signed-in user (including `executive_viewer`) can still write. Making `executive_viewer` a **true** read-only role at the database requires the broader **RLS hardening** workstream (P0 in the go-live plan) — tightening every table's write policy to the owning role(s) and excluding `executive_viewer`. Until then, exec read-only is **UI-enforced only**. Call this out to Andre; ideally do the RLS hardening in the same pass.

## Task C — Admin / provisioning screen

Add an **`/admin`** route, gated with `isAdmin` (redirect others). It should let the admin:

- List users + their roles; add a user (email + role), change a role, deactivate.
- Creating an auth user requires the **service-role** client (`supabase.auth.admin.createUser`) in a server action — never expose the service key to the client. Read `SUPABASE_SERVICE_ROLE_KEY` server-side only (already in env). On create, also insert the `user_roles` row.
- (Follow-on, lower priority) a **Settings** area under `/admin` for system assumptions — today the deal-economics assumptions live in code (`DEAL_ASSUMPTIONS` in `lib/deal-economics.ts`); moving them to a DB-backed settings table editable by admin is the eventual goal. Gate any settings UI with `isAdmin`.

Also hide/disable any existing GM-only management entry points for user/role/settings and move them behind `isAdmin`.

## Task D — register the eight staff

Two paths: (a) build Task C then add them through the UI, or (b) interim — Andre creates the users in Supabase Auth (Add user, Auto-Confirm) and runs the updated **`supabase/assign-roles.sql`** (already updated with the real roster). Roster:

| Email | Role |
|---|---|
| andre@the-utopia.world | admin |
| john@the-utopia.world | executive_viewer |
| faris@the-utopia.world | executive_viewer |
| yawar@the-utopia.world | executive_viewer |
| abdulrahman@wakud.com | gm |
| tariq@wakud.com | operations |
| salim@wakud.com | operations |
| thasleem@wakud.com | operations |

(No dedicated Sales/Finance holder yet — those modules fall to admin/gm until Andre assigns owners.)

## Acceptance criteria

- `admin` and `executive_viewer` are valid everywhere (types compile, labels show, no runtime "unknown role").
- Signed in as `executive_viewer`: every create/edit/delete control is hidden/disabled; read pages work.
- Signed in as `gm`: business writes work, but **no** access to `/admin`, user management, or settings.
- Signed in as `admin`: full access incl. `/admin` user management.
- `user_roles` self-insert policy is gone; role management works only as admin.
- `next build` passes; `next` still 14.2.35.
- If RLS hardening is out of scope for this pass, leave a clear note that exec read-only is UI-only for now.

## Coordination

Update the checkboxes in `BUILD-PLAN.md` (P1 rows) and note progress in `project.md` §9a so we don't collide. This brief covers roles + provisioning only; other remaining work (SharePoint sync, PDF export, realtime, finance sign-off) is in `docs/go-live-plan.md`.
