-- ============================================================================
-- WAKUD PLANT COMMAND — Phase 4: tasks (To-Do board)
-- ============================================================================
-- Run this in the Supabase SQL Editor after setup.sql + grant-privileges.sql.
-- Safe to run more than once (idempotent).
--
-- A shared team to-do list. Reads open to any signed-in user; any signed-in
-- user may create/manage tasks (collaborative). Append-only audit is handled
-- in the app, not here.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  assignee TEXT,
  due_date DATE,
  -- Optional link to another record in the app.
  link_type TEXT CHECK (link_type IN ('deal','contract','batch')),
  link_id TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth can read tasks" ON public.tasks;
DROP POLICY IF EXISTS "Auth can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Auth can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Auth can delete tasks" ON public.tasks;
CREATE POLICY "Auth can read tasks"   ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update tasks" ON public.tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth can delete tasks" ON public.tasks FOR DELETE TO authenticated USING (true);

-- Table privileges (RLS still gates rows). Mirrors grant-privileges.sql intent.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;

CREATE INDEX IF NOT EXISTS tasks_status_idx ON public.tasks (status);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON public.tasks (due_date);
