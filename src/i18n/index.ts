import { createInstance } from "i18next";
import en from "./locales/en.json";
import ar from "./locales/ar.json";
import { DEFAULT_AR, DEFAULT_EN, toResourceBundle } from "@/lib/site-content-catalog";
import type { UiLanguage } from "@/lib/ui-language";

const resources = {
  en: { translation: { ...en, ...toResourceBundle(DEFAULT_EN) } },
  ar: { translation: { ...ar, ...toResourceBundle(DEFAULT_AR) } },
};

// One instance per app: concurrent SSR requests must never share a locale.
export function createUiI18n(language: UiLanguage) {
  const instance = createInstance();
  void instance.init({
    resources,
    lng: language,
    initAsync: false,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return instance;
}
