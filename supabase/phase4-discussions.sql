-- ============================================================================
-- WAKUD PLANT COMMAND — Phase 4: Discussions (channels + messages)
-- ============================================================================
-- Run this in the Supabase SQL Editor after setup.sql + grant-privileges.sql.
-- Safe to run more than once (idempotent).
--
-- In-app team chat: channels with threaded messages. Reads open to any signed-in
-- user; any signed-in user may post (messages are stamped with their uid).
-- Messages are append-only (no UPDATE/DELETE policy) so the archive is stable.
-- Realtime is enabled on messages (and channels) so new posts stream live.
-- Item references (@deal:ID, @contract:ID, @batch:ID) are stored inline in the
-- message body and rendered as deep links in the app.
-- ============================================================================

-- ---- Channels --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth can read channels" ON public.channels;
DROP POLICY IF EXISTS "Auth can insert channels" ON public.channels;
CREATE POLICY "Auth can read channels"   ON public.channels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert channels" ON public.channels FOR INSERT TO authenticated WITH CHECK (true);
GRANT SELECT, INSERT ON public.channels TO authenticated;

-- ---- Messages (threaded via parent_id) -------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  author_email TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth can read messages" ON public.messages;
DROP POLICY IF EXISTS "Auth can insert messages" ON public.messages;
CREATE POLICY "Auth can read messages"   ON public.messages FOR SELECT TO authenticated USING (true);
-- Posters can only write rows stamped with their own uid.
CREATE POLICY "Auth can insert messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT ON public.messages TO authenticated;

CREATE INDEX IF NOT EXISTS messages_channel_created_idx ON public.messages (channel_id, created_at);
CREATE INDEX IF NOT EXISTS messages_parent_idx ON public.messages (parent_id);

-- ---- Realtime: stream new channels + messages ------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'channels') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;
  END IF;
END $$;

-- ---- Default channels (idempotent) -----------------------------------------
INSERT INTO public.channels (name, description)
VALUES
  ('general',    'Facility-wide discussion'),
  ('deals',      'Trade evaluation & pipeline'),
  ('production', 'Plant & output'),
  ('compliance', 'ISCC & audit'),
  ('logistics',  'Shipments & deliveries')
ON CONFLICT (name) DO NOTHING;
