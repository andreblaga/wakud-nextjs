# WakudOS — Build Plan (for Claude Code)

This is the working roadmap for building WakudOS out from the current first-pass scaffold to a functioning app. Work top-to-bottom; phases are ordered by dependency. `project.md` is the product source of truth; `BACKLOG.md` holds parked items.

## Ground rules & conventions

- **Stack:** Next.js 14.2.35 (App Router) · TypeScript · Tailwind · Supabase (`@supabase/ssr`). Stay on Next 14 — do **not** `npm audit fix --force` (it breaks the pin).
- **Data access:** server components/route handlers use `lib/supabase/server.ts`; client components use `lib/supabase/client.ts`. Both return `null` when env is unset — handle that path so pages don't crash pre-connection.
- **DB types:** generate once Supabase is connected — `npx supabase gen types typescript --project-id <id> > lib/supabase/types.ts` — and type `createClient<Database>()`.
- **Schema is fixed** in `supabase/setup.sql` (23 tables). Don't redefine tables in code; if a schema change is needed, add a new migration SQL file under `supabase/` and note it in `project.md`.
- **Reuse the design system** in `components/ui.tsx` (`Card`, `StatCard`, `PageHeader`, `StatusBadge`). Replace `PlaceholderPanel` with a real reusable `DataTable`. Keep `lib/nav.ts` as the single nav source.
- **Roles:** `admin` (superuser: + user mgmt & settings), `gm` (full business), `operations`, `sales`, `finance`, `executive_viewer` (read-only). Reads open to all signed-in users; gate **writes** by role via `canWrite`/`RoleGate`, and admin-only areas via `isAdmin` (never `canWrite` — gm is `"*"`). The per-table write matrix lives in `supabase/roles-rls.sql`; keep it and `lib/permissions.ts` in step.
- **Currency:** USD primary; OMR via the `exchange_rates` peg (0.385). Build one currency helper; don't hardcode the rate in components.
- After each phase: `npm run build` must pass, and update the relevant checkboxes here + notes in `project.md`.

---

## Phase 0 — Connect Supabase (unblocks everything)
- [x] Andre creates his Supabase project and runs `supabase/setup.sql` + `assign-roles.sql` (see `supabase/SETUP-CHECKLIST.md`).
- [x] Add `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`.
- [x] Generate `lib/supabase/types.ts` and type `createClient<Database>()` in both `lib/supabase/client.ts` and `server.ts`.
- [x] **Andre: run `supabase/grant-privileges.sql`** in the SQL Editor — `setup.sql` omitted table GRANTs, so live queries 401 with `42501` until this runs.
- **Done when:** a signed-out `createClient()` no longer returns null locally and a trivial query (e.g. count of `deals`) succeeds. ✅ _(verified: anon read of all anon-policy tables returns 200; all tables currently empty.)_

## Phase 1 — Auth & access control
- [x] Wire `app/login/page.tsx` to Supabase email/password sign-in (make it a client component / server action).
- [x] Add middleware for session refresh + route protection; redirect unauthenticated users to `/login`.
- [x] Load the current user's role; expose via a context/provider. Make `TopBar` show the real user + role (replace the hardcoded "GM").
- [x] Hide/disable write actions the role can't perform. (`lib/permissions.ts` + `RoleGate`; applied to Deals "New deal".)
- **Done when:** seeded users (gm/ops/sales/finance) can log in, see role-appropriate UI, and log out. ✅ _(GM login verified by Andre; route protection verified headless.)_

## Phase 2 — Wire core read pages to live data
Replace placeholders with real queries + a reusable `DataTable`. One PR per page is fine.
- [x] **Dashboard** — real KPIs (active deals, committed volume, forecast profit, working capital) + `monthly_forecast` chart + live `system_alerts`.
- [x] **Deals** — list from `deals` with status badges, filters, and the margin/profit columns.
- [x] **Sales Forecast** — `contracts` + `contract_volumes` + `monthly_forecast`.
- [x] **Production** — `production_plan` vs actual; `quality_tests`.
- [x] **Inventory** — `stock_levels` (UCO + B100) + `raw_material_orders` with below-safety reorder flags. (UCO intake table is a Phase 4 module — surfaced as a pending card.)
- [x] **Logistics** — `shipments`.
- [x] **Finance** — `invoices` (USD + DB-computed OMR), `finance_exports`. (Excel export button disabled → Phase 4.)
- [x] **ISCC** — `iscc_certificates` + the mass-balance chain card (full trace → Phase 4).
- [x] **Change Log** — render `audit_log` (auto-population → Phase 3).
- **Done when:** every page shows real data with empty/loading/error states; no remaining `PlaceholderPanel`. ✅ _(All selects validated against the live schema; `PlaceholderPanel` removed; DB currently empty so empty states are what render.)_

