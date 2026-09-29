-- 1. Remove the constant polling schedules
SELECT cron.unschedule('rita-worker');
SELECT cron.unschedule('push-dispatch');

-- 2. Wake-on-enqueue: Rita document worker fires only when a job is created
CREATE OR REPLACE FUNCTION public.wake_rita_worker()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  worker_key text;
BEGIN
  SELECT value INTO worker_key FROM public.site_secrets WHERE key = 'worker_cron_key';
  IF worker_key IS NULL OR length(trim(worker_key)) = 0 THEN
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url := 'https://project--84f9560d-cda3-444b-b692-31491571e090.lovable.app/api/public/rita-worker',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-worker-key', trim(worker_key)),
    body := '{}'::jsonb
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER rita_jobs_wake_worker
AFTER INSERT ON public.rita_ai_jobs
FOR EACH ROW
WHEN (NEW.status = 'queued')
EXECUTE FUNCTION public.wake_rita_worker();

-- 3. Wake-on-enqueue: push dispatcher fires when a notification is due now
CREATE OR REPLACE FUNCTION public.wake_push_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  worker_key text;
BEGIN
  SELECT value INTO worker_key FROM public.site_secrets WHERE key = 'worker_cron_key';
  IF worker_key IS NULL OR length(trim(worker_key)) = 0 THEN
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url := 'https://project--84f9560d-cda3-444b-b692-31491571e090.lovable.app/api/public/push-dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-worker-key', trim(worker_key)),
    body := '{}'::jsonb
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER push_messages_wake_dispatch
AFTER INSERT ON public.push_messages
FOR EACH ROW
WHEN (NEW.status = 'scheduled' AND NEW.scheduled_at <= now())
EXECUTE FUNCTION public.wake_push_dispatch();

-- 4. Hourly safety net for notifications scheduled for a future time
SELECT cron.schedule(
  'push-dispatch-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--84f9560d-cda3-444b-b692-31491571e090.lovable.app/api/public/push-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-key', (SELECT trim(value) FROM public.site_secrets WHERE key = 'worker_cron_key')
    ),
    body := '{}'::jsonb
  );
  $$
);