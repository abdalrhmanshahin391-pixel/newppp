// The library's discover page for one learning language: the same shelves, keeping only the books
// in that language. Pure: no DOM, no network. When no book is in the language, the caller shows
// every language instead (with a note), so the page is never empty.

type WithLanguage = { language: string };

export type DiscoverLike<B extends WithLanguage> = {
  featured: B | null;
  picks: B[];
  newest: B[];
  loose: B[];
  shelves: { books: B[] }[];
  categories: { books: B[]; total: number }[];
};

/** How many books of the discover page are in `lang` (the featured book counted once). */
export function booksIn<B extends WithLanguage>(data: DiscoverLike<B>, lang: string): number {
  const ids = new Set<B>();
  const add = (list: B[]) => list.forEach((book) => book.language === lang && ids.add(book));
  if (data.featured?.language === lang) ids.add(data.featured);
  add(data.picks);
  add(data.newest);
  add(data.loose);
  data.shelves.forEach((s) => add(s.books));
  data.categories.forEach((c) => add(c.books));
  return ids.size;
}

/**
 * The discover page with only `lang`'s books: empty shelves drop out, and a category's total
 * becomes the number shown (the full total counts every language).
 */
export function discoverIn<B extends WithLanguage, D extends DiscoverLike<B>>(
  data: D,
  lang: string,
): D {
  const keep = (list: B[]) => list.filter((book) => book.language === lang);
  return {
    ...data,
    featured: data.featured?.language === lang ? data.featured : null,
    picks: keep(data.picks),
    newest: keep(data.newest),
    loose: keep(data.loose),
    shelves: data.shelves
      .map((s) => ({ ...s, books: keep(s.books) }))
      .filter((s) => s.books.length > 0),
    categories: data.categories
      .map((c) => {
        const books = keep(c.books);
        return { ...c, books, total: books.length };
      })
      .filter((c) => c.books.length > 0),
  };
}
