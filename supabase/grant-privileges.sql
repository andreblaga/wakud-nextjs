-- ============================================================================
-- WAKUD PLANT COMMAND — Grant table privileges to API roles
-- ============================================================================
-- Run this in the Supabase SQL Editor AFTER setup.sql.
--
-- WHY THIS IS NEEDED
-- ------------------
-- setup.sql enables Row Level Security and creates policies, but PostgREST
-- (the REST API behind the anon/authenticated keys) ALSO requires plain SQL
-- table GRANTs. Without them every query fails with:
--     42501  permission denied for table <name>
-- even though a matching RLS policy exists. RLS filters ROWS; GRANTs decide
-- whether the role may touch the TABLE at all. You need both.
--
-- RLS is still the real security boundary: granting a role access to a table
-- does nothing on its own — a row is only returned/written if an RLS policy
-- also allows it. Tables without an "anon" policy stay invisible to anon even
-- though SELECT is granted below (RLS default-denies).
--
-- Safe to run more than once (idempotent).
-- ============================================================================

-- Schema usage (required before any table access).
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Signed-out (anon): NO table access.
--
-- This originally granted anon SELECT on every table, paired with "Anon can
-- read ..." policies on deals, contracts, contract_volumes, production_plan,
-- stock_levels, prices, monthly_forecast and price_feeds. Because the anon key
-- ships in the browser bundle, that made commercial data readable over the REST
-- API by anyone who could load the login page. Both the grant and the policies
-- were removed in supabase/roles-rls.sql — do not reinstate them here.
--
--   (was: GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;)

-- Signed-in (authenticated): full DML at the GRANT layer; the RLS policies in
-- supabase/roles-rls.sql gate what each role may actually read/write (e.g. only
-- admin/gm can write contracts). Mirrors Supabase's default public-schema grants.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Sequences (for any serial/identity columns).
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Apply the same grants automatically to any table/sequence created later,
-- so future migrations don't reintroduce the 42501 gap.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

-- ============================================================================
-- Verify: a signed-in query (e.g. count of deals) succeeds and stops returning
-- 42501. A signed-out (anon) query should now fail — that is intended.
-- ============================================================================
