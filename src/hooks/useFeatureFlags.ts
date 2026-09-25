/** Every section and tool ships enabled; there are no admin switches any more. */
export function useFeatureFlags() {
  return {
    flags: {} as Record<string, never>,
    enabled: (_key: string) => true,
    badge: (_key: string, _lang: "en" | "ar" = "en") => null as string | null,
  };
}
