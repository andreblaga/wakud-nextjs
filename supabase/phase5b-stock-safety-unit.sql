-- ============================================================================
-- WAKUD OS — Phase 5b: make the stock safety level self-describing
-- ============================================================================
-- Run in the Supabase SQL Editor after phase5-sharepoint-sync.sql, and BEFORE
-- the first sync run. Safe to re-run.
--
-- ⚠️ AFTER RUNNING: regenerate the typed client (generate to a temp file first —
--    the CLI writes errors to stdout):
--      npx supabase gen types typescript --project-id ftrtekdiabttvjlfgisy > types.new.ts
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. safety_stock_unit
-- ---------------------------------------------------------------------------
-- stock_levels.unit describes the *measurement* columns — opening, produced,
-- purchased, delivered, closing. safety_stock_level is a different quantity and
-- needs its own unit, because a single row can legitimately hold two:
--
--   The SharePoint sync upserts on (product, month). It overwrites the figures
--   and `unit`, but never writes safety_stock_level. So a row a person created
--   in tonnes, once the sync touches it, becomes a hybrid: KL figures from the
--   workbook, a tonnes safety level from the human. Row-level provenance (a
--   `source` column) cannot describe that row, because its two halves have
--   different provenance. A unit that belongs to the safety level can.
--
-- Default 'tonnes' preserves today's behaviour: every existing safety level was
-- entered on a form that implied tonnes.
ALTER TABLE public.stock_levels
  ADD COLUMN IF NOT EXISTS safety_stock_unit TEXT NOT NULL DEFAULT 'tonnes';

COMMENT ON COLUMN public.stock_levels.safety_stock_unit IS
  'Unit of safety_stock_level (tonnes | KL | Kg). Separate from stock_levels.unit because the sync overwrites the measurement columns and their unit without touching the safety level, so one row can carry two units. Compare like with like, or do not compare.';

-- ---------------------------------------------------------------------------
-- 2. Stop fabricating a safety level
-- ---------------------------------------------------------------------------
-- setup.sql declared `safety_stock_level DECIMAL DEFAULT 20`. The sync does not
-- write that column, so every synced row would silently claim a safety level of
-- 20 that nobody set — and once units line up, reorder alerts would fire against
-- a number no one chose. The column is nullable, so NULL can mean "not set",
-- which is the honest value for a row imported from a workbook that has no
-- concept of a safety level.
--
-- Dropping the default affects new rows only; existing rows keep their value.
-- stock_levels is empty at the time of writing (2026-08-19), so nothing is
-- grandfathered in.
ALTER TABLE public.stock_levels
  ALTER COLUMN safety_stock_level DROP DEFAULT;

COMMENT ON COLUMN public.stock_levels.safety_stock_level IS
  'Reorder threshold, in safety_stock_unit. NULL means no threshold has been set — do not treat NULL as zero, and do not raise a below-safety alert for it.';

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------
-- SELECT column_name, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'stock_levels'
--    AND column_name IN ('unit','safety_stock_unit','safety_stock_level')
--  ORDER BY column_name;
--
-- Expect:
--   safety_stock_level | YES | (null)
--   safety_stock_unit  | NO  | 'tonnes'::text
--   unit               | NO  | 'tonnes'::text
