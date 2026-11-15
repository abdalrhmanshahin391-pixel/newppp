// Saving what the practice window made (in a lesson or a book) where the learner keeps studying:
// questions go to Lecture Lab as one small "lecture", cards go to the flashcards board. Pure: no
// DOM, no network, no storage; the window and the server function call these.
import type { StudyCard, StudyMcq } from "./study-practice.ts";

export const SAVE_LIMITS = { title: 160, source: 200, questions: 20, cards: 40 } as const;

export type LectureOption = { letter: string; body: string; is_correct: boolean };
export type LectureQuestion = {
  stem: string;
  options: LectureOption[];
  explanation: string;
  point_ref: string | null;
};

const LETTERS = ["A", "B", "C", "D"] as const;

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Lecture Lab's shape for the practice questions: four lettered options with exactly one right
 * one, the "why" line as the explanation, and the selected text as the point it came from.
 * A question that is not whole (a missing option, no right answer) is left out.
 */
export function toLectureQuestions(questions: StudyMcq[], quote: string): LectureQuestion[] {
  const point = quote.trim() ? clip(quote, 200) : null;
  return questions.flatMap((question) => {
    const stem = question.question.trim();
    const bodies = question.options.map((option) => option.trim());
    if (!stem || bodies.length !== 4 || bodies.some((body) => !body)) return [];
    if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer > 3) return [];
    return [
      {
        stem,
        options: bodies.map((body, index) => ({
          letter: LETTERS[index],
          body,
          is_correct: index === question.answer,
        })),
        explanation: question.why.trim(),
        point_ref: point,
      },
    ];
  });
}

/** The saved lecture's title: where it came from and the start of the selection. */
export function savedLectureTitle(source: string, quote: string): string {
  const from = source.trim() || "درس";
  const bit = quote.trim() ? ` · «${clip(quote, 48)}»` : "";
  return clip(`${from}${bit}`, SAVE_LIMITS.title);
}

/** A card's text on the flashcards board: the back carries the meaning and, under it, the note. */
export function cardFaces(card: StudyCard): { front: string; back: string } {
  const back = card.note.trim() ? `${card.back.trim()}\n${card.note.trim()}` : card.back.trim();
  return { front: card.front.trim(), back };
}

function same(text: string): string {
  return text.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * The cards to add to a topic that already has `existing`: a card whose front is already there
 * (or appears twice in this batch) is skipped, never added twice.
 */
export function newCards<C extends { front: string }>(
  existing: { front: string }[],
  cards: C[],
): { add: C[]; skipped: number } {
  const seen = new Set(existing.map((card) => same(card.front)));
  const add: C[] = [];
  for (const card of cards) {
    const key = same(card.front);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    add.push(card);
  }
  return { add, skipped: cards.length - add.length };
}

/** The items the learner kept ticked, in their order. */
export function picked<T>(items: T[], chosen: ReadonlySet<number>): T[] {
  return items.filter((_, index) => chosen.has(index));
}
