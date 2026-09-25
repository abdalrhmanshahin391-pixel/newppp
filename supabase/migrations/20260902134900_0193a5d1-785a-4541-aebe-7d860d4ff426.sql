CREATE TABLE IF NOT EXISTS public.vault_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'backup',
  status text NOT NULL DEFAULT 'running',
  snapshot text,
  started_by uuid,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vault_runs TO authenticated;
GRANT ALL ON public.vault_runs TO service_role;

ALTER TABLE public.vault_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read vault runs" ON public.vault_runs;
CREATE POLICY "admins read vault runs" ON public.vault_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS vault_runs_touch ON public.vault_runs;
CREATE TRIGGER vault_runs_touch BEFORE UPDATE ON public.vault_runs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.vault_tables()
RETURNS TABLE(name text, depth integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  WITH RECURSIVE t AS (
    SELECT c.oid, c.relname::text AS tname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  ),
  deps AS (
    SELECT con.conrelid AS child, con.confrelid AS parent
    FROM pg_constraint con
    JOIN t ON t.oid = con.conrelid
    WHERE con.contype = 'f' AND con.confrelid <> con.conrelid
      AND con.confrelid IN (SELECT oid FROM t)
  ),
  lvl AS (
    SELECT t.oid, t.tname, 0 AS d FROM t
    WHERE NOT EXISTS (SELECT 1 FROM deps x WHERE x.child = t.oid)
    UNION ALL
    SELECT t.oid, t.tname, l.d + 1
    FROM t JOIN deps x ON x.child = t.oid JOIN lvl l ON l.oid = x.parent
    WHERE l.d < 12
  )
  SELECT l.tname, max(l.d)::int FROM lvl l GROUP BY l.tname ORDER BY 2, 1;
END;
$$;

REVOKE ALL ON FUNCTION public.vault_tables() FROM public;
GRANT EXECUTE ON FUNCTION public.vault_tables() TO authenticated, service_role;

INSERT INTO public.site_secrets (key, value)
VALUES ('vault_cron_key', replace(gen_random_uuid()::text, '-', ''))
ON CONFLICT (key) DO NOTHING;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $cron$
DECLARE _key text;
BEGIN
  SELECT value INTO _key FROM public.site_secrets WHERE key = 'vault_cron_key';
  PERFORM cron.unschedule('vault-daily-snapshot')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'vault-daily-snapshot');
  PERFORM cron.schedule(
    'vault-daily-snapshot',
    '20 3 * * *',
    format($job$
      SELECT net.http_post(
        url := 'https://project--05a7273e-65b6-403e-8cb6-c887d70948df.lovable.app/api/public/vault/run',
        headers := jsonb_build_object('Content-Type','application/json','x-vault-key',%L),
        body := '{"source":"cron"}'::jsonb
      );
    $job$, _key)
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron scheduling skipped: %', SQLERRM;
END;
$cron$;