/**
 * Wording for the RitaJet pages. The words now ship in the code, so this hook
 * simply returns the fallback each caller passes in.
 */
export function useSiteText() {
  return {
    map: {} as Record<string, { en: string; ar: string }>,
    text: (_key: string, fallback: { en: string; ar: string }, lang: "en" | "ar" = "en") =>
      fallback[lang],
  };
}
