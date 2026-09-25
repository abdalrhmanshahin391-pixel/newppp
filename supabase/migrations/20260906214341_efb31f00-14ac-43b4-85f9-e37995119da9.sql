CREATE TABLE public.site_feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  badge TEXT,
  badge_ar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_feature_flags TO anon;
GRANT SELECT ON public.site_feature_flags TO authenticated;
GRANT ALL ON public.site_feature_flags TO service_role;

ALTER TABLE public.site_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read feature flags"
  ON public.site_feature_flags FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins manage feature flags"
  ON public.site_feature_flags FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER site_feature_flags_touch
  BEFORE UPDATE ON public.site_feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();