import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { I18nextProvider } from "react-i18next";
import { createUiI18n } from "@/i18n";
import {
  LANG_STORAGE_KEY,
  languageCookie,
  languageFromCookie,
  type UiLanguage,
} from "@/lib/ui-language";

export type Lang = UiLanguage;
type Ctx = { lang: Lang; setLang: (lang: Lang) => void; toggle: () => void };
const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({
  children,
  initialLang = "en",
}: {
  children: ReactNode;
  initialLang?: Lang;
}) {
  const [lang, setLangState] = useState(initialLang);
  const [i18n] = useState(() => createUiI18n(initialLang));
  const setLang = useCallback(
    (next: Lang) => {
      document.documentElement.lang = next;
      document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
      void i18n.changeLanguage(next);
      document.cookie = languageCookie(next, location.protocol === "https:");
      try {
        localStorage.setItem(LANG_STORAGE_KEY, next);
      } catch {
        /* Storage may be blocked. */
      }
      setLangState(next);
    },
    [i18n],
  );

  useLayoutEffect(() => {
    let next = initialLang;
    // Migrate existing local-only preferences once; reloads then use the SSR cookie.
    if (!languageFromCookie(document.cookie)) {
      try {
        if (localStorage.getItem(LANG_STORAGE_KEY) === "ar") next = "ar";
      } catch {
        /* optional */
      }
    }
    setLang(next);
  }, [initialLang, setLang]);

  const value = useMemo(
    () => ({ lang, setLang, toggle: () => setLang(lang === "ar" ? "en" : "ar") }),
    [lang, setLang],
  );
  return (
    <I18nextProvider i18n={i18n}>
      <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
    </I18nextProvider>
  );
}

export function useLang(): Ctx {
  return useContext(LanguageContext) ?? { lang: "en", setLang: () => {}, toggle: () => {} };
}
