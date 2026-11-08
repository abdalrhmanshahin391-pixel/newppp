// The library (/books): types and the pure rules behind the page — search that forgives hamzas,
// diacritics and accents, the filters, the order, the shelves and the reading time. No React,
// no database (books-data.ts reads and writes).

export const BOOK_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type BookLevel = (typeof BOOK_LEVELS)[number];

/** Category colours: one strong tone for the dot and icon, one soft tint for its shelf. */
export const CATEGORY_COLORS = {
  rose: { c: "#be123c", soft: "#fde7ec" },
  teal: { c: "#0f766e", soft: "#dff3ef" },
  amber: { c: "#b45309", soft: "#fdf0dc" },
  violet: { c: "#6d28d9", soft: "#efe9fd" },
  slate: { c: "#334155", soft: "#e8ecf1" },
  indigo: { c: "#4338ca", soft: "#e8e9fd" },
  green: { c: "#15803d", soft: "#e3f4e8" },
  sky: { c: "#0369a1", soft: "#e0f0fa" },
} as const;
export type CategoryColor = keyof typeof CATEGORY_COLORS;
export const CATEGORY_COLOR_KEYS = Object.keys(CATEGORY_COLORS) as CategoryColor[];

export const CATEGORY_ICONS = [
  "book",
  "heart",
  "flask",
  "mountain",
  "search",
  "rocket",
  "landmark",
  "brain",
  "globe",
  "feather",
] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

export type BookCategory = {
  id: string;
  name_ar: string;
  name_en: string;
  color: CategoryColor;
  icon: CategoryIcon;
  sort: number;
};

export type Book = {
  id: string;
  title: string;
  author: string;
  description: string;
  category_id: string | null;
  level: BookLevel;
  language: string;
  pages: number | null;
  year: number | null;
  cover_path: string | null;
  /** The cover's public address, filled in when the list is read. */
  cover_url: string | null;
  file_path: string | null;
  featured: boolean;
  published: boolean;
  sort: number;
  created_at: string;
};

export type BookLength = "short" | "medium" | "long";
export type BookSort = "new" | "title" | "short";

export type BookFilters = {
  q: string;
  cat: string | null;
  level: BookLevel | null;
  lang: string | null;
  len: BookLength | null;
  sort: BookSort;
};

export const NO_FILTERS: BookFilters = {
  q: "",
  cat: null,
  level: null,
  lang: null,
  len: null,
  sort: "new",
};

const SAFE_COLOR = (value: unknown): CategoryColor =>
  CATEGORY_COLOR_KEYS.includes(value as CategoryColor) ? (value as CategoryColor) : "slate";
const SAFE_ICON = (value: unknown): CategoryIcon =>
  CATEGORY_ICONS.includes(value as CategoryIcon) ? (value as CategoryIcon) : "book";
const SAFE_LEVEL = (value: unknown): BookLevel =>
  BOOK_LEVELS.includes(value as BookLevel) ? (value as BookLevel) : "B1";

/** A category row as the page uses it (unknown colours and icons fall back to calm ones). */
export function toCategory(row: Record<string, unknown>): BookCategory {
  return {
    id: String(row.id),
    name_ar: String(row.name_ar ?? ""),
    name_en: String(row.name_en ?? ""),
    color: SAFE_COLOR(row.color),
    icon: SAFE_ICON(row.icon),
    sort: Number(row.sort) || 0,
  };
}

export function toBook(row: Record<string, unknown>, coverUrl: string | null): Book {
  const num = (value: unknown) =>
    value === null || value === undefined || value === "" || !Number.isFinite(Number(value))
      ? null
      : Number(value);
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    author: String(row.author ?? ""),
    description: String(row.description ?? ""),
    category_id: row.category_id ? String(row.category_id) : null,
    level: SAFE_LEVEL(row.level),
    language: String(row.language ?? "en"),
    pages: num(row.pages),
    year: num(row.year),
    cover_path: row.cover_path ? String(row.cover_path) : null,
    cover_url: coverUrl,
    file_path: row.file_path ? String(row.file_path) : null,
    featured: row.featured === true,
    published: row.published === true,
    sort: Number(row.sort) || 0,
    created_at: String(row.created_at ?? ""),
  };
}

/**
 * Text for matching: lower case, no accents or Arabic diacritics, the alef forms, taa marbuta and
 * alef maqsura unified, punctuation as spaces.
 */
export function searchText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Every word of the query appears at the start of a word in the title or the author. */
export function matchesQuery(book: Pick<Book, "title" | "author">, query: string): boolean {
  const words = searchText(query).split(" ").filter(Boolean);
  if (!words.length) return true;
  const hay = ` ${searchText(`${book.title} ${book.author}`)}`;
  return words.every((word) => hay.includes(` ${word}`));
}

/** Short under 150 pages, long from 350; a book without a page count is "medium". */
export function lengthOf(pages: number | null): BookLength {
  if (pages === null) return "medium";
  if (pages < 150) return "short";
  if (pages >= 350) return "long";
  return "medium";
}

/** Rough hours for a learner reading in a new language (about 1.5 minutes a page), at least 1. */
export function readingHours(pages: number | null): number | null {
  if (!pages) return null;
  return Math.max(1, Math.round((pages * 1.5) / 60));
}

export function filterBooks(books: Book[], filters: BookFilters): Book[] {
  const out = books.filter(
    (book) =>
      matchesQuery(book, filters.q) &&
      (!filters.cat || book.category_id === filters.cat) &&
      (!filters.level || book.level === filters.level) &&
      (!filters.lang || book.language === filters.lang) &&
      (!filters.len || lengthOf(book.pages) === filters.len),
  );
  return sortBooks(out, filters.sort);
}

export function sortBooks(books: Book[], sort: BookSort): Book[] {
  const list = [...books];
  if (sort === "title")
    list.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
  else if (sort === "short")
    list.sort((a, b) => (a.pages ?? Infinity) - (b.pages ?? Infinity) || a.sort - b.sort);
  else list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return list;
}

/** True when the page should show a list of results instead of the shelves. */
export function isFiltering(filters: BookFilters): boolean {
  return Boolean(filters.q.trim() || filters.cat || filters.level || filters.lang || filters.len);
}

export type Shelf = { category: BookCategory; books: Book[] };

/** One shelf per category that has books, in the admin's order; books in their order inside. */
export function shelves(categories: BookCategory[], books: Book[]): Shelf[] {
  return [...categories]
    .sort((a, b) => a.sort - b.sort)
    .map((category) => ({
      category,
      books: books
        .filter((book) => book.category_id === category.id)
        .sort((a, b) => a.sort - b.sort || b.created_at.localeCompare(a.created_at)),
    }))
    .filter((shelf) => shelf.books.length > 0);
}

/** The newest books, for the «وصل جديداً» shelf (only worth showing with a few books). */
export function newest(books: Book[], count = 12): Book[] {
  return sortBooks(books, "new").slice(0, count);
}

/** Reads filters from the page address; anything unknown is ignored. */
export function filtersFromSearch(search: Record<string, unknown>): BookFilters {
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const level = text(search.level).toUpperCase();
  const len = text(search.len);
  const sort = text(search.sort);
  const lang = text(search.lang).toLowerCase();
  return {
    q: text(search.q).slice(0, 80),
    cat: /^[0-9a-f-]{36}$/i.test(text(search.cat)) ? text(search.cat) : null,
    level: BOOK_LEVELS.includes(level as BookLevel) ? (level as BookLevel) : null,
    lang: /^[a-z]{2,3}$/.test(lang) ? lang : null,
    len: len === "short" || len === "medium" || len === "long" ? len : null,
    sort: sort === "title" || sort === "short" ? sort : "new",
  };
}

/** The address search for a set of filters (empty values left out). */
export function searchFromFilters(filters: BookFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.q.trim()) out.q = filters.q.trim();
  if (filters.cat) out.cat = filters.cat;
  if (filters.level) out.level = filters.level;
  if (filters.lang) out.lang = filters.lang;
  if (filters.len) out.len = filters.len;
  if (filters.sort !== "new") out.sort = filters.sort;
  return out;
}
