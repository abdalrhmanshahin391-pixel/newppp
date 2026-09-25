ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS max_todo_tasks integer,
  ADD COLUMN IF NOT EXISTS max_calendar_items integer,
  ADD COLUMN IF NOT EXISTS max_groups integer,
  ADD COLUMN IF NOT EXISTS max_all_in_one_lectures integer,
  ADD COLUMN IF NOT EXISTS max_all_in_one_questions integer,
  ADD COLUMN IF NOT EXISTS max_archive_questions integer,
  ADD COLUMN IF NOT EXISTS max_rita_questions integer,
  ADD COLUMN IF NOT EXISTS feature_lecture_qgen boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS feature_archive_qgen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_all_in_one boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_rita38 boolean NOT NULL DEFAULT false;

ALTER TABLE public.usage_counters
  ADD COLUMN IF NOT EXISTS todo_tasks integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calendar_items integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS all_in_one_lectures integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS all_in_one_questions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archive_questions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rita_questions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS groups integer NOT NULL DEFAULT 0;

-- fold every historic monthly bucket into one lifetime bucket
INSERT INTO public.usage_counters (user_id, period, summaries, ai_questions, flashcards)
SELECT user_id, 'lifetime', SUM(summaries), SUM(ai_questions), SUM(flashcards)
  FROM public.usage_counters WHERE period <> 'lifetime'
 GROUP BY user_id
ON CONFLICT (user_id, period) DO UPDATE
  SET summaries = public.usage_counters.summaries + EXCLUDED.summaries,
      ai_questions = public.usage_counters.ai_questions + EXCLUDED.ai_questions,
      flashcards = public.usage_counters.flashcards + EXCLUDED.flashcards;

DELETE FROM public.usage_counters WHERE period <> 'lifetime';

CREATE OR REPLACE FUNCTION public.bump_usage(_user_id uuid, _kind text, _n integer DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _kind NOT IN ('summaries','ai_questions','flashcards','todo_tasks','calendar_items',
                   'all_in_one_lectures','all_in_one_questions','archive_questions',
                   'rita_questions','groups') THEN
    RETURN;
  END IF;

  INSERT INTO public.usage_counters (user_id, period) VALUES (_user_id, 'lifetime')
  ON CONFLICT (user_id, period) DO NOTHING;

  EXECUTE format(
    'UPDATE public.usage_counters SET %I = %I + $1, updated_at = now() WHERE user_id = $2 AND period = ''lifetime''',
    _kind, _kind
  ) USING _n, _user_id;
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
  _slug text;
  _plan public.plans%ROWTYPE;
  _usage public.usage_counters%ROWTYPE;
  _admin boolean;
BEGIN
  IF _uid IS NULL THEN
    RETURN NULL;
  END IF;

  _admin := public.has_role(_uid, 'admin');

  SELECT plan_slug INTO _slug FROM public.user_plans WHERE user_id = _uid;
  IF _slug IS NULL THEN
    _slug := 'starter';
  END IF;

  SELECT * INTO _plan FROM public.plans WHERE slug = _slug;
  IF _plan.slug IS NULL THEN
    SELECT * INTO _plan FROM public.plans WHERE published ORDER BY sort LIMIT 1;
  END IF;

  SELECT * INTO _usage FROM public.usage_counters
   WHERE user_id = _uid AND period = 'lifetime';

  RETURN jsonb_build_object(
    'plan', to_jsonb(_plan),
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

-- the five tiers
UPDATE public.plans SET published = false WHERE slug = 'study';

INSERT INTO public.plans (slug, name, tagline, price_cents, yearly_cents, currency, sort, published, highlight,
  max_flashcards, max_ai_questions, max_summaries, max_todo_tasks, max_calendar_items, max_groups,
  max_all_in_one_lectures, max_all_in_one_questions, max_archive_questions, max_rita_questions,
  todo_full, rich_cards, feature_ai_import, feature_review,
  feature_lecture_qgen, feature_archive_qgen, feature_all_in_one, feature_rita38, perks)
VALUES
  ('starter','Free','Your first steps with Rita',0,0,'USD',1,true,false,
    25,10,1,5,5,5,0,0,0,0,false,false,false,true,true,false,false,false,
    ARRAY['10 lecture questions','1 summary','25 flashcards','5 to-do tasks','5 calendar entries','Join unlimited classrooms']),
  ('toolkit','Toolkit','Every study tool, unlimited',300,3000,'USD',2,false,false,
    NULL,0,0,NULL,NULL,NULL,0,0,0,0,true,true,false,true,false,false,false,false,
    ARRAY['Unlimited flashcards','German labs','Memory game','Unlimited to-do & calendar','Unlimited classrooms & groups']),
  ('boost','Boost','Add AI to your toolkit',500,5000,'USD',3,false,false,
    500,200,20,NULL,NULL,NULL,0,0,0,0,true,true,true,true,true,false,false,false,
    ARRAY['Everything in Toolkit','200 lecture questions','20 summaries','500 flashcards']),
  ('pro','Pro','Exam season, handled',1500,15000,'USD',4,true,true,
    1000,400,50,NULL,NULL,NULL,50,NULL,0,0,true,true,true,true,true,false,true,false,
    ARRAY['Everything in Boost','400 lecture questions','1000 flashcards','All-in-One on 50 lectures']),
  ('ultimate','Ultimate','The whole of Rita',2000,20000,'USD',5,true,false,
    NULL,400,NULL,NULL,NULL,NULL,NULL,120,1000,1000,true,true,true,true,true,true,true,true,
    ARRAY['Everything in Pro','Archive questions with full explanations (1000)','All-in-One up to 120 questions','Rita Model 3.8 up to 1000 questions'])
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, tagline = EXCLUDED.tagline,
  price_cents = EXCLUDED.price_cents, yearly_cents = EXCLUDED.yearly_cents,
  currency = EXCLUDED.currency, sort = EXCLUDED.sort,
  published = EXCLUDED.published, highlight = EXCLUDED.highlight,
  max_flashcards = EXCLUDED.max_flashcards, max_ai_questions = EXCLUDED.max_ai_questions,
  max_summaries = EXCLUDED.max_summaries, max_todo_tasks = EXCLUDED.max_todo_tasks,
  max_calendar_items = EXCLUDED.max_calendar_items, max_groups = EXCLUDED.max_groups,
  max_all_in_one_lectures = EXCLUDED.max_all_in_one_lectures,
  max_all_in_one_questions = EXCLUDED.max_all_in_one_questions,
  max_archive_questions = EXCLUDED.max_archive_questions,
  max_rita_questions = EXCLUDED.max_rita_questions,
  todo_full = EXCLUDED.todo_full, rich_cards = EXCLUDED.rich_cards,
  feature_ai_import = EXCLUDED.feature_ai_import, feature_review = EXCLUDED.feature_review,
  feature_lecture_qgen = EXCLUDED.feature_lecture_qgen,
  feature_archive_qgen = EXCLUDED.feature_archive_qgen,
  feature_all_in_one = EXCLUDED.feature_all_in_one,
  feature_rita38 = EXCLUDED.feature_rita38,
  perks = EXCLUDED.perks;