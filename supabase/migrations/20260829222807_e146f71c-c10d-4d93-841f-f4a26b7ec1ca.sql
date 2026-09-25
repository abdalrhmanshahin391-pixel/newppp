ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS highlight boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cta_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS perks text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS feature_ai_import boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS feature_review boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.plans SET highlight = true WHERE slug = 'study';
UPDATE public.plans SET feature_ai_import = false, feature_review = false WHERE slug = 'starter';

GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;

DROP POLICY IF EXISTS "Admins manage plans" ON public.plans;
CREATE POLICY "Admins manage plans" ON public.plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT INSERT, UPDATE, DELETE ON public.plans TO authenticated;

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
   WHERE user_id = _uid AND period = to_char(now(), 'YYYY-MM');

  RETURN jsonb_build_object(
    'plan', to_jsonb(_plan),
    'usage', jsonb_build_object(
      'summaries', COALESCE(_usage.summaries, 0),
      'ai_questions', COALESCE(_usage.ai_questions, 0),
      'flashcards', COALESCE(_usage.flashcards, 0)
    ),
    'is_admin', _admin
  );
END;
$$;