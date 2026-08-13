# WakudOS — Project Notes

_Biofuel facility management system for Wakud International LLC (Barka, Oman). Handles trade evaluation, deal pipeline, production planning, stock tracking, and financial forecasting._

Last reviewed: 2026-06-18

---

## 1. What exists today

There is already a working application in the folder **`Wakud Plant Command/`**. It was generated with **Lovable** (the README is the default Lovable template). It is a single-page React app backed by Supabase — **not yet** a custom full-stack build.

### Stack
- **Frontend:** Vite + React 18 + TypeScript
- **UI:** shadcn/ui (Radix primitives) + Tailwind CSS, Recharts for charts, lucide-react icons
- **Routing:** react-router-dom (client-side)
- **Data/state:** TanStack Query + a custom `useSupabaseData` hook
- **Backend:** Supabase (Postgres + Auth + Storage + one Edge Function)
- **Forms/validation:** react-hook-form + zod
- **Testing:** Vitest + Testing Library; Playwright configured (config + fixture present, no specs found)
- **Package manager:** both `bun.lock` and `package-lock.json` present (npm scripts work)

### App structure (`src/`)
- **Pages** (`src/pages/`): `Index` (dashboard), `Deals`, `Forecast`, `Production`, `Finance`, `Logistics`, `Alerts`, `ISCC`, `Login`, `NotFound`. Note: `ISCC.tsx` exists but is **not wired into `App.tsx` routes**.
- **Components** (`src/components/`): CapacityHUD, ConsumptionTracking, ContractLifecycle, DocumentsPanel, Header, InvoicesTab, MaintenanceCalendar, PriceHistoryChart, ProcurementSection, ProductionQueue, QualityTests, VarianceReport, ProtectedRoute, NavLink, plus full shadcn `ui/` set.
- **Contexts:** `AuthContext` (Supabase auth + roles), `CurrencyContext` (USD/OMR; fixed peg 0.385).
- **Data:** `src/data/seed.ts` — hardcoded demo data (deals, contracts, forecast, KPIs, buyers). Still referenced by ~3 files alongside live Supabase data.
- **Hooks:** `useSupabaseData.ts` (~537 lines) — central data access.

### Auth & roles
- Four roles, enforced via Postgres RLS policies and a `has_role()` function: **`gm`** (general manager — full access), **`operations`**, **`sales`**, **`finance`**.
- Demo role switcher exists (`demoRole`) for previewing permissions.
- Seeded demo users via the `seed-users` Edge Function — all password `wakud2026`:
  `gm@wakud.com`, `ops@wakud.com`, `sales@wakud.com`, `finance@wakud.com`.
- **Note:** RLS currently has very permissive policies layered on (e.g. "Anon can read", "Auth can insert/update" with `CHECK (true)`) on top of the stricter role-based ones — effectively open for most write paths right now.

### Supabase config
- `.env` holds `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`. Client uses `localStorage` for session persistence.
- Storage bucket `wakud-documents` for uploaded files.

---

## 2. Database schema (Supabase migrations, 15 files dated Mar 2026)

Domain tables, grouped by the five functional areas:

**Trade evaluation & deal pipeline**
- `deals` — full trade economics: input/output product, producer, disport, tonnes, buy/sell price, shipping & trucking per tonne, VAT (5%), funding rate (10%), computed total cost/revenue/profit/margin/profit-per-tonne, pre-funding required, status workflow (`draft → approved → confirmed → in_transit → delivered → paid`), type (`production`/`arbitrage`), created_by/approved_by.
- `production_confirmations` — confirmation workflow tied to a deal (materials ordered, slot reserved, issue flags).

**Contracts & sales**
- `contracts` — buyer, price per tonne, active flag.
- `contract_volumes` — monthly planned vs actual volume per contract, with invoice number/status/payment date.

