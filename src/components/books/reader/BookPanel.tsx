// The reader's panel (the page-pane plan, phase 3): the book's contents, search inside it, and
// the reader's bookmarks, as three tabs behind one button in the bar under the page — a panel
// above the button on an iPad or computer, a sheet from the bottom on a phone.
//
// - Contents: from the PDF's outline (in the manifest); the chapter you are in is marked and in
//   view. Shown only when the PDF has an outline; otherwise the panel opens on search.
// - Search: whole words, Arabic or English, on Enter (books_search_pages: up to 50 pages, each
//   with a line around the match). Going to a result marks the word on its page.
// - Bookmarks: the reader's marked pages, in page order, each removable.
// Results and bookmarks show the page's 160 px picture at 40 px when the book has it.
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ListTree, Search, X } from "lucide-react";
import type { BookManifest, PageHit } from "@/lib/book-reader-data";
import { searchBookPages, signPagePaths, snippetParts } from "@/lib/book-reader-data";
import { chapterAt, outlineIndexAt, tierPath } from "@/lib/books-reader";

const PANEL = 340;
type Tab = "contents" | "search" | "marks";
type Found =
  | { state: "idle" }
  | { state: "loading"; query: string }
  | { state: "done"; query: string; hits: PageHit[] }
  | { state: "missing" }
  | { state: "error"; query: string };

type Props = {
  bookId: string;
  userId: string;
  manifest: BookManifest | null;
  page: number;
  /** Goes to a page; `terms` are words to mark on it (from a search). */
  onJump: (page: number, terms?: string[]) => void;
  /** "باقي ≈ 6 دقايق بالفصل", or null (shown under the title). */
  left: string | null;
  /** The reader's bookmarked pages, or null before the database has bookmarks. */
  bookmarks: number[] | null;
  onUnmark: (page: number) => void;
};

/** Moves the focus between the buttons of a list with ↑ / ↓. */
function arrowKeys(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const items = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-row]"),
  );
  const at = items.indexOf(document.activeElement as HTMLButtonElement);
  const next = event.key === "ArrowDown" ? Math.min(items.length - 1, at + 1) : Math.max(0, at - 1);
  items[next]?.focus();
  event.preventDefault();
}

