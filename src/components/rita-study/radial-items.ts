// What the round menu offers. The actions come from `study-actions.ts` (they depend on what is
// selected); RING_ACTIONS says which of them the ring shows.

import {
  AlertTriangle,
  BookOpenText,
  Layers,
  ListChecks,
  Languages,
  ListTree,
  MessageCircleQuestion,
  RotateCcw,
  Sparkles,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { ACTION_INFO, type SelectionKind, type StudyAction } from "@/lib/study/study-actions";

export type RadialItem = {
  id: string;
  label: string;
  Icon: LucideIcon;
  /** A trial option with nothing behind it yet. */
  placeholder?: boolean;
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

/** The ring's options for what is selected. */
export function ringItems(options: { actions: StudyAction[] }): RadialItem[] {
  return RING_ACTIONS.filter((action) => options.actions.includes(action)).map(actionItem);
}
