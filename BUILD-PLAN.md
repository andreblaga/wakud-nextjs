# WakudOS — Build Plan (for Claude Code)

This is the working roadmap for building WakudOS out from the current first-pass scaffold to a functioning app. Work top-to-bottom; phases are ordered by dependency. `project.md` is the product source of truth; `BACKLOG.md` holds parked items.

## Ground rules & conventions

- **Stack:** Next.js 14.2.35 (App Router) · TypeScript · Tailwind · Supabase (`@supabase/ssr`). Stay on Next 14 — do **not** `npm audit fix --force` (it breaks the pin).
- **Data access:** server components/route handlers use `lib/supabase/server.ts`; client components use `lib/supabase/client.ts`. Both return `null` when env is unset — handle that path so pages don't crash pre-connection.
- **DB types:** generate once Supabase is connected — `npx supabase gen types typescript --project-id <id> > lib/supabase/types.ts` — and type `createClient<Database>()`.
- **Schema is fixed** in `supabase/setup.sql` (23 tables). Don't redefine tables in code; if a schema change is needed, add a new migration SQL file under `supabase/` and note it in `project.md`.
- **Reuse the design system** in `components/ui.tsx` (`Card`, `StatCard`, `PageHeader`, `StatusBadge`). Replace `PlaceholderPanel` with a real reusable `DataTable`. Keep `lib/nav.ts` as the single nav source.
- **Roles:** `gm` (full), `operations`, `sales`, `finance`. Reads open to all signed-in users; gate **writes** by role (mirror the RLS intent).
- **Currency:** USD primary; OMR via the `exchange_rates` peg (0.385). Build one currency helper; don't hardcode the rate in components.
- After each phase: `npm run build` must pass, and update the relevant checkboxes here + notes in `project.md`.

---

## Phase 0 — Connect Supabase (unblocks everything)
- [x] Andre creates his Supabase project and runs `supabase/setup.sql` + `assign-roles.sql` (see `supabase/SETUP-CHECKLIST.md`).
- [x] Add `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`.
- [x] Generate `lib/supabase/types.ts` and type `createClient<Database>()` in both `lib/supabase/client.ts` and `server.ts`.
- [ ] **Andre: run `supabase/grant-privileges.sql`** in the SQL Editor — `setup.sql` omitted table GRANTs, so live queries 401 with `42501` until this runs.
- **Done when:** a signed-out `createClient()` no longer returns null locally and a trivial query (e.g. count of `deals`) succeeds. _(Code done; pending the grant SQL above.)_

## Phase 1 — Auth & access control
- [ ] Wire `app/login/page.tsx` to Supabase email/password sign-in (make it a client component / server action).
- [ ] Add middleware for session refresh + route protection; redirect unauthenticated users to `/login`.
- [ ] Load the current user's role; expose via a context/provider. Make `TopBar` show the real user + role (replace the hardcoded "GM").
- [ ] Hide/disable write actions the role can't perform.
- **Done when:** seeded users (gm/ops/sales/finance) can log in, see role-appropriate UI, and log out.

## Phase 2 — Wire core read pages to live data
Replace placeholders with real queries + a reusable `DataTable`. One PR per page is fine.
- [ ] **Dashboard** — real KPIs (active deals, committed volume, forecast profit, working capital) + `monthly_forecast` chart + live `system_alerts`.
- [ ] **Deals** — list from `deals` with status badges, filters, and the margin/profit columns.
- [ ] **Sales Forecast** — `contracts` + `contract_volumes` + `monthly_forecast`.
- [ ] **Production** — `production_plan` vs `production_actuals`; `quality_tests`.
- [ ] **Inventory** — `stock_levels` (UCO + B100), UCO intake, `raw_material_orders` with below-safety reorder flags.
- [ ] **Logistics** — `shipments`.
- [ ] **Finance** — `invoices` (USD + computed OMR), `finance_exports`.
- [ ] **ISCC** — `iscc_certificates` + the mass-balance chain-of-custody view.
- [ ] **Change Log** — render `audit_log`.
- **Done when:** every page shows real data with empty/loading/error states; no remaining `PlaceholderPanel`.

## Phase 3 — Create / edit + write flows
- [ ] Forms (create/edit) for Deals, Contracts, Production plan, Stock, Invoices, Raw-material orders — validated (zod), role-gated.
- [ ] **Auto-populate `audit_log`** on create/update/delete (DB triggers or a shared server helper).
- [ ] **Deal economics engine** — port margin/funding/VAT math from the old Lovable app (see BACKLOG) into a typed `lib/` module; compute on save.
- [ ] **Reorder logic** — flag/raise alerts when `stock_levels` dips below safety given the production plan + lead times.
- **Done when:** users can run the deal → production → delivery → invoice flow end to end.

## Phase 4 — New modules
- [ ] **To-Do** — tasks table (add migration), board UI with priority/assignee/due date, item links.
- [ ] **Discussions** — in-app chat: channels, messages, threads, deep-link references to deals/contracts/batches, searchable archive. Use Supabase Realtime. (Add tables via migration.)
- [ ] **Export to Excel** — per-page export of tables/figures (server-side via a library, or client-side). Start with Finance + Deals.

## Phase 5 — SharePoint sync (blocked on Andre: M365 access + data format)
- [ ] Confirm source format (Excel files vs Lists) and get M365 app registration (tenant/client/secret).
- [ ] Server-side job (route handler + scheduled trigger) that reads SharePoint and upserts into Supabase. SharePoint stays the source of truth.
- [ ] Sync status/last-run surfaced in the UI.

## Phase 6 — AI assistant (final)
- [ ] Chat box that answers questions grounded in the live data (deals, stock, forecasts). Decide provider + what data is sent. See BACKLOG.

---

### Suggested split (Cowork ↔ CC)
- **CC (this repo):** Phases 0–4 build-out.
- **Cowork/me:** Phase 5 SharePoint sync design + the deal-economics port reference, plus reviews. Adjust as you like — just keep `project.md` and these checkboxes current so we don't collide.
