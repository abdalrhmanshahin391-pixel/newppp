-- 1. Device Limit update to 50 devices & unlock affected accounts
UPDATE public.device_security_settings
  SET default_device_limit = 50
  WHERE id = true;

UPDATE public.profiles
  SET device_limit = 50
  WHERE device_limit IS NOT NULL AND device_limit < 50;

UPDATE public.profiles
  SET locked_at = NULL, lock_reason = NULL
  WHERE lock_reason = 'device_limit';

-- 2. Shared Question Sets
CREATE TABLE IF NOT EXISTS public.shared_question_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  source_type text NOT NULL DEFAULT 'lecture', -- 'bank' | 'archive' | 'lecture'
  subject text,
  cover text NOT NULL DEFAULT 'sky',
  emoji text,
  tags text[] NOT NULL DEFAULT '{}',
  question_count integer NOT NULL DEFAULT 0,
  save_count integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  audience text NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Shared Question Items
CREATE TABLE IF NOT EXISTS public.shared_question_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id uuid NOT NULL REFERENCES public.shared_question_sets(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  source_type text NOT NULL DEFAULT 'lecture',
  subject text,
  subtopic text,
  stem text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation text NOT NULL DEFAULT '',
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Space Question Sets join table
CREATE TABLE IF NOT EXISTS public.space_question_sets (
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  set_id uuid NOT NULL REFERENCES public.shared_question_sets(id) ON DELETE CASCADE,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, set_id)
);

-- 5. Shared Question Saves table
CREATE TABLE IF NOT EXISTS public.shared_question_saves (
  set_id uuid NOT NULL REFERENCES public.shared_question_sets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (set_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS shared_question_sets_feed_idx
  ON public.shared_question_sets (audience, published, created_at DESC);
CREATE INDEX IF NOT EXISTS shared_question_sets_top_idx
  ON public.shared_question_sets (audience, published, save_count DESC);
CREATE INDEX IF NOT EXISTS shared_question_sets_owner_idx
  ON public.shared_question_sets (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shared_question_sets_source_idx
  ON public.shared_question_sets (source_type);
CREATE INDEX IF NOT EXISTS shared_question_items_set_idx
  ON public.shared_question_items (set_id, sort);
CREATE INDEX IF NOT EXISTS space_question_sets_set_idx
  ON public.space_question_sets (set_id);

-- Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_question_sets TO authenticated;
GRANT ALL ON public.shared_question_sets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_question_items TO authenticated;
GRANT ALL ON public.shared_question_items TO service_role;
GRANT SELECT, INSERT, DELETE ON public.space_question_sets TO authenticated;
GRANT ALL ON public.space_question_sets TO service_role;
GRANT SELECT, INSERT, DELETE ON public.shared_question_saves TO authenticated;
GRANT ALL ON public.shared_question_saves TO service_role;

-- Enable RLS
ALTER TABLE public.shared_question_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_question_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_question_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_question_saves ENABLE ROW LEVEL SECURITY;

-- Helper function to check read permission
CREATE OR REPLACE FUNCTION public.can_read_question_set(_set_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shared_question_sets s
    WHERE s.id = _set_id
      AND (
        s.owner_id = _user_id
        OR (s.published AND s.audience = 'public')
        OR EXISTS (
          SELECT 1 FROM public.space_question_sets q
          WHERE q.set_id = s.id AND public.is_space_member(q.space_id, _user_id)
        )
      )
  )
$$;

-- RLS Policies
DROP POLICY IF EXISTS "own question sets" ON public.shared_question_sets;
CREATE POLICY "own question sets" ON public.shared_question_sets
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "read public question sets" ON public.shared_question_sets;
CREATE POLICY "read public question sets" ON public.shared_question_sets
  FOR SELECT TO authenticated
  USING (published AND audience = 'public');

DROP POLICY IF EXISTS "read space question sets" ON public.shared_question_sets;
CREATE POLICY "read space question sets" ON public.shared_question_sets
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.space_question_sets q
    WHERE q.set_id = shared_question_sets.id AND public.is_space_member(q.space_id, auth.uid())
  ));

DROP POLICY IF EXISTS "own question items" ON public.shared_question_items;
CREATE POLICY "own question items" ON public.shared_question_items
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "read shared question items" ON public.shared_question_items;
CREATE POLICY "read shared question items" ON public.shared_question_items
  FOR SELECT TO authenticated
  USING (public.can_read_question_set(set_id, auth.uid()));

DROP POLICY IF EXISTS "members read space question sets" ON public.space_question_sets;
CREATE POLICY "members read space question sets" ON public.space_question_sets
  FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));

DROP POLICY IF EXISTS "members add space question sets" ON public.space_question_sets;
CREATE POLICY "members add space question sets" ON public.space_question_sets
  FOR INSERT TO authenticated
  WITH CHECK (public.space_can_add_decks(space_id, auth.uid()));

DROP POLICY IF EXISTS "remove space question sets" ON public.space_question_sets;
CREATE POLICY "remove space question sets" ON public.space_question_sets
  FOR DELETE TO authenticated
  USING (added_by = auth.uid() OR public.can_manage_space(space_id, auth.uid()));

DROP POLICY IF EXISTS "manage own question saves" ON public.shared_question_saves;
CREATE POLICY "manage own question saves" ON public.shared_question_saves
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Function to bump save counts
CREATE OR REPLACE FUNCTION public.bump_question_set_saves(_set_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.shared_question_sets
     SET save_count = (SELECT count(*) FROM public.shared_question_saves s WHERE s.set_id = _set_id)
   WHERE id = _set_id;
$$;
REVOKE ALL ON FUNCTION public.bump_question_set_saves(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bump_question_set_saves(uuid) TO authenticated;
