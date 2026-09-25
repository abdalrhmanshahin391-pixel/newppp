CREATE TABLE public.shared_question_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  title text NOT NULL,
  description text,
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

CREATE TABLE public.shared_question_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id uuid NOT NULL REFERENCES public.shared_question_sets(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  stem text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation text NOT NULL DEFAULT '',
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.space_question_sets (
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  set_id uuid NOT NULL REFERENCES public.shared_question_sets(id) ON DELETE CASCADE,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, set_id)
);

CREATE INDEX shared_question_sets_feed_idx
  ON public.shared_question_sets (audience, published, created_at DESC);
CREATE INDEX shared_question_sets_top_idx
  ON public.shared_question_sets (audience, published, save_count DESC);
CREATE INDEX shared_question_sets_owner_idx ON public.shared_question_sets (owner_id, created_at DESC);
CREATE INDEX shared_question_items_set_idx ON public.shared_question_items (set_id, sort);
CREATE INDEX space_question_sets_set_idx ON public.space_question_sets (set_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_question_sets TO authenticated;
GRANT ALL ON public.shared_question_sets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_question_items TO authenticated;
GRANT ALL ON public.shared_question_items TO service_role;
GRANT SELECT, INSERT, DELETE ON public.space_question_sets TO authenticated;
GRANT ALL ON public.space_question_sets TO service_role;

ALTER TABLE public.shared_question_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_question_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_question_sets ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "own question sets" ON public.shared_question_sets
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "read public question sets" ON public.shared_question_sets
  FOR SELECT TO authenticated
  USING (published AND audience = 'public');

CREATE POLICY "read space question sets" ON public.shared_question_sets
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.space_question_sets q
    WHERE q.set_id = shared_question_sets.id AND public.is_space_member(q.space_id, auth.uid())
  ));

CREATE POLICY "own question items" ON public.shared_question_items
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "read shared question items" ON public.shared_question_items
  FOR SELECT TO authenticated
  USING (public.can_read_question_set(set_id, auth.uid()));

CREATE POLICY "members read space question sets" ON public.space_question_sets
  FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));

CREATE POLICY "members add space question sets" ON public.space_question_sets
  FOR INSERT TO authenticated
  WITH CHECK (public.space_can_add_decks(space_id, auth.uid()));

CREATE POLICY "remove space question sets" ON public.space_question_sets
  FOR DELETE TO authenticated
  USING (added_by = auth.uid() OR public.can_manage_space(space_id, auth.uid()));

CREATE TRIGGER shared_question_sets_touch
  BEFORE UPDATE ON public.shared_question_sets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();