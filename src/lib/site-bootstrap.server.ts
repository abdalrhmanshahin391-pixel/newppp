import { createStartupCache } from "./startup-cache";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/integrations/supabase/config";

export type BootstrapSettings = Record<string, string | number | boolean | null>;

export type BootstrapData = {
  settings: BootstrapSettings | null;
  /** key -> ready-to-use URL for admin-replaced artwork. */
  siteImages: Record<string, string>;
};

const SETTINGS_COLUMNS =
  "id,site_name,tagline,logo_url,updated_at,theme,show_signature,protect_enabled,protect_watermark_opacity,protect_blur_on_blur,protect_block_print,protect_block_copy,protect_consent_required,protect_devtools_guard,protect_auto_lock_threshold,protect_terms_en,protect_terms_ar,committee_default_storage,brand_style,header_style,study_plan_path,study_plan_title,study_plan_subtitle,terms_en,terms_ar,privacy_en,privacy_ar,refund_en,refund_ar,study_hub_title,study_hub_title_ar,study_hub_subtitle,study_hub_subtitle_ar,committee_qr_path,committee_qr_link,home_video_url,home_video_poster_url,feature_ai_cards_enabled,offers_page_enabled,credit_packs_enabled,classic_colors";

const EMPTY: BootstrapData = { settings: null, siteImages: {} };

/**
 * This row is tiny, identical for every visitor, and were being
 * re-queried on literally every server render (thousands of sequential scans).
 * A short in-instance cache turns that into ~1 query per minute per worker,
 * which is the single biggest backend saving as traffic grows.
 */
const CACHE_TTL_MS = 60_000;
const LOAD_TIMEOUT_MS = 1800;
async function load(): Promise<BootstrapData> {
  const { url, publishableKey: key } = getSupabasePublicConfig();

  const client = createClient(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, {
          ...init,
          headers,
          signal: AbortSignal.any([
            ...(init?.signal ? [init.signal] : []),
            AbortSignal.timeout(8000),
          ]),
        });
      },
    },
  });

  const [settingsRes, imagesRes] = await Promise.all([
    (client.from as any)("site_settings_public")
      .select(SETTINGS_COLUMNS)
      .eq("id", true)
      .maybeSingle(),
    (client.from as any)("site_images_public").select("key,path"),
  ]);

  if (settingsRes.error) throw settingsRes.error;
  if (imagesRes.error) throw imagesRes.error;

  // Sign the replaced artwork here so the very first HTML frame already points
  // at the right picture — otherwise the page paints the built-in art and then
  // visibly swaps it a moment later.
  const rows = (imagesRes?.data ?? []) as { key: string; path: string }[];
  const siteImages: Record<string, string> = {};
  if (rows.length) {
    const paths = rows.filter((r) => !/^https?:\/\//i.test(r.path)).map((r) => r.path);
    const signedResult = paths.length
      ? await client.storage.from("site-media").createSignedUrls(paths, 60 * 60 * 6)
      : null;
    if (signedResult?.error) throw signedResult.error;
    const signed = signedResult?.data ?? [];
    const byPath = new Map(
      (signed ?? []).map((s: any) => [s.path as string, s.signedUrl as string]),
    );
    for (const row of rows) {
      const url = /^https?:\/\//i.test(row.path) ? row.path : byPath.get(row.path);
      if (url) siteImages[row.key] = url;
    }
  }

  return { settings: (settingsRes?.data as BootstrapSettings | null) ?? null, siteImages };
}

const bootstrapCache = createStartupCache(load, EMPTY, CACHE_TTL_MS, LOAD_TIMEOUT_MS);

/** Drop the cache so the next render sees an admin's settings change. */
export function invalidateSiteBootstrapCache() {
  bootstrapCache.invalidate();
}

export const loadSiteBootstrap = () => bootstrapCache.get();