**Production planning**
- `production_plan` — monthly target vs actual output, B100 + glycerin output, UCO consumed.
- `production_actuals` — planned vs actual volume/revenue per deal-month, with generated variance columns.
- `inventory_consumption` — planned vs actual material kg per production month, generated variance columns, batch id.
- `quality_tests` — full biodiesel QC panel (density, viscosity, flash point, sulfur, water, acid value, methanol, oxidation stability, cloud point, cetane), pass/fail result, certificate number.

**Stock & logistics**
- `stock_levels` — per product/month opening/produced/purchased/delivered/closing, safety-stock threshold + below-safety flag.
- `raw_material_orders` — procurement with lead times, required-by, expected/actual delivery, auto-generation flag.
- `shipments` — vessel, BoL, containers, departure/ETA/arrival, tonnes loaded/delivered, freight + insurance cost, customs status, incoterm.

**Finance & forecasting**
- `monthly_forecast` — the financial model per month: committed volume, avg contract price, Barka output, production vs stock, gap, arbitrage required/capped, shortfall, production & arb revenue/COGS/profit, total profit, working capital needed, UCO needed.
- `prices` — price points by type/effective date/source.
- `exchange_rates` — USD→OMR (fixed peg 0.385 seeded).
- `invoices` — invoice number, buyer, amount USD, generated amount OMR, due/paid dates, status, method.
- `finance_exports` — JSONB export payloads handed to finance, with sent/acknowledged flags.

**Compliance, ops & system**
- `iscc_certificates` — ISCC sustainability certs (scope, expiry, GHG savings %). _(Page exists but unrouted.)_
- `documents` — file metadata pointing at the `wakud-documents` storage bucket, versioned.
- `system_alerts` — typed/severity-tagged alerts with read/resolved state.
- `audit_log` — old/new JSONB diffs per action.
- `user_roles` — role per user (the only table with a CHECK-constrained role set).

### Business domain notes (inferred from seed data)
- Core process: **UCO (used cooking oil) → B100 biodiesel + glycerin** byproduct.
- Two deal types: **Production** (Wakud produces) and **Arbitrage** (buy/resell finished B100).
- Key buyers: OMCO, Synsol, Sirona, 44.01, Blue Energo, Verified Petro, Disruptive (glycerin).
- Locations: production at **Barka, Oman**; deliveries to Salalah, Fujairah.
- Forecast horizon: rolling 12 months starting **Mar 2026**.
- Sample KPIs in seed: 5 deals, ~1,980 t committed, ~$1.2M profit, ~$2.4M cash required.

---

## 3. Observations / open issues

1. **Seed vs live data** — the app mixes hardcoded `seed.ts` demo data with live Supabase reads. Unclear which is the source of truth going forward.
2. **ISCC page is unrouted** — built but not in `App.tsx`.
3. **RLS is effectively open** — later migrations added permissive `(true)` policies over the role-based ones. Needs a decision before any real data.
4. **No git history** — folder is not a git repo (or history is absent). Versioning/CI not established.
5. **No project.md existed** until now; this is the first.
6. **Forecast logic** appears partly encoded in `seed.ts` arrays and partly in `monthly_forecast` — the actual calculation engine's location needs confirming (likely in `useSupabaseData` / page components rather than the DB).

---

## 4. Decisions made

- **Supabase ownership:** the old project (`uealdqtlaylgkpoetfxk`) is of unknown ownership and likely paused. Decision: **migrate to a fresh Supabase project Andre owns.** Demo data is disposable.
- **Status:** still a demo/prototype; goal is to load **real live data** next.

> **Repo layout note (2026-06-18):** Canonical project now lives at `C:\Users\andre\Projects\wakud-os` (this folder) — the deployable Next.js app, with the DB schema, CSV templates, and setup checklist under `supabase/`. The old `WakudOS` folder retains only the original Lovable app (`Wakud Plant Command/`) as a business-logic reference until that logic is ported. The redundant duplicate app folder and the standalone `supabase-migration/` folder were deleted after their useful contents moved into `supabase/` here.

## 5. Database setup kit (now in `supabase/`)

