// What the round menu offers. The actions come from `study-actions.ts` (they depend on what is
// selected); RING_ACTIONS says which of them the ring shows.

import {
  AlertTriangle,
  AppWindowMac,
  BookOpenText,
  Lightbulb,
  Layers,
  ListChecks,
  Languages,
  ListTree,
  MessageCircleQuestion,
  Mic,
  Undo2,
  RotateCcw,
  Sparkles,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { ACTION_INFO, type SelectionKind, type StudyAction } from "@/lib/study/study-actions";
import type { ExplanationLanguage } from "@/lib/explanation-language";

export type RadialItem = {
  id: string;
  label: string;
  Icon: LucideIcon;
  /** A trial option with nothing behind it yet. */
  placeholder?: boolean;
  /** Short text drawn in the disc instead of the icon (a language: "ع", "EN"). */
  glyph?: string;
  /** "reply": an option about Uzyra's own answer, drawn in dark red like that selection. */
  tone?: "reply";
  /** One of a set of choices: true for the chosen one, false for the others. */
  checked?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  /** Its own colour on the wheel, as "r g b" (the rim light, the icon, the glow when chosen). */
  color?: string;
};

const ICONS: Record<StudyAction, LucideIcon> = {
  explain: MessageCircleQuestion,
  simplify: Sparkles,
  meaning: Volume2,
  explain_back: RotateCcw,
  compare_arabic: Languages,
  word_by_word: ListTree,
  why_form: Lightbulb,
  common_mistake: AlertTriangle,
  summarize_section: BookOpenText,
  explain_reply: Lightbulb,
  make_cards: Layers,
  make_mcq: ListChecks,
  report: AlertTriangle,
};

/** Short names for the ring (the full wording is still used for Uzyra's requests). */
const SHORT: Partial<Record<StudyAction, string>> = {
  explain: "اشرحلي",
  simplify: "بسّط بمثال",
  meaning: "معنى ونطق",
  explain_back: "أنا بشرح",
  compare_arabic: "بالعربي",
  word_by_word: "فكّك الجملة",
  why_form: "ليش هيك؟",
  common_mistake: "انتبه للغلطة",
  make_cards: "فلاش كاردز",
  make_mcq: "تمارين",
  summarize_section: "لخّص القسم",
};

/**
 * The study wheel, the same in the lessons and the books: eight slices, each always in the same
 * place (clockwise from the top) and the same colour, so the hand learns where each one is.
 */
export const RING_ACTIONS: StudyAction[] = [
  "explain",
  "meaning",
  "make_cards",
  "make_mcq",
  "compare_arabic",
  "why_form",
  "word_by_word",
  "common_mistake",
];

/** Each slice's colour ("r g b"), bright enough on the wheel's dark navy. */
export const WHEEL_COLORS: Partial<Record<StudyAction, string>> = {
  explain: "110 168 255",
  explain_reply: "255 122 140",
  meaning: "62 224 200",
  make_cards: "255 201 92",
  make_mcq: "183 155 255",
  compare_arabic: "126 224 143",
  why_form: "255 143 200",
  word_by_word: "95 214 255",
  common_mistake: "255 138 122",
};

/** Why a slice is dimmed (what to select instead), the same words in the lessons and books. */
export const WHEEL_REASONS: Partial<Record<StudyAction, string>> = {
  meaning: "حدّد كلمة أو عبارة قصيرة بالإنجليزي أو الألماني",
  word_by_word: "حدّد جملة أو عبارة عشان نوضح تركيبها",
  why_form: "حدّد كلمة أو صيغة قصيرة داخل الجملة",
  compare_arabic: "حدّد عبارة أو جملة عشان نقارنها بالعربي",
  common_mistake: "حدّد قاعدة أو جملة عشان نعرض غلطة مرتبطة فيها",
  make_cards: "حدّد جزء عشان نجهّز البطاقات",
  make_mcq: "حدّد جزء عشان نجهّز التمارين",
};

export function actionItem(action: StudyAction): RadialItem {
  return {
    id: action,
    label: SHORT[action] ?? ACTION_INFO[action].label,
    Icon: ICONS[action],
    color: WHEEL_COLORS[action],
  };
}

export const KIND_LABEL: Record<SelectionKind, string> = {
  word: "كلمة",
  phrase: "عبارة",
  sentence: "جملة",
  rule: "قاعدة",
  table_cells: "خلايا من جدول",
  multi_block: "أكثر من جزء",
  arabic_only: "شرح عربي",
  too_long: "تحديد كبير",
  non_text: "",
};

/** The wheel's eight slices; a slice that does not suit the selection stays, dimmed. */
export function ringItems(options: { actions: StudyAction[] }): RadialItem[] {
  return RING_ACTIONS.map((action) => ({
    ...actionItem(action),
    disabled: !options.actions.includes(action),
    disabledReason: WHEEL_REASONS[action] ?? "حدّد كلمة أو جملة",
  }));
}

/** Temporary, local-only preview with three sample questions. Remove after design approval. */
export const WINDOW_ITEM: RadialItem = {
  id: "window-demo",
  label: "معاينة الأسئلة",
  Icon: AppWindowMac,
};

/**
 * The wheel for a selection in Uzyra's own answers (the left column): the same eight places, with
 * "explain it simply" in the explain slice (in her dark red) and the others dimmed.
 */
export function replyRingItems(): RadialItem[] {
  return RING_ACTIONS.map((action) =>
    action === "explain"
      ? { ...actionItem("explain_reply"), tone: "reply" as const }
      : {
          ...actionItem(action),
          disabled: true,
          disabledReason: "هاد للنص نفسه: حدّد من الدرس أو الكتاب",
        },
  );
}

/** Opens the language choices; always there, with or without a selection. */
export const LANGUAGE_ITEM: RadialItem = { id: "lang", label: "لغة الشرح", Icon: Languages };

export const LANGUAGE_NAMES: Record<ExplanationLanguage, string> = {
  ar: "العربي",
  en: "English",
  automatic: "حسب كلامي",
};

const LANGUAGE_ORDER: ExplanationLanguage[] = ["ar", "en", "automatic"];

/** The ring while choosing the language: the three choices (the current one ticked) and back. */
export function languageItems(current: ExplanationLanguage): RadialItem[] {
  return [
    ...LANGUAGE_ORDER.map((value) => ({
      id: `lang:${value}`,
      label: LANGUAGE_NAMES[value],
      Icon: value === "automatic" ? Mic : Languages,
      glyph: value === "ar" ? "ع" : value === "en" ? "EN" : undefined,
      checked: value === current,
      color: "110 168 255",
    })),
    { id: "lang:back", label: "رجوع", Icon: Undo2, color: "156 193 255" },
  ];
}

/** The language named by a ring id ("lang:ar"), or null. */
export function languageFromId(id: string): ExplanationLanguage | null {
  const value = id.startsWith("lang:") ? id.slice(5) : "";
  return (LANGUAGE_ORDER as string[]).includes(value) ? (value as ExplanationLanguage) : null;
}
