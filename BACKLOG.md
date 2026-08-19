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

## Migration / cleanup
- [ ] **Port business logic** from the old Lovable app (`C:\Users\Work\Documents\Claude\Projects\WakudOS\Wakud Plant Command`) — forecast math, deal-economics (margin/funding/VAT), seed reference values. It's kept only as a reference.
- [ ] **Delete the old Lovable app** once the above logic is ported and verified.

## Done (moved off the backlog)
- [x] Place WAKUD logo in sidebar + login page.
