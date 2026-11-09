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
  /** How many readers rated it, and their average (null without ratings). */
  rating_count: number;
  rating_avg: number | null;
  sort: number;
  created_at: string;
};

export type BookLength = "short" | "medium" | "long";
export const BOOK_LENGTHS: BookLength[] = ["short", "medium", "long"];
export type BrowseSort =
  "relevance" | "discover" | "new" | "title" | "short" | "rating" | "trending";
export const BROWSE_SORTS: BrowseSort[] = [
  "relevance",
  "discover",
  "new",
  "title",
  "short",
  "rating",
  "trending",
];
/** A book's average shows from this many ratings (the top-rated shelf uses the same rule). */
export const MIN_RATINGS = 3;

export function ratingShown(book: Pick<Book, "rating_count" | "rating_avg">): boolean {
  return book.rating_count >= MIN_RATINGS && book.rating_avg !== null;
}
export const PAGE_SIZES = [24, 48] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

/**
 * What the reader asked for, as kept in the page address. Each list is OR inside itself; the
 * lists are AND between each other. `view: "all"` asks for every book without any filter.
 */
export type BrowseState = {
  q: string;
  cat: string[];
  level: BookLevel[];
  lang: string[];
  len: BookLength[];
  tag: string[];
  sort: BrowseSort | null;
  view: "all" | "favorites" | null;
  page: number;
  size: PageSize;
};

export const NO_BROWSE: BrowseState = {
  q: "",
  cat: [],
  level: [],
  lang: [],
  len: [],
  tag: [],
  sort: null,
  view: null,
  page: 1,
  size: 24,
};

/** discover: the shelves; search: a query; category: one category; all: everything else. */
export type LibraryMode = "discover" | "all" | "search" | "category" | "favorites";

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
    rating_count: Number(row.rating_count) || 0,
    rating_avg:
      row.rating_avg === null ||
      row.rating_avg === undefined ||
      !Number.isFinite(Number(row.rating_avg))
        ? null
        : Number(row.rating_avg),
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

