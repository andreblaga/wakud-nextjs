# WakudOS — Backlog (parked for later)

Things we've deliberately deferred. Pull items from here when their time comes; add new ones as they surface.

## UI / polish
- [ ] **Favicon** — show the WAKUD mark in the browser tab instead of the default Next icon. Needs a square logo variant (e.g. `app/icon.png` 512×512, or `favicon.ico`).
- [ ] Recharts is on the deprecated v2 line — consider upgrading to v3 at some point (not urgent; pinned and working).

## Features (sequenced in BUILD-PLAN.md, parked specifics here)
- [ ] **AI assistant** — Q&A over facility data. Deferred to the final phase, after core data + modules are in.
- [ ] **SharePoint sync** — M365 access provisioned (read-only `Sites.Selected`, Barka Operations Hub). Now blocked only on confirming which workbooks are canonical + that they live in the granted site. Design: `docs/sharepoint-integration.md`; BUILD-PLAN Phase 5.

## Data / security
- [x] **Tighten RLS** — done 2026-08-13 via `supabase/roles-rls.sql` (per-role write matrix, self-insert role hole closed, anon read access removed). Andre still has to run the migration.
- [ ] **Auth hardening** — password reset, email confirmation flows, session timeout (after basic login works).

## Migration / cleanup
- [ ] **Port business logic** from the old Lovable app (`C:\Users\Work\Documents\Claude\Projects\WakudOS\Wakud Plant Command`) — forecast math, deal-economics (margin/funding/VAT), seed reference values. It's kept only as a reference.
- [ ] **Delete the old Lovable app** once the above logic is ported and verified.

## Done (moved off the backlog)
- [x] Place WAKUD logo in sidebar + login page.
