-- ============================================================================
-- WAKUD PLANT COMMAND — Phase 3: audit_log INSERT policy
-- ============================================================================
-- Run this in the Supabase SQL Editor after setup.sql + grant-privileges.sql.
--
-- WHY: setup.sql created audit_log with only a SELECT policy, so the app's
-- shared audit helper (lib/audit.ts) can't write change records — inserts
-- fail under RLS (default deny). This adds the INSERT policy. The table GRANT
-- already exists from grant-privileges.sql.
--
-- Writes are allowed for any authenticated user (the app sets user_id to the
-- acting user). audit_log stays read-only to anon and has no UPDATE/DELETE
-- policy, so entries are append-only / tamper-resistant.
--
-- Safe to run more than once (idempotent).
-- ============================================================================

DROP POLICY IF EXISTS "Auth can insert audit_log" ON public.audit_log;
CREATE POLICY "Auth can insert audit_log" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (true);
