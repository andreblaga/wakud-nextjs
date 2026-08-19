-- ============================================================================
-- WAKUD OS — Phase 5: SharePoint sync support
-- ============================================================================
-- Run in the Supabase SQL Editor after roles-rls.sql. Safe to re-run.
--
-- Adds:
--   1. sync_runs          — one row per sync run, powers the /sync status page
--   2. documents          — SharePoint provenance columns + a uniqueness key so
--                           the document index can be upserted idempotently
--   3. stock_levels.unit  — the source workbook records volumes in KL, not
--                           tonnes. Storing the unit alongside the number stops
--                           the app silently presenting KL as tonnes.
--
-- ⚠️ AFTER RUNNING: regenerate the typed client, or TypeScript will not know
--    about sync_runs / the new columns:
--      npx supabase gen types typescript --project-id ftrtekdiabttvjlfgisy \
--        > lib/supabase/types.ts
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. sync_runs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sync_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source        TEXT NOT NULL DEFAULT 'sharepoint',
  status        TEXT NOT NULL DEFAULT 'running'
                CHECK (status IN ('running','success','partial','failed')),
  trigger       TEXT NOT NULL DEFAULT 'manual'
                CHECK (trigger IN ('manual','scheduled')),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  duration_ms   INTEGER,
  -- Per-area detail: [{ area, status, read, upserted, skipped, errored, note }]
  areas         JSONB NOT NULL DEFAULT '[]'::jsonb,
  rows_read     INTEGER NOT NULL DEFAULT 0,
  rows_upserted INTEGER NOT NULL DEFAULT 0,
  rows_skipped  INTEGER NOT NULL DEFAULT 0,
  rows_errored  INTEGER NOT NULL DEFAULT 0,
  error         TEXT,
  triggered_by  UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS sync_runs_started_idx ON public.sync_runs (started_at DESC);

ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;

-- Any signed-in user may see sync history (it is operational transparency, and
-- exposes no commercial figures). Writes come from the service-role client in
-- the sync job only, which bypasses RLS — so there is deliberately no INSERT or
-- UPDATE policy here.
DROP POLICY IF EXISTS "Auth can read sync_runs" ON public.sync_runs;
CREATE POLICY "Auth can read sync_runs"
  ON public.sync_runs FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.sync_runs TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. documents — SharePoint provenance
-- ---------------------------------------------------------------------------
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS source            TEXT NOT NULL DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS source_ref        TEXT,
  ADD COLUMN IF NOT EXISTS source_path       TEXT,
  ADD COLUMN IF NOT EXISTS source_folder     TEXT,
  ADD COLUMN IF NOT EXISTS source_modified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS synced_at         TIMESTAMPTZ;

COMMENT ON COLUMN public.documents.source IS
  '''upload'' = uploaded into the app''s storage bucket; ''sharepoint'' = indexed from the Barka Operations Hub library (file_url is a SharePoint webUrl, the bytes stay in SharePoint).';

-- source_ref holds the Graph driveItem id, which is what makes an indexed file
-- re-identifiable across runs, and is the ON CONFLICT target for the sync's upsert.
--
-- It is a dedicated column rather than a reuse of entity_id for two reasons:
--   1. entity_id is NOT NULL and, for app uploads, holds a *business* entity id
--      (a deal, a contract) which legitimately repeats across several documents —
--      so a unique index on entity_id would be wrong.
--   2. A PARTIAL unique index (… WHERE entity_type = 'sharepoint') cannot be used
--      as an ON CONFLICT target unless the predicate is restated in the statement,
--      and PostgREST's on_conflict parameter cannot express a WHERE clause. The
--      upsert would fail with 42P10 "no unique or exclusion constraint matching
--      the ON CONFLICT specification".
-- source_ref is NULL for app uploads, and Postgres permits many NULLs in a unique
-- index, so uploads are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS documents_source_ref_uidx
  ON public.documents (source_ref);

CREATE INDEX IF NOT EXISTS documents_source_folder_idx
  ON public.documents (source_folder);

CREATE INDEX IF NOT EXISTS documents_file_name_idx
  ON public.documents (lower(file_name));

-- ---------------------------------------------------------------------------
-- 3. stock_levels — record the unit the figures are actually in
-- ---------------------------------------------------------------------------
-- The Barka inventory workbook keeps every material in KL (kilolitres), except
-- the antioxidant which is in Kg. The app's UI labels stock in tonnes. Until a
-- density figure per material is confirmed, the sync stores the source number
-- unchanged and records its unit here rather than guessing a conversion.
ALTER TABLE public.stock_levels
  ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'tonnes';

COMMENT ON COLUMN public.stock_levels.unit IS
  'Unit the numeric columns are expressed in (tonnes | KL | Kg). Rows written by the SharePoint sync carry the source workbook''s unit; conversion to tonnes needs a confirmed density per material.';

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------
-- SELECT to_regclass('public.sync_runs') IS NOT NULL AS sync_runs_exists;
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'documents' AND column_name LIKE 'source%';
-- SELECT indexname FROM pg_indexes WHERE tablename = 'documents';
-- Should list documents_source_ref_uidx.
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'stock_levels' AND column_name = 'unit';
