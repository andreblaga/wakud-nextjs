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

-- Signed-out (anon): read-only. RLS still limits this to the tables that have
-- an explicit "Anon can read ..." policy (deals, contracts, contract_volumes,
-- production_plan, stock_levels, prices, monthly_forecast, price_feeds).
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Signed-in (authenticated): full DML at the GRANT layer; RLS policies from
-- setup.sql gate what each role may actually read/write (e.g. only GM can
-- write contracts). This mirrors Supabase's default public-schema grants.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Sequences (for any serial/identity columns).
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Apply the same grants automatically to any table/sequence created later,
-- so future migrations don't reintroduce the 42501 gap.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;

-- ============================================================================
-- Verify: anon should now be able to read deals (count), and a signed-out
-- createClient() query in the app should stop returning 42501.
-- ============================================================================
