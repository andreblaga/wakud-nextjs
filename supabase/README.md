# Database setup

This app uses **Supabase** (hosted Postgres + Auth + Storage). The schema is defined here so it lives with the app.

## First-time setup

1. Create a Supabase project at **supabase.com** (use an account you own).
2. Open **SQL Editor → New query**, paste all of **`setup.sql`**, and **Run**. This creates all 23 tables, security rules (RLS), and the `wakud-documents` storage bucket. It's idempotent — safe to re-run.
3. Create your users in **Authentication → Users** (tick *Auto Confirm*).
4. Edit the email/role lines in **`assign-roles.sql`** to match those users, then run it in the SQL Editor. Roles: `gm`, `operations`, `sales`, `finance`.
5. Copy your **Project URL** and **anon public key** (Settings → API) into the app's `.env.local` (local) and into Vercel/Render env vars (deployed).

## Notes

- The schema starts **empty** — no demo data. Load real data through the app or via CSV import using the templates in [`data-templates/`](./data-templates) (see its README for column formats). A non-developer walkthrough is in [`SETUP-CHECKLIST.md`](./SETUP-CHECKLIST.md).
- `setup.sql` here is the same verified schema from the migration kit; it has been tested against a real Postgres.
- RLS policies are currently permissive (prototype). Tighten before production use with real data.
