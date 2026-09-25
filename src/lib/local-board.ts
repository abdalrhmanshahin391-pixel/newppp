import { readCards, writeCards, type FlashCardItem } from "@/lib/use-flashcards";
import { FLASHCARD_SUBJECTS_KEY } from "@/lib/use-study-subjects";
import { ensureSampleFlashcards } from "@/lib/demo-seed";

export type BoardSubject = { name: string; subs: { name: string }[] };

/** The flashcard board exactly as the study workspace shows it. */
export function readBoard(): BoardSubject[] {
  if (typeof window === "undefined") return [];
  try {
    let raw = window.localStorage.getItem(FLASHCARD_SUBJECTS_KEY);
    let parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      ensureSampleFlashcards();
      raw = window.localStorage.getItem(FLASHCARD_SUBJECTS_KEY);
      parsed = raw ? JSON.parse(raw) : [];
    }
    if (!Array.isArray(parsed)) return [];
    return (parsed as BoardSubject[]).map((s) => ({
      name: s.name,
      subs: (s.subs ?? []).map((x) => ({ name: x.name })),
    }));
  } catch {
    return [];
  }
}

export function writeBoard(list: BoardSubject[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FLASHCARD_SUBJECTS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** Board plus the real card count of every subject and sub-subject. */
export function readBoardWithCounts() {
  return readBoard().map((s) => {
    const subs = s.subs.map((x) => ({ name: x.name, count: readCards(s.name, x.name).length }));
    return { name: s.name, subs, count: subs.reduce((n, x) => n + x.count, 0) };
  });
}

export function readTopicCards(subject: string, sub: string): FlashCardItem[] {
  return readCards(subject, sub);
}

function uniqueName(taken: Set<string>, wanted: string) {
  let name = wanted.trim() || "Shared deck";
  let n = 2;
  while (taken.has(name.toLowerCase())) name = `${wanted} ${n++}`;
  taken.add(name.toLowerCase());
  return name;
}

/** Copies a shared deck into the local board as one subject with a sub per group. */
export function addDeckToBoard(
  title: string,
  groups: { name: string; cards: { front: string; back: string }[] }[],
) {
  const board = readBoard();
  const subjectName = uniqueName(new Set(board.map((s) => s.name.toLowerCase())), title);
  const takenSubs = new Set<string>();
  const subs = groups.map((g) => ({ name: uniqueName(takenSubs, g.name || "Shared cards") }));
  writeBoard([...board, { name: subjectName, subs }]);
  groups.forEach((g, i) => {
    writeCards(
      subjectName,
      subs[i]!.name,
      g.cards.map((c, j) => ({
        id: `${Date.now().toString(36)}-${i}-${j}`,
        front: c.front,
        back: c.back,
      })),
    );
  });
  return subjectName;
}
