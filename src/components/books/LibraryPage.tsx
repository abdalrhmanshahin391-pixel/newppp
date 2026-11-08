import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { useUiLanguage } from "@/components/language/useUiLanguage";
import { useAuth } from "@/hooks/useAuth";
import { useLanguageRegistry } from "@/hooks/useLearningLanguage";
import {
  BOOK_LEVELS,
  CATEGORY_COLORS,
  filterBooks,
  isFiltering,
  newest,
  NO_FILTERS,
  readingHours,
  shelves,
  type Book,
  type BookCategory,
  type BookFilters,
  type BookLength,
  type BookSort,
} from "@/lib/books";
import { LIBRARY_QUERY_KEY, loadLibrary } from "@/lib/books-data";
import { BookObject, CATEGORY_ICON } from "./BookObject";
import { BookSheet } from "./BookSheet";

/**
 * The library: search and filters on top, the categories as chips, the book of the week, then one
 * shelf per category. Searching or filtering swaps the shelves for a grid of results.
 */
export function LibraryPage({
  filters,
  onFilters,
}: {
  filters: BookFilters;
  onFilters: (next: BookFilters) => void;
}) {
  const ui = useUiLanguage();
  const t = (en: string, ar: string) => (ui === "ar" ? ar : en);
  const { user, isAdmin } = useAuth();
  const registry = useLanguageRegistry();
  const query = useQuery({ queryKey: LIBRARY_QUERY_KEY, queryFn: loadLibrary, staleTime: 60_000 });
  const [open, setOpen] = useState<Book | null>(null);
  const [panel, setPanel] = useState(false);
  const [text, setText] = useState(filters.q);
  const searchBox = useRef<HTMLInputElement>(null);

  // The address can change the query (back button): follow it.
  useEffect(() => setText(filters.q), [filters.q]);
  // Typing updates the address a moment after the last key.
  useEffect(() => {
    if (text === filters.q) return;
    const timer = window.setTimeout(() => onFilters({ ...filters, q: text }), 180);
    return () => window.clearTimeout(timer);
  }, [text, filters, onFilters]);
  // «/» jumps to the search box (not while typing elsewhere).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "/" || target?.closest("input, textarea, [contenteditable]")) return;
      event.preventDefault();
      searchBox.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const library = query.data;
  const books = useMemo(() => (library?.books ?? []).filter((b) => b.published), [library]);
  const categories = library?.categories ?? [];
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of books)
      if (b.category_id) map.set(b.category_id, (map.get(b.category_id) ?? 0) + 1);
    return map;
  }, [books]);
  const languages = useMemo(() => [...new Set(books.map((b) => b.language))], [books]);
  const languageName = (code: string) => {
    const found = registry.all.find((l) => l.code === code);
    return found ? (ui === "ar" ? found.name_ar : found.name_native) : code.toUpperCase();
  };
  const name = (c: BookCategory) => (ui === "ar" ? c.name_ar : c.name_en);
  const filtering = isFiltering(filters);
  const results = useMemo(() => filterBooks(books, filters), [books, filters]);
  const featured = books.find((b) => b.featured) ?? null;
  const rows = useMemo(() => shelves(categories, books), [categories, books]);
  const loose = books.filter((b) => !b.category_id || !byId.has(b.category_id));
  const fresh = newest(books);
  const set = (patch: Partial<BookFilters>) => onFilters({ ...filters, ...patch });
  const activeCount =
    [filters.level, filters.lang, filters.len].filter(Boolean).length +
    (filters.sort !== "new" ? 1 : 0);

  const card = (book: Book) => {
    const category = book.category_id ? byId.get(book.category_id) : undefined;
    return (
      <button key={book.id} type="button" className="bk-item" onClick={() => setOpen(book)}>
        <BookObject book={book} color={category?.color} />
        <span className="bk-item-title" dir="auto">
          {book.title}
        </span>
        {book.author && (
          <span className="bk-item-author" dir="auto">
            {book.author}
          </span>
        )}
      </button>
    );
  };

  const Arrow = ui === "ar" ? ChevronLeft : ChevronRight;
  const shelf = (
    key: string,
    title: string,
    list: Book[],
    tone: { c: string; soft: string },
    Icon: typeof Sparkles,
    cat: string | null,
  ) => (
    <section
      key={key}
      className="bk-shelf"
      style={{ ["--c" as string]: tone.c, ["--soft" as string]: tone.soft }}
    >
      <div className="bk-shelf-head">
        <span className="bk-shelf-icon" aria-hidden="true">
          <Icon size={16} strokeWidth={2.2} />
        </span>
        <h2 className="bk-shelf-title">{title}</h2>
        <span className="bk-shelf-count">
          {list.length} {t(list.length === 1 ? "book" : "books", "كتب")}
        </span>
        {cat && (
          <button type="button" className="bk-shelf-all" onClick={() => set({ cat })}>
            {t("See all", "عرض الكل")} <Arrow size={15} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="bk-row">{list.map(card)}</div>
      <div className="bk-board" aria-hidden="true" />
    </section>
  );

  return (
    <div className="min-h-screen bg-white text-[var(--pp-ink)]">
      <SiteHeader />
      <main className="bk-page" dir={ui === "ar" ? "rtl" : "ltr"}>
        <div className="bk-head">
          <div>
            <p className="bk-eyebrow">{t("Uzyra library", "مكتبة Uzyra")}</p>
            <h1 className="bk-title">
              {t("Read real books at your level", "اقرأ كتب حقيقية بمستواك")}
            </h1>
            <p className="bk-lead">
              {t(
                "Chosen books, sorted by subject and level. Open one and read it at your own pace.",
                "كتب مختارة ومرتّبة حسب الموضوع والمستوى. افتح أي كتاب واقرأه على راحتك.",
              )}
            </p>
          </div>
          <div className="bk-search">
            <label className="bk-field">
              <Search size={18} aria-hidden="true" />
              <input
                ref={searchBox}
                type="search"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={t("Search by title or author", "ابحث بعنوان الكتاب أو الكاتب")}
                aria-label={t("Search the library", "ابحث بالمكتبة")}
                enterKeyHint="search"
              />
              {text ? (
                <button
                  type="button"
                  className="bk-clear"
                  onClick={() => setText("")}
                  aria-label={t("Clear", "امسح")}
                >
                  <X size={16} />
                </button>
              ) : (
                <kbd className="bk-kbd">/</kbd>
              )}
            </label>
            <button
              type="button"
              className="bk-filter"
              aria-expanded={panel}
              aria-controls="bk-panel"
              onClick={() => setPanel((value) => !value)}
            >
              <SlidersHorizontal size={17} aria-hidden="true" />
              {t("Filter", "فلترة")}
              {activeCount > 0 && <span className="bk-badge">{activeCount}</span>}
            </button>
          </div>
        </div>

        {panel && (
          <div id="bk-panel" className="bk-panel">
            <Group label={t("Level", "المستوى")}>
              {BOOK_LEVELS.map((level) => (
                <Chip
                  key={level}
                  on={filters.level === level}
                  onClick={() => set({ level: filters.level === level ? null : level })}
                >
                  {level}
                </Chip>
              ))}
            </Group>
            {languages.length > 1 && (
              <Group label={t("Language", "اللغة")}>
                {languages.map((code) => (
                  <Chip
                    key={code}
                    on={filters.lang === code}
                    onClick={() => set({ lang: filters.lang === code ? null : code })}
                  >
                    {languageName(code)}
                  </Chip>
                ))}
              </Group>
            )}
            <Group label={t("Length", "الطول")}>
              {(
                [
                  ["short", t("Short", "قصير"), t("under 150 pages", "أقل من 150 صفحة")],
                  ["medium", t("Medium", "متوسط"), "150–350"],
                  ["long", t("Long", "طويل"), t("350+ pages", "أكثر من 350")],
                ] as [BookLength, string, string][]
              ).map(([len, label, hint]) => (
                <Chip
                  key={len}
                  on={filters.len === len}
                  onClick={() => set({ len: filters.len === len ? null : len })}
                  title={hint}
                >
                  {label}
                </Chip>
              ))}
            </Group>
            <Group label={t("Order", "الترتيب")}>
              {(
                [
                  ["new", t("Newest", "الأحدث")],
                  ["title", t("By title", "حسب الاسم")],
                  ["short", t("Shortest", "الأقصر")],
                ] as [BookSort, string][]
              ).map(([sort, label]) => (
                <Chip key={sort} on={filters.sort === sort} onClick={() => set({ sort })}>
                  {label}
                </Chip>
              ))}
            </Group>
            {activeCount > 0 && (
              <button
                type="button"
                className="bk-reset"
                onClick={() => onFilters({ ...NO_FILTERS, q: filters.q, cat: filters.cat })}
              >
                {t("Clear filters", "امسح الفلترة")}
              </button>
            )}
          </div>
        )}

        {categories.length > 0 && books.length > 0 && (
          <nav className="bk-cats" aria-label={t("Categories", "التصنيفات")}>
            <button
              type="button"
              className="bk-cat"
              aria-pressed={!filters.cat}
              onClick={() => set({ cat: null })}
            >
              {t("All", "الكل")} <span className="bk-cat-n">{books.length}</span>
            </button>
            {categories
              .filter((c) => counts.get(c.id))
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="bk-cat"
                  aria-pressed={filters.cat === c.id}
                  onClick={() => set({ cat: filters.cat === c.id ? null : c.id })}
                  style={{ ["--c" as string]: CATEGORY_COLORS[c.color].c }}
                >
                  <span className="bk-cat-dot" aria-hidden="true" />
                  {name(c)} <span className="bk-cat-n">{counts.get(c.id)}</span>
                </button>
              ))}
          </nav>
        )}

        {query.isLoading ? (
          <LoadingShelves />
        ) : query.isError ? (
          <div className="bk-empty">
            <p className="bk-empty-title">{t("The library did not load.", "ما انفتحت المكتبة.")}</p>
            <button type="button" className="bk-btn" onClick={() => void query.refetch()}>
              {t("Try again", "جرّب مرة ثانية")}
            </button>
          </div>
        ) : books.length === 0 ? (
          <div className="bk-empty">
            <p className="bk-empty-title">
              {t("The library is empty for now.", "المكتبة لسا فاضية.")}
            </p>
            <p className="bk-empty-text">
              {library && !library.ready && isAdmin
                ? t(
                    "The library tables are not in the database yet (the migration has to be applied).",
                    "جداول المكتبة مش موجودة بقاعدة البيانات لسا (لازم يتطبّق تحديث قاعدة البيانات).",
                  )
                : t("New books are on their way.", "في كتب جاية قريباً.")}
            </p>
            {isAdmin && (
              <Link to="/admin/books" className="bk-btn is-primary">
                {t("Add the first book", "أضف أول كتاب")}
              </Link>
            )}
          </div>
        ) : filtering ? (
          <section className="bk-results" aria-live="polite">
            <div className="bk-results-head">
              <h2 className="bk-shelf-title">
                {results.length}{" "}
                {t(results.length === 1 ? "book" : "books", results.length === 1 ? "كتاب" : "كتب")}
                {filters.cat && byId.get(filters.cat) ? ` · ${name(byId.get(filters.cat)!)}` : ""}
              </h2>
              <button type="button" className="bk-reset" onClick={() => onFilters(NO_FILTERS)}>
                {t("Back to the shelves", "رجوع للرفوف")}
              </button>
            </div>
            {results.length ? (
              <div className="bk-grid">{results.map(card)}</div>
            ) : (
              <div className="bk-empty">
                <p className="bk-empty-title">{t("No book matches.", "ما في كتاب بيطابق.")}</p>
                <p className="bk-empty-text">
                  {t(
                    "Try another word, or clear the filters.",
                    "جرّب كلمة ثانية، أو امسح الفلترة.",
                  )}
                </p>
                <button type="button" className="bk-btn" onClick={() => onFilters(NO_FILTERS)}>
                  {t("Clear the search", "امسح البحث")}
                </button>
              </div>
            )}
          </section>
        ) : (
          <>
            {featured && (
              <Featured
                book={featured}
                category={featured.category_id ? (byId.get(featured.category_id) ?? null) : null}
                ui={ui}
                languageName={languageName(featured.language)}
                onOpen={() => setOpen(featured)}
              />
            )}
            {books.length >= 6 &&
              shelf(
                "new",
                t("New arrivals", "وصل جديداً"),
                fresh,
                CATEGORY_COLORS.sky,
                Sparkles,
                null,
              )}
            {rows.map((row) =>
              shelf(
                row.category.id,
                name(row.category),
                row.books,
                CATEGORY_COLORS[row.category.color],
                CATEGORY_ICON[row.category.icon],
                row.category.id,
              ),
            )}
            {loose.length > 0 &&
              shelf(
                "loose",
                t("More books", "كتب ثانية"),
                loose,
                CATEGORY_COLORS.slate,
                CATEGORY_ICON.book,
                null,
              )}
          </>
        )}
      </main>

      {open && (
        <BookSheet
          book={open}
          category={open.category_id ? (byId.get(open.category_id) ?? null) : null}
          languageName={languageName(open.language)}
          signedIn={Boolean(user)}
          ui={ui}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function Featured({
  book,
  category,
  ui,
  languageName,
  onOpen,
}: {
  book: Book;
  category: BookCategory | null;
  ui: "en" | "ar";
  languageName: string;
  onOpen: () => void;
}) {
  const t = (en: string, ar: string) => (ui === "ar" ? ar : en);
  const tone = CATEGORY_COLORS[category?.color ?? "slate"];
  const hours = readingHours(book.pages);
  return (
    <section
      className="bk-feature"
      style={{ ["--c" as string]: tone.c, ["--soft" as string]: tone.soft }}
    >
      <button type="button" className="bk-feature-book" onClick={onOpen} aria-label={book.title}>
        <BookObject book={book} color={category?.color} size="lg" showLevel={false} />
      </button>
      <div className="bk-feature-body">
        <span className="bk-tag">
          {t("Book of the week", "كتاب الأسبوع")}
          {category ? ` · ${ui === "ar" ? category.name_ar : category.name_en}` : ""}
        </span>
        <h2 className="bk-feature-title" dir="auto">
          {book.title}
        </h2>
        {(book.author || book.year) && (
          <p className="bk-feature-by" dir="auto">
            {[book.author, book.year].filter(Boolean).join(" · ")}
          </p>
        )}
        <div className="bk-chips">
          <span className="bk-chip is-level">{book.level}</span>
          {book.pages && (
            <span className="bk-chip">
              {book.pages} {t("pages", "صفحة")}
            </span>
          )}
          {hours && (
            <span className="bk-chip">
              {t(`about ${hours} h`, `حوالي ${hours} ${hours === 1 ? "ساعة" : "ساعات"}`)}
            </span>
          )}
          <span className="bk-chip">{languageName}</span>
        </div>
        {book.description && (
          <p className="bk-feature-text" dir="auto">
            {book.description}
          </p>
        )}
        <div className="bk-actions">
          <button type="button" className="bk-btn is-primary" onClick={onOpen}>
            {t("Open the book", "افتح الكتاب")}
          </button>
        </div>
      </div>
    </section>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bk-group" role="group" aria-label={label}>
      <span className="bk-group-label">{label}</span>
      <div className="bk-group-chips">{children}</div>
    </div>
  );
}

function Chip({
  on,
  onClick,
  title,
  children,
}: {
  on: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className="bk-opt" aria-pressed={on} onClick={onClick} title={title}>
      {children}
    </button>
  );
}

function LoadingShelves() {
  return (
    <div aria-busy="true" aria-label="…">
      {[0, 1].map((row) => (
        <div key={row} className="bk-shelf">
          <div className="bk-skel bk-skel-head" />
          <div className="bk-row">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="bk-item">
                <div className="bk-skel bk-skel-book" />
                <div className="bk-skel bk-skel-line" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
