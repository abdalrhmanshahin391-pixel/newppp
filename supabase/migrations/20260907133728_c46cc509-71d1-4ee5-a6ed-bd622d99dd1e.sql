CREATE TABLE public.slide_decks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  source_name TEXT,
  subject_label TEXT,
  subtopic_label TEXT,
  page_count INTEGER NOT NULL DEFAULT 0,
  pages_done INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'building',
  slides JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.slide_decks TO authenticated;
GRANT ALL ON public.slide_decks TO service_role;

ALTER TABLE public.slide_decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage their own slide decks"
ON public.slide_decks FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX slide_decks_user_created_idx ON public.slide_decks (user_id, created_at DESC);

CREATE TRIGGER slide_decks_updated_at
BEFORE UPDATE ON public.slide_decks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();