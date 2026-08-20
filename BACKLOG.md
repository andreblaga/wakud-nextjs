# WakudOS — Backlog (parked for later)

Things we've deliberately deferred. Pull items from here when their time comes; add new ones as they surface.

## UI / polish
- [ ] **Favicon** — show the WAKUD mark in the browser tab instead of the default Next icon. Needs a square logo variant (e.g. `app/icon.png` 512×512, or `favicon.ico`).
- [ ] Recharts is on the deprecated v2 line — consider upgrading to v3 at some point (not urgent; pinned and working).

## Features (sequenced in BUILD-PLAN.md, parked specifics here)
- [ ] **AI assistant** — Q&A over facility data. Deferred to the final phase, after core data + modules are in.
- [x] **SharePoint sync** — built 2026-08-19, read-only. Document index + monthly stock levels active; 10 other areas blocked on source data, see `docs/sharepoint-findings.md`. Andre still has to run `supabase/phase5-sharepoint-sync.sql`.
- [ ] **Mass-balance tables** — surfaced by the ISCC audit: the app has no sustainability category (Sustainable Oman / Sustainable UAE / Non-Sustainable) per batch, which is the substance of ISCC chain-of-custody and a prerequisite for generating a PoS. `iscc_certificates` alone cannot express it.
- [ ] **Customer address book + invoice line items** — surfaced by the PDF template drafts: `contracts.buyer` is a bare string, and `invoices` holds a single amount, so a real tax invoice can't be represented. See `docs/pdf-templates.md`.
- [ ] **Stock units** — the SharePoint inventory workbook is in KL (antioxidant Kg); the app labels stock in tonnes. `stock_levels.unit` now records the source unit; converting needs an agreed density per material.

## Data / security
- [x] **Tighten RLS** — done 2026-08-13 via `supabase/roles-rls.sql` (per-role write matrix, self-insert role hole closed, anon read access removed). Andre still has to run the migration.
- [ ] **Auth hardening** — password reset, email confirmation flows, session timeout (after basic login works).

## Role model gaps (found 2026-08-19 while wiring global search)

- [x] **Read-only detail views — done 2026-08-20.** Every `[id]` route was an edit form that redirected anyone without write access, so the four `executive_viewer` accounts — John Jones, Faris Al Kharusi, Yawar Abbas Naqvi — could see list pages and **could not open a single record anywhere in the app**. It only surfaced because global search tried to link to a record and couldn't. Now `/deals/[id]`, `/contracts/[id]`, `/production/[id]` and `/finance/invoices/[id]`, with "Edit" behind `RoleGate` and per-record history from `audit_log`; search links to records rather than to pre-filtered lists. **Still open: Discussions deep-links and the Change Log's entity column both still name a record without linking to it.**
- [x] **A `/contracts` index page — done 2026-08-20.** Same DataTable pattern as `/deals`; global search's "see all contracts" now has a target, and `/contracts` is the contracts home (Sales Forecast still lists them, with a link through).

## Data integrity (surfaced 2026-08-19)

- [ ] **Recompute stored deal economics when `DEAL_ASSUMPTIONS` change.** The detail page recomputes with `evaluateDeal` and flags a mismatch against the stored columns — good. But the moment finance signs off and any rate changes (glycerin price $450 vs $220 is a ~2× swing on byproduct revenue), *every existing deal's stored profit, margin and profit-per-tonne goes stale at once*, and list pages read the stored values. Needs an admin action that recomputes and re-saves all deals, audited, plus a record of which assumption set a row was computed under.
- [ ] **Text references with no foreign key.** `invoices.deal_id` is text with no FK, so an invoice can name a deal that does not exist (the detail page renders the bare reference with a note rather than a broken link). `audit_log.entity_id` is a nullable UUID with no FK for the same reason. Both are deliberate-ish, but the pattern should be a decision rather than an accident — decide per table whether to add the constraint or keep the loose reference and always render it defensively.
- [ ] **Link records where they are only named.** Discussions deep-links and the Change Log's entity column name a record without linking to it. Now cheap, since read-only detail routes exist as of `d60dd6a`.

## Deletion / archiving

- [x] **Archive, not delete — decided 2026-08-19, built 2026-08-20.** `supabase/roles-rls.sql` sets `allow_delete = false` for every business table, so the database refuses deletes from every role; only `tasks` has a DELETE policy. That default is correct and stays: `audit_log.entity_id` has no foreign key, so hard-deleting a record would leave its own Change Log history pointing at something that no longer exists — undermining the module the team specifically asked for. `production_confirmations` and `production_actuals` also reference deals, and a voided tax invoice must remain on file. Built instead as `archived_at` / `archived_by` on deals, contracts, invoices, raw material orders and shipments (`supabase/phase5d-archive.sql`), archived rows filtered out of default lists behind a "Show archived" toggle, and every archive routed through `lib/audit.ts`. **No hard delete anywhere. Still open: orders and shipments have the columns but no detail page, so nothing archives them from the UI yet.**

## Migration / cleanup
- [ ] **Port business logic** from the old Lovable app (`C:\Users\Work\Documents\Claude\Projects\WakudOS\Wakud Plant Command`) — forecast math, deal-economics (margin/funding/VAT), seed reference values. It's kept only as a reference.
- [ ] **Delete the old Lovable app** once the above logic is ported and verified.

## Done (moved off the backlog)
- [x] Place WAKUD logo in sidebar + login page.