- `setup.sql` — consolidated, idempotent rebuild of all 23 tables + RLS + storage bucket + USD/OMR peg. **Verified** against a real Postgres (23 tables, 75 policies, `has_role()` works, runs twice cleanly). Random demo price seeding removed.
- `assign-roles.sql` — maps user emails → roles after users are created.
- `grant-privileges.sql` — **(added 2026-06-18)** grants the table/sequence privileges that `setup.sql` omitted. RLS policies alone aren't enough: PostgREST needs SQL `GRANT`s too, or every query returns `42501 permission denied`. Run once in the SQL Editor after `setup.sql`. RLS remains the real security boundary. Discovered when the first live query (`anon` count of `deals`) failed during Phase 0.
- `phase3-audit-log-policy.sql` — **(added 2026-06-18, Phase 3)** adds the missing `audit_log` INSERT policy (`setup.sql` had only SELECT), so the app's audit helper can record changes. audit_log stays append-only (no UPDATE/DELETE policy). Run once after `grant-privileges.sql`. **Decision: audit is written by a shared server helper (`lib/audit.ts`) called from each server action, not by DB triggers** — so the acting user and a clean before/after diff are captured at the app layer; non-fatal if it fails.
- `phase4-tasks.sql` — **(added 2026-06-18, Phase 4) ⚠️ Andre must run this in the SQL Editor.** Creates the `tasks` table (To-Do board) + RLS (reads to signed-in users; any signed-in user may create/manage tasks) + grants. Until it's run, the To-Do page shows an error prompting to run it. **Applied + `lib/supabase/types.ts` regenerated**, so `tasks` is fully typed (the temporary `extraTable()` shim has been removed).
- `phase4-discussions.sql` — **(added 2026-06-18, Phase 4) ⚠️ Andre must run this in the SQL Editor.** Creates `channels` + `messages` (threaded via `parent_id`) + RLS (reads to signed-in users; posts stamped with the poster's uid; append-only) + grants, adds both tables to the `supabase_realtime` publication, and seeds 5 default channels. Until it's run, Discussions shows an error prompting to run it. **Applied + types regenerated** (fully typed; `extraTable()` shim removed). **Realtime must be enabled for the project** (Database → Replication / Realtime) for live streaming.
- `SETUP-CHECKLIST.md` — step-by-step for a non-developer.
- `data-templates/` — CSV templates + README for importing real deals/contracts/production/stock/prices/orders/invoices.
- App connects via `.env.local` (see `.env.local.example`); secrets gitignored.

## 6. Next steps / open items

- Andre to create the Supabase project and run `setup.sql` (or send me the 3 API values to wire `.env`).
- Remove `seed.ts` demo data so the app shows only live DB data (pending decision/confirmation).
- Wire the unrouted **ISCC** page into `App.tsx` if it should be live.
- Tighten RLS before real production use (currently permissive for prototype).

---

## 7. Team feature requests (logged 2026-06-18)

Raw list from the team, organized below with notes on what already exists vs. what's new. Nothing built yet — pending the clarifying questions in §8.

### A. Data & integrations
1. **SharePoint integration — "crucial for all live data."** NEW. The team's live data apparently lives in SharePoint (likely Excel files and/or SharePoint Lists in Microsoft 365). Need to define whether SharePoint is the source of truth (sync into Supabase) or read live, and how/when it syncs. Requires M365 tenant access + admin consent. Biggest architectural decision on the list — affects everything else.
2. **Export to Excel** — for pages, figures, and sheets. NEW (cross-cutting). Per-screen "Export to Excel" of tables/KPIs. Feasible client-side (SheetJS) or server-side.

### B. New feature modules
3. **Discussions area / team chat.** NEW module.
   - Members can reference page links and items being discussed (deep-links to a deal, contract, batch, etc.).
   - Archive so past conversations are searchable/reviewable.
   - Design fork: build in-app chat vs. integrate existing Microsoft Teams (they're on M365).
4. **To-do list — timeline & priorities.** NEW module. Tasks with due dates, priority, assignee, status. May overlap with existing `system_alerts`.
5. **AI-integrated chat box.** NEW. Ask questions / get solutions. Scope to define: Q&A over *their* facility data (deals, stock, forecasts) vs. a general assistant. Needs an LLM provider + a decision on data leaving to an API.

### C. Operations / production (mostly extends existing schema)
6. **UCO Stock.** EXTEND `stock_levels` (product = 'UCO'); dedicated UCO view.
7. **UCO Intake.** NEW. Receiving/intake records for incoming UCO (supplier, quantity, date, sustainability declaration for ISCC). Feeds UCO stock + ISCC mass balance.
8. **Production status — Fuel (B100) & Glycerol output.** EXISTS in `production_plan` (`b100_output`, `glycerin_output`, `status`). Needs a clear status dashboard.
9. **Inventory status + auto-replacement of materials when needed.** EXISTS partly: `stock_levels.safety_stock_level`/`is_below_safety` + `raw_material_orders.auto_generated`. Needs reorder logic + alerts wired up.
10. **Sales forecast.** EXISTS partly: `contracts`, `contract_volumes`, `monthly_forecast`. Needs a dedicated sales-forecast view.

### D. Compliance & governance
11. **ISCC compliance — tracking & accountability of feed/product.** EXTEND `iscc_certificates`. Core need is mass-balance / chain-of-custody: trace UCO intake → production batch → B100/glycerol output, with sustainability characteristics carried through. This is the heart of ISCC auditing.
12. **Change/Update log tracker** — for any action completed/added/removed. EXISTS as `audit_log` table, but: (a) no UI to view it, and (b) it isn't yet populated on actions. Needs both.

### Dependency notes
- **SharePoint decision gates a lot** — if SharePoint is the live source of truth, the data model and import templates change.
- Items 6–10 and 12 are mostly *surfacing/extending* what the schema already supports — lower effort, good early wins.
- Items 1, 3, 5 are the heavy, decision-heavy builds.
- Work is split with **Claude Code**; this doc is the shared source of truth.

## 8. Decisions (2026-06-18)

- **Rebuild from scratch** in **Next.js 14 (App Router) + TypeScript + Tailwind** — replacing the Lovable Vite SPA (kept as reference). Same Supabase backend; `setup.sql` schema still applies.
- **SharePoint:** sync into the app DB (accuracy + speed); SharePoint stays source of truth. Server-side job. **Read-only, one-way (no write-back)** — team gets data "out" via Export-to-Excel. **Access provisioned 2026-08-13:** Entra app registration, `Sites.Selected` read-only, scoped to **Barka Operations Hub** only (`netorgft11912468.sharepoint.com/sites/Barka-Operations-Hub`). Design + Graph details in [`docs/sharepoint-integration.md`](./docs/sharepoint-integration.md). Remaining: confirm canonical source workbooks (format presumed Excel, not Lists).
- **Team chat:** build in-app (channels, item references, searchable archive).
- **AI chat box:** Q&A over facility data — deferred to the **final** phase.

## 9. New app scaffold (`wakud-os/`, built 2026-06-18)

First-pass Next.js app. App shell (sidebar nav + topbar), dashboard (KPIs + forecast chart + alerts), and styled placeholder pages for all 12 modules. **Verified: `next build` passes, all 15 routes compile.** Pinned `next@14.2.35` (patched, per Dec-2025 advisory). Data wiring to Supabase is the next step. See `wakud-os/README.md`.

Page → feature map: inventory (UCO stock/intake/reorder), production (B100+glycerol), sales-forecast, iscc (mass balance), discussions (chat), tasks (to-do), change-log (audit), finance (Excel-export stub), assistant (AI, final phase).

## 9a. Build progress (Claude Code)

- **Phase 0 ✅** — `lib/supabase/types.ts` generated; clients typed `createClient<Database>()`. Added `supabase/grant-privileges.sql` (run by Andre) to fix the missing table GRANTs that made every query 401.
- **Phase 1 ✅** — Supabase email/password login, `middleware.ts` session refresh + route protection, server-loaded role in a `SessionProvider`, real user/role + sign-out in `TopBar`, `lib/permissions.ts` + `RoleGate` for write-gating. GM login verified.
- **Phase 2 ✅** — Reusable `components/DataTable.tsx` (+ Empty/Error/Skeleton states) and `lib/currency.ts` / `lib/dates.ts` helpers. All read pages wired to live Supabase with empty/loading/error states: Dashboard, Deals (filters), Sales Forecast, Production, Inventory, Logistics, Finance, ISCC, Change Log. `PlaceholderPanel` removed. DB is currently empty, so pages render their empty states until real data is imported.
- **Phase 3 ✅** — Write flows on `main`. `/new` + `/[id]/edit` for Deals, Contracts, Production plan, Stock, Invoices, Raw-material orders — zod-validated (`lib/schemas.ts`), role-gated server actions (`lib/form-actions.ts` + `RoleGate`), shared form kit (`components/form.tsx`). Audit on every write via `lib/audit.ts` (app-layer helper, not DB triggers). Deal economics engine `lib/deal-economics.ts` (all rates in `DEAL_ASSUMPTIONS`, provisional until finance signs off — flagged on the form) recomputed server-side on save. Reorder logic `lib/reorder.ts` raises `system_alerts`. Added `zod@3.23.8` (next still pinned 14.2.35).
  - **Andre to run:** `supabase/phase3-audit-log-policy.sql` (adds the audit_log INSERT policy; until then audit writes silently no-op — the rest of the flow works).
  - **Open ❓ for finance:** confirm the deal-economics assumptions in `docs/deal-economics.md` §"Assumptions to confirm" (VAT as cost vs reclaimable, funding rate, glycerin yield/price $450 vs $220, go thresholds, prefunded payment_type value). Each is a one-line edit in `DEAL_ASSUMPTIONS`.
- **Phase 4 ✅ (modules built; 2 migrations to run)** — (1) **Excel export**: one shared client helper `lib/export-excel.ts` (exceljs, dynamic-imported) + reusable `ExportExcelButton`; wired into Deals (respects active filters) and Finance invoices. (2) **To-Do**: `tasks` board (To-Do/In progress/Done) with create/edit, priority, due date, item link, per-card move/delete — needs `phase4-tasks.sql`. (3) **Discussions**: realtime channels + threaded messages, post box, `@deal:/@contract:/@batch:` deep-link references, in-channel search, create-channel — needs `phase4-discussions.sql` + Realtime enabled. Migrations applied + `lib/supabase/types.ts` regenerated, so tasks/channels/messages are fully typed (temporary `extraTable()` shim removed).
- **Roles + RLS hardening ✅ (2026-08-13; 1 migration to run)** — implements the P0 RLS item and the P1 access items from `docs/go-live-plan.md` in one pass.
  - **Role model** — `lib/permissions.ts` now carries six roles: `admin` (superuser, above GM: user management + system settings) and `executive_viewer` (read-only oversight) alongside `gm`/`operations`/`sales`/`finance`. New `isAdmin()` gates admin areas — **never** `canWrite()`, because `gm` holds `"*"` and would pass a `canWrite(gm, "users")` check. GM keeps full business write access and loses nothing else. Dropped the dead `sales-forecast` domain (nothing gated on it — the Sales Forecast page gates on `contracts`); added `prices` to ops/sales/finance so the app model matches the DB matrix.
  - **RLS hardening** — `supabase/roles-rls.sql` replaces every `WITH CHECK (true)` prototype policy with a per-role matrix (the `VALUES` list in §2 *is* the matrix). Adds `public.has_any_role(uuid, text[])` + `public.is_admin(uuid)`; `has_role()` was already generic and is untouched. Three structural fixes: role management moved gm → admin; the `"Users can insert own role"` policy **dropped** (it let any signed-in user self-promote to gm); `executive_viewer` given no write access to any business table, so exec read-only is now enforced at the database, not just the UI.
  - **Anon access removed** — `setup.sql` let signed-out `anon` read deals, contracts, contract_volumes, production_plan, stock_levels, prices, monthly_forecast and price_feeds, and made the `wakud-documents` bucket public. Since the anon key ships in the browser bundle, that exposed commercial data over the REST API to anyone who could load the login page. Policies dropped, the grant revoked, bucket flipped private. `supabase/grant-privileges.sql` updated to match so re-running it can't undo this. **When the document-upload UI is built, use `createSignedUrl()`** — public URLs no longer resolve (nothing reads `documents` today, so there was nothing to migrate).
  - **Discussions is the deliberate exception** — channels/messages stay writable by every role *including* `executive_viewer` (decision 2026-08-13: execs take part in the conversation, they just can't change records). Discussions writes go straight from the browser client, so RLS is their only gate; posting still requires holding a role and stamping your own uid.
  - **Admin screen** — `/admin` (nav: System, admin-only) lists users with role + last sign-in, creates accounts, changes roles, and deactivates/reactivates. Account creation needs the service-role client (`lib/supabase/admin.ts`, `import "server-only"`); every action re-checks `requireAdmin()` (`lib/admin.ts`) because server actions are reachable by direct POST regardless of the page redirect. Deactivate = ban, not delete, so `audit_log`/`deals` FKs to `auth.users` survive. Admins can't demote or deactivate themselves (lock-out guard). New users are created pre-confirmed with a temporary password shown once — there is no self-serve reset yet.
  - **Andre to run:** `supabase/roles-rls.sql`, then create the eight staff accounts (via `/admin`, or in Supabase Auth + `supabase/assign-roles.sql`). Verification queries are at the bottom of the migration.
  - **Admin-driven password reset (2026-08-13)** — per-user "Reset password" button on `/admin`, next to Deactivate: `confirm()` guard, then `resetPassword` regenerates the password via the service client and returns it **once**. The plaintext never touches the audit log (which records only `{ password_reset: true }`), server logs, or the DB. Added an optional `secret` field to the shared `FormState` so one-time values travel separately from `message` — a shared `SecretNotice` component renders them in monospace with a copy-to-clipboard button, and `createUser` now uses the same path instead of embedding the password in its message.
  - **Still open:** the rest of P1 auth hardening — **self-serve** password reset, email confirmation, session timeout. Until that lands, a forgotten password means an admin resets it on `/admin` (or in the Supabase dashboard).
- **Notifications (2026-06-18)** — functional TopBar bell + `/alerts` page (added to nav under Overview). All "what needs attention" items are derived live in one helper, `lib/notifications.ts` (never relies on a cron/populated table): upcoming/overdue raw-material orders (≤14 days), low stock (reuses the extracted `detectReorderFlags` from `lib/reorder.ts`), deals created in the last 7 days, plus unresolved `system_alerts` — de-duped (a live low-stock item supersedes its raised reorder alert), sorted by severity then urgency, capped at 20. The bell fetches `GET /api/notifications` (authenticated route handler); the dashboard card and `/alerts` read the same helper so they never diverge.

## 10. Open items / next steps

- **The build roadmap now lives in [`BUILD-PLAN.md`](./BUILD-PLAN.md)** — the phased, checkbox-driven plan Claude Code executes (Phase 0 connect Supabase → 1 auth → 2 wire pages → 3 write flows → 4 new modules → 5 SharePoint → 6 AI).
- **Parked/"later" items are in [`BACKLOG.md`](./BACKLOG.md)** (favicon, RLS hardening, old-app logic port, etc.).
- Immediate unblock: Andre creates the Supabase project + supplies `NEXT_PUBLIC_*` env values (BUILD-PLAN Phase 0).
- SharePoint sync (Phase 5): M365 access **now provisioned** (read-only `Sites.Selected`, Barka Operations Hub); design in [`docs/sharepoint-integration.md`](./docs/sharepoint-integration.md). Remaining input from team: confirm which workbooks are canonical + that they live in the granted site.
