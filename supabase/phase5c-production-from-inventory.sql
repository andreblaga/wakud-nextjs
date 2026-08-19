-- ============================================================================
-- WAKUD OS — Phase 5c: derive production_plan from the inventory workbook
-- ============================================================================
-- Run in the Supabase SQL Editor after phase5b-stock-safety-unit.sql.
-- Safe to re-run.
--
-- The nominated production source (Sales-Production MAHER.xlsx) is empty, but
-- daily B100 and glycerol output and daily UCO consumption already sit in the
-- inventory workbook the sync reads. This migration lets those be recorded as
-- monthly production without inventing anything.
--
-- ⚠️ AFTER RUNNING: regenerate the typed client (temp file first — the CLI
--    writes errors to stdout):
--      npx supabase gen types typescript --project-id ftrtekdiabttvjlfgisy > types.new.ts
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. A derived actual has no target
-- ---------------------------------------------------------------------------
-- setup.sql declared `target_output DECIMAL NOT NULL`. The workbook records what
-- was produced, never what was planned. Writing 0 would fabricate a target and
-- make every derived month look like a 100% overshoot; the honest value is NULL.
-- Same principle as dropping the DEFAULT 20 on stock_levels.safety_stock_level
-- in phase5b: a number nobody chose is worse than no number.
ALTER TABLE public.production_plan
  ALTER COLUMN target_output DROP NOT NULL;

COMMENT ON COLUMN public.production_plan.target_output IS
  'Planned output for the month, in `unit`. NULL means no target was set — rows derived from the inventory workbook have no target, because the workbook records actuals only. Do not treat NULL as zero.';

-- ---------------------------------------------------------------------------
-- 2. Units, again
-- ---------------------------------------------------------------------------
-- The inventory workbook is in KL. Same decision as stock_levels: store the
-- source number unchanged and record its unit, rather than converting on an
-- unconfirmed density.
ALTER TABLE public.production_plan
  ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'tonnes';

COMMENT ON COLUMN public.production_plan.unit IS
  'Unit of target_output, actual_output, b100_output, glycerin_output, uco_consumed and wastage (tonnes | KL | Kg). Rows derived from the Barka inventory workbook are KL.';

-- ---------------------------------------------------------------------------
-- 3. Wastage
-- ---------------------------------------------------------------------------
-- The BIODIESEL sheet records daily wastage alongside production. Dropping it on
-- import would lose real operational signal — February 2026 shows 15 KL wasted
-- against 39.3 KL produced, which is the kind of number a dashboard exists to
-- make visible.
ALTER TABLE public.production_plan
  ADD COLUMN IF NOT EXISTS wastage DECIMAL;

COMMENT ON COLUMN public.production_plan.wastage IS
  'B100 wastage recorded for the month, in `unit`. NULL means not recorded.';

-- ---------------------------------------------------------------------------
-- 4. Provenance — so the sync never overwrites a person
-- ---------------------------------------------------------------------------
-- production_plan.month is UNIQUE, so the sync upserts on it. Once operations
-- staff start entering production in the app, a later sync would silently
-- overwrite their row for any month the workbook also covers.
--
-- With this column the sync can read which months are marked 'manual' and skip
-- them, reporting how many it left alone. A person's entry always wins over a
-- derived one; the app is the system of record for what people type.
ALTER TABLE public.production_plan
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

COMMENT ON COLUMN public.production_plan.source IS
  '''manual'' = entered in the app by a person; ''sharepoint'' = derived from the Barka inventory workbook by the sync. The sync must never overwrite a ''manual'' row.';

CREATE INDEX IF NOT EXISTS production_plan_source_idx ON public.production_plan (source);

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------
-- SELECT column_name, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'production_plan'
--    AND column_name IN ('target_output','unit','wastage','source')
--  ORDER BY column_name;
--
-- Expect:
--   source        | NO  | 'manual'::text
--   target_output | YES | (null)
--   unit          | NO  | 'tonnes'::text
--   wastage       | YES | (null)
