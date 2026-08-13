# Database setup

This app uses **Supabase** (hosted Postgres + Auth + Storage). The schema is defined here so it lives with the app.

## First-time setup

1. Create a Supabase project at **supabase.com** (use an account you own).
2. Open **SQL Editor → New query**, paste all of **`setup.sql`**, and **Run**. This creates all 23 tables, security rules (RLS), and the `wakud-documents` storage bucket. It's idempotent — safe to re-run.
3. Run the remaining migrations **in this order** — each is idempotent:
   `grant-privileges.sql` → `phase3-audit-log-policy.sql` → `phase4-tasks.sql` → `phase4-discussions.sql` → `roles-admin-viewer.sql` → **`roles-rls.sql`**.
4. Create your users in **Authentication → Users** (tick *Auto Confirm*), or add them from the app's `/admin` screen once it's deployed.
5. Edit the email/role lines in **`assign-roles.sql`** to match those users, then run it in the SQL Editor. Roles: `admin`, `gm`, `operations`, `sales`, `finance`, `executive_viewer`.
6. Copy your **Project URL** and **anon public key** (Settings → API) into the app's `.env.local` (local) and into Vercel/Render env vars (deployed). `/admin` also needs the **service_role** key as `SUPABASE_SERVICE_ROLE_KEY` — server-side only, never `NEXT_PUBLIC_`.

## Notes

- The schema starts **empty** — no demo data. Load real data through the app or via CSV import using the templates in [`data-templates/`](./data-templates) (see its README for column formats). A non-developer walkthrough is in [`SETUP-CHECKLIST.md`](./SETUP-CHECKLIST.md).
- `setup.sql` here is the same verified schema from the migration kit; it has been tested against a real Postgres.
- **`roles-rls.sql` is the security boundary** — it replaces `setup.sql`'s permissive prototype policies with a per-role write matrix, removes all signed-out (`anon`) read access, and makes the documents bucket private. Run it before real data lands. `setup.sql` is left as-is (it's the base schema); anything it grants that `roles-rls.sql` later revokes is intentional.
