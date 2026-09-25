ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS home_video_url text,
  ADD COLUMN IF NOT EXISTS home_video_poster_url text;