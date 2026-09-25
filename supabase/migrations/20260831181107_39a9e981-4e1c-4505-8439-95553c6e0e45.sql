ALTER TABLE public.rita_ai_jobs
  ADD COLUMN IF NOT EXISTS lease_until timestamptz,
  ADD COLUMN IF NOT EXISTS imported_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chunks_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chunks_done integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pages_per_chunk integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS log jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS rita_ai_jobs_active_idx ON public.rita_ai_jobs (status, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rita_ai_jobs TO authenticated;
GRANT ALL ON public.rita_ai_jobs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rita_ai_chunks TO authenticated;
GRANT ALL ON public.rita_ai_chunks TO service_role;

SELECT cron.unschedule('rita-worker') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rita-worker');

SELECT cron.schedule(
  'rita-worker',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--05a7273e-65b6-403e-8cb6-c887d70948df-dev.lovable.app/api/public/rita-worker',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_zYIuBSlEbWHAQGILccbp8A_UV9ssX7z"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);