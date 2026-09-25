import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/legacy-client";
import { signSiteMedia } from "@/lib/site-media";

export type SiteImageMap = Record<string, string>;

/** All admin-set picture overrides, resolved to usable URLs. */
export function useSiteImages() {
  return useQuery<SiteImageMap>({
    queryKey: ["site-images"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("site_images").select("key,path");
      const rows = (data ?? []) as { key: string; path: string }[];
      const entries = await Promise.all(
        rows.map(async (r) => [r.key, (await signSiteMedia(r.path)) ?? ""] as const),
      );
      return Object.fromEntries(entries.filter(([, url]) => url)) as SiteImageMap;
    },
  });
}

/** Returns the override for `key` when one exists, otherwise the built-in art. */
export function useSiteImage(key: string, fallback: string) {
  const { data } = useSiteImages();
  return data?.[key] || fallback;
}

