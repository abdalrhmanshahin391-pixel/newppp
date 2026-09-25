CREATE TABLE public.site_images (
  key text PRIMARY KEY,
  path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_images TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_images TO authenticated;
GRANT ALL ON public.site_images TO service_role;

ALTER TABLE public.site_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_images_public_read" ON public.site_images
  FOR SELECT USING (true);

CREATE POLICY "site_images_admin_write" ON public.site_images
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER site_images_touch
  BEFORE UPDATE ON public.site_images
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();