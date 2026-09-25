CREATE TABLE public.institution_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  organisation text NOT NULL,
  role text,
  students integer,
  message text,
  kind text NOT NULL DEFAULT 'institution',
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.institution_leads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.institution_leads TO authenticated;
GRANT ALL ON public.institution_leads TO service_role;

ALTER TABLE public.institution_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can send an enquiry" ON public.institution_leads
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "admins read enquiries" ON public.institution_leads
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update enquiries" ON public.institution_leads
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete enquiries" ON public.institution_leads
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER institution_leads_touch
  BEFORE UPDATE ON public.institution_leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();