## Phase 3 — Create / edit + write flows
- [x] Forms (create/edit) for Deals, Contracts, Production plan, Stock, Invoices, Raw-material orders — validated (zod), role-gated. `/new` + `/[id]/edit` routes with server actions; shared form kit in `components/form.tsx`.
- [x] **Auto-populate `audit_log`** on create/update — shared server helper `lib/audit.ts` (decision noted in project.md). Needs `supabase/phase3-audit-log-policy.sql` (adds the missing INSERT policy).
- [x] **Deal economics engine** — `lib/deal-economics.ts` per `docs/deal-economics.md`; all rates in `DEAL_ASSUMPTIONS` (provisional defaults flagged via `ASSUMPTION_NOTES`, shown on the form). Recomputed on save server-side; client submits are never trusted.
- [x] **Reorder logic** — `lib/reorder.ts` flags below-safety (and UCO projected-below-safety) products given the plan + lead times; raises non-duplicate `system_alerts`. Runs on stock save + a "Run reorder check" button.
- **Done when:** users can run the deal → production → delivery → invoice flow end to end. ✅ _(code complete, build green; full end-to-end click-through pending the audit-log SQL + Andre confirming a save.)_

## Phase 4 — New modules
- [x] **To-Do** — `tasks` table (`supabase/phase4-tasks.sql`), board UI (To-Do/In progress/Done) with priority/assignee/due date, item links, per-card move/edit/delete.
- [x] **Discussions** — in-app chat: channels, threaded messages, `@deal:/@contract:/@batch:` deep-link references, in-channel search. Supabase Realtime. (`supabase/phase4-discussions.sql`.)
- [x] **Export to Excel** — client-side via exceljs (`lib/export-excel.ts` + `ExportExcelButton`). Wired into Finance + Deals (Deals respects active filters).
- **Migrations to run:** `supabase/phase4-tasks.sql`, `supabase/phase4-discussions.sql` (+ enable Realtime).

## Phase 5 — SharePoint sync (design: `docs/sharepoint-integration.md`)
- [x] M365 app registration — **provisioned 2026-08-13**: `Sites.Selected` read-only, Barka Operations Hub only. Creds in `.env.local` (`MS_*`, `SHAREPOINT_SITE_URL` pre-filled).
- [ ] **Blocked on team:** confirm canonical source workbooks per data area + that they live in the granted site (format presumed Excel, not Lists). See design doc §6.
- [ ] Server-side job (route handler + scheduled trigger) — read-only, reads SharePoint and upserts into Supabase (idempotent). SharePoint stays source of truth; **no write-back** (data out = Export-to-Excel).
- [ ] Sync status/last-run surfaced in the UI.

## Phase 6 — AI assistant (final)
- [ ] Chat box that answers questions grounded in the live data (deals, stock, forecasts). Decide provider + what data is sent. See BACKLOG.

---

### Suggested split (Cowork ↔ CC)
- **CC (this repo):** Phases 0–4 build-out.
- **Cowork/me:** Phase 5 SharePoint sync design + the deal-economics port reference, plus reviews. Adjust as you like — just keep `project.md` and these checkboxes current so we don't collide.

---

## Remaining work / go-live scope (added 2026-08-13)

Full prioritised plan + decisions in [`docs/go-live-plan.md`](./docs/go-live-plan.md). Headline items beyond Phases 5–6:

- [ ] **P0** Verify all 6 migrations ran on the correct project (`ftrtekdiabttvjlfgisy`); set prod env vars in **Vercel** (Supabase + `MS_*` + `SHAREPOINT_SITE_URL`).
- [x] **P0** RLS hardening — `supabase/roles-rls.sql`: per-role write matrix replaces every `WITH CHECK (true)` policy, self-insert role hole dropped, **all anon read access removed** (it exposed commercial data via the public anon key), documents bucket made private. **Andre: run the migration.**
- [x] **P1** New **`admin` role above GM** (superuser: users/roles + system settings; GM loses those) + `executive_viewer` read-only role — `lib/permissions.ts` (`isAdmin()`), enforced at the DB too.
- [x] **P1** User provisioning + Admin screen — `/admin`: list/create users, change roles, deactivate. Roster is in `supabase/assign-roles.sql`; **the eight accounts still need creating** (via `/admin` or Supabase Auth).
- [ ] **P1** Auth hardening: password reset, email confirmation, session timeout.
- [ ] **P2** Finance sign-off on deal-economics assumptions.
- [ ] **P3** PDF export + templates: invoices, ISCC/PoS, finance/forecast reports, per-page snapshot.
- [ ] **P3** Realtime: live on Deals/Inventory/Production/Alerts; auto-refresh elsewhere (see plan).
