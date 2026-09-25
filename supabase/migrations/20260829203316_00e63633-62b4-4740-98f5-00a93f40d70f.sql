GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Plans are readable by everyone" ON public.plans;
CREATE POLICY "Plans are readable by everyone" ON public.plans FOR SELECT USING (true);