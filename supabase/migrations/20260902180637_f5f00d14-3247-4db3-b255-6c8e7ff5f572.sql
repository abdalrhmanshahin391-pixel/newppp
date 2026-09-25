
CREATE TABLE IF NOT EXISTS public.special_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  subtitle text,
  image_url text,
  accent text NOT NULL DEFAULT '#c62828',
  badge text NOT NULL DEFAULT 'Free right now',
  bullets text[] NOT NULL DEFAULT '{}',
  plan_slug text NOT NULL,
  duration_days integer NOT NULL DEFAULT 90,
  requires_code boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.special_offers TO authenticated;
GRANT SELECT ON public.special_offers TO anon;
GRANT ALL ON public.special_offers TO service_role;
ALTER TABLE public.special_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone reads active offers" ON public.special_offers;
CREATE POLICY "anyone reads active offers" ON public.special_offers
  FOR SELECT USING (is_active OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "admins manage offers" ON public.special_offers;
CREATE POLICY "admins manage offers" ON public.special_offers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.toolkit_claims ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES public.special_offers(id) ON DELETE SET NULL;
ALTER TABLE public.toolkit_claims ADD COLUMN IF NOT EXISTS expires_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS toolkit_claims_one_per_offer
  ON public.toolkit_claims (user_id, offer_id) WHERE offer_id IS NOT NULL;

ALTER TABLE public.toolkit_codes ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES public.special_offers(id) ON DELETE CASCADE;

ALTER TABLE public.plan_credit_grants ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS offers_page_enabled boolean NOT NULL DEFAULT true;

-- seed the toolkit as the first offer
INSERT INTO public.special_offers (slug, title, subtitle, badge, bullets, plan_slug, duration_days, sort)
SELECT 'toolkit',
       'The Rita Toolkit — free right now',
       'A starter pack of flashcards, summaries and AI questions, dropped straight into your account.',
       'Free for 3 months',
       ARRAY['Flashcards you can make, flip and share','Clean study summaries from your own files','Practice questions with instant answers','Everything unlocks the moment you claim'],
       COALESCE((SELECT s.toolkit_free_plan FROM public.site_settings s LIMIT 1), 'pack-study'),
       90, 0
WHERE NOT EXISTS (SELECT 1 FROM public.special_offers WHERE slug = 'toolkit');

CREATE OR REPLACE FUNCTION public.offers_list()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'sort'), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
      'id', o.id, 'slug', o.slug, 'title', o.title, 'subtitle', o.subtitle,
      'image_url', o.image_url, 'accent', o.accent, 'badge', o.badge,
      'bullets', to_jsonb(o.bullets), 'duration_days', o.duration_days,
      'requires_code', o.requires_code, 'sort', o.sort,
      'plan', (SELECT to_jsonb(p) FROM public.plans p WHERE p.slug = o.plan_slug),
      'claimed', EXISTS (SELECT 1 FROM public.toolkit_claims c WHERE c.user_id = auth.uid() AND c.offer_id = o.id),
      'expires_at', (SELECT max(c.expires_at) FROM public.toolkit_claims c WHERE c.user_id = auth.uid() AND c.offer_id = o.id)
    ) AS x
    FROM public.special_offers o
    WHERE o.is_active
  ) t;
$$;

REVOKE ALL ON FUNCTION public.offers_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.offers_list() TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.claim_offer(_offer_id uuid, _code text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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

  INSERT INTO public.plan_credit_grants (
    user_id, plan_slug, transaction_id, environment, expires_at, flashcards, ai_questions, summaries,
    todo_tasks, calendar_items, all_in_one_lectures, all_in_one_questions,
    archive_questions, rita_questions, groups)
  VALUES (_uid, _plan.slug, 'offer-' || gen_random_uuid()::text, 'live', _exp,
    COALESCE(_plan.max_flashcards,0), COALESCE(_plan.max_ai_questions,0), COALESCE(_plan.max_summaries,0),
    COALESCE(_plan.max_todo_tasks,0), COALESCE(_plan.max_calendar_items,0),
    COALESCE(_plan.max_all_in_one_lectures,0), COALESCE(_plan.max_all_in_one_questions,0),
    COALESCE(_plan.max_archive_questions,0), COALESCE(_plan.max_rita_questions,0), COALESCE(_plan.max_groups,0));

  RETURN jsonb_build_object('ok', true, 'plan', _plan.slug, 'name', _plan.name, 'expires_at', _exp);
END; $$;

REVOKE ALL ON FUNCTION public.claim_offer(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_offer(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_plan_usage()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _slug text;
  _plan public.plans%ROWTYPE;
  _usage public.usage_counters%ROWTYPE;
  _admin boolean;
  _g jsonb;
  _exp timestamptz;
BEGIN
  IF _uid IS NULL THEN RETURN NULL; END IF;

  _admin := public.has_role(_uid, 'admin');

  SELECT plan_slug INTO _slug FROM public.user_plans WHERE user_id = _uid;
  IF _slug IS NULL THEN _slug := 'starter'; END IF;

  SELECT * INTO _plan FROM public.plans WHERE slug = _slug;
  IF _plan.slug IS NULL THEN
    SELECT * INTO _plan FROM public.plans WHERE published ORDER BY sort LIMIT 1;
  END IF;

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
    'plan', to_jsonb(_plan),
    'grants', COALESCE(_g, '{}'::jsonb),
    'offer_expires_at', _exp,
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
END; $$;

REVOKE ALL ON FUNCTION public.my_plan_usage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_plan_usage() TO authenticated;
