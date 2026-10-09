-- Security hardening: replace broad table and storage reads with minimal,
-- intentionally public views or predicates.  This migration does not touch
-- existing rows or objects.

-- Public support copy is deliberately exposed through a column-limited view.
-- The base table (which includes the internal notification address) remains
-- readable only to administrators.
DROP POLICY IF EXISTS "Anyone can view support settings" ON public.support_settings;
CREATE POLICY "admins read support settings"
ON public.support_settings
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE VIEW public.support_settings_public AS
SELECT
  id, page_enabled, form_enabled, channels_enabled,
  intro_title_en, intro_title_ar, intro_text_en, intro_text_ar,
  response_note_en, response_note_ar, categories, created_at, updated_at
FROM public.support_settings;
GRANT SELECT ON public.support_settings_public TO anon, authenticated;

-- Notification switches are operational configuration, not user settings.
DROP POLICY IF EXISTS "read notification settings" ON public.notification_settings;

-- Only published plans are part of the public pricing catalogue.  Admins keep
-- access to drafts through their existing manage policy.
DROP POLICY IF EXISTS "Plans are readable by everyone" ON public.plans;
CREATE POLICY "published plans are readable"
ON public.plans
FOR SELECT TO anon, authenticated
USING (
  published = true
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- A visitor may see only currently active announcements.  Scheduled, expired,
-- and draft announcements are visible to administrators only.
DROP POLICY IF EXISTS "Anyone can view announcements" ON public.site_announcements;
CREATE POLICY "live announcements are readable"
ON public.site_announcements
FOR SELECT TO anon, authenticated
USING (
  (
    active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now())
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Settings and site artwork are public site configuration, but direct broad
-- table reads are replaced by explicit, safe column views.
DROP POLICY IF EXISTS "anyone can read site settings" ON public.site_settings;
CREATE POLICY "admins read site settings"
ON public.site_settings
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE VIEW public.site_settings_public AS
SELECT
  id, site_name, tagline, logo_url, updated_at, theme, show_signature,
  protect_enabled, protect_watermark_opacity, protect_blur_on_blur,
  protect_block_print, protect_block_copy, protect_consent_required,
  protect_devtools_guard, protect_auto_lock_threshold, protect_terms_en,
  protect_terms_ar, committee_default_storage, brand_style, header_style,
  study_plan_path, study_plan_title, study_plan_subtitle, terms_en, terms_ar,
  privacy_en, privacy_ar, refund_en, refund_ar, study_hub_title,
  study_hub_title_ar, study_hub_subtitle, study_hub_subtitle_ar,
  feature_ai_cards_enabled, committee_qr_path, committee_qr_link,
  offers_page_enabled, credit_packs_enabled, home_video_url,
  home_video_poster_url, classic_colors
FROM public.site_settings;
GRANT SELECT ON public.site_settings_public TO anon, authenticated;

DROP POLICY IF EXISTS "site_images_public_read" ON public.site_images;
CREATE POLICY "admins read site images"
ON public.site_images
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE VIEW public.site_images_public AS
SELECT key, path FROM public.site_images;
GRANT SELECT ON public.site_images_public TO anon, authenticated;

-- Public support contacts are intentionally public, but hidden channels are
-- now admin-only instead of readable by every visitor.
DROP POLICY IF EXISTS "Anyone can view support channels" ON public.support_channels;
CREATE POLICY "visible support channels are readable"
ON public.support_channels
FOR SELECT TO anon, authenticated
USING (
  visible = true
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- The Study Hub belongs to signed-in students; its hidden tiles stay admin-only.
DROP POLICY IF EXISTS "study_hub_tiles_read" ON public.study_hub_tiles;
CREATE POLICY "signed in students read visible study hub tiles"
ON public.study_hub_tiles
FOR SELECT TO authenticated
USING (
  hidden = false
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Private profile and member photos: only the path owner or an administrator
-- can read an object.  Existing write rules are left intact.
DROP POLICY IF EXISTS "avatars_read_authenticated" ON storage.objects;
CREATE POLICY "avatars owner or admin read"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

DROP POLICY IF EXISTS "member_photos_read" ON storage.objects;
CREATE POLICY "member photos owner or admin read"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'member-photos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

-- Course images remain available to visitors only when a published course
-- references them.  This prevents arbitrary private objects in the bucket
-- from being downloaded by guessing a path.
DROP POLICY IF EXISTS "Public can view course images" ON storage.objects;
CREATE POLICY "published course images are readable"
ON storage.objects
FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'course-images'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.published = true
        AND (
          c.image_url = storage.objects.name
          OR c.image_url LIKE '%' || '/course-images/' || storage.objects.name
        )
    )
  )
);

-- No university-logo object exists in production today.  Keep this private
-- until its public reference is modeled, rather than retaining a bucket-wide
-- anonymous download rule.
DROP POLICY IF EXISTS "public read university-logos" ON storage.objects;
CREATE POLICY "admins read university logos"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'university-logos'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- site-media remains private at the bucket level.  Its existing policy exposes
-- only paths explicitly listed in site_images, preserving published artwork.
