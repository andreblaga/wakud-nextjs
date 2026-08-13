# WakudOS — Remaining Work / Go-Live Plan

_Compiled 2026-08-13. Consolidated view of everything left before the app is production-ready with real Wakud data. `project.md` + `BUILD-PLAN.md` stay the execution source of truth; this is the prioritised remaining-scope map. Owners in [brackets]._

## Decisions captured (2026-08-13, from Andre)

- **PDF export/generate:** build for **invoices, ISCC / Proof-of-Sustainability docs, finance & forecast reports, and a generic per-page snapshot** — with designed **templates** for each.
- **Admin role:** new top-level role = **superuser, above GM**. Admin (Andre) does everything: user & role management, system settings, assumptions. **GM is deliberately restricted** from those system-level things — GM keeps full *business* access only.
- **Executive-viewer role (new):** read-only across the whole app — sees everything, edits nothing, no settings. For the Utopia execs (oversight without data entry). Keeps `admin` uniquely Andre's.

## User roster & role model (confirmed 2026-08-13)

Role model (top → bottom): **admin** (superuser) → **executive-viewer** (read-only, all modules) → **gm** (business full-access, no system settings/assumptions/user-mgmt) → **operations / sales / finance** (domain write access).

| Name | Email | Title | Role |
|---|---|---|---|
| Andre Blaga | andre@the-utopia.world | UWB Asset Development Manager | **admin** |
| John Jones | john@the-utopia.world | UWB COO | **executive-viewer** |
| Faris Al Kharusi | faris@the-utopia.world | UWI CEO (primary shareholder) | **executive-viewer** |
| Yawar Abbas Naqvi | yawar@the-utopia.world | UWI CPO | **executive-viewer** |
| Abdulrahman Al Busaidi | abdulrahman@wakud.com | General Manager | **gm** |
| Tariq Al Wahaibi | tariq@wakud.com | Operations Manager | **operations** |
| Salim Al-Shabibi | salim@wakud.com | Chemical Engineer | **operations** |
| Thasleem Ali | thasleem@wakud.com | Chemical Engineer | **operations** |

_Open: no dedicated **Sales** or **Finance** role-holder in the roster — those modules are covered by admin/gm for now unless Andre assigns owners._


- **Live updates:** middle-path recommendation below (live on high-collision pages, auto-refresh elsewhere). Andre to confirm.

## P0 — Urgent / foundational (do first)

1. **Verify all migrations ran on the CORRECT project** (`ftrtekdiabttvjlfgisy` — not the Catchment project), in order: `setup.sql`, `grant-privileges.sql`, `phase3-audit-log-policy.sql`, `phase4-tasks.sql`, `phase4-discussions.sql` (+ enable Realtime), `roles-admin-viewer.sql`, **`roles-rls.sql`** (new — the security lock-down), `assign-roles.sql`. Audit log / tasks / discussions each depend on one. [Andre — Supabase]
2. **Set production env vars in Vercel** (the deployed app cannot see your laptop's `.env.local`): Supabase URL / anon / service-role, `MS_TENANT_ID` / `MS_CLIENT_ID` / `MS_CLIENT_SECRET`, `SHAREPOINT_SITE_URL`. Without this the SharePoint sync and server-side features won't work in production. [Andre — Vercel]
3. ~~**RLS hardening**~~ — ✅ **built 2026-08-13** (`supabase/roles-rls.sql`). Per-role write matrix replaces every permissive `WITH CHECK (true)` policy; the `user_roles` self-insert hole is dropped; **anon read access removed entirely** — `setup.sql` had let signed-out users read deals/contracts/production/stock/prices/forecast over the REST API using the browser-bundled anon key, and made the documents bucket public. **Andre: run the migration**, then spot-check with the verification queries at the bottom of the file. [Claude Code]

## P1 — Access & security

4. ~~**Admin role (above GM)**~~ — ✅ **built 2026-08-13.** `admin` + `executive_viewer` in `lib/permissions.ts` (six roles), `isAdmin()` gates admin areas, and the DB enforces the same via `has_any_role()`/`is_admin()`. GM keeps business-full-access, loses user management and settings. Note: system **assumptions** are still in code (`DEAL_ASSUMPTIONS`) — moving them to an admin-editable settings table is the remaining piece of this item. [Claude Code]
5. ~~**User provisioning + Admin screen**~~ — ✅ **built 2026-08-13.** `/admin` lists users with role + last sign-in, creates accounts (service-role client, server-only), changes roles, deactivates/reactivates. **Remaining: the eight accounts still need creating** — either through `/admin` or Supabase Auth + `supabase/assign-roles.sql`. [Andre]
6. **Auth hardening:** ~~password reset~~ **partly done 2026-08-13** — an admin can now reset any user's password from `/admin` (one click, new temp password shown once). Still to build: **self-serve** reset for the user themselves, email confirmation, session timeout. A forgotten password is no longer a dashboard fix, but it does still need Andre. [Claude Code]

## P2 — Correctness & data

7. **Finance sign-off** on the deal-economics assumptions (VAT treatment, funding rate, glycerin yield/price, go/no-go thresholds) — see `docs/deal-economics.md`. Profit/margin figures are provisional until confirmed. [Finance / Andre]
8. **SharePoint sync (Phase 5):** team confirms canonical source workbooks (candidate map already shared), then build the read-only sync per `docs/sharepoint-integration.md`. [Team confirm · Claude Code + Cowork]
9. **Initial data load:** first sync (or CSV import) so pages show real data instead of empty states. [after #8]

## P3 — Features

10. **PDF export + templates:** invoices, ISCC/PoS, finance/forecast reports, per-page snapshot. Design templates first, then wire generation. [Cowork drafts templates · Claude Code wires]
11. **Realtime** per the agreed scope (below). [Claude Code]
12. **AI assistant (Phase 6):** Q&A over live data — final phase. [later]

## P4 — Ops (recommended)

13. Automated Supabase backups; custom domain instead of the `vercel.app` URL.

## Realtime recommendation

Don't subscribe every table — it adds connection load and complexity for pages that rarely see concurrent edits. Proposed split:

- **Live (realtime subscribe):** Deals, Inventory / Stock, Production, Alerts / Dashboard.
- **Auto-refresh (on save + on window focus):** Sales Forecast, Contracts, Finance / Invoices, Logistics, ISCC, Change Log.

Feels "always current" everywhere while only paying the realtime cost where collisions actually happen; any page can be promoted to fully live later.
