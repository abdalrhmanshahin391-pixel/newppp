GRANT SELECT ON public.plans TO anon;
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='plans' AND policyname='Plans are publicly readable'
  ) THEN
    CREATE POLICY "Plans are publicly readable" ON public.plans FOR SELECT TO anon, authenticated USING (true);
  END IF;
END$$;

GRANT SELECT ON public.user_plans TO authenticated;
GRANT ALL ON public.user_plans TO service_role;
GRANT SELECT ON public.usage_counters TO authenticated;
GRANT ALL ON public.usage_counters TO service_role;