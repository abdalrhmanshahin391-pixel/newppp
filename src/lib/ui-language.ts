export type UiLanguage = "en" | "ar";
export const LANG_STORAGE_KEY = "ysmu-lang";

export function languageFromCookie(cookie: string | undefined): UiLanguage | null {
  const value = cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LANG_STORAGE_KEY}=`))
    ?.slice(LANG_STORAGE_KEY.length + 1);
  return value === "ar" || value === "en" ? value : null;
}

export function languageCookie(lang: UiLanguage, secure: boolean): string {
  return `${LANG_STORAGE_KEY}=${lang}; Path=/; Max-Age=31536000; SameSite=Lax${secure ? "; Secure" : ""}`;
}
