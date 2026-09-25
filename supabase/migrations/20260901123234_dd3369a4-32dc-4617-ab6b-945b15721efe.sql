ALTER TABLE public.german_subjects
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.german_subjects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'mixed';

CREATE INDEX IF NOT EXISTS german_subjects_parent_idx
  ON public.german_subjects(parent_id);

ALTER TABLE public.german_subjects
  DROP CONSTRAINT IF EXISTS german_subjects_not_self_parent,
  ADD CONSTRAINT german_subjects_not_self_parent CHECK (parent_id IS NULL OR parent_id <> id);