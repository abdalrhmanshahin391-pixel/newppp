
-- 1) Offer copy + code lock
UPDATE public.special_offers SET
  title = 'The Rita Toolkit — free right now',
  subtitle = 'Every study tool that costs us nothing to run, unlocked on your account for three months.',
  bullets = ARRAY[
    'Unlimited flashcards',
    'Unlimited to-do tasks',
    'Unlimited calendar entries',
    'Unlimited classrooms you create',
    'Join unlimited classrooms'
  ],
  requires_code = true,
  updated_at = now()
WHERE slug = 'toolkit';

UPDATE public.toolkit_codes c SET
  code = 'LamineYamal',
  plan_slug = 'toolkit',
  is_active = true,
  offer_id = (SELECT id FROM public.special_offers WHERE slug = 'toolkit')
WHERE upper(c.code) IN ('LAMINYAMAL','LAMINEYAMAL');

INSERT INTO public.toolkit_codes (code, plan_slug, label, max_uses, is_active, offer_id)
SELECT 'LamineYamal', 'toolkit', 'Toolkit activation code', NULL, true,
       (SELECT id FROM public.special_offers WHERE slug = 'toolkit')
WHERE NOT EXISTS (SELECT 1 FROM public.toolkit_codes WHERE upper(code) = 'LAMINEYAMAL');

-- 2) Claim = real entitlement, no zero-value grants for unlimited plans
CREATE OR REPLACE FUNCTION public.claim_offer(_offer_id uuid, _code text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _o public.special_offers%ROWTYPE;
  _plan public.plans%ROWTYPE;
  _c public.toolkit_codes%ROWTYPE;
  _exp timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;

  SELECT * INTO _o FROM public.special_offers WHERE id = _offer_id AND is_active;
  IF _o.id IS NULL THEN RAISE EXCEPTION 'That offer is not available.'; END IF;

  IF EXISTS (SELECT 1 FROM public.toolkit_claims c WHERE c.user_id = _uid AND c.offer_id = _o.id) THEN
    RAISE EXCEPTION 'You already claimed this offer.';
  END IF;

  IF _o.requires_code OR (_code IS NOT NULL AND btrim(_code) <> '') THEN
    IF _code IS NULL OR btrim(_code) = '' THEN RAISE EXCEPTION 'This offer needs a code.'; END IF;
    SELECT * INTO _c FROM public.toolkit_codes WHERE upper(code) = upper(btrim(_code));
    IF _c.id IS NULL OR NOT _c.is_active THEN RAISE EXCEPTION 'That code does not work.'; END IF;
    IF _c.offer_id IS NOT NULL AND _c.offer_id <> _o.id THEN RAISE EXCEPTION 'That code is for another offer.'; END IF;
    IF _c.expires_at IS NOT NULL AND _c.expires_at < now() THEN RAISE EXCEPTION 'That code has expired.'; END IF;
    IF _c.max_uses IS NOT NULL AND _c.used_count >= _c.max_uses THEN RAISE EXCEPTION 'That code is used up.'; END IF;
    UPDATE public.toolkit_codes SET used_count = used_count + 1 WHERE id = _c.id;
  END IF;

  SELECT p.* INTO _plan FROM public.plans p WHERE p.slug = COALESCE(_c.plan_slug, _o.plan_slug);
  IF _plan.slug IS NULL THEN RAISE EXCEPTION 'This offer is not set up yet.'; END IF;

  _exp := CASE WHEN _o.duration_days > 0 THEN now() + make_interval(days => _o.duration_days) ELSE NULL END;

  INSERT INTO public.toolkit_claims (user_id, code_id, plan_slug, offer_id, expires_at)
  VALUES (_uid, _c.id, _plan.slug, _o.id, _exp);

  -- Only metered allowances become grants; unlimited perks come from the
  -- entitlement merge in my_plan_usage instead of a meaningless zero grant.
  IF COALESCE(_plan.max_flashcards,0) > 0 OR COALESCE(_plan.max_ai_questions,0) > 0
     OR COALESCE(_plan.max_summaries,0) > 0 OR COALESCE(_plan.max_todo_tasks,0) > 0
     OR COALESCE(_plan.max_calendar_items,0) > 0 OR COALESCE(_plan.max_all_in_one_lectures,0) > 0
     OR COALESCE(_plan.max_all_in_one_questions,0) > 0 OR COALESCE(_plan.max_archive_questions,0) > 0
     OR COALESCE(_plan.max_rita_questions,0) > 0 OR COALESCE(_plan.max_groups,0) > 0 THEN
    INSERT INTO public.plan_credit_grants (
      user_id, plan_slug, transaction_id, environment, expires_at, flashcards, ai_questions, summaries,
      todo_tasks, calendar_items, all_in_one_lectures, all_in_one_questions,
      archive_questions, rita_questions, groups)
    VALUES (_uid, _plan.slug, 'offer-' || gen_random_uuid()::text, 'live', _exp,
      COALESCE(_plan.max_flashcards,0), COALESCE(_plan.max_ai_questions,0), COALESCE(_plan.max_summaries,0),
      COALESCE(_plan.max_todo_tasks,0), COALESCE(_plan.max_calendar_items,0),
      COALESCE(_plan.max_all_in_one_lectures,0), COALESCE(_plan.max_all_in_one_questions,0),
      COALESCE(_plan.max_archive_questions,0), COALESCE(_plan.max_rita_questions,0), COALESCE(_plan.max_groups,0));
  END IF;

  RETURN jsonb_build_object('ok', true, 'plan', _plan.slug, 'name', _plan.name, 'expires_at', _exp);
END;
$$;

-- 3) Effective plan = base plan merged with any live claimed offer
CREATE OR REPLACE FUNCTION public.merge_cap(_a integer, _b integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$ SELECT CASE WHEN _a IS NULL OR _b IS NULL THEN NULL ELSE greatest(_a, _b) END $$;

CREATE OR REPLACE FUNCTION public.effective_plan(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
      -- unlimited (NULL) beats any number; otherwise take the larger cap
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
        'max_rita_questions',       public.merge_cap(_base.max_rita_questions, _op.max_rita_questions),
        'todo_full',             _base.todo_full OR _op.todo_full,
        'rich_cards',            _base.rich_cards OR _op.rich_cards,
        'feature_lecture_qgen',  _base.feature_lecture_qgen OR _op.feature_lecture_qgen,
        'feature_archive_qgen',  _base.feature_archive_qgen OR _op.feature_archive_qgen,
        'feature_all_in_one',    _base.feature_all_in_one OR _op.feature_all_in_one,
        'feature_rita38',        _base.feature_rita38 OR _op.feature_rita38,
        'offer_name', _op.name,
        'offer_plan_slug', _op.slug,
        'offer_expires_at', _claim.expires_at
      );
    END IF;
  END IF;

  RETURN _out;
END;
$$;

CREATE OR REPLACE FUNCTION public.my_plan_usage()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    'rita_questions', COALESCE(SUM(rita_questions),0),
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
      'rita_questions', COALESCE(_usage.rita_questions, 0),
      'groups', COALESCE(_usage.groups, 0)
    ),
    'is_admin', _admin
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.effective_plan(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.merge_cap(integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.effective_plan(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.merge_cap(integer, integer) TO service_role;

-- 4) Admin directory of every user with plan + claimed kit
CREATE OR REPLACE FUNCTION public.admin_users_with_plans()
RETURNS TABLE(
  id uuid, full_name text, username text, email text,
  created_at timestamptz, last_seen timestamptz,
  plan_slug text, plan_name text,
  kit_slug text, kit_name text, kit_expires_at timestamptz,
  roles text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admins only';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.username,
    u.email::text,
    p.created_at,
    (SELECT max(e.created_at) FROM public.user_login_events e WHERE e.user_id = p.id),
    COALESCE(up.plan_slug, 'starter'),
    COALESCE(pl.name, 'Free'),
    k.plan_slug,
    kp.name,
    k.expires_at,
    COALESCE((SELECT array_agg(r.role::text) FROM public.user_roles r WHERE r.user_id = p.id), '{}')
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.user_plans up ON up.user_id = p.id
  LEFT JOIN public.plans pl ON pl.slug = COALESCE(up.plan_slug, 'starter')
  LEFT JOIN LATERAL (
    SELECT c.plan_slug, c.expires_at
      FROM public.toolkit_claims c
     WHERE c.user_id = p.id AND (c.expires_at IS NULL OR c.expires_at > now())
     ORDER BY c.created_at DESC LIMIT 1
  ) k ON true
  LEFT JOIN public.plans kp ON kp.slug = k.plan_slug
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_users_with_plans() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_users_with_plans() TO authenticated, service_role;
