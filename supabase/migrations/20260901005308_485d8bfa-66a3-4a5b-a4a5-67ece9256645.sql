CREATE TABLE public.aio_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lecture_id uuid NOT NULL REFERENCES public.lq_lectures(id) ON DELETE CASCADE,
  guide_md text NOT NULL DEFAULT '',
  short_md text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lecture_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aio_summaries TO authenticated;
GRANT ALL ON public.aio_summaries TO service_role;
ALTER TABLE public.aio_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own aio summaries" ON public.aio_summaries
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.aio_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lecture_id uuid NOT NULL REFERENCES public.lq_lectures(id) ON DELETE CASCADE,
  front text NOT NULL,
  back text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aio_cards TO authenticated;
GRANT ALL ON public.aio_cards TO service_role;
ALTER TABLE public.aio_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own aio cards" ON public.aio_cards
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX aio_cards_lecture_idx ON public.aio_cards (lecture_id, sort_order);

CREATE TRIGGER aio_summaries_touch
  BEFORE UPDATE ON public.aio_summaries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();