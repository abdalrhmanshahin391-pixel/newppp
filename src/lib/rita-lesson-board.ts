// The «review and publish» page: every book lesson that is made, with its book and its state, the
// numbers at the top of the page, and the filtered list. Pure, so it is unit tested with node.
import { lessonReadiness, type LessonReadiness, type SlidesState } from "./rita-book-flow.ts";
import { CEFR, normalizeLevel } from "./rita-path-levels.ts";

export type BoardBook = {
  id: string;
  title: string;
  title_ar: string | null;
  level: string;
  status: "draft" | "published" | "archived";
};

export type BoardLesson = {
  id: string;
  curriculum_id: string;
  lesson_no: number;
  status: "draft" | "published" | "archived";
  topic: string;
  title: string;
  title_ar: string;
  source_from_page: number;
  source_to_page: number;
};

export type BoardEntry<L extends BoardLesson = BoardLesson, B extends BoardBook = BoardBook> = {
  lesson: L;
  book: B;
  readiness: LessonReadiness;
  /** Review points on its slides (something wrong, or something the pages teach that is missing). */
  notes: number;
  level: string;
};

export type BoardTab = "ready" | "published";

/** Every lesson of a live book (archived ones left out), with its state. */
export function lessonBoard<L extends BoardLesson, B extends BoardBook>(input: {
  books: B[];
  lessons: L[];
  slides: Record<string, Record<string, SlidesState>>;
}): BoardEntry<L, B>[] {
  const books = new Map(input.books.filter((b) => b.status !== "archived").map((b) => [b.id, b]));
  const entries: BoardEntry<L, B>[] = [];
  for (const lesson of input.lessons) {
    const book = books.get(lesson.curriculum_id);
    if (!book || lesson.status === "archived") continue;
    const slides = input.slides[book.id]?.[lesson.id];
    entries.push({
      lesson,
      book,
      readiness: lessonReadiness(lesson, slides),
      notes: slides?.notes ?? 0,
      level: normalizeLevel(book.level),
    });
  }
  return entries;
}

/** Which tab an entry belongs to; lessons still being made belong to neither (they are made first). */
export function tabOf(entry: BoardEntry): BoardTab | null {
  if (entry.readiness === "published") return "published";
  if (entry.readiness === "ready" || entry.readiness === "warnings") return "ready";
  return null;
}

export type BoardStats = {
  ready: number;
  warnings: number;
  published: number;
  /** Made but not finished (no slides linked yet): finished in the lesson factory. */
  unfinished: number;
  /** Published lessons per level, in level order, levels without lessons left out. */
  byLevel: { level: string; count: number }[];
};

export function boardStats(entries: BoardEntry[]): BoardStats {
  const count = (state: LessonReadiness) => entries.filter((e) => e.readiness === state).length;
  const perLevel = new Map<string, number>();
  for (const entry of entries)
    if (entry.readiness === "published")
      perLevel.set(entry.level, (perLevel.get(entry.level) ?? 0) + 1);
  return {
    ready: count("ready") + count("warnings"),
    warnings: count("warnings"),
    published: count("published"),
    unfinished: count("no_slides"),
    byLevel: CEFR.filter((level) => perLevel.has(level)).map((level) => ({
      level,
      count: perLevel.get(level) ?? 0,
    })),
  };
}

export type BoardFilter = {
  tab: BoardTab;
  level?: string;
  book?: string;
  query?: string;
};

/** The cards of one tab: filtered by level, book and words, in level, book and lesson order. */
export function boardView<E extends BoardEntry>(entries: E[], filter: BoardFilter): E[] {
  const words = (filter.query ?? "").trim().toLocaleLowerCase();
  return entries
    .filter((entry) => tabOf(entry) === filter.tab)
    .filter((entry) => !filter.level || filter.level === "all" || entry.level === filter.level)
    .filter((entry) => !filter.book || filter.book === "all" || entry.book.id === filter.book)
    .filter(
      (entry) =>
        !words ||
        [entry.lesson.title, entry.lesson.title_ar, entry.lesson.topic, entry.book.title]
          .concat(entry.book.title_ar ?? "")
          .some((text) => text.toLocaleLowerCase().includes(words)),
    )
    .sort(
      (a, b) =>
        CEFR.indexOf(a.level as (typeof CEFR)[number]) -
          CEFR.indexOf(b.level as (typeof CEFR)[number]) ||
        a.book.title.localeCompare(b.book.title) ||
        a.lesson.lesson_no - b.lesson.lesson_no,
    );
}

/** The levels and books that have cards in a tab, for the filter chips. */
export function boardChoices(entries: BoardEntry[], tab: BoardTab) {
  const inTab = entries.filter((entry) => tabOf(entry) === tab);
  const levels = CEFR.filter((level) => inTab.some((entry) => entry.level === level));
  const books = [...new Map(inTab.map((entry) => [entry.book.id, entry.book])).values()];
  return { levels: [...levels], books };
}
