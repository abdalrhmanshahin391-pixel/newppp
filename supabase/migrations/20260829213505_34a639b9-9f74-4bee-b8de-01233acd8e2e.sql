CREATE TABLE public.card_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  card_id text NOT NULL,
  subject text NOT NULL DEFAULT '',
  sub_subject text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, card_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_flags TO authenticated;
GRANT ALL ON public.card_flags TO service_role;

ALTER TABLE public.card_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own card flags"
  ON public.card_flags FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER card_flags_touch
  BEFORE UPDATE ON public.card_flags
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.card_reviews
  ADD COLUMN IF NOT EXISTS leech boolean NOT NULL DEFAULT false;