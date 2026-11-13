import type { Level } from "@/lib/wordcraft/round";

export const LEVEL_NAMES: Record<Level, { en: string; ar: string }> = {
  easy: { en: "Easy", ar: "سهل" },
  medium: { en: "Medium", ar: "متوسط" },
  hard: { en: "Hard", ar: "صعب" },
};

export const LEVEL_LINES: Record<Level, { en: string; ar: string }> = {
  easy: {
    en: "Four 4-letter words on a \u20664\u00a0×\u00a04\u2069 grid. Everyday words.",
    ar: "أربع كلمات من 4 حروف على شبكة \u20664\u00a0×\u00a04\u2069. كلمات يومية.",
  },
  medium: {
    en: "Four 5-letter words on a \u20664\u00a0×\u00a05\u2069 grid.",
    ar: "أربع كلمات من 5 حروف على شبكة \u20664\u00a0×\u00a05\u2069.",
  },
  hard: {
    en: "Four longer words on a \u20664\u00a0×\u00a06\u2069 grid, with more turns.",
    ar: "أربع كلمات أطول على شبكة \u20664\u00a0×\u00a06\u2069، وطرقها ملفوفة أكتر.",
  },
};
