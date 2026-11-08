import type { PlanUsage } from "./plans.functions";
import type { SubscriptionRow } from "./subscription.functions";

export type SettingsLang = "en" | "ar";
export const SETTINGS_SECTIONS = ["account", "security", "plan", "usage", "billing"] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];
export const settingsText = (lang: SettingsLang, en: string, ar: string) =>
  lang === "ar" ? ar : en;
export const SETTINGS_INFO: Record<
  SettingsSection,
  { en: string; ar: string; description: [string, string]; keywords: string }
> = {
  account: {
    en: "Profile",
    ar: "الملف الشخصي",
    description: [
      "Your photo and the details that make this account yours.",
      "صورتك ومعلوماتك الشخصية في مكان واحد.",
    ],
    keywords:
      "name username photo email phone bio profile اسم مستخدم صورة بريد هاتف نبذة معلومات شخصية",
  },
  security: {
    en: "Security",
    ar: "الأمان",
    description: [
      "Manage the password you use to sign in.",
      "إدارة كلمة المرور المستخدمة لتسجيل الدخول.",
    ],
    keywords: "password login security reset كلمة السر كلمة المرور دخول أمان استعادة",
  },
  plan: {
    en: "My plan",
    ar: "خطتي",
    description: [
      "Your membership, benefits and active offers.",
      "اشتراكك ومزاياه والعروض الفعّالة على حسابك.",
    ],
    keywords: "plan subscription upgrade offer pack renewal خطتي خطة اشتراك ترقية باقة عرض تجديد",
  },
  usage: {
    en: "Usage",
    ar: "الاستخدام",
    description: [
      "See what you have used and what is still available.",
      "تعرّف على استهلاكك والرصيد المتبقي لكل خدمة.",
    ],
    keywords:
      "usage allowance balance remaining limits flashcards summaries استخدام رصيد حدود استهلاك متبقي بطاقات ملخصات",
  },
  billing: {
    en: "Billing & invoices",
    ar: "الدفع والفواتير",
    description: [
      "Manage payment methods, receipts and automatic renewal.",
      "إدارة وسائل الدفع والفواتير والتجديد التلقائي.",
    ],
    keywords:
      "billing invoice payment card cancel receipt paddle دفع فاتورة فواتير بطاقة إلغاء ايقاف إيصال",
  },
};
export function settingsSection(value: unknown): SettingsSection {
  return SETTINGS_SECTIONS.includes(value as SettingsSection)
    ? (value as SettingsSection)
    : "account";
}
export function matchingSettings(query: string): SettingsSection[] {
  const needle = query.trim().toLocaleLowerCase().normalize("NFKD").replace(/\p{M}/gu, "");
  return SETTINGS_SECTIONS.filter((section) => {
    const info = SETTINGS_INFO[section];
    return `${info.en} ${info.ar} ${info.keywords}`
      .toLocaleLowerCase()
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .includes(needle);
  });
}
export const SETTINGS_METERS = [
  { key: "flashcards", cap: "max_flashcards", en: "Flashcards", ar: "البطاقات" },
  { key: "summaries", cap: "max_summaries", en: "Summaries", ar: "الملخصات" },
  { key: "ai_questions", cap: "max_ai_questions", en: "Lecture questions", ar: "أسئلة المحاضرات" },
  {
    key: "archive_questions",
    cap: "max_archive_questions",
    en: "Archive questions",
    ar: "أسئلة الأرشيف",
  },
  {
    key: "all_in_one_lectures",
    cap: "max_all_in_one_lectures",
    en: "All-in-One lectures",
    ar: "محاضرات الكل في واحد",
  },
] as const;
export function settingsAllowance(data: PlanUsage, meter: (typeof SETTINGS_METERS)[number]) {
  const raw = data.plan[meter.cap];
  const cap =
    data.is_admin || raw === null
      ? null
      : raw === undefined || !Number.isFinite(Number(raw))
        ? undefined
        : Math.max(0, Number(raw));
  const finite = (value: unknown) =>
    Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  const extra = finite(data.grants?.[meter.key] ?? 0);
  const used = finite(data.usage[meter.key] ?? 0);
  const total = cap === null ? null : cap === undefined ? undefined : cap + extra;
  return {
    cap,
    extra,
    total,
    used,
    left: total === null ? null : total === undefined ? undefined : Math.max(0, total - used),
    percent:
      total === null || total === undefined
        ? null
        : total === 0
          ? 0
          : Math.min(100, (used / total) * 100),
  };
}
export function settingsDate(value: string | null | undefined, lang: SettingsLang): string | null {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-JO" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}
export function subscriptionLabel(
  subscription: SubscriptionRow | null | undefined,
  lang: SettingsLang,
) {
  if (subscription?.cancel_at_period_end)
    return settingsText(lang, "Auto-renewal stopped", "التجديد التلقائي متوقف");
  const labels: Record<string, [string, string]> = {
    active: ["Active", "فعّال"],
    trialing: ["Trial", "تجريبي"],
    past_due: ["Payment needs attention", "الدفع يحتاج متابعة"],
    paused: ["Paused", "متوقف مؤقتًا"],
    canceled: ["Cancelled", "ملغى"],
  };
  const label = subscription?.status ? labels[subscription.status] : undefined;
  if (subscription && !label) return settingsText(lang, "Status not available", "الحالة غير متاحة");
  return label
    ? settingsText(lang, ...label)
    : settingsText(lang, "No recurring subscription", "لا يوجد اشتراك متجدد");
}
