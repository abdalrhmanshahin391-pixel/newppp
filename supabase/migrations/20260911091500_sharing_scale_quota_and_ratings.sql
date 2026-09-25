-- ============================================================
-- Sharing Scale, 5/Day Quota Support, Space Folders & Question Ratings
-- ============================================================

-- 1. Space Folder column on space_question_sets
ALTER TABLE public.space_question_sets
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.space_folders(id) ON DELETE SET NULL;

-- 2. Rating columns on shared_question_sets
ALTER TABLE public.shared_question_sets
  ADD COLUMN IF NOT EXISTS rating_avg numeric(3,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0;

-- 3. Question set ratings table
CREATE TABLE IF NOT EXISTS public.question_set_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id uuid NOT NULL REFERENCES public.shared_question_sets(id) ON DELETE CASCADE,
  space_id uuid REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  stars smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  note text,
  under_review boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS question_set_ratings_one_global
  ON public.question_set_ratings (user_id, set_id) WHERE space_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS question_set_ratings_one_space
  ON public.question_set_ratings (user_id, set_id, space_id) WHERE space_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS question_set_ratings_set_idx
  ON public.question_set_ratings (set_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_set_ratings TO authenticated;
GRANT ALL ON public.question_set_ratings TO service_role;
ALTER TABLE public.question_set_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own question set rating read" ON public.question_set_ratings;
CREATE POLICY "own question set rating read" ON public.question_set_ratings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "own question set rating write" ON public.question_set_ratings;
CREATE POLICY "own question set rating write" ON public.question_set_ratings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own question set rating update" ON public.question_set_ratings;
CREATE POLICY "own question set rating update" ON public.question_set_ratings FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own question set rating delete" ON public.question_set_ratings;
CREATE POLICY "own question set rating delete" ON public.question_set_ratings FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Recount trigger
CREATE OR REPLACE FUNCTION public.recount_question_set_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _set uuid;
BEGIN
  _set := COALESCE(NEW.set_id, OLD.set_id);
  UPDATE public.shared_question_sets s SET
    rating_avg = COALESCE((SELECT ROUND(AVG(r.stars)::numeric, 2) FROM public.question_set_ratings r
                            WHERE r.set_id = _set AND r.space_id IS NULL AND NOT r.under_review), 0),
    rating_count = COALESCE((SELECT COUNT(*) FROM public.question_set_ratings r
                            WHERE r.set_id = _set AND r.space_id IS NULL AND NOT r.under_review), 0)
  WHERE s.id = _set;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS question_set_ratings_recount ON public.question_set_ratings;
CREATE TRIGGER question_set_ratings_recount
AFTER INSERT OR UPDATE OR DELETE ON public.question_set_ratings
FOR EACH ROW EXECUTE FUNCTION public.recount_question_set_rating();

-- Rate a question set RPC
CREATE OR REPLACE FUNCTION public.rate_question_set(_set_id uuid, _stars smallint, _note text DEFAULT NULL, _space_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _new boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  IF _stars < 1 OR _stars > 5 THEN RAISE EXCEPTION 'stars must be 1..5'; END IF;
  IF _space_id IS NOT NULL AND NOT public.is_space_member(_space_id, _uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT (p.created_at > now() - interval '2 days') INTO _new FROM public.profiles p WHERE p.id = _uid;

  IF _space_id IS NULL THEN
    INSERT INTO public.question_set_ratings (set_id, user_id, stars, note, under_review)
    VALUES (_set_id, _uid, _stars, NULLIF(btrim(COALESCE(_note,'')),''), COALESCE(_new,false))
    ON CONFLICT (user_id, set_id) WHERE space_id IS NULL
    DO UPDATE SET stars = EXCLUDED.stars, note = EXCLUDED.note, updated_at = now();
  ELSE
    INSERT INTO public.question_set_ratings (set_id, space_id, user_id, stars, note, under_review)
    VALUES (_set_id, _space_id, _uid, _stars, NULLIF(btrim(COALESCE(_note,'')),''), COALESCE(_new,false))
    ON CONFLICT (user_id, set_id, space_id) WHERE space_id IS NOT NULL
    DO UPDATE SET stars = EXCLUDED.stars, note = EXCLUDED.note, updated_at = now();
  END IF;
END; $$;
REVOKE EXECUTE ON FUNCTION public.rate_question_set(uuid, smallint, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.rate_question_set(uuid, smallint, text, uuid) TO authenticated;

-- Rating summary RPC
CREATE OR REPLACE FUNCTION public.question_set_rating_summary(_set_id uuid, _space_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _avg numeric;
  _cnt integer;
  _mine record;
  _b jsonb;
BEGIN
  SELECT ROUND(AVG(stars)::numeric, 2), COUNT(*)
    INTO _avg, _cnt
    FROM public.question_set_ratings
   WHERE set_id = _set_id
     AND ((_space_id IS NULL AND space_id IS NULL) OR (_space_id IS NOT NULL AND space_id = _space_id))
     AND NOT under_review;

  IF _uid IS NOT NULL THEN
    SELECT stars, note INTO _mine FROM public.question_set_ratings
     WHERE set_id = _set_id
       AND user_id = _uid
       AND ((_space_id IS NULL AND space_id IS NULL) OR (_space_id IS NOT NULL AND space_id = _space_id))
     LIMIT 1;
  END IF;

  SELECT COALESCE(jsonb_object_agg(stars, c), '{}'::jsonb) INTO _b FROM (
    SELECT stars, count(*) AS c
      FROM public.question_set_ratings
     WHERE set_id = _set_id
       AND ((_space_id IS NULL AND space_id IS NULL) OR (_space_id IS NOT NULL AND space_id = _space_id))
       AND NOT under_review
     GROUP BY stars
  ) t;

  RETURN jsonb_build_object(
    'avg', COALESCE(_avg, 0),
    'count', COALESCE(_cnt, 0),
    'breakdown', COALESCE(_b, '{}'::jsonb),
    'mine', CASE WHEN _mine.stars IS NOT NULL THEN jsonb_build_object('stars', _mine.stars, 'note', _mine.note) ELSE NULL END
  );
END; $$;
REVOKE EXECUTE ON FUNCTION public.question_set_rating_summary(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.question_set_rating_summary(uuid, uuid) TO authenticated;

-- 4. High-Performance Composite Indexes for Millions of Rows
CREATE INDEX IF NOT EXISTS idx_shared_decks_pub_feed ON public.shared_decks (audience, published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_decks_pub_top ON public.shared_decks (audience, published, save_count DESC);
CREATE INDEX IF NOT EXISTS idx_shared_decks_owner_today ON public.shared_decks (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shared_question_sets_pub_feed ON public.shared_question_sets (audience, published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_question_sets_pub_top ON public.shared_question_sets (audience, published, save_count DESC);
CREATE INDEX IF NOT EXISTS idx_shared_question_sets_pub_rating ON public.shared_question_sets (audience, published, rating_avg DESC);
CREATE INDEX IF NOT EXISTS idx_shared_question_sets_source_feed ON public.shared_question_sets (source_type, audience, published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_question_sets_owner_today ON public.shared_question_sets (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_question_items_set_sort ON public.shared_question_items (set_id, sort);
