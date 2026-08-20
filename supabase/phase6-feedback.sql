-- ============================================================================
-- WAKUD OS — Phase 6: feedback & ideas
-- ============================================================================
-- Run in the Supabase SQL Editor after phase5d-archive.sql. Safe to re-run.
--
-- A place for staff to raise ideas and problems, with a threaded conversation
-- so Andre can reply and they can reply back.
--
-- WHY A SEPARATE TABLE rather than reusing what exists:
--   `tasks` is the team's to-do board — work someone has committed to doing,
--   with an assignee and a due date. Feedback is a *request*, which may never
--   become work at all. Folding requests into the board would mean the To-Do
--   page fills with things nobody agreed to do.
--   `messages` is free-form chat with no title, no status and no triage.
-- Feedback that is accepted can become a task via feedback.task_id — the link
-- exists so nothing has to be retyped.
--
-- ⚠️ AFTER RUNNING: regenerate the typed client (temp file first — the CLI
--    writes errors to stdout):
--      npx supabase gen types typescript --project-id ftrtekdiabttvjlfgisy > types.new.ts
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. feedback
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feedback (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  description    TEXT,
  -- new -> reviewing -> planned -> done, or declined at any point.
  status         TEXT NOT NULL DEFAULT 'new'
                 CHECK (status IN ('new','reviewing','planned','done','declined')),
  category       TEXT
                 CHECK (category IS NULL OR category IN ('idea','problem','question','data')),
  -- Declining without a reason is how a feedback channel dies. The app should
  -- require this when moving to 'declined'; the DB records it either way.
  resolution     TEXT,
  submitted_by   UUID REFERENCES auth.users(id),
  -- Set when accepted feedback is turned into a to-do item.
  task_id        UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- No hard delete anywhere in this app (see roles-rls.sql). Archive instead.
  archived_at    TIMESTAMPTZ,
  archived_by    UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS feedback_status_idx      ON public.feedback (status);
CREATE INDEX IF NOT EXISTS feedback_created_idx     ON public.feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_archived_idx    ON public.feedback (archived_at);
CREATE INDEX IF NOT EXISTS feedback_submitted_by_idx ON public.feedback (submitted_by);

COMMENT ON COLUMN public.feedback.resolution IS
  'Why this was declined, or what was done. Required by the app when status becomes ''declined'' — people stop submitting when requests vanish without explanation.';
COMMENT ON COLUMN public.feedback.task_id IS
  'Set when accepted feedback is converted into a tasks row, so the request and the work stay linked.';

-- ---------------------------------------------------------------------------
-- 2. feedback_comments — the thread
-- ---------------------------------------------------------------------------
-- Flat, not nested. A feedback item is a conversation between the submitter and
-- whoever responds; threading within it would be structure nobody needs.
CREATE TABLE IF NOT EXISTS public.feedback_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  author_id   UUID NOT NULL REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_comments_feedback_idx
  ON public.feedback_comments (feedback_id, created_at);

-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.feedback          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_comments ENABLE ROW LEVEL SECURITY;

-- Visibility: everyone signed in sees everything (decision 2026-08-19). With a
-- team of eight, duplicate requests cost more than the candour risk, and one
-- answer serves everybody.
DROP POLICY IF EXISTS "Auth can read feedback" ON public.feedback;
CREATE POLICY "Auth can read feedback"
  ON public.feedback FOR SELECT TO authenticated USING (true);

-- ⚠️ DELIBERATE EXCEPTION, same shape as Discussions: every signed-in user may
-- submit feedback INCLUDING executive_viewer. Feedback is not business data —
-- locking the CEO out of the suggestion box would be absurd. The per-role write
-- matrix in roles-rls.sql governs business tables and does not apply here.
DROP POLICY IF EXISTS "Auth can submit feedback" ON public.feedback;
CREATE POLICY "Auth can submit feedback"
  ON public.feedback FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid());

-- Submitters may edit their own item; admin and gm may triage any of them.
-- Which COLUMNS each may change is enforced in the server action, matching how
-- the rest of this app works — RLS decides rows, the app decides fields.
DROP POLICY IF EXISTS "Owners and managers can update feedback" ON public.feedback;
CREATE POLICY "Owners and managers can update feedback"
  ON public.feedback FOR UPDATE TO authenticated
  USING (submitted_by = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['admin','gm']));

-- No DELETE policy, deliberately. Archiving is an UPDATE.

DROP POLICY IF EXISTS "Auth can read feedback comments" ON public.feedback_comments;
CREATE POLICY "Auth can read feedback comments"
  ON public.feedback_comments FOR SELECT TO authenticated USING (true);

-- Append-only: post as yourself, and no edit or delete. Same rule as messages —
-- a conversation nobody can quietly rewrite.
DROP POLICY IF EXISTS "Auth can post feedback comments" ON public.feedback_comments;
CREATE POLICY "Auth can post feedback comments"
  ON public.feedback_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.feedback          TO authenticated;
GRANT SELECT, INSERT         ON public.feedback_comments TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Realtime, so a reply appears without a refresh (as Discussions does)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback_comments;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------
-- SELECT to_regclass('public.feedback'), to_regclass('public.feedback_comments');
-- SELECT policyname, cmd FROM pg_policies
--  WHERE tablename IN ('feedback','feedback_comments') ORDER BY tablename, cmd;
--   Expect SELECT + INSERT + UPDATE on feedback, SELECT + INSERT on
--   feedback_comments, and NO DELETE on either.
