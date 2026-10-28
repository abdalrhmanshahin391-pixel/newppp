-- The scheduled AI review moves to the rita-review Edge Function. It needs the service key, which
-- the published site's server does not have (so the old job, which called the site, could not read
-- the conversations). Same schedule and the same private worker key; only the address changes.
select cron.unschedule('rita-turn-review')
where exists (select 1 from cron.job where jobname = 'rita-turn-review');

select cron.schedule(
  'rita-turn-review',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := 'https://aeawoexywnyankbeqkmz.supabase.co/functions/v1/rita-review',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-key', (select trim(value) from public.site_secrets where key = 'worker_cron_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
