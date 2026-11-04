import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { languageFromCookie, type UiLanguage } from "./ui-language";

export type SettingsRow = Record<string, string | number | boolean | null>;

export type BootstrapPayload = {
  language: UiLanguage;
  settings: SettingsRow | null;
  siteImages: Record<string, string>;
};

/**
 * Server-side fetch of the global datasets every page needs (theme settings) so the first HTML frame is already correct.
 * The actual query lives in site-bootstrap.server.ts behind a short cache.
 */
export const getSiteBootstrap = createServerFn({ method: "GET" }).handler(
  async (): Promise<BootstrapPayload> => {
    const language = languageFromCookie(getRequestHeader("cookie")) ?? "en";
    try {
      const { loadSiteBootstrap } = await import("./site-bootstrap.server");
      return { ...(await loadSiteBootstrap()), language };
    } catch {
      return { settings: null, siteImages: {}, language };
    }
  },
);
