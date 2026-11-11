DROP POLICY IF EXISTS "signed in users read feature flags" ON public.rita_feature_flags;
CREATE POLICY "signed in users read feature flags" ON public.rita_feature_flags
  FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "path items are readable" ON public.rita_path_items;
CREATE POLICY "path items are readable" ON public.rita_path_items
  FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "path item resources are readable" ON public.rita_path_item_resources;
CREATE POLICY "path item resources are readable" ON public.rita_path_item_resources
  FOR SELECT TO authenticated USING (
    (select auth.uid()) IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.rita_path_items i WHERE i.id = rita_path_item_resources.item_id)
  );

DROP POLICY IF EXISTS "learners read path item files" ON storage.objects;
CREATE POLICY "learners read path item files" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'rita-lesson-resources'
    AND (select auth.uid()) IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.rita_path_item_resources r WHERE r.file_path = objects.name)
  );

DROP POLICY IF EXISTS "lesson images are public" ON storage.objects;
CREATE POLICY "lesson images are public" ON storage.objects
  FOR SELECT TO anon, authenticated USING (
    bucket_id = 'rita-lesson-images'
    AND (
      public.has_role((select auth.uid()), 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.rita_lessons l
        WHERE l.status = 'published'
          AND l.image_url LIKE '%/rita-lesson-images/' || objects.name || '%'
      )
    )
  );