CREATE OR REPLACE FUNCTION public.ensure_lq_default_bucket()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _subject_id uuid;
  _subtopic_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Please sign in again.'; END IF;

  SELECT id INTO _subject_id
  FROM public.lq_subjects
  WHERE user_id = _uid AND lower(btrim(name)) = 'my lectures'
  ORDER BY created_at
  LIMIT 1;

  IF _subject_id IS NULL THEN
    INSERT INTO public.lq_subjects (user_id, name)
    VALUES (_uid, 'My lectures')
    RETURNING id INTO _subject_id;
  END IF;

  SELECT id INTO _subtopic_id
  FROM public.lq_subtopics
  WHERE user_id = _uid AND subject_id = _subject_id AND lower(btrim(name)) = 'general'
  ORDER BY created_at
  LIMIT 1;

  IF _subtopic_id IS NULL THEN
    INSERT INTO public.lq_subtopics (user_id, subject_id, name)
    VALUES (_uid, _subject_id, 'General')
    RETURNING id INTO _subtopic_id;
  END IF;

  RETURN jsonb_build_object('subjectId', _subject_id, 'subtopicId', _subtopic_id);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_lq_default_bucket() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_lq_default_bucket() TO authenticated;

CREATE OR REPLACE FUNCTION public.save_lq_generation(
  _subtopic_id uuid,
  _title text,
  _source_name text,
  _difficulty text,
  _key_points jsonb,
  _questions jsonb,
  _lecture_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _saved_lecture_id uuid;
  _question jsonb;
  _index integer := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Please sign in again.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.lq_subtopics
    WHERE id = _subtopic_id AND user_id = _uid
  ) THEN
    RAISE EXCEPTION 'That sub-subject is not available in your account.';
  END IF;
  IF jsonb_typeof(_questions) <> 'array' OR jsonb_array_length(_questions) = 0 THEN
    RAISE EXCEPTION 'No valid questions were generated.';
  END IF;

  IF _lecture_id IS NULL THEN
    INSERT INTO public.lq_lectures (
      user_id, subtopic_id, title, source_name, difficulty, key_points, question_count
    ) VALUES (
      _uid, _subtopic_id, btrim(_title), NULLIF(btrim(COALESCE(_source_name, '')), ''),
      _difficulty, COALESCE(_key_points, '[]'::jsonb), jsonb_array_length(_questions)
    ) RETURNING id INTO _saved_lecture_id;
  ELSE
    SELECT id INTO _saved_lecture_id
    FROM public.lq_lectures
    WHERE id = _lecture_id AND user_id = _uid
    FOR UPDATE;
    IF _saved_lecture_id IS NULL THEN RAISE EXCEPTION 'That lecture is not available in your account.'; END IF;

    DELETE FROM public.lq_questions WHERE lecture_id = _saved_lecture_id AND user_id = _uid;
    UPDATE public.lq_lectures
    SET title = btrim(_title),
        source_name = NULLIF(btrim(COALESCE(_source_name, '')), ''),
        difficulty = _difficulty,
        key_points = COALESCE(_key_points, '[]'::jsonb),
        question_count = jsonb_array_length(_questions)
    WHERE id = _saved_lecture_id AND user_id = _uid;
  END IF;

  FOR _question IN SELECT value FROM jsonb_array_elements(_questions)
  LOOP
    INSERT INTO public.lq_questions (
      user_id, lecture_id, stem, options, explanation, point_ref, sort_order
    ) VALUES (
      _uid,
      _saved_lecture_id,
      btrim(_question->>'stem'),
      COALESCE(_question->'options', '[]'::jsonb),
      COALESCE(_question->>'explanation', ''),
      NULLIF(btrim(COALESCE(_question->>'point_ref', '')), ''),
      _index
    );
    _index := _index + 1;
  END LOOP;

  RETURN _saved_lecture_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_lq_generation(uuid, text, text, text, jsonb, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_lq_generation(uuid, text, text, text, jsonb, jsonb, uuid) TO authenticated;