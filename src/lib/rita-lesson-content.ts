// What a lesson (version 2) is made of: sections taken from the book, each with an explanation,
// a guided example, practice items and remediation items. The same shape fits any grammar point
// or any group of words; nothing here knows about a particular rule.
// Pure: no server or browser imports, so the rules can be unit tested with node.
import { z } from "zod";

export const CONTENT_SCHEMA_V2 = 2;

/** Exercise kinds in the first batch. Each has a fixed way to be checked (rita-lesson-grader). */
export const ITEM_TEMPLATES = [
  "choice_fill",
  "meaning_choice",
  "word_order",
  "syllable_tiles",
] as const;
export type ItemTemplate = (typeof ITEM_TEMPLATES)[number];

/** The gap in a choice_fill prompt. */
export const GAP = "___";

/** Questions a section needs before it can be passed, and how many must be right. */
export const DEFAULT_MASTERY = { required: 5, min_correct: 4 } as const;

const text = (max: number) => z.string().trim().max(max);
const pageNo = z.number().int().min(1).max(5_000);
const itemId = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9_-]{0,47}$/, "ids are lowercase letters, digits, dashes and underscores");

const itemBase = {
  /** Sent to the page with the question, so it must not give the answer away ("q3", not "q_is"). */
  id: itemId,
  /** The small skill the item checks, e.g. "be.he_she_it". Remediation follows it. */
  skill_tag: text(60).min(1),
  /** What the learner reads. */
  prompt: text(240).min(1),
  /** Short instruction in Arabic shown above the question ("اختر الكلمة المناسبة"). */
  instruction_ar: text(120).default(""),
  /** What Rita says when she reads the question; the prompt when empty. */
  spoken_prompt: text(240).default(""),
  hint_ar: text(240).default(""),
  hint_en: text(240).default(""),
  /** Said and shown after the answer: why it is right. */
  explain_ar: text(300).default(""),
  explain_en: text(300).default(""),
  source_page: pageNo.nullable().default(null),
};

const ChoiceFillSchema = z.object({
  ...itemBase,
  template: z.literal("choice_fill"),
  options: z.array(text(60).min(1)).min(2).max(4),
  /** Keep the options in this order (am / is / are reads naturally); otherwise they are shuffled. */
  keep_option_order: z.boolean().default(false),
  answer: text(60).min(1),
});

const MeaningChoiceSchema = z.object({
  ...itemBase,
  template: z.literal("meaning_choice"),
  word: text(60).min(1),
  options: z.array(text(80).min(1)).min(2).max(4),
  answer: text(80).min(1),
});

const WordOrderSchema = z.object({
  ...itemBase,
  template: z.literal("word_order"),
  /** The words of the sentence in the right order. The learner gets them shuffled. */
  answer: z.array(text(40).min(1)).min(2).max(10),
  /** Other orders that are also right ("Today I am happy" / "I am happy today"). */
  accepted: z
    .array(z.array(text(40).min(1)).min(2).max(10))
    .max(4)
    .default([]),
});

const SyllableTilesSchema = z.object({
  ...itemBase,
  template: z.literal("syllable_tiles"),
  /** The word to build. Never shown before the answer: the learner hears it or reads the clue. */
  word: text(40).min(1),
  /** What the learner sees instead of the word, e.g. its meaning ("ملكية، عقار"). */
  clue_ar: text(120).default(""),
  /** The pieces in the right order; joined they make the word. The count depends on the word. */
  answer: z.array(text(20).min(1)).min(2).max(8),
});

export const LessonItemSchema = z.discriminatedUnion("template", [
  ChoiceFillSchema,
  MeaningChoiceSchema,
  WordOrderSchema,
  SyllableTilesSchema,
]);
export type LessonItem = z.infer<typeof LessonItemSchema>;

export const SectionSchema = z.object({
  id: itemId,
  title: text(120).min(1),
  title_ar: text(120).default(""),
  source_pages: z.array(pageNo).max(20).default([]),
  explain: z.object({
    rule_ar: text(600).min(1),
    rule_en: text(600).default(""),
    /** A small two-column table, e.g. subject → form. */
    table: z
      .array(z.object({ left: text(60).min(1), right: text(60).min(1) }))
      .max(10)
      .default([]),
    examples: z
      .array(z.object({ text: text(160).min(1), note_ar: text(160).default("") }))
      .max(6)
      .default([]),
  }),
  guided: z.array(LessonItemSchema).max(2).default([]),
  practice: z.array(LessonItemSchema).min(1).max(20),
  remediation: z.array(LessonItemSchema).max(12).default([]),
  mastery: z
    .object({
      required: z.number().int().min(1).max(10),
      min_correct: z.number().int().min(1).max(10),
    })
    .default({ ...DEFAULT_MASTERY }),
});
export type LessonSection = z.infer<typeof SectionSchema>;

export const LessonContentSchema = z.object({
  schema: z.literal(CONTENT_SCHEMA_V2),
  /** The language being learned ("en", "de"). */
  language: text(8).min(2),
  estimated_minutes: z.number().int().min(3).max(40).default(12),
  intro_ar: text(300).default(""),
  intro_en: text(300).default(""),
  sections: z.array(SectionSchema).min(1).max(6),
  wrap: z.object({ summary_ar: text(600).default(""), summary_en: text(600).default("") }),
});
export type LessonContent = z.infer<typeof LessonContentSchema>;

/** The words of a sentence or option, compared the way the grader compares them. */
export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
    .replace(/[.!?؟,،;:]+$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sameMultiset(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const left = a.map(normalizeAnswer).sort();
  const right = b.map(normalizeAnswer).sort();
  return left.every((value, index) => value === right[index]);
}

/** Every item in a lesson, with the section it belongs to and the bank it sits in. */
export function allItems(content: LessonContent) {
  return content.sections.flatMap((section) =>
    (["guided", "practice", "remediation"] as const).flatMap((bank) =>
      section[bank].map((item) => ({ section, bank, item })),
    ),
  );
}

export function findItem(content: LessonContent, id: string) {
  return allItems(content).find((entry) => entry.item.id === id) ?? null;
}

/**
 * Problems that make a lesson unsafe to publish, found without any AI: an item whose answer is not
 * among its options, a gap missing or doubled, tiles that do not make the word, too few practice
 * questions for the section's mastery rule, repeated ids. Empty means the content can be saved.
 */
export function contentProblems(content: LessonContent): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const sectionIds = new Set<string>();
  for (const section of content.sections) {
    if (sectionIds.has(section.id)) problems.push(`Section id "${section.id}" is used twice.`);
    sectionIds.add(section.id);
    if (section.mastery.min_correct > section.mastery.required) {
      problems.push(`Section "${section.id}": min_correct is above required.`);
    }
    if (section.practice.length < section.mastery.required) {
      problems.push(
        `Section "${section.id}" has ${section.practice.length} practice questions; it needs ${section.mastery.required}.`,
      );
    }
  }
  for (const { section, item } of allItems(content)) {
    const where = `Section "${section.id}", item "${item.id}"`;
    if (seen.has(item.id)) problems.push(`${where}: the id is used twice.`);
    seen.add(item.id);
    problems.push(...itemProblems(item).map((problem) => `${where}: ${problem}`));
  }
  return problems;
}

export function itemProblems(item: LessonItem): string[] {
  const problems: string[] = [];
  switch (item.template) {
    case "choice_fill": {
      const gaps = item.prompt.split(GAP).length - 1;
      if (gaps !== 1) problems.push(`the prompt needs exactly one ${GAP} (found ${gaps}).`);
      problems.push(...optionProblems(item.options, item.answer));
      break;
    }
    case "meaning_choice":
      problems.push(...optionProblems(item.options, item.answer));
      break;
    case "word_order":
      for (const order of item.accepted) {
        if (!sameMultiset(order, item.answer)) {
          problems.push("an accepted order uses different words from the answer.");
        }
      }
      if (new Set(item.answer.map(normalizeAnswer)).size === 1) {
        problems.push("all the words are the same, so there is nothing to order.");
      }
      break;
    case "syllable_tiles":
      if (normalizeAnswer(item.answer.join("")) !== normalizeAnswer(item.word)) {
        problems.push(`the pieces make "${item.answer.join("")}", not "${item.word}".`);
      }
      break;
  }
  return problems;
}

function optionProblems(options: string[], answer: string): string[] {
  const problems: string[] = [];
  const normalized = options.map(normalizeAnswer);
  if (new Set(normalized).size !== normalized.length) problems.push("two options are the same.");
  const matches = normalized.filter((option) => option === normalizeAnswer(answer)).length;
  if (matches !== 1) problems.push(`the answer "${answer}" must be exactly one of the options.`);
  return problems;
}

/** Parses stored content; null when it is missing or not version 2 (an older spoken-only lesson). */
export function parseLessonContent(raw: unknown): LessonContent | null {
  const parsed = LessonContentSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
