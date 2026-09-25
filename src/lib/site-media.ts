import { supabase } from "@/integrations/supabase/legacy-client";

export const SITE_MEDIA_BUCKET = "site-media";

export async function signSiteMedia(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const { data, error } = await supabase.storage
    .from(SITE_MEDIA_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error || !data) return null;
  return data.signedUrl;
}