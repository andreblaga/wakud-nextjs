-- ============================================================================
-- WAKUD PLANT COMMAND — RLS hardening + admin / executive-viewer roles
-- ============================================================================
-- Run this in the Supabase SQL Editor AFTER:
--   setup.sql · grant-privileges.sql · phase3-audit-log-policy.sql ·
--   phase4-tasks.sql · phase4-discussions.sql · roles-admin-viewer.sql
--
-- Safe to run more than once (idempotent).
--
-- WHAT THIS REPLACES
-- ------------------
-- setup.sql shipped prototype policies: every data table had
-- "Auth can insert/update ... WITH CHECK (true)", meaning ANY signed-in user
-- could write ANY table regardless of role. Several tables also had
-- "Anon can read ..." policies, which — because the anon key ships in the
-- browser bundle — made commercial data readable over the REST API by anyone
-- who could load the login page. This file closes both.
--
-- Three structural fixes beyond the per-table matrix:
--   1. user_roles "Users can insert own role" is DROPPED. It let any signed-in
--      user insert their own role row with any value — i.e. self-promote to gm.
--      Provisioning is admin-only now (see app/admin).
--   2. Role management moves from gm to admin. GM keeps full *business* write
--      access but loses user management and system settings.
--   3. executive_viewer gets no write access to any business table. It is a
--      genuine read-only role at the database, not just in the UI.
--
-- Discussions is the deliberate exception: channels/messages are writable by
-- every role INCLUDING executive_viewer (decision 2026-08-13 — execs take part
-- in the conversation; they just can't change records). Discussions writes go
-- straight from the browser client, so RLS is their only gate.
--
-- NOTE ON THE APPROACH
-- --------------------
-- The block below DROPS EVERY EXISTING POLICY on each managed table before
-- recreating the canonical set. That is intentional: it guarantees no stale
-- permissive policy survives the hardening. If you have added policies by hand
-- in the dashboard, re-add them after running this.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Role helpers
-- ----------------------------------------------------------------------------
-- has_role() from setup.sql is generic and unchanged. This adds the set form,
-- so each policy is one readable line instead of chained ORs.
--
-- SECURITY DEFINER is required: the policies on user_roles itself call this,
-- and a non-definer function would recurse through user_roles' own RLS.
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  )
$$;

-- Convenience wrapper for admin-only gates (mirrors isAdmin() in lib/permissions.ts).
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- ----------------------------------------------------------------------------
-- 2. Per-table write matrix
-- ----------------------------------------------------------------------------
-- Reads: open to every signed-in role (including executive_viewer) on every
-- table. Anon reads: removed entirely — see section 5.
--
-- The VALUES list below IS the write matrix. Columns:
--   tbl           table in the public schema
--   writers       roles allowed to INSERT (and UPDATE, where allowed)
--   allow_update  false = insert-only / append-only table
--   allow_delete  false = no DELETE policy, so deletes are denied to everyone
--
-- Role shorthand used in the comments:
--   ALL_W = admin, gm, operations, sales, finance   (every writing role)
--   OPS   = admin, gm, operations
--   COMM  = admin, gm, sales
--   FIN   = admin, gm, finance
--   MGR   = admin, gm
DO $$
DECLARE
  t record;
  p record;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      -- ---- Commercial ------------------------------------------------------
      ('deals',                    ARRAY['admin','gm','sales'],                            true,  false),
      ('contracts',                ARRAY['admin','gm'],                                    true,  false),
      ('contract_volumes',         ARRAY['admin','gm','sales','finance'],                  true,  false),
      ('invoices',                 ARRAY['admin','gm','finance'],                          true,  false),
      -- Export records are a log of what was sent to finance: insert-only.
      ('finance_exports',          ARRAY['admin','gm','finance'],                          false, false),
      -- Computed/synced by the forecast job (service role bypasses RLS): no writers.
      ('monthly_forecast',         ARRAY[]::text[],                                        false, false),
      -- Market prices: anyone who trades, bills, or buys UCO may record them.
      ('prices',                   ARRAY['admin','gm','operations','sales','finance'],     true,  false),
      ('price_feeds',              ARRAY['admin','gm','operations','sales','finance'],     true,  false),
      -- The USD/OMR peg is a system assumption, not business data: admin only.
      ('exchange_rates',           ARRAY['admin'],                                         true,  false),

      -- ---- Operations ------------------------------------------------------
      ('production_plan',          ARRAY['admin','gm','operations'],                       true,  false),
      ('production_actuals',       ARRAY['admin','gm','operations'],                       true,  false),
      ('production_confirmations', ARRAY['admin','gm','operations'],                       true,  false),
      ('stock_levels',             ARRAY['admin','gm','operations'],                       true,  false),
      ('raw_material_orders',      ARRAY['admin','gm','operations'],                       true,  false),
      ('inventory_consumption',    ARRAY['admin','gm','operations'],                       true,  false),
      ('quality_tests',            ARRAY['admin','gm','operations'],                       true,  false),
      ('maintenance_schedule',     ARRAY['admin','gm','operations'],                       true,  false),
      ('shipments',                ARRAY['admin','gm','operations'],                       true,  false),
      ('iscc_certificates',        ARRAY['admin','gm','operations'],                       true,  false),

      -- ---- Shared ----------------------------------------------------------
      ('tasks',                    ARRAY['admin','gm','operations','sales','finance'],     true,  true),
      ('documents',                ARRAY['admin','gm','operations','sales','finance'],     true,  false),
      -- Raised by the app under the acting user's session (lib/reorder.ts), so
      -- every writing role needs INSERT or stock saves start failing.
      ('system_alerts',            ARRAY['admin','gm','operations','sales','finance'],     true,  false),
      -- Append-only audit trail (lib/audit.ts writes as the acting user).
      -- No UPDATE/DELETE for anyone, including admin.
      ('audit_log',                ARRAY['admin','gm','operations','sales','finance'],     false, false)
    ) AS v(tbl, writers, allow_update, allow_delete)
  LOOP
    -- Clear every existing policy so nothing permissive survives.
    FOR p IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t.tbl
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t.tbl);
    END LOOP;

    -- Reads: every signed-in user, no exceptions.
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
      'Signed-in can read ' || t.tbl, t.tbl
    );

    IF array_length(t.writers, 1) IS NOT NULL THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), %L))',
        'Owners can insert ' || t.tbl, t.tbl, t.writers
      );

      IF t.allow_update THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), %L)) WITH CHECK (public.has_any_role(auth.uid(), %L))',
          'Owners can update ' || t.tbl, t.tbl, t.writers, t.writers
        );
      END IF;

      IF t.allow_delete THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.has_any_role(auth.uid(), %L))',
          'Owners can delete ' || t.tbl, t.tbl, t.writers
        );
      END IF;
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 3. user_roles — admin-only management
-- ----------------------------------------------------------------------------
-- Every signed-in user may READ roles (the app shows "who is what", and
-- getSessionUser reads the caller's own row). Only admin may change them.
DROP POLICY IF EXISTS "Authenticated can read roles" ON public.user_roles;
DROP POLICY IF EXISTS "GM can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;  -- self-escalation hole
DROP POLICY IF EXISTS "Signed-in can read roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can manage roles" ON public.user_roles;

CREATE POLICY "Signed-in can read roles" ON public.user_roles
  FOR SELECT TO authenticated USING (true);

-- FOR ALL covers INSERT/UPDATE/DELETE; the SELECT policy above is OR'd in, so
-- reads stay open to everyone.
CREATE POLICY "Admin can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 4. Discussions — every role may take part, including executive_viewer
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Auth can read channels" ON public.channels;
DROP POLICY IF EXISTS "Auth can insert channels" ON public.channels;
DROP POLICY IF EXISTS "Signed-in can read channels" ON public.channels;
DROP POLICY IF EXISTS "Signed-in can create channels" ON public.channels;

CREATE POLICY "Signed-in can read channels" ON public.channels
  FOR SELECT TO authenticated USING (true);
-- Any user holding a role may open a channel (executive_viewer included).
CREATE POLICY "Signed-in can create channels" ON public.channels
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','gm','operations','sales','finance','executive_viewer']));

DROP POLICY IF EXISTS "Auth can read messages" ON public.messages;
DROP POLICY IF EXISTS "Auth can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Signed-in can read messages" ON public.messages;
DROP POLICY IF EXISTS "Signed-in can post messages" ON public.messages;

CREATE POLICY "Signed-in can read messages" ON public.messages
  FOR SELECT TO authenticated USING (true);
-- Posters may only write rows stamped with their own uid (unchanged), and must
-- hold a role — a user with no role row cannot post.
CREATE POLICY "Signed-in can post messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.has_any_role(auth.uid(), ARRAY['admin','gm','operations','sales','finance','executive_viewer'])
  );