export function BookPanel({
  bookId,
  userId,
  manifest,
  page,
  onJump,
  left,
  bookmarks,
  onUnmark,
}: Props) {
  const outline = useMemo(() => manifest?.outline ?? [], [manifest]);
  const hasContents = outline.length > 0;
  const [open, setOpen] = useState(false);
  // The tab the reader chose; until then contents (when the PDF has them, which may arrive after
  // the panel's first render), else search.
  const [chosen, setChosen] = useState<Tab | null>(null);
  const tab: Tab =
    chosen && (chosen !== "contents" || hasContents) ? chosen : hasContents ? "contents" : "search";
  const setTab = (next: Tab) => {
    setChosen(next);
    if (next === "search") window.setTimeout(() => input.current?.focus(), 0);
  };
  const button = useRef<HTMLButtonElement | null>(null);
  const body = useRef<HTMLDivElement | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const [place, setPlace] = useState({ bottom: 72, left: 16, sheet: false });
  const current = outlineIndexAt(outline, page);
  // Rendered inside the reader (not at the end of <body>), so the site's colour tokens apply.
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(button.current?.closest<HTMLElement>(".edith-premium") ?? null), []);

  const measure = () => {
    const el = button.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const sheet = window.innerWidth < 600;
    const leftPx = Math.min(
      Math.max(box.left + box.width / 2 - PANEL / 2, 16),
      window.innerWidth - PANEL - 16,
    );
    setPlace({ bottom: window.innerHeight - box.top + 8, left: leftPx, sheet });
  };

  // ---- search ----------------------------------------------------------------------------------
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Found>({ state: "idle" });
  const running = useRef<AbortController | null>(null);
  const search = (event: FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    running.current?.abort();
    const controller = new AbortController();
    running.current = controller;
    setFound({ state: "loading", query: q });
    searchBookPages(bookId, q, controller.signal).then(
      (hits) => {
        if (controller.signal.aborted) return;
        setFound(hits === "missing" ? { state: "missing" } : { state: "done", query: q, hits });
      },
      () => {
        if (!controller.signal.aborted) setFound({ state: "error", query: q });
      },
    );
  };
  useEffect(() => () => running.current?.abort(), []);

  // ---- little pictures for results and bookmarks -------------------------------------------------
  const thumbPath = (n: number): string | null => {
    const entry = manifest?.pages[n - 1];
    return entry && entry.tiers.includes("thumb") ? tierPath(bookId, n, "thumb", entry.type) : null;
  };
  const listed = useMemo(() => {
    if (!open) return [];
    if (tab === "search" && found.state === "done") return found.hits.map((hit) => hit.page);
    if (tab === "marks" && bookmarks) return bookmarks.slice(0, 50);
    return [];
  }, [open, tab, found, bookmarks]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  useEffect(() => {
    const paths = listed.map((n) => thumbPath(n)).filter((p): p is string => Boolean(p));
    if (!paths.length) return;
    let alive = true;
    void signPagePaths(userId, paths)
      .then((links) => alive && setThumbs((was) => ({ ...was, ...links })))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // thumbPath depends on the manifest and the book only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listed, userId, bookId, manifest]);

  const thumb = (n: number) => {
    const path = thumbPath(n);
    const url = path ? thumbs[path] : undefined;
    const entry = manifest?.pages[n - 1];
    return (
      <span
        className="bkr-hit-thumb"
        style={{ background: entry?.color ?? undefined }}
        aria-hidden="true"
      >
        {url && <img src={url} alt="" draggable={false} />}
      </span>
    );
  };

  // ---- focus on opening ------------------------------------------------------------------------------
  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      if (tab === "search") {
        input.current?.focus();
        return;
      }
      const el =
        body.current?.querySelector<HTMLButtonElement>('[aria-current="true"]') ??
        body.current?.querySelector<HTMLButtonElement>("button[data-row]");
      el?.scrollIntoView({ block: "center" });
      el?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, tab]);

  const go = (n: number, terms?: string[]) => {
    setOpen(false);
    onJump(n, terms);
  };

  const tabs: [Tab, string][] = [
    ...(hasContents ? ([["contents", "الفهرس"]] as [Tab, string][]) : []),
    ["search", "بحث"],
    ["marks", "العلامات"],
  ];
  const label = hasContents ? "الفهرس والبحث" : "بحث وعلامات";

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (next) measure();
        setOpen(next);
      }}
    >
      <Dialog.Trigger asChild>
        <button ref={button} type="button" className="bkr-icon" aria-label={label} title={label}>
          {hasContents ? (
            <ListTree size={17} aria-hidden="true" />
          ) : (
            <Search size={17} aria-hidden="true" />
          )}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal container={host ?? undefined}>
        <Dialog.Overlay className="bkr-toc-veil" />
        <Dialog.Content
          className={`bkr-toc${place.sheet ? " is-sheet" : ""}`}
          style={place.sheet ? undefined : { bottom: place.bottom, left: place.left, width: PANEL }}
          dir="rtl"
          aria-describedby={undefined}
          onKeyDown={(event) => {
            // Arrows inside the panel never reach the reader's page turning.
            if (event.key.startsWith("Arrow") || event.key.startsWith("Page"))
              event.stopPropagation();
          }}
        >
          <div className="bkr-toc-head">
            <div>
              <Dialog.Title className="bkr-toc-title">
                {tabs.find(([id]) => id === tab)?.[1]}
              </Dialog.Title>
              {left && tab === "contents" && <p className="bkr-toc-left">{left}</p>}
            </div>
            <Dialog.Close className="bkr-icon" aria-label="سكّر">
              <X size={16} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="bkr-tabs" role="tablist" aria-label="أقسام">
            {tabs.map(([id, name]) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`bkr-tab-${id}`}
                aria-selected={tab === id}
                aria-controls="bkr-tab-body"
                tabIndex={tab === id ? 0 : -1}
                onClick={() => setTab(id)}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                  const at = tabs.findIndex(([t]) => t === tab);
                  // Right-to-left: the right arrow goes to the previous tab.
                  const step = event.key === "ArrowLeft" ? 1 : -1;
                  const next = tabs[(at + step + tabs.length) % tabs.length][0];
                  setTab(next);
                  document.getElementById(`bkr-tab-${next}`)?.focus();
                  event.preventDefault();
                }}
              >
                {name}
                {id === "marks" && bookmarks && bookmarks.length > 0 && (
                  <span className="bkr-tab-count">{bookmarks.length}</span>
                )}
              </button>
            ))}
          </div>
          <div
            ref={body}
            id="bkr-tab-body"
            role="tabpanel"
            aria-labelledby={`bkr-tab-${tab}`}
            className="bkr-tab-body"
            onKeyDown={arrowKeys}
          >
            {tab === "contents" && (
              <ol className="bkr-toc-list">
                {outline.map(([title, at, level], index) => (
                  <li key={`${index}-${at}`}>
                    <button
                      type="button"
                      data-row=""
                      aria-current={index === current ? "true" : undefined}
                      style={{ paddingInlineStart: 12 + Math.min(3, level) * 14 }}
                      onClick={() => go(at)}
                    >
                      <span className="bkr-toc-name" dir="auto">
                        {title}
                      </span>
                      <span className="bkr-toc-page">{at}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}

            {tab === "search" && (
              <>
                <form className="bkr-search" role="search" onSubmit={search}>
                  <Search size={16} aria-hidden="true" />
                  <label className="sr-only" htmlFor="bkr-search-q">
                    دوّر بالكتاب
                  </label>
                  <input
                    ref={(node) => {
                      input.current = node;
                      // Focused as soon as the search tab shows (opened or switched to).
                      if (node && document.activeElement !== node) node.focus();
                    }}
                    id="bkr-search-q"
                    type="search"
                    dir="auto"
                    enterKeyHint="search"
                    placeholder="دوّر على كلمة بالكتاب"
                    value={query}
                    maxLength={200}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </form>
                <div aria-live="polite">
                  {found.state === "loading" && <p className="bkr-panel-note">جاري البحث…</p>}
                  {found.state === "missing" && (
                    <p className="bkr-panel-note">البحث بيشتغل بعد تحديث قاعدة البيانات.</p>
                  )}
                  {found.state === "error" && (
                    <p className="bkr-panel-note">ما زبط البحث. تأكد من النت وجرّب مرة ثانية.</p>
                  )}
                  {found.state === "done" && !found.hits.length && (
                    <p className="bkr-panel-note">
                      ما لقيت «<bdi>{found.query}</bdi>» بهالكتاب.
                    </p>
                  )}
                  {found.state === "done" && found.hits.length > 0 && (
                    <p className="bkr-panel-count">
                      {found.hits.length === 50 ? "أول 50 صفحة" : `${found.hits.length} صفحة`}
                    </p>
                  )}
                </div>
                {found.state === "done" && found.hits.length > 0 && (
                  <ol className="bkr-hits">
                    {found.hits.map((hit) => {
                      const parts = snippetParts(hit.snippet);
                      const terms = [
                        ...new Set(parts.filter(([, bold]) => bold).map(([t]) => t.toLowerCase())),
                      ];
                      return (
                        <li key={hit.page}>
                          <button
                            type="button"
                            data-row=""
                            aria-current={hit.page === page ? "true" : undefined}
                            onClick={() => go(hit.page, terms)}
                          >
                            {thumb(hit.page)}
                            <span className="bkr-hit-text">
                              <span className="bkr-hit-page">صفحة {hit.page}</span>
                              <span className="bkr-hit-line" dir="auto">
                                {parts.map(([text, bold], index) =>
                                  bold ? (
                                    <b key={index}>{text}</b>
                                  ) : (
                                    <span key={index}>{text}</span>
                                  ),
                                )}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </>
            )}

            {tab === "marks" &&
              (bookmarks === null ? (
                <p className="bkr-panel-note">العلامات بتشتغل بعد تحديث قاعدة البيانات.</p>
              ) : !bookmarks.length ? (
                <p className="bkr-panel-note">
                  ما في علامات بعد. اكبس على أيقونة العلامة تحت لتحفظ الصفحة اللي انت فيها.
                </p>
              ) : (
                <ol className="bkr-hits">
                  {bookmarks.map((n) => {
                    const chapter = chapterAt(outline, n);
                    return (
                      <li key={n} className="bkr-mark-row">
                        <button
                          type="button"
                          data-row=""
                          aria-current={n === page ? "true" : undefined}
                          onClick={() => go(n)}
                        >
                          {thumb(n)}
                          <span className="bkr-hit-text">
                            <span className="bkr-hit-page">صفحة {n}</span>
                            {chapter && (
                              <span className="bkr-hit-line" dir="auto">
                                {chapter}
                              </span>
                            )}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="bkr-icon"
                          aria-label={`شيل علامة صفحة ${n}`}
                          onClick={() => onUnmark(n)}
                        >
                          <X size={15} aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ol>
              ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
