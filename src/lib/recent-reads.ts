// «آخر كتب قرأتها»: one row with the reader's own books (always, at most two) and the library
// books they read most recently (at most five), newest first. Pure: no DOM, no storage.

export type RecentEntry<Mine, Library> =
  { kind: "mine"; item: Mine; at: number } | { kind: "library"; item: Library; at: number };

/** The row, newest first; ties keep own books first. */
export function mergeRecent<Mine, Library>(
  mine: { item: Mine; at: number }[],
  library: { item: Library; at: number }[],
  libraryLimit = 5,
): RecentEntry<Mine, Library>[] {
  const own = mine.map((entry) => ({ kind: "mine" as const, ...entry }));
  const read = [...library]
    .sort((a, b) => b.at - a.at)
    .slice(0, libraryLimit)
    .map((entry) => ({ kind: "library" as const, ...entry }));
  return [...own, ...read].sort(
    (a, b) => b.at - a.at || (a.kind === b.kind ? 0 : a.kind === "mine" ? -1 : 1),
  );
}

/**
 * The library books read in one learning language (all of them with none chosen, or when the
 * learner asked to see every language). Own PDFs are not filtered: they are always in the row.
 */
export function readsIn<R extends { book: { language: string } }>(
  reads: R[],
  language: string | null,
): R[] {
  return language ? reads.filter((read) => read.book.language === language) : reads;
}

/** How far into a book the reader is (0–1), or null without a page count. */
export function readShare(page: number | null, total: number | null): number | null {
  if (!page || !total || total < 1) return null;
  return Math.min(1, Math.max(0, page / total));
}
