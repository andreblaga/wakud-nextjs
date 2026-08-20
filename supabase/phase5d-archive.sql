-- ============================================================================
-- WAKUD OS — Phase 5d: archive, not delete
-- ============================================================================
-- Run in the Supabase SQL Editor after phase5c-production-from-inventory.sql.
-- Safe to re-run.
--
-- ⚠️ RUN THIS BEFORE DEPLOYING the matching app release. The list and detail
--    pages select archived_at, so against a database without these columns
--    PostgREST returns "column does not exist" and those pages show their error
--    state until the migration lands.
--
-- ⚠️ AFTER RUNNING: regenerate the typed client (temp file first — the CLI
--    writes errors to stdout):
--      npx supabase gen types typescript --project-id ftrtekdiabttvjlfgisy > types.new.ts
--    lib/supabase/types.ts already carries these columns by hand, so the
--    regenerated file should differ from it in nothing but formatting.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Why archiving and not deleting
-- ---------------------------------------------------------------------------
-- supabase/roles-rls.sql sets allow_delete = false for every business table and
-- that stays. audit_log.entity_id has no foreign key, so a hard delete would
-- leave Change Log entries pointing at records that no longer exist —
-- undermining the one module the team specifically asked for. production_
-- confirmations and production_actuals also reference deals, and a voided tax
-- invoice must remain on file.
--
-- Archiving is an UPDATE, so the existing per-role write matrix already decides
-- who may do it: whoever can edit a deal can archive one. No new policies, and
-- deliberately no DELETE policies.

-- ---------------------------------------------------------------------------
-- 1. The columns
-- ---------------------------------------------------------------------------
-- archived_at NULL = live. Both columns are cleared together on unarchive; the
-- history of who archived what and when lives in audit_log, which is the point
-- of routing archiving through lib/audit.ts.

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id);

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id);

ALTER TABLE public.raw_material_orders
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id);

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id);

-- ---------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------
-- Every default list query is "... WHERE archived_at IS NULL". A btree index
-- does store NULLs, so this serves that predicate as well as the rarer
-- "show me the archived ones".

CREATE INDEX IF NOT EXISTS deals_archived_at_idx ON public.deals (archived_at);
CREATE INDEX IF NOT EXISTS contracts_archived_at_idx ON public.contracts (archived_at);
CREATE INDEX IF NOT EXISTS invoices_archived_at_idx ON public.invoices (archived_at);
CREATE INDEX IF NOT EXISTS raw_material_orders_archived_at_idx ON public.raw_material_orders (archived_at);
CREATE INDEX IF NOT EXISTS shipments_archived_at_idx ON public.shipments (archived_at);

-- ---------------------------------------------------------------------------
-- 3. Documentation on the columns themselves
-- ---------------------------------------------------------------------------

COMMENT ON COLUMN public.deals.archived_at IS
  'NULL = live. Non-NULL = archived: hidden from default lists, still readable, still referenced by audit_log. There is no hard delete — see supabase/roles-rls.sql.';
COMMENT ON COLUMN public.deals.archived_by IS
  'Who archived the row. Cleared on unarchive; the durable record of both is in audit_log (action = archive | unarchive).';

COMMENT ON COLUMN public.contracts.archived_at IS
  'NULL = live. Non-NULL = archived: hidden from default lists and from the Sales Forecast contract list, still readable.';
COMMENT ON COLUMN public.contracts.archived_by IS
  'Who archived the row. Cleared on unarchive; see audit_log for the history.';

COMMENT ON COLUMN public.invoices.archived_at IS
  'NULL = live. Non-NULL = archived. An archived invoice is excluded from the outstanding/overdue figures but remains on file — a voided tax invoice may never be deleted.';
COMMENT ON COLUMN public.invoices.archived_by IS
  'Who archived the row. Cleared on unarchive; see audit_log for the history.';

COMMENT ON COLUMN public.raw_material_orders.archived_at IS
  'NULL = live. Non-NULL = archived: hidden from the default Inventory list. Useful for auto-generated orders that were superseded.';
COMMENT ON COLUMN public.raw_material_orders.archived_by IS
  'Who archived the row. Cleared on unarchive; see audit_log for the history.';

COMMENT ON COLUMN public.shipments.archived_at IS
  'NULL = live. Non-NULL = archived: hidden from the default Logistics list, still readable.';
COMMENT ON COLUMN public.shipments.archived_by IS
  'Who archived the row. Cleared on unarchive; see audit_log for the history.';

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------
-- 1. All five tables carry both columns, nullable, no default:
--
-- SELECT table_name, column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND column_name IN ('archived_at','archived_by')
--  ORDER BY table_name, column_name;
--
-- Expect 10 rows, every is_nullable = YES, every column_default = NULL.
--
-- 2. The indexes exist:
--
-- SELECT indexname FROM pg_indexes
--  WHERE schemaname = 'public' AND indexname LIKE '%archived_at_idx'
--  ORDER BY indexname;
--
-- Expect 5 rows.
--
-- 3. Still no DELETE policy anywhere it matters — this must stay empty:
--
-- SELECT tablename, policyname FROM pg_policies
--  WHERE schemaname = 'public' AND cmd = 'DELETE'
--    AND tablename IN ('deals','contracts','invoices','raw_material_orders','shipments');
--
-- Expect 0 rows.
