// What the round menu offers. The actions come from `study-actions.ts` (they depend on what is
// selected); RING_ACTIONS says which of them the ring shows.

import {
  AlertTriangle,
  AppWindowMac,
  BookOpenText,
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
  /** One of a set of choices: true for the chosen one, false for the others. */
  checked?: boolean;
  disabled?: boolean;
};

const ICONS: Record<StudyAction, LucideIcon> = {
  explain: MessageCircleQuestion,
  simplify: Sparkles,
  meaning: Volume2,
  explain_back: RotateCcw,
  compare_arabic: Languages,
  word_by_word: ListTree,
  common_mistake: AlertTriangle,
  summarize_section: BookOpenText,
  make_cards: Layers,
  make_mcq: ListChecks,
  report: AlertTriangle,
};

/** Short names for the ring (the full wording is still used for Rita's requests). */
const SHORT: Partial<Record<StudyAction, string>> = {
  explain: "اشرح",
  simplify: "بسّط بمثال",
  meaning: "معنى ونطق",
  explain_back: "أنا بشرح",
  compare_arabic: "بالعربي",
  word_by_word: "كلمة كلمة",
  common_mistake: "غلطة شائعة",
  summarize_section: "لخّص القسم",
};

/**
 * What the ring shows for now: only the flashcards and the four-option questions. The explain
 * actions still exist (Rita's voice worker knows them); add them here to bring them back.
 */
export const RING_ACTIONS: StudyAction[] = ["make_cards", "make_mcq"];

export function actionItem(action: StudyAction): RadialItem {
  return { id: action, label: SHORT[action] ?? ACTION_INFO[action].label, Icon: ICONS[action] };
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

/** The ring's options for what is selected, then the language Rita explains in. */
export function ringItems(options: { actions: StudyAction[] }): RadialItem[] {
  return [
    ...RING_ACTIONS.filter((action) => options.actions.includes(action)).map(actionItem),
    LANGUAGE_ITEM,
    WINDOW_ITEM,
  ];
}

/** A trial: opens the floating window with «Hello world» (its real content comes later). */
export const WINDOW_ITEM: RadialItem = {
  id: "window-demo",
  label: "نموذج ويندو",
  Icon: AppWindowMac,
};

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
    })),
    { id: "lang:back", label: "رجوع", Icon: Undo2 },
  ];
}

/** The language named by a ring id ("lang:ar"), or null. */
export function languageFromId(id: string): ExplanationLanguage | null {
  const value = id.startsWith("lang:") ? id.slice(5) : "";
  return (LANGUAGE_ORDER as string[]).includes(value) ? (value as ExplanationLanguage) : null;
}
