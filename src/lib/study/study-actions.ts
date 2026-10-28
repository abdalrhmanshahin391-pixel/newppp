// What the floating circle's menu offers for a selection. Pure, tested with node.
// The kind of selection decides the list: a menu never shows an action that does not fit it.
import type { GuideSegment, SegmentRole } from "../guides/guide-blocks.ts";
import { MAX_SELECTION_CHARS, type QuotaGroup } from "./study-limits.ts";

export const SELECTION_KINDS = [
  "word",
  "phrase",
  "sentence",
  "rule",
  "table_cells",
  "multi_block",
  "arabic_only",
  "too_long",
  "non_text",
] as const;
export type SelectionKind = (typeof SELECTION_KINDS)[number];

/** Actions Rita answers (the voice worker knows the same names; a test keeps them equal). */
export const RITA_ACTIONS = [
  "explain",
  "simplify",
  "explain_back",
  "compare_arabic",
  "word_by_word",
  "common_mistake",
  "summarize_section",
] as const;
export type RitaAction = (typeof RITA_ACTIONS)[number];

export type StudyAction = RitaAction | "meaning" | "report";

export type ActionInfo = {
  label: string;
  /** Shown first in the menu; the others sit under "More". */
  primary: boolean;
  group: QuotaGroup | null;
  /** Needs Rita's call (the learner talks back). */
  voiceOnly?: boolean;
};

export const ACTION_INFO: Record<StudyAction, ActionInfo> = {
  explain: { label: "اشرح المحدد", primary: true, group: "explain" },
  simplify: { label: "بسّط بمثال", primary: true, group: "explain" },
  meaning: { label: "معنى ونطق", primary: false, group: null },
  explain_back: {
    label: "أنا بشرح وإنتِ صححي",
    primary: false,
    group: "explain",
    voiceOnly: true,
  },
  compare_arabic: { label: "قارنها بالعربي", primary: false, group: "explain" },
  word_by_word: { label: "فصّلها كلمة كلمة", primary: false, group: "explain" },
  common_mistake: { label: "الغلطة الشائعة", primary: false, group: "explain" },
  summarize_section: { label: "لخّصلي القسم", primary: false, group: "explain" },
  report: { label: "في غلط بالدرس؟", primary: false, group: "report" },
};

const ALL_TEXT: SelectionKind[] = [
  "word",
  "phrase",
  "sentence",
  "rule",
  "table_cells",
  "multi_block",
  "arabic_only",
];

const AVAILABLE: Record<StudyAction, SelectionKind[]> = {
  explain: ALL_TEXT,
  simplify: ALL_TEXT,
  explain_back: ["sentence", "rule", "table_cells", "multi_block", "phrase"],
  meaning: ["word", "phrase", "table_cells"],
  compare_arabic: ["phrase", "sentence", "rule", "table_cells", "arabic_only"],
  word_by_word: ["phrase", "sentence"],
  common_mistake: ["phrase", "sentence", "rule", "table_cells"],
  summarize_section: [],
  report: [...ALL_TEXT, "too_long"],
};

export function availableActions(kind: SelectionKind): StudyAction[] {
  return (Object.keys(AVAILABLE) as StudyAction[]).filter((action) =>
    AVAILABLE[action].includes(kind),
  );
}

const CELL_ROLES: SegmentRole[] = ["cell", "label", "rowlabel"];
const TEACHING_ROLES: SegmentRole[] = ["rule", "callout", "intro", "heading"];
const LETTER = /\p{L}/u;
const LATIN = /[A-Za-zÀ-ÿ]/;

function words(text: string): string[] {
  return text.split(/\s+/).filter((word) => LETTER.test(word));
}

/** What kind of piece the learner selected (see the plan, section 7.2). */
export function classifySelection(input: {
  exact: string;
  segments: Pick<GuideSegment, "seg" | "block" | "role" | "lang" | "text">[];
}): SelectionKind {
  const exact = input.exact.trim();
  if (!exact || !LETTER.test(exact) || !input.segments.length) return "non_text";
  const blocks = new Set(input.segments.map((segment) => segment.block));
  if (exact.length > MAX_SELECTION_CHARS || blocks.size > 3) return "too_long";
  if (input.segments.every((segment) => segment.lang === "ar") || !LATIN.test(exact))
    return "arabic_only";
  const cellsOnly = input.segments.every((segment) => CELL_ROLES.includes(segment.role));
  if (input.segments.length > 1 && cellsOnly) return "table_cells";
  if (blocks.size > 1) return "multi_block";
  const count = words(exact).length;
  if (count <= 1) return "word";
  const only = input.segments[0];
  const whole = only && exact.length >= only.text.length * 0.8;
  if (count <= 6) return whole && only.role === "example" ? "sentence" : "phrase";
  if (input.segments.some((segment) => TEACHING_ROLES.includes(segment.role))) return "rule";
  return "sentence";
}
