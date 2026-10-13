/**
 * Colour tokens for the live lesson. One source of truth: the page sets them as
 * CSS custom properties, and the tests check WCAG AA contrast on the same values.
 */
export type ThemeName = "dark" | "light";

export const LESSON_THEMES = {
  dark: {
    bg: "#15161a",
    surface: "#1c1e23",
    surface2: "#24262c",
    line: "#383b44",
    ink: "#f1f2f5",
    muted: "#a9aebb",
    accent: "#7aa2ff",
    accentInk: "#0b1220",
    accentSoft: "#1f2b47",
    you: "#243553",
    youInk: "#eaf0ff",
    ok: "#6fd3a5",
    okSoft: "#143024",
    warn: "#f0b866",
    warnSoft: "#33270f",
    danger: "#ff9a9a",
    dangerSoft: "#3a1a1a",
  },
  light: {
    bg: "#f4f5f8",
    surface: "#ffffff",
    surface2: "#edeff4",
    line: "#d4d8e0",
    ink: "#15171c",
    muted: "#555c6b",
    accent: "#2253cf",
    accentInk: "#ffffff",
    accentSoft: "#e4ebfc",
    you: "#e1e9fb",
    youInk: "#14223f",
    ok: "#0f6b47",
    okSoft: "#dcf2e8",
    warn: "#8a4b00",
    warnSoft: "#fbebd2",
    danger: "#b02020",
    dangerSoft: "#fbe3e3",
  },
} as const satisfies Record<ThemeName, Record<string, string>>;

export type ThemeTokens = (typeof LESSON_THEMES)["dark"];

/** Inline style that exposes every token as `--l-<name>`. */
export function themeStyle(name: ThemeName): Record<string, string> {
  return Object.fromEntries(
    Object.entries(LESSON_THEMES[name]).map(([token, value]) => [`--l-${token}`, value]),
  );
}

function channel(value: number) {
  const unit = value / 255;
  return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((offset) =>
    channel(Number.parseInt(value.slice(offset, offset + 2), 16)),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #rrggbb colours. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

export function readStoredTheme(): ThemeName {
  try {
    const value = window.localStorage.getItem("rita-lesson-theme");
    return value === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function storeTheme(name: ThemeName) {
  try {
    window.localStorage.setItem("rita-lesson-theme", name);
  } catch {
    /* A theme preference is optional. */
  }
}