-- Still no UPDATE/DELETE policy: the message archive stays append-only.

-- ----------------------------------------------------------------------------
-- 5. Remove anonymous (signed-out) access
-- ----------------------------------------------------------------------------
-- setup.sql let anon read deals, contracts, contract_volumes, production_plan,
-- stock_levels, prices, monthly_forecast and price_feeds. Those policies are
-- already gone (section 2 dropped every policy on each table), which is enough
-- on its own — RLS default-denies. The REVOKEs below are defence in depth, so
-- a future policy added without thinking cannot re-expose the data.
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM anon;

-- The app never queries as anon — every page sits behind the middleware auth
-- check, and the login page only talks to GoTrue (auth), not PostgREST.
--
-- IMPORTANT: supabase/grant-privileges.sql has been updated to match. If you
-- re-run an older copy of it, it will re-grant anon SELECT and undo this.

-- ----------------------------------------------------------------------------
-- 6. Document storage
-- ----------------------------------------------------------------------------
-- The wakud-documents bucket was created PUBLIC, so every uploaded file was
-- fetchable by URL with no auth at all. Flip it private; uploads are limited to
-- roles that can write, reads to any signed-in user.
--
-- Consequence for whoever builds the upload UI: public URLs no longer resolve.
-- Use createSignedUrl() when rendering document links. Nothing reads the
-- documents table today, so there is nothing to migrate.
UPDATE storage.buckets SET public = false WHERE id = 'wakud-documents';

DROP POLICY IF EXISTS "Auth can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Auth can read documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can read documents" ON storage.objects;
DROP POLICY IF EXISTS "Owners can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Signed-in can read documents" ON storage.objects;

CREATE POLICY "Owners can upload documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'wakud-documents'
    AND public.has_any_role(auth.uid(), ARRAY['admin','gm','operations','sales','finance'])
  );

CREATE POLICY "Signed-in can read documents" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'wakud-documents');

-- ============================================================================
-- VERIFY
-- ============================================================================
-- 1. No permissive write policies remain (should return zero rows):
--      SELECT tablename, policyname, cmd, with_check FROM pg_policies
--      WHERE schemaname = 'public' AND cmd IN ('INSERT','UPDATE')
--        AND with_check = 'true';
--
-- 2. No anon policies remain (should return zero rows):
--      SELECT tablename, policyname FROM pg_policies
--      WHERE schemaname = 'public' AND 'anon' = ANY(roles);
--
-- 3. Self-insert hole is gone (should return zero rows):
--      SELECT policyname FROM pg_policies
--      WHERE tablename = 'user_roles' AND policyname = 'Users can insert own role';
--
-- 4. Spot-check the matrix for one role:
--      SELECT public.has_any_role(
--        (SELECT user_id FROM public.user_roles WHERE role = 'executive_viewer' LIMIT 1),
--        ARRAY['admin','gm','operations','sales','finance']
--      );  -- expect false
-- ============================================================================
