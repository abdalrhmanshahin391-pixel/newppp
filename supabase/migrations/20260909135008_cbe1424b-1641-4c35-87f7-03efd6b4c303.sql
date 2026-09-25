CREATE OR REPLACE FUNCTION public.effective_plan(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _slug text;
  _base public.plans%ROWTYPE;
  _op public.plans%ROWTYPE;
  _claim public.toolkit_claims%ROWTYPE;
  _out jsonb;
BEGIN
  SELECT plan_slug INTO _slug FROM public.user_plans WHERE user_id = _user_id;
  IF _slug IS NULL THEN _slug := 'starter'; END IF;
  SELECT * INTO _base FROM public.plans WHERE slug = _slug;
  IF _base.slug IS NULL THEN
    SELECT * INTO _base FROM public.plans WHERE published ORDER BY sort LIMIT 1;
  END IF;
  _out := to_jsonb(_base);

  SELECT c.* INTO _claim FROM public.toolkit_claims c
   WHERE c.user_id = _user_id
     AND (c.expires_at IS NULL OR c.expires_at > now())
     AND c.offer_id IS NOT NULL
   ORDER BY c.created_at DESC LIMIT 1;

  IF _claim.id IS NOT NULL THEN
    SELECT * INTO _op FROM public.plans WHERE slug = _claim.plan_slug;
    IF _op.slug IS NOT NULL THEN
      _out := _out || jsonb_build_object(
        'name', _base.name || ' + ' || _op.name,
        'max_flashcards',           public.merge_cap(_base.max_flashcards, _op.max_flashcards),
        'max_ai_questions',         public.merge_cap(_base.max_ai_questions, _op.max_ai_questions),
        'max_summaries',            public.merge_cap(_base.max_summaries, _op.max_summaries),
        'max_todo_tasks',           public.merge_cap(_base.max_todo_tasks, _op.max_todo_tasks),
        'max_calendar_items',       public.merge_cap(_base.max_calendar_items, _op.max_calendar_items),
        'max_groups',               public.merge_cap(_base.max_groups, _op.max_groups),
        'max_all_in_one_lectures',  public.merge_cap(_base.max_all_in_one_lectures, _op.max_all_in_one_lectures),
        'max_all_in_one_questions', public.merge_cap(_base.max_all_in_one_questions, _op.max_all_in_one_questions),
        'max_archive_questions',    public.merge_cap(_base.max_archive_questions, _op.max_archive_questions),
        'todo_full',             _base.todo_full OR _op.todo_full,
        'rich_cards',            _base.rich_cards OR _op.rich_cards,
        'feature_lecture_qgen',  _base.feature_lecture_qgen OR _op.feature_lecture_qgen,
        'feature_archive_qgen',  _base.feature_archive_qgen OR _op.feature_archive_qgen,
        'feature_all_in_one',    _base.feature_all_in_one OR _op.feature_all_in_one,
        'offer_name', _op.name,
        'offer_plan_slug', _op.slug,
        'offer_expires_at', _claim.expires_at
      );
    END IF;
  END IF;

  RETURN _out;
END;
$function$;

CREATE OR REPLACE FUNCTION public.my_plan_usage()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _plan jsonb;
  _usage public.usage_counters%ROWTYPE;
  _admin boolean;
  _g jsonb;
  _exp timestamptz;
BEGIN
  IF _uid IS NULL THEN RETURN NULL; END IF;

  _admin := public.has_role(_uid, 'admin');
  _plan := public.effective_plan(_uid);

  SELECT * INTO _usage FROM public.usage_counters WHERE user_id = _uid AND period = 'lifetime';

  SELECT jsonb_build_object(
    'summaries', COALESCE(SUM(summaries),0),
    'ai_questions', COALESCE(SUM(ai_questions),0),
    'flashcards', COALESCE(SUM(flashcards),0),
    'todo_tasks', COALESCE(SUM(todo_tasks),0),
    'calendar_items', COALESCE(SUM(calendar_items),0),
    'all_in_one_lectures', COALESCE(SUM(all_in_one_lectures),0),
    'all_in_one_questions', COALESCE(SUM(all_in_one_questions),0),
    'archive_questions', COALESCE(SUM(archive_questions),0),
    'groups', COALESCE(SUM(groups),0)
  ) INTO _g
  FROM public.plan_credit_grants
  WHERE user_id = _uid AND (expires_at IS NULL OR expires_at > now());

  SELECT max(c.expires_at) INTO _exp FROM public.toolkit_claims c
   WHERE c.user_id = _uid AND c.expires_at IS NOT NULL AND c.expires_at > now();

  RETURN jsonb_build_object(
    'plan', _plan,
    'grants', COALESCE(_g, '{}'::jsonb),
    'offer_expires_at', _exp,
    'offer_name', _plan->>'offer_name',
    'usage', jsonb_build_object(
      'summaries', COALESCE(_usage.summaries, 0),
      'ai_questions', COALESCE(_usage.ai_questions, 0),
      'flashcards', COALESCE(_usage.flashcards, 0),
      'todo_tasks', COALESCE(_usage.todo_tasks, 0),
      'calendar_items', COALESCE(_usage.calendar_items, 0),
      'all_in_one_lectures', COALESCE(_usage.all_in_one_lectures, 0),
      'all_in_one_questions', COALESCE(_usage.all_in_one_questions, 0),
      'archive_questions', COALESCE(_usage.archive_questions, 0),
      'groups', COALESCE(_usage.groups, 0)
    ),
    'is_admin', _admin
  );
END;
$function$;