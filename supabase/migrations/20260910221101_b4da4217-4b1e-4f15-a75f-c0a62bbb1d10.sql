DROP POLICY IF EXISTS "site-media readable" ON storage.objects;

CREATE POLICY "site-media published readable"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'site-media'
  AND (
    EXISTS (SELECT 1 FROM public.site_images si WHERE si.path = storage.objects.name)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);