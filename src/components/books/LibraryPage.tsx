import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookMarked,
  ChevronLeft,
  ChevronRight,
  Eye,
  Flame,
  Heart,
  Star,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { useUiLanguage } from "@/components/language/useUiLanguage";
import { useAuth } from "@/hooks/useAuth";
import { useLanguageRegistry } from "@/hooks/useLearningLanguage";
import {
  BOOK_LENGTHS,
  BOOK_LEVELS,
  CATEGORY_COLORS,
  defaultSort,
  filterCount,
  modeOf,
  newSeed,
  NO_BROWSE,
  ratingShown,
  readingHours,
  toggleValue,
  type Book,
  type BookCategory,
  type BookLength,
  type BrowseSort,
  type BrowseState,
  type Facets,
  type PageSize,
} from "@/lib/books";
import {
  browseBooks,
  LIBRARY_QUERY_KEY,
  loadCatalog,
  loadDiscover,
  loadMine,
  loadPopular,
  type Popular,
} from "@/lib/books-data";
import { BookObject, CATEGORY_ICON } from "./BookObject";
import { BookSheet } from "./BookSheet";

const SEED_KEY = "bk-seed";

function readSeed(): string {
  try {
    const saved = window.sessionStorage.getItem(SEED_KEY);
    if (saved && /^[a-z0-9]{4,16}$/.test(saved)) return saved;
  } catch {
    // Storage can be blocked; a fresh seed is fine.
  }
  return newSeed();
}

/**
 * The library. Four ways in: discover (the shelves: the book of the week, the admin's shelves,
 * picks for this visit, the newest books and one shelf per category), all books, a search, and
 * one category. Lists come from the database a page at a time (24 or 48); filters are OR inside
 * a group and AND between groups, with counts that follow the other groups. Searching happens on
 * the button or Enter. An admin can preview the library at another moment (`preview`).
 */
export function LibraryPage({
  state,
  onState,
  preview,
  previewSeed,
}: {
  state: BrowseState;
  onState: (next: BrowseState) => void;
  preview?: string;
  previewSeed?: string;
}) {
  const ui = useUiLanguage();
  const t = (en: string, ar: string) => (ui === "ar" ? ar : en);
  const { user, isAdmin } = useAuth();
  const registry = useLanguageRegistry();
  const previewAt = useMemo(() => {
    const d = preview ? new Date(preview) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
  }, [preview]);
  const previewIso = isAdmin && previewAt ? previewAt.toISOString() : null;
  const mode = modeOf(state);

  const [seed, setSeed] = useState(() =>
    previewSeed && /^[a-z0-9]{1,16}$/i.test(previewSeed)
      ? previewSeed
      : typeof window === "undefined"
        ? ""
        : readSeed(),
  );
  useEffect(() => {
    try {
      window.sessionStorage.setItem(SEED_KEY, seed);
    } catch {
      // Not saved: the next visit gets new picks.
    }
  }, [seed]);

  const catalog = useQuery({
    queryKey: [...LIBRARY_QUERY_KEY, "catalog"],
    queryFn: loadCatalog,
    staleTime: 5 * 60_000,
  });
  const queryClient = useQueryClient();
  const phase3 = Boolean(catalog.data?.phase3);
  // The two popularity shelves (phase 3) and the signed-in reader's own favourites and ratings.
  const popular = useQuery({
    queryKey: [...LIBRARY_QUERY_KEY, "popular", previewIso],
    queryFn: ({ signal }) => loadPopular(previewIso, signal),
    enabled: mode === "discover" && phase3,
    staleTime: 60_000,
  });
  const mine = useQuery({
    queryKey: [...LIBRARY_QUERY_KEY, "mine", user?.id ?? ""],
    queryFn: loadMine,
    enabled: Boolean(user) && phase3,
    staleTime: 60_000,
  });
  const discover = useQuery({
    queryKey: [...LIBRARY_QUERY_KEY, "discover", seed, previewIso],
    queryFn: ({ signal }) => loadDiscover(seed, previewIso, signal),
    enabled: mode === "discover" && Boolean(seed),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  // One browse (the same search, filters and order) keeps one snapshot time for all its pages.
  const browseKey = JSON.stringify({ ...state, page: 0 });
  const snapshot = useRef<{ key: string; asOf: string | null }>({ key: "", asOf: null });
  if (snapshot.current.key !== browseKey) snapshot.current = { key: browseKey, asOf: previewIso };
  const browse = useQuery({
    queryKey: [...LIBRARY_QUERY_KEY, "browse", browseKey, state.page, seed, previewIso],
    queryFn: async ({ signal }) => {
      const key = browseKey;
      const result = await browseBooks(state, { seed, asOf: snapshot.current.asOf, signal });
      if (snapshot.current.key === key && !snapshot.current.asOf)
        snapshot.current.asOf = result.asOf;
      return result;
    },
    enabled: mode !== "discover",
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const [open, setOpen] = useState<Book | null>(null);
  const [panel, setPanel] = useState(false);
  // The panel's counts on the discover page come from a browse of everything.
  const facetsOnly = useQuery({
    queryKey: [...LIBRARY_QUERY_KEY, "facets", previewIso],
    queryFn: ({ signal }) =>
      browseBooks({ ...NO_BROWSE, view: "all" }, { seed, asOf: previewIso, signal }),
    enabled: panel && mode === "discover",
    staleTime: 60_000,
  });
  const facets: Facets | null =
    (mode === "discover" ? facetsOnly.data?.facets : browse.data?.facets) ?? null;

  const [text, setText] = useState(state.q);
  const searchBox = useRef<HTMLInputElement>(null);
  const resultsTop = useRef<HTMLDivElement>(null);
  // The address can change the query (back button): follow it.
  useEffect(() => setText(state.q), [state.q]);
  // «/» jumps to the search box (not while typing elsewhere).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "/" || target?.closest("input, textarea, select, [contenteditable]"))
        return;
      event.preventDefault();
      searchBox.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  // A new page starts at the top of the results.
  const lastPage = useRef(state.page);
  useEffect(() => {
    if (lastPage.current !== state.page) {
      resultsTop.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      lastPage.current = state.page;
    }
  }, [state.page]);

  const categories = useMemo(() => catalog.data?.categories ?? [], [catalog.data]);
  const tags = catalog.data?.tags ?? [];
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const languageName = (code: string) => {
    const found = registry.all.find((l) => l.code === code);
    return found ? (ui === "ar" ? found.name_ar : found.name_native) : code.toUpperCase();
  };
  const name = (c: { name_ar: string; name_en: string }) => (ui === "ar" ? c.name_ar : c.name_en);
  const go = (patch: Partial<BrowseState>) => onState({ ...state, page: 1, ...patch });
  const fresh = (patch: Partial<BrowseState> = {}) =>
    onState({ ...NO_BROWSE, size: state.size, ...patch });

  function submit(event: FormEvent) {
    event.preventDefault();
    const q = text.trim().slice(0, 80);
    searchBox.current?.blur();
    if (q === state.q) {
      if (q) void browse.refetch();
      return;
    }
    go({ q, sort: null });
  }

  const discoverTotal = discover.data?.total;
  const categoryTotals = new Map((discover.data?.categories ?? []).map((c) => [c.id, c.total]));
  const chosen = filterCount(state);
  const sortNow: BrowseSort = state.sort ?? browse.data?.sort ?? defaultSort(state);
  const sortOptions: [BrowseSort, string][] = [
    ...(mode === "search"
      ? ([["relevance", t("Best match", "الأنسب")]] as [BrowseSort, string][])
      : []),
    ...(mode === "category"
      ? ([["discover", t("Recommended", "المقترح")]] as [BrowseSort, string][])
      : []),
    ["new", t("Newest", "الأحدث")],
    ["title", t("By title", "حسب الاسم")],
    ["short", t("Shortest", "الأقصر")],
    ...(phase3
      ? ([
          ["rating", t("Top rated", "الأعلى تقييماً")],
          ["trending", t("Trending", "الرائج")],
        ] as [BrowseSort, string][])
      : []),
  ];
  const languages = useMemo(() => {
    const fromFacets = facets ? Object.keys(facets.language) : [];
    const list = fromFacets.length ? fromFacets : registry.all.map((l) => l.code);
    return [...new Set([...list, ...state.lang])];
  }, [facets, registry.all, state.lang]);
  const countOf = (group: keyof Facets, key: string) => (facets ? (facets[group][key] ?? 0) : null);
  const lengthWords: Record<BookLength, [string, string]> = {
    short: [t("Short", "قصير"), t("under 150 pages", "أقل من 150 صفحة")],
    medium: [t("Medium", "متوسط"), "150–350"],
    long: [t("Long", "طويل"), t("350+ pages", "أكثر من 350")],
  };
  const phase2Missing =
    isAdmin &&
    ((mode === "discover" && discover.data && !discover.data.phase2) ||
      (mode !== "discover" && browse.data && !browse.data.phase2));

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
        {phase3 && ratingShown(book) && (
          <span className="bk-item-rating">
            <Star size={12} fill="currentColor" aria-hidden="true" />
            {book.rating_avg?.toFixed(1)}
            <span className="sr-only">
              {t(` from ${book.rating_count} ratings`, ` من ${book.rating_count} تقييم`)}
            </span>
          </span>
        )}
      </button>
    );
  };

  const Arrow = ui === "ar" ? ChevronLeft : ChevronRight;
  const Back = ui === "ar" ? ChevronRight : ChevronLeft;
  const shelf = (
    key: string,
    title: string,
    list: Book[],
    tone: { c: string; soft: string },
    Icon: typeof Sparkles,
    options: { all?: () => void; total?: number; action?: ReactNode } = {},
  ) => {
    const n = options.total ?? list.length;
    return (
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
            {n} {t(n === 1 ? "book" : "books", "كتب")}
          </span>
          {options.action}
          {options.all && (
            <button type="button" className="bk-shelf-all" onClick={options.all}>
              {t("See all", "عرض الكل")} <Arrow size={15} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="bk-row">{list.map(card)}</div>
        <div className="bk-board" aria-hidden="true" />
      </section>
    );
  };

  const result = browse.data;
  const pages = result ? Math.max(1, Math.ceil(result.total / state.size)) : 1;
  const category = mode === "category" ? byId.get(state.cat[0]) : undefined;
  const resultTitle =
    mode === "search"
      ? t(`Results for “${state.q}”`, `نتائج «${state.q}»`)
      : mode === "favorites"
        ? t("My favourites", "مفضلتي")
        : category
          ? name(category)
          : t("All books", "كل الكتب");
  const myState = (book: Book) =>
    mine.data
      ? {
          favorite: mine.data.favorites.includes(book.id),
          rating: mine.data.ratings[book.id] ?? null,
        }
      : null;
  // After a rating or a favourite: the reader's own lists and the popularity shelves refresh.
  const changed = () => {
    void queryClient.invalidateQueries({ queryKey: [...LIBRARY_QUERY_KEY, "mine"] });
    void queryClient.invalidateQueries({ queryKey: [...LIBRARY_QUERY_KEY, "popular"] });
    if (mode === "favorites")
      void queryClient.invalidateQueries({ queryKey: [...LIBRARY_QUERY_KEY, "browse"] });
  };
  const CategoryIcon = category ? CATEGORY_ICON[category.icon] : null;
  const remove = t("Remove", "شيل");

  return (
    <div className="min-h-screen bg-white text-[var(--pp-ink)]">
      <SiteHeader />
      <main className="bk-page" dir={ui === "ar" ? "rtl" : "ltr"}>
        {previewIso && previewAt && (
          <div className="bk-preview" role="status">
            <Eye size={16} aria-hidden="true" />
            <span>
              {t("Admin preview of the library at", "معاينة للأدمن: المكتبة بتاريخ")}{" "}
              <b>
                {previewAt.toLocaleString(ui === "ar" ? "ar-u-nu-latn" : "en", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </b>
              {previewSeed ? ` · ${t("order", "الترتيب")} ${previewSeed}` : ""}
            </span>
            <Link to="/books" className="bk-preview-exit">
              {t("Leave preview", "اطلع من المعاينة")}
            </Link>
          </div>
        )}
        {phase2Missing && (
          <div className="bk-preview" role="status">
            <span>
              {t(
                "Admin only: search, pages and pins run in the browser until the database update 20261110120000 is applied.",
                "للأدمن بس: البحث والصفحات والتثبيت شغّالين من المتصفح لحد ما يتطبّق تحديث قاعدة البيانات 20261110120000.",
              )}
            </span>
          </div>
        )}

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
          <form className="bk-search" role="search" onSubmit={submit}>
            <label className="bk-field">
              <Search size={18} aria-hidden="true" />
              <input
                ref={searchBox}
                type="search"
                value={text}
                maxLength={80}
                onChange={(event) => setText(event.target.value)}
                placeholder={t("Title, author or ISBN", "عنوان، كاتب أو ISBN")}
                aria-label={t("Search the library", "ابحث بالمكتبة")}
                enterKeyHint="search"
              />
              {text ? (
                <button
                  type="button"
                  className="bk-clear"
                  onClick={() => {
                    setText("");
                    if (state.q) go({ q: "", sort: null });
                    searchBox.current?.focus();
                  }}
                  aria-label={t("Clear", "امسح")}
                >
                  <X size={16} />
                </button>
              ) : (
                <kbd className="bk-kbd">/</kbd>
              )}
            </label>
            <button type="submit" className="bk-go">
              {t("Search", "ابحث")}
            </button>
            <button
              type="button"
              className="bk-filter"
              aria-expanded={panel}
              aria-controls="bk-panel"
              aria-label={t("Filter", "فلترة")}
              onClick={() => setPanel((value) => !value)}
            >
              <SlidersHorizontal size={17} aria-hidden="true" />
              <span className="bk-filter-word">{t("Filter", "فلترة")}</span>
              {chosen > 0 && <span className="bk-badge">{chosen}</span>}
            </button>
          </form>
        </div>

        {panel && (
          <div id="bk-panel" className="bk-panel">
            {categories.length > 0 && (
              <Group label={t("Category", "التصنيف")}>
                {categories.map((c) => (
                  <Chip
                    key={c.id}
                    on={state.cat.includes(c.id)}
                    count={countOf("category", c.id)}
                    onClick={() => onState(toggleValue(state, "cat", c.id))}
                  >
                    <span
                      className="bk-cat-dot"
                      style={{ ["--c" as string]: CATEGORY_COLORS[c.color].c }}
                      aria-hidden="true"
                    />
                    {name(c)}
                  </Chip>
                ))}
              </Group>
            )}
            <Group label={t("Level", "المستوى")}>
              {BOOK_LEVELS.map((level) => (
                <Chip
                  key={level}
                  on={state.level.includes(level)}
                  count={countOf("level", level)}
                  onClick={() => onState(toggleValue(state, "level", level))}
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
                    on={state.lang.includes(code)}
                    count={countOf("language", code)}
                    onClick={() => onState(toggleValue(state, "lang", code))}
                  >
                    {languageName(code)}
                  </Chip>
                ))}
              </Group>
            )}
            <Group label={t("Length", "الطول")}>
              {BOOK_LENGTHS.map((len) => (
                <Chip
                  key={len}
                  on={state.len.includes(len)}
                  count={countOf("length", len)}
                  onClick={() => onState(toggleValue(state, "len", len))}
                  title={lengthWords[len][1]}
                >
                  {lengthWords[len][0]}
                </Chip>
              ))}
            </Group>
            {tags.length > 0 && (
              <Group label={t("Tags", "الوسوم")}>
                {tags.map((tag) => (
                  <Chip
                    key={tag.id}
                    on={state.tag.includes(tag.id)}
                    count={countOf("tag", tag.id)}
                    onClick={() => onState(toggleValue(state, "tag", tag.id))}
                  >
                    {name(tag)}
                  </Chip>
                ))}
              </Group>
            )}
            <p className="bk-panel-note">
              {t(
                "Choices in one group widen the list; choices in different groups narrow it.",
                "الخيارات بنفس المجموعة بتوسّع النتائج، وبين المجموعات بتضيّقها.",
              )}
            </p>
          </div>
        )}

        <nav className="bk-cats" aria-label={t("Browse", "تصفّح")}>
          <button
            type="button"
            className="bk-cat"
            aria-pressed={mode === "discover"}
            onClick={() => fresh()}
          >
            <Sparkles size={15} aria-hidden="true" /> {t("Discover", "اكتشف")}
          </button>
          <button
            type="button"
            className="bk-cat"
            aria-pressed={mode === "all" && chosen === 0}
            onClick={() => fresh({ view: "all" })}
          >
            {t("All books", "كل الكتب")}
            {discoverTotal !== undefined && <span className="bk-cat-n">{discoverTotal}</span>}
          </button>
          {user && phase3 && (
            <button
              type="button"
              className="bk-cat"
              aria-pressed={mode === "favorites"}
              onClick={() => fresh({ view: "favorites" })}
            >
              <Heart size={15} aria-hidden="true" /> {t("My favourites", "مفضلتي")}
              {mine.data && <span className="bk-cat-n">{mine.data.favorites.length}</span>}
            </button>
          )}
          {categories
            .filter((c) => !discover.data || categoryTotals.get(c.id))
            .map((c) => (
              <button
                key={c.id}
                type="button"
                className="bk-cat"
                aria-pressed={mode === "category" && state.cat[0] === c.id}
                onClick={() => fresh({ cat: [c.id] })}
                style={{ ["--c" as string]: CATEGORY_COLORS[c.color].c }}
              >
                <span className="bk-cat-dot" aria-hidden="true" />
                {name(c)}
                {categoryTotals.get(c.id) !== undefined && (
                  <span className="bk-cat-n">{categoryTotals.get(c.id)}</span>
                )}
              </button>
            ))}
        </nav>

        {(chosen > 0 || state.q) && (
          <div className="bk-active" role="group" aria-label={t("Chosen", "المختار")}>
            {state.q && (
              <Active onRemove={() => go({ q: "", sort: null })} label={remove}>
                «{state.q}»
              </Active>
            )}
            {state.cat.map((id) => {
              const c = byId.get(id);
              return c ? (
                <Active
                  key={id}
                  onRemove={() => onState(toggleValue(state, "cat", id))}
                  label={remove}
                >
                  {name(c)}
                </Active>
              ) : null;
            })}
            {state.level.map((v) => (
              <Active
                key={v}
                onRemove={() => onState(toggleValue(state, "level", v))}
                label={remove}
              >
                {v}
              </Active>
            ))}
            {state.lang.map((v) => (
              <Active
                key={v}
                onRemove={() => onState(toggleValue(state, "lang", v))}
                label={remove}
              >
                {languageName(v)}
              </Active>
            ))}
            {state.len.map((v) => (
              <Active key={v} onRemove={() => onState(toggleValue(state, "len", v))} label={remove}>
                {lengthWords[v][0]}
              </Active>
            ))}
            {state.tag.map((id) => {
              const tag = tags.find((x) => x.id === id);
              return tag ? (
                <Active
                  key={id}
                  onRemove={() => onState(toggleValue(state, "tag", id))}
                  label={remove}
                >
                  {name(tag)}
                </Active>
              ) : null;
            })}
            <button type="button" className="bk-reset" onClick={() => fresh()}>
              {t("Clear all", "امسح الكل")}
            </button>
          </div>
        )}

        {mode === "discover" ? (
          discover.isLoading || (!discover.data && !discover.isError) ? (
            <LoadingShelves />
          ) : discover.isError || !discover.data ? (
            <Problem ui={ui} onRetry={() => void discover.refetch()} />
          ) : discover.data.total === 0 ? (
            <div className="bk-empty">
              <p className="bk-empty-title">
                {t("The library is empty for now.", "المكتبة لسا فاضية.")}
              </p>
              <p className="bk-empty-text">
                {catalog.data && !catalog.data.ready && isAdmin
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
          ) : (
            <DiscoverShelves
              data={discover.data}
              fetching={discover.isFetching}
              byId={byId}
              ui={ui}
              shelf={shelf}
              name={name}
              languageName={languageName}
              onOpen={setOpen}
              onNewPicks={() => setSeed(newSeed())}
              onAll={(patch) => fresh(patch)}
              popular={popular.data ?? null}
            />
          )
        ) : (
          <section className="bk-results" aria-busy={browse.isFetching}>
            <div className="bk-results-head" ref={resultsTop}>
              <div className="bk-results-title">
                {category && CategoryIcon && (
                  <span
                    className="bk-shelf-icon"
                    style={{
                      ["--c" as string]: CATEGORY_COLORS[category.color].c,
                      ["--soft" as string]: CATEGORY_COLORS[category.color].soft,
                    }}
                    aria-hidden="true"
                  >
                    <CategoryIcon size={16} strokeWidth={2.2} />
                  </span>
                )}
                <h2 className="bk-shelf-title" dir="auto">
                  {resultTitle}
                </h2>
                {result && (
                  <span className="bk-shelf-count" aria-live="polite">
                    {result.total}{" "}
                    {t(result.total === 1 ? "book" : "books", result.total === 1 ? "كتاب" : "كتب")}
                  </span>
                )}
              </div>
              <label className="bk-sort">
                <span>{t("Order", "الترتيب")}</span>
                <select
                  value={sortNow}
                  onChange={(event) => go({ sort: event.target.value as BrowseSort })}
                >
                  {sortOptions.map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {browse.isError ? (
              <Problem ui={ui} onRetry={() => void browse.refetch()} />
            ) : !result ? (
              <div className="bk-grid" aria-hidden="true">
                {Array.from({ length: 12 }, (_, i) => (
                  <div key={i} className="bk-item">
                    <div className="bk-skel bk-skel-book" />
                    <div className="bk-skel bk-skel-line" />
                  </div>
                ))}
              </div>
            ) : result.items.length ? (
              <>
                <div className={`bk-grid${browse.isPlaceholderData ? " is-stale" : ""}`}>
                  {result.items.map(card)}
                </div>
                {result.total > state.size && (
                  <nav className="bk-pager" aria-label={t("Pages", "الصفحات")}>
                    <button
                      type="button"
                      className="bk-btn"
                      disabled={state.page <= 1}
                      onClick={() => onState({ ...state, page: state.page - 1 })}
                    >
                      <Back size={16} aria-hidden="true" /> {t("Previous", "السابق")}
                    </button>
                    <span className="bk-pager-n" aria-current="page">
                      {t(`Page ${state.page} of ${pages}`, `صفحة ${state.page} من ${pages}`)}
                    </span>
                    <button
                      type="button"
                      className="bk-btn"
                      disabled={state.page >= pages}
                      onClick={() => onState({ ...state, page: state.page + 1 })}
                    >
                      {t("Next", "التالي")} <Arrow size={16} aria-hidden="true" />
                    </button>
                    <label className="bk-sort">
                      <span>{t("Per page", "بالصفحة")}</span>
                      <select
                        value={state.size}
                        onChange={(event) => go({ size: Number(event.target.value) as PageSize })}
                      >
                        <option value={24}>24</option>
                        <option value={48}>48</option>
                      </select>
                    </label>
                  </nav>
                )}
              </>
            ) : (
              <div className="bk-empty">
                <p className="bk-empty-title">
                  {state.page > 1
                    ? t("This page is empty.", "هالصفحة فاضية.")
                    : mode === "favorites" && !state.q && !chosen
                      ? t("No favourites yet.", "لسا ما في كتب بالمفضلة.")
                      : t("No book matches.", "ما في كتاب بيطابق.")}
                </p>
                <p className="bk-empty-text">
                  {state.page > 1
                    ? t("Go back to the first page.", "ارجع للصفحة الأولى.")
                    : mode === "favorites" && !state.q && !chosen
                      ? t(
                          "Open a book and press «Add to favourites» to keep it here.",
                          "افتح أي كتاب واضغط «للمفضلة» عشان يضل هون.",
                        )
                      : t(
                          "Try another word, or clear the filters.",
                          "جرّب كلمة ثانية، أو امسح الفلترة.",
                        )}
                </p>
                <button
                  type="button"
                  className="bk-btn"
                  onClick={() => (state.page > 1 ? go({}) : fresh())}
                >
                  {state.page > 1
                    ? t("First page", "الصفحة الأولى")
                    : t("Clear the search", "امسح البحث")}
                </button>
              </div>
            )}
          </section>
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
          phase3={phase3}
          mine={myState(open)}
          onChanged={changed}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}

type ShelfFn = (
  key: string,
  title: string,
  list: Book[],
  tone: { c: string; soft: string },
  Icon: typeof Sparkles,
  options?: { all?: () => void; total?: number; action?: ReactNode },
) => ReactNode;

function DiscoverShelves({
  data,
  fetching,
  byId,
  ui,
  shelf,
  name,
  languageName,
  onOpen,
  onNewPicks,
  onAll,
  popular,
}: {
  data: Awaited<ReturnType<typeof loadDiscover>>;
  fetching: boolean;
  byId: Map<string, BookCategory>;
  ui: "en" | "ar";
  shelf: ShelfFn;
  name: (c: { name_ar: string; name_en: string }) => string;
  languageName: (code: string) => string;
  onOpen: (book: Book) => void;
  onNewPicks: () => void;
  onAll: (patch: Partial<BrowseState>) => void;
  popular: Popular | null;
}) {
  const t = (en: string, ar: string) => (ui === "ar" ? ar : en);
  const featured = data.featured;
  return (
    <>
      {featured && (
        <Featured
          book={featured}
          category={featured.category_id ? (byId.get(featured.category_id) ?? null) : null}
          ui={ui}
          languageName={languageName(featured.language)}
          onOpen={() => onOpen(featured)}
        />
      )}
      {data.shelves.map((s) =>
        shelf(`shelf-${s.id}`, name(s), s.books, CATEGORY_COLORS.indigo, BookMarked),
      )}
      {data.picks.length > 0 &&
        shelf(
          "picks",
          t("Picked for you", "مختارات لك"),
          data.picks,
          CATEGORY_COLORS.violet,
          Sparkles,
          {
            action: (
              <button
                type="button"
                className="bk-shelf-all"
                onClick={onNewPicks}
                disabled={fetching}
              >
                <RefreshCw
                  size={14}
                  aria-hidden="true"
                  className={fetching ? "animate-spin" : undefined}
                />
                {t("New picks", "اقتراحات جديدة")}
              </button>
            ),
          },
        )}
      {popular &&
        popular.trending.length > 0 &&
        shelf(
          "trending",
          t("Trending this week", "الرائج هالأسبوع"),
          popular.trending,
          CATEGORY_COLORS.amber,
          Flame,
          { all: () => onAll({ view: "all", sort: "trending" }) },
        )}
      {popular &&
        popular.topRated.length > 0 &&
        shelf(
          "top-rated",
          t("Top rated", "الأعلى تقييماً"),
          popular.topRated,
          CATEGORY_COLORS.rose,
          Star,
          { all: () => onAll({ view: "all", sort: "rating" }) },
        )}
      {data.total >= 6 &&
        shelf("new", t("New arrivals", "وصل جديداً"), data.newest, CATEGORY_COLORS.sky, Sparkles, {
          all: () => onAll({ view: "all", sort: "new" }),
          total: data.total,
        })}
      {data.categories.map((row) => {
        const c = byId.get(row.id);
        if (!c) return null;
        return shelf(row.id, name(c), row.books, CATEGORY_COLORS[c.color], CATEGORY_ICON[c.icon], {
          all: () => onAll({ cat: [c.id] }),
          total: row.total,
        });
      })}
      {data.loose.length > 0 &&
        shelf(
          "loose",
          t("More books", "كتب ثانية"),
          data.loose,
          CATEGORY_COLORS.slate,
          CATEGORY_ICON.book,
        )}
    </>
  );
}

function Problem({ ui, onRetry }: { ui: "en" | "ar"; onRetry: () => void }) {
  const t = (en: string, ar: string) => (ui === "ar" ? ar : en);
  return (
    <div className="bk-empty">
      <p className="bk-empty-title">{t("The library did not load.", "ما انفتحت المكتبة.")}</p>
      <button type="button" className="bk-btn" onClick={onRetry}>
        {t("Try again", "جرّب مرة ثانية")}
      </button>
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

function Group({ label, children }: { label: string; children: ReactNode }) {
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
  count,
  children,
}: {
  on: boolean;
  onClick: () => void;
  title?: string;
  /** How many books this choice would show (null when not known yet). */
  count?: number | null;
  children: ReactNode;
}) {
  const empty = count === 0 && !on;
  return (
    <button
      type="button"
      className="bk-opt"
      aria-pressed={on}
      onClick={onClick}
      title={title}
      disabled={empty}
    >
      {children}
      {count !== null && count !== undefined && <span className="bk-opt-n">{count}</span>}
    </button>
  );
}

function Active({
  onRemove,
  label,
  children,
}: {
  onRemove: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="bk-active-chip" dir="auto">
      {children}
      <button type="button" onClick={onRemove} aria-label={label}>
        <X size={14} aria-hidden="true" />
      </button>
    </span>
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
