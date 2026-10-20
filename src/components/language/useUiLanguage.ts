import { useTranslation } from "react-i18next";

/** The language the site is shown in (not the one being learned). */
export function useUiLanguage(): "en" | "ar" {
  const { i18n } = useTranslation();
  return (i18n.language ?? "").startsWith("ar") ? "ar" : "en";
}
