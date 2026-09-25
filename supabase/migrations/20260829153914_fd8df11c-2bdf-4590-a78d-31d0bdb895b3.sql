CREATE TABLE IF NOT EXISTS public.plans (
  slug text PRIMARY KEY,
  name text NOT NULL,
  tagline text NOT NULL DEFAULT '',
  price_cents integer NOT NULL DEFAULT 0,
  yearly_cents integer NOT NULL DEFAULT 0,
  max_flashcards integer,
  max_ai_questions integer,
  max_summaries integer,
  todo_full boolean NOT NULL DEFAULT false,
  rich_cards boolean NOT NULL DEFAULT false,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon;
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plans are public" ON public.plans FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.user_plans (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_slug text NOT NULL DEFAULT 'starter' REFERENCES public.plans(slug),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_plans TO authenticated;
GRANT ALL ON public.user_plans TO service_role;
ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See own plan" ON public.user_plans FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage plans" ON public.user_plans FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.usage_counters (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period text NOT NULL,
  summaries integer NOT NULL DEFAULT 0,
  ai_questions integer NOT NULL DEFAULT 0,
  flashcards integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, period)
);
GRANT SELECT ON public.usage_counters TO authenticated;
GRANT ALL ON public.usage_counters TO service_role;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See own usage" ON public.usage_counters FOR SELECT TO authenticated USING (auth.uid() = user_id);

INSERT INTO public.plans (slug, name, tagline, price_cents, yearly_cents, max_flashcards, max_ai_questions, max_summaries, todo_full, rich_cards, sort)
VALUES
  ('starter', 'Starter', 'Try every tool, gently', 0, 0, 100, 20, 2, false, false, 1),
  ('study', 'Study', 'For one busy student', 600, 6000, 2000, 300, 25, true, true, 2),
  ('pro', 'Pro', 'Exam season, no limits in sight', 1400, 14000, NULL, 1000, 80, true, true, 3)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  price_cents = EXCLUDED.price_cents,
  yearly_cents = EXCLUDED.yearly_cents,
  max_flashcards = EXCLUDED.max_flashcards,
  max_ai_questions = EXCLUDED.max_ai_questions,
  max_summaries = EXCLUDED.max_summaries,
  todo_full = EXCLUDED.todo_full,
  rich_cards = EXCLUDED.rich_cards,
  sort = EXCLUDED.sort;

CREATE OR REPLACE FUNCTION public.my_plan_usage()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'plan', to_jsonb(p),
    'usage', COALESCE((
      SELECT to_jsonb(u) FROM public.usage_counters u
      WHERE u.user_id = auth.uid() AND u.period = to_char(now(), 'YYYY-MM')
    ), jsonb_build_object('summaries', 0, 'ai_questions', 0, 'flashcards', 0)),
    'is_admin', public.has_role(auth.uid(), 'admin')
  )
  FROM public.plans p
  WHERE p.slug = COALESCE((SELECT plan_slug FROM public.user_plans WHERE user_id = auth.uid()), 'starter');
$$;

CREATE OR REPLACE FUNCTION public.bump_usage(_user_id uuid, _kind text, _n integer DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _period text := to_char(now(), 'YYYY-MM');
BEGIN
  INSERT INTO public.usage_counters (user_id, period) VALUES (_user_id, _period)
  ON CONFLICT (user_id, period) DO NOTHING;

  IF _kind = 'summaries' THEN
    UPDATE public.usage_counters SET summaries = summaries + _n, updated_at = now()
      WHERE user_id = _user_id AND period = _period;
  ELSIF _kind = 'ai_questions' THEN
    UPDATE public.usage_counters SET ai_questions = ai_questions + _n, updated_at = now()
      WHERE user_id = _user_id AND period = _period;
  ELSIF _kind = 'flashcards' THEN
    UPDATE public.usage_counters SET flashcards = flashcards + _n, updated_at = now()
      WHERE user_id = _user_id AND period = _period;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.my_plan_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.bump_usage(uuid, text, integer) TO service_role;