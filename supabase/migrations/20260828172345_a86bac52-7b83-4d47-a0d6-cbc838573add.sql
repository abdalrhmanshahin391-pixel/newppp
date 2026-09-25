CREATE TABLE public.flash_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.flash_subjects(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'apricot',
  emoji text,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.flash_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.flash_subjects(id) ON DELETE CASCADE,
  front text NOT NULL,
  back text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  ease integer NOT NULL DEFAULT 0,
  reviews integer NOT NULL DEFAULT 0,
  last_reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX flash_subjects_user_idx ON public.flash_subjects(user_id, parent_id, sort);
CREATE INDEX flash_cards_subject_idx ON public.flash_cards(subject_id, sort);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flash_subjects TO authenticated;
GRANT ALL ON public.flash_subjects TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flash_cards TO authenticated;
GRANT ALL ON public.flash_cards TO service_role;

ALTER TABLE public.flash_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flash_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own flash subjects" ON public.flash_subjects FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own flash cards" ON public.flash_cards FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER flash_subjects_touch BEFORE UPDATE ON public.flash_subjects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER flash_cards_touch BEFORE UPDATE ON public.flash_cards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();