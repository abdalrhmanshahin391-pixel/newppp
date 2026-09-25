CREATE TABLE public.card_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  card_id text NOT NULL,
  subject text NOT NULL DEFAULT '',
  sub_subject text NOT NULL DEFAULT '',
  ease numeric NOT NULL DEFAULT 2.5,
  interval_days numeric NOT NULL DEFAULT 0,
  reps integer NOT NULL DEFAULT 0,
  lapses integer NOT NULL DEFAULT 0,
  state text NOT NULL DEFAULT 'new',
  last_grade integer,
  due_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, card_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_reviews TO authenticated;
GRANT ALL ON public.card_reviews TO service_role;
ALTER TABLE public.card_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own card reviews" ON public.card_reviews FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  card_id text NOT NULL,
  subject text NOT NULL DEFAULT '',
  grade integer NOT NULL,
  ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.review_events TO authenticated;
GRANT ALL ON public.review_events TO service_role;
ALTER TABLE public.review_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own review events read" ON public.review_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "own review events write" ON public.review_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX review_events_user_day ON public.review_events (user_id, created_at DESC);

CREATE TABLE public.study_days (
  user_id uuid NOT NULL,
  day date NOT NULL,
  cards integer NOT NULL DEFAULT 0,
  correct integer NOT NULL DEFAULT 0,
  ms bigint NOT NULL DEFAULT 0,
  goal_met boolean NOT NULL DEFAULT false,
  frozen boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
GRANT SELECT, INSERT, UPDATE ON public.study_days TO authenticated;
GRANT ALL ON public.study_days TO service_role;
ALTER TABLE public.study_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own study days" ON public.study_days FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.study_prefs (
  user_id uuid PRIMARY KEY,
  daily_goal integer NOT NULL DEFAULT 20,
  freezes_left integer NOT NULL DEFAULT 1,
  freeze_week date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.study_prefs TO authenticated;
GRANT ALL ON public.study_prefs TO service_role;
ALTER TABLE public.study_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own study prefs" ON public.study_prefs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER card_reviews_touch BEFORE UPDATE ON public.card_reviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER study_prefs_touch BEFORE UPDATE ON public.study_prefs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();