// Saving flashcards made on the study page into the learner's flashcard board (the same subjects,
// sub-subjects and cards the flashcards page shows). Pure planning here; the browser storage is
// read and written through local-board / use-flashcards by the caller.
import type { BoardSubject } from "./local-board";
import type { FlashCardItem } from "./use-flashcards";

export type DraftCard = { front: string; back: string };

const norm = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();

/** The board with the subject and sub-subject added when missing (names compared loosely). */
export function ensurePlace(
  board: BoardSubject[],
  subject: string,
  sub: string,
): { board: BoardSubject[]; subject: string; sub: string } {
  const wantedSubject = subject.trim().replace(/\s+/g, " ");
  const wantedSub = sub.trim().replace(/\s+/g, " ");
  const next = board.map((s) => ({ name: s.name, subs: s.subs.map((x) => ({ name: x.name })) }));
  let found = next.find((s) => norm(s.name) === norm(wantedSubject));
  if (!found) {
    found = { name: wantedSubject, subs: [] };
    next.push(found);
  }
  let foundSub = found.subs.find((x) => norm(x.name) === norm(wantedSub));
  if (!foundSub) {
    foundSub = { name: wantedSub };
    found.subs.push(foundSub);
  }
  return { board: next, subject: found.name, sub: foundSub.name };
}

/**
 * The cards to add to a sub-subject: the drafts whose front is not there yet (nor repeated among
 * the drafts). Returns the new cards with fresh ids and how many were skipped as repeats.
 */
export function mergeCards(
  existing: FlashCardItem[],
  drafts: DraftCard[],
  makeId: (index: number) => string,
): { added: FlashCardItem[]; skipped: number } {
  const seen = new Set(existing.map((card) => norm(card.front)));
  const added: FlashCardItem[] = [];
  let skipped = 0;
  drafts.forEach((draft, index) => {
    const front = draft.front.trim();
    const back = draft.back.trim();
    if (!front || !back) return;
    const key = norm(front);
    if (seen.has(key)) {
      skipped += 1;
      return;
    }
    seen.add(key);
    added.push({ id: makeId(index), front, back });
  });
  return { added, skipped };
}

/** Takes back exactly the cards one save added (undo), leaving everything else. */
export function removeCards(existing: FlashCardItem[], ids: string[]): FlashCardItem[] {
  const drop = new Set(ids);
  return existing.filter((card) => !drop.has(card.id));
}
