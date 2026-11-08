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

export const BOOK_STATUSES = ["draft", "published", "archived"] as const;
export type BookStatus = (typeof BOOK_STATUSES)[number];

export type BookTag = { id: string; name_ar: string; name_en: string };

/** A shelf the admin fills by hand, shown during its period (judged by the server's clock). */
export type BookShelf = {
  id: string;
  name_ar: string;
  name_en: string;
  visible: boolean;
  starts_at: string | null;
  ends_at: string | null;
  sort: number;
  /** The shelf's books, in its order. */
  book_ids: string[];
};

export type Book = {
  id: string;
  title: string;
  /** Another title the book is known by (a translation, the original). */
  alt_title: string;
  author: string;
  isbn: string | null;
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
  featured_from: string | null;
  featured_until: string | null;
  status: BookStatus;
  /** Same as status === "published" (kept for older rows and pages). */
  published: boolean;
  rights_checked: boolean;
  tag_ids: string[];
  secondary_category_ids: string[];
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

export function toBook(
  row: Record<string, unknown>,
  coverUrl: string | null,
  links: { tag_ids?: string[]; secondary_category_ids?: string[] } = {},
): Book {
  const num = (value: unknown) =>
    value === null || value === undefined || value === "" || !Number.isFinite(Number(value))
      ? null
      : Number(value);
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    alt_title: String(row.alt_title ?? ""),
    author: String(row.author ?? ""),
    isbn: row.isbn ? String(row.isbn) : null,
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
    featured_from: row.featured_from ? String(row.featured_from) : null,
    featured_until: row.featured_until ? String(row.featured_until) : null,
    status: BOOK_STATUSES.includes(row.status as BookStatus)
      ? (row.status as BookStatus)
      : row.published === true
        ? "published"
        : "draft",
    published: row.status ? row.status === "published" : row.published === true,
    rights_checked:
      row.rights_checked === true || (!("rights_checked" in row) && row.published === true),
    tag_ids: links.tag_ids ?? [],
    secondary_category_ids: links.secondary_category_ids ?? [],
    sort: Number(row.sort) || 0,
    created_at: String(row.created_at ?? ""),
  };
}

/**
 * Text for matching: lower case, no accents, Arabic diacritics or tatweel, the alef forms unified,
 * punctuation as spaces. The taa marbuta and alef maqsura are kept as they are written.
 */
export function searchText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Every word of the query appears at the start of a word in the title or the author. */
export function matchesQuery(
  book: Pick<Book, "title" | "author"> & { alt_title?: string; isbn?: string | null },
  query: string,
): boolean {
  const words = searchText(query).split(" ").filter(Boolean);
  if (!words.length) return true;
  const isbn = query.replace(/[^0-9Xx]/g, "").toUpperCase();
  if (isbn.length >= 10 && book.isbn && book.isbn === isbn) return true;
  const hay = ` ${searchText(`${book.title} ${book.alt_title ?? ""} ${book.author}`)}`;
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

/** What stops a book from being published (the database checks the same three). */
export function publishIssues(
  book: Pick<Book, "title" | "category_id" | "rights_checked">,
): ("title" | "category" | "rights")[] {
  const out: ("title" | "category" | "rights")[] = [];
  if (!book.title.trim()) out.push("title");
  if (!book.category_id) out.push("category");
  if (!book.rights_checked) out.push("rights");
  return out;
}

/** What is worth adding but never blocks publishing. */
export function publishWarnings(
  book: Pick<Book, "cover_path" | "file_path" | "isbn" | "year" | "description">,
): ("cover" | "pdf" | "isbn" | "year" | "description")[] {
  const out: ("cover" | "pdf" | "isbn" | "year" | "description")[] = [];
  if (!book.cover_path) out.push("cover");
  if (!book.file_path) out.push("pdf");
  if (!book.isbn) out.push("isbn");
  if (book.year === null) out.push("year");
  if (!book.description.trim()) out.push("description");
  return out;
}

/** An ISBN as digits (and a final X), or null when it is empty; "invalid" when its shape is wrong. */
export function normalizeIsbn(text: string): string | null | "invalid" {
  const digits = text.toUpperCase().replace(/[^0-9X]/g, "");
  if (!digits) return null;
  return /^([0-9]{9}[0-9X]|97[89][0-9]{10})$/.test(digits) ? digits : "invalid";
}

// ---- admin helpers --------------------------------------------------------------------------

export type BookGap = "cover" | "pdf" | "isbn";

export type AdminBookFilter = {
  q: string;
  status: BookStatus | "all";
  /** A category id, "none" for books without one, or "all". */
  cat: string;
  level: BookLevel | null;
  lang: string | null;
  missing: BookGap | null;
};

export const NO_ADMIN_FILTER: AdminBookFilter = {
  q: "",
  status: "all",
  cat: "all",
  level: null,
  lang: null,
  missing: null,
};

export function isAdminFiltering(filter: AdminBookFilter): boolean {
  return Boolean(
    filter.q.trim() ||
    filter.status !== "all" ||
    filter.cat !== "all" ||
    filter.level ||
    filter.lang ||
    filter.missing,
  );
}

const lacks = (book: Book, gap: BookGap) =>
  gap === "cover" ? !book.cover_path : gap === "pdf" ? !book.file_path : !book.isbn;

/** The admin's book list: every status, filtered; in the categories' order, then the book order. */
export function adminFilterBooks(
  books: Book[],
  categories: BookCategory[],
  filter: AdminBookFilter,
): Book[] {
  const order = new Map(categories.map((c) => [c.id, c.sort]));
  return books
    .filter(
      (book) =>
        matchesQuery(book, filter.q) &&
        (filter.status === "all" || book.status === filter.status) &&
        (filter.cat === "all" ||
          (filter.cat === "none"
            ? !book.category_id || !order.has(book.category_id)
            : book.category_id === filter.cat)) &&
        (!filter.level || book.level === filter.level) &&
        (!filter.lang || book.language === filter.lang) &&
        (!filter.missing || lacks(book, filter.missing)),
    )
    .sort(
      (a, b) =>
        (order.get(a.category_id ?? "") ?? Infinity) -
          (order.get(b.category_id ?? "") ?? Infinity) ||
        a.sort - b.sort ||
        b.created_at.localeCompare(a.created_at),
    );
}

export type QualityReport = {
  noCover: Book[];
  noPdf: Book[];
  noIsbn: Book[];
  /** Drafts that could not be published yet (missing title, category or the rights check). */
  notReady: Book[];
  /** Books that share a title and author (after the search normalisation). */
  duplicates: Book[][];
};

/** What the admin should look at: archived books are left out. */
export function qualityReport(books: Book[]): QualityReport {
  const live = books.filter((b) => b.status !== "archived");
  const groups = new Map<string, Book[]>();
  for (const book of live) {
    const key = `${searchText(book.title)}|${searchText(book.author)}`;
    groups.set(key, [...(groups.get(key) ?? []), book]);
  }
  return {
    noCover: live.filter((b) => !b.cover_path),
    noPdf: live.filter((b) => !b.file_path),
    noIsbn: live.filter((b) => !b.isbn),
    notReady: live.filter((b) => b.status === "draft" && publishIssues(b).length > 0),
    duplicates: [...groups.values()].filter((g) => g.length > 1),
  };
}

/** A moment as the value of a datetime-local field (the admin's own time zone), or "". */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A datetime-local value (the admin's time zone) as an ISO moment; empty or invalid → null. */
export function fromLocalInput(value: string): string | null {
  if (!value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** True when a period (either end open) contains the moment. */
export function inPeriod(from: string | null, until: string | null, at: Date): boolean {
  const t = at.getTime();
  if (from && Date.parse(from) > t) return false;
  if (until && Date.parse(until) <= t) return false;
  return true;
}
