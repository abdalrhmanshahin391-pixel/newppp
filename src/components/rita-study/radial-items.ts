// What the round menu offers. The real study actions come from `study-actions.ts` (they depend on
// what is selected); the trial options below are placeholders the owner fills in later: change a
// label or an icon here, or give one an `id` and handle it in StudyPage's `pickRing`.

import {
  AlertTriangle,
  BookOpenText,
  Languages,
  ListTree,
  MessageCircleQuestion,
  Plus,
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

/** The trial options. Replace them when the real ones are decided. */
export const PLACEHOLDER_ITEMS: RadialItem[] = [
  { id: "slot-1", label: "خيار ١", Icon: Plus, placeholder: true },
  { id: "slot-2", label: "خيار ٢", Icon: Plus, placeholder: true },
];

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

/** The ring's options for what is selected (the main actions first), then the trial ones. */
export function ringItems(options: {
  actions: StudyAction[];
  hasSelection: boolean;
  hasSection: boolean;
}): RadialItem[] {
  const real = options.actions.filter((action) => action !== "report");
  const ordered = [
    ...real.filter((action) => ACTION_INFO[action].primary),
    ...real.filter((action) => !ACTION_INFO[action].primary),
  ];
  if (!options.hasSelection && options.hasSection) ordered.unshift("summarize_section");
  return [...ordered.map(actionItem), ...PLACEHOLDER_ITEMS];
}
