import snapshot from "./public-site-snapshot.json";

export type BootstrapSettings = Record<string, string | number | boolean | null>;

export type BootstrapData = {
  settings: BootstrapSettings | null;
  /** key -> ready-to-use URL for admin-replaced artwork. */
  siteImages: Record<string, string>;
};

/** Cold SSR never reads Cloud; refreshed public data is bundled at publication. */
export async function loadSiteBootstrap(): Promise<BootstrapData> {
  return { settings: { ...snapshot.settings }, siteImages: { ...snapshot.siteImages } };
}

/** Compatibility hook: authenticated settings queries are invalidated by the editor. */
export function invalidateSiteBootstrapCache() {}
