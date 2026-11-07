import { useState } from "react";

export type PageLang = "en" | "ar";

/** Remembers a page's English / Arabic choice for this browser (the progress page uses it). */
export function usePageLang(): [PageLang, (lang: PageLang) => void] {
  const [lang, setLang] = useState<PageLang>(() => {
    if (typeof window === "undefined") return "en";
    try {
      // The key predates the removed "How it works" tours; kept so the saved choice survives.
      return localStorage.getItem("rita-tutorial-lang") === "ar" ? "ar" : "en";
    } catch {
      return "en";
    }
  });
  return [
    lang,
    (next: PageLang) => {
      setLang(next);
      try {
        localStorage.setItem("rita-tutorial-lang", next);
      } catch {
        /* storage can be blocked; the choice lasts this visit only */
      }
    },
  ];
}
