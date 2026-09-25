ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS ribbon_label text,
  ADD COLUMN IF NOT EXISTS ribbon_color text,
  ADD COLUMN IF NOT EXISTS compare_cents integer,
  ADD COLUMN IF NOT EXISTS offer_ends_at timestamptz;