export function sortBooks(books: Book[], sort: "new" | "title" | "short"): Book[] {
  const list = [...books];
  if (sort === "title")
    list.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
  else if (sort === "short")
    list.sort((a, b) => (a.pages ?? Infinity) - (b.pages ?? Infinity) || a.sort - b.sort);
  else list.sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
  return list;
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const list = (value: unknown): string[] =>
  (typeof value === "string" ? value : Array.isArray(value) ? value.join(",") : "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const unique = <T>(items: T[]) => [...new Set(items)];

/** Reads the page address; anything unknown is ignored (older single-value links still work). */
export function stateFromSearch(search: Record<string, unknown>): BrowseState {
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const sort = text(search.sort) as BrowseSort;
  const num = (value: unknown) =>
    typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
  const page = Math.floor(num(search.page));
  const size = num(search.size);
  return {
    q: text(search.q).slice(0, 80),
    cat: unique(list(search.cat).filter((x) => UUID.test(x))).slice(0, 20),
    level: unique(
      list(search.level)
        .map((x) => x.toUpperCase())
        .filter((x): x is BookLevel => BOOK_LEVELS.includes(x as BookLevel)),
    ),
    lang: unique(
      list(search.lang)
        .map((x) => x.toLowerCase())
        .filter((x) => /^[a-z]{2,3}$/.test(x)),
    ).slice(0, 20),
    len: unique(
      list(search.len).filter((x): x is BookLength => BOOK_LENGTHS.includes(x as BookLength)),
    ),
    tag: unique(list(search.tag).filter((x) => UUID.test(x))).slice(0, 20),
    sort: BROWSE_SORTS.includes(sort) ? sort : null,
    view:
      text(search.view) === "all" ? "all" : text(search.view) === "favorites" ? "favorites" : null,
    page: Number.isFinite(page) && page > 1 ? Math.min(page, 5000) : 1,
    size: size === 48 ? 48 : 24,
  };
}

/** The page address for a state (empty values left out; page and size as numbers). */
export function searchFromState(state: BrowseState): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (state.q.trim()) out.q = state.q.trim();
  if (state.cat.length) out.cat = state.cat.join(",");
  if (state.level.length) out.level = state.level.join(",");
  if (state.lang.length) out.lang = state.lang.join(",");
  if (state.len.length) out.len = state.len.join(",");
  if (state.tag.length) out.tag = state.tag.join(",");
  if (state.sort) out.sort = state.sort;
  if (state.view) out.view = state.view;
  if (state.page > 1) out.page = state.page;
  if (state.size !== 24) out.size = state.size;
  return out;
}

/** How many filter values are chosen (the query and the order are not counted). */
export function filterCount(state: BrowseState): number {
  return (
    state.cat.length + state.level.length + state.lang.length + state.len.length + state.tag.length
  );
}

export function modeOf(state: BrowseState): LibraryMode {
  if (state.q.trim()) return "search";
  if (state.view === "favorites") return "favorites";
  if (state.cat.length === 1 && state.view !== "all") return "category";
  if (state.view === "all" || filterCount(state) > 0) return "all";
  return "discover";
}

/** Where the admin's pins and exclusions apply: the discover page, or the one category shown. */
export function contextOf(state: BrowseState): string | null {
  const mode = modeOf(state);
  if (mode === "discover") return "discover";
  if (mode === "category") return state.cat[0];
  return null;
}

/** The sort used when the reader chose none (the database decides the same way). */
export function defaultSort(state: BrowseState): BrowseSort {
  const mode = modeOf(state);
  if (mode === "search") return "relevance";
  if (mode === "category") return "discover";
  return "new";
}

/** Adds or removes one value in one group, back to page 1. */
export function toggleValue<K extends "cat" | "level" | "lang" | "len" | "tag">(
  state: BrowseState,
  key: K,
  value: BrowseState[K][number],
): BrowseState {
  const current = state[key] as string[];
  const next = current.includes(value as string)
    ? current.filter((x) => x !== value)
    : [...current, value as string];
  return { ...state, [key]: next, page: 1 };
}

/** A short random seed for the "recommended" order of one visit. */
export function newSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** A stable 32-bit hash (FNV-1a), for the seeded order when the database cannot do it. */
export function seededKey(seed: string, id: string): number {
  let h = 0x811c9dc5;
  const text = `${seed}:${id}`;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export type Facets = {
  category: Record<string, number>;
  level: Record<string, number>;
  language: Record<string, number>;
  length: Record<string, number>;
  tag: Record<string, number>;
};

export type BrowseResult = {
  total: number;
  items: Book[];
  facets: Facets;
  asOf: string;
  sort: BrowseSort;
};

const count = (map: Record<string, number>, key: string | null) => {
  if (key) map[key] = (map[key] ?? 0) + 1;
};

/**
 * The same browse as the database's books_browse, on books already loaded (used while the
 * phase 2 migration is not applied). `books` are the published books.
 */
export function browseLocal(
  books: Book[],
  state: BrowseState,
  options: { seed: string; pins?: string[]; excluded?: string[]; favorites?: string[] } = {
    seed: "",
  },
): Omit<BrowseResult, "asOf"> {
  // Without the phase 3 numbers in the browser, the popularity orders fall back to the newest.
  const chosen =
    state.sort && !(state.sort === "relevance" && !state.q.trim())
      ? state.sort
      : defaultSort(state);
  const sort = chosen === "rating" || chosen === "trending" ? "new" : chosen;
  const favorites = state.view === "favorites" ? new Set(options.favorites ?? []) : null;
  const excluded = new Set(options.excluded ?? []);
  const found = books.filter(
    (b) => !excluded.has(b.id) && (!favorites || favorites.has(b.id)) && matchesQuery(b, state.q),
  );
  const m = (b: Book) => ({
    cat:
      !state.cat.length ||
      state.cat.includes(b.category_id ?? "") ||
      b.secondary_category_ids.some((c) => state.cat.includes(c)),
    level: !state.level.length || state.level.includes(b.level),
    lang: !state.lang.length || state.lang.includes(b.language),
    len: !state.len.length || state.len.includes(lengthOf(b.pages)),
    tag: !state.tag.length || b.tag_ids.some((t) => state.tag.includes(t)),
  });
  const facets: Facets = { category: {}, level: {}, language: {}, length: {}, tag: {} };
  const hits: Book[] = [];
  for (const b of found) {
    const x = m(b);
    if (x.level && x.lang && x.len && x.tag) {
      count(facets.category, b.category_id);
      for (const c of b.secondary_category_ids) count(facets.category, c);
    }
    if (x.cat && x.lang && x.len && x.tag) count(facets.level, b.level);
    if (x.cat && x.level && x.len && x.tag) count(facets.language, b.language);
    if (x.cat && x.level && x.lang && x.tag) count(facets.length, lengthOf(b.pages));
    if (x.cat && x.level && x.lang && x.len) for (const t of b.tag_ids) count(facets.tag, t);
    if (x.cat && x.level && x.lang && x.len && x.tag) hits.push(b);
  }
  let ordered: Book[];
  if (sort === "discover") {
    const pins = options.pins ?? [];
    ordered = [...hits].sort((a, b) => {
      const pa = pins.indexOf(a.id);
      const pb = pins.indexOf(b.id);
      if (pa !== pb) return (pa < 0 ? Infinity : pa) - (pb < 0 ? Infinity : pb);
      return seededKey(options.seed, a.id) - seededKey(options.seed, b.id);
    });
  } else if (sort === "relevance") {
    // Title matches first, then the rest; newest first inside each.
    const inTitle = (b: Book) =>
      matchesQuery({ title: `${b.title} ${b.alt_title}`, author: "" }, state.q);
    ordered = sortBooks(hits, "new").sort((a, b) => Number(inTitle(b)) - Number(inTitle(a)));
  } else ordered = sortBooks(hits, sort);
  const start = (state.page - 1) * state.size;
  return { total: hits.length, items: ordered.slice(start, start + state.size), facets, sort };
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
