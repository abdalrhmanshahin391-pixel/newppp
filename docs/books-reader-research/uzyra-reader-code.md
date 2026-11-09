# Uzyra book reader — source code
The files behind the reader described in the PDF report. React 19 + TanStack Start/Router + React Query; Supabase (Postgres + Storage).

## `src/components/books/reader/BookReader.tsx`

```tsx
// The book reader: the same layout as the study page (Rita on the left, the page on the right, a
// draggable divider on wide screens, two tabs on phones, and the floating circle over both). Only
// the page being read is loaded (a light picture and its words), with the next one ready behind
// it, so a 500 MB book opens as fast as a short one and never freezes the device.
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Group, Panel, Separator } from "react-resizable-panels";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  MoveHorizontal,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { PhraseDialog } from "@/components/rita/PhraseDialog";
import { FloatingOrb, type OrbState } from "@/components/rita-study/FloatingOrb";
import { RadialMenu, type RadialHandle } from "@/components/rita-study/RadialMenu";
import { StudyPracticePanel, type PracticeView } from "@/components/rita-study/StudyPracticePanel";
import { DEFAULT_ORB, snapToEdge, type OrbPosition } from "@/components/rita-study/orb-position";
import { readStudyMemory, writeStudyMemory } from "@/components/rita-study/study-memory";
import { installSoundUnlock, setSoundOn, soundOn } from "@/components/rita-study/tech-sound";
import {
  KIND_LABEL,
  LANGUAGE_NAMES,
  actionItem,
  languageFromId,
  languageItems,
  type RadialItem,
} from "@/components/rita-study/radial-items";
import { useExplanationLanguage } from "@/hooks/useExplanationLanguage";
import { MAX_PHRASE_CHARS } from "@/lib/rita-phrase";
import { availableActions, type PracticeAction, type StudyAction } from "@/lib/study/study-actions";
import { bookSelectionKind, clampPage, pageQuote } from "@/lib/books-reader";
import {
  loadReaderPage,
  saveReadingPlace,
  type ReaderBook,
  type ReaderPage,
} from "@/lib/book-reader-data";
import {
  BOOK_TEXT_ACTIONS,
  bookMakeCards,
  bookMakeMcq,
  bookStudyText,
  type BookTextAction,
} from "@/lib/books-study.functions";
import { BookPageView } from "./BookPageView";
import { BookRitaColumn, type BookAnswer } from "./BookRitaColumn";
import "@/components/rita-study/study-meaning.css";
import "./book-reader.css";

const SPLIT_KEY = "uzyra-book-split";
/** Per browser: how the page fits ("page": all of it in view; "width": the pane's width). */
const FIT_KEY = "uzyra-book-fit";
/** Per browser: the first-visit tip about selecting was seen. */
const TIP_KEY = "uzyra-book-tip";

function readStore(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStore(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage can be blocked; it is only a convenience */
  }
}
const ZOOMS = [1, 1.25, 1.5, 2, 2.5];
const PAGE_STALE_MS = 45 * 60 * 1000; // the picture links last an hour

/** What the circle offers on a book page (the lessons' "common mistake" needs a lesson's rule). */
const BOOK_RING: StudyAction[] = [
  "explain",
  "meaning",
  "word_by_word",
  "why_form",
  "compare_arabic",
  "make_cards",
  "make_mcq",
];

const DISABLED_REASON: Partial<Record<StudyAction, string>> = {
  meaning: "حدّد كلمة أو عبارة قصيرة بالإنجليزي أو الألماني",
  word_by_word: "حدّد جملة أو عبارة عشان نوضح تركيبها",
  why_form: "حدّد كلمة أو صيغة قصيرة داخل الجملة",
  compare_arabic: "حدّد عبارة أو جملة من الصفحة",
};

type Picked = { page: number; quote: string; range: Range | null };
/** An answer in Rita's column, with what is needed to ask again. */
type Answer = BookAnswer & { action: BookTextAction; full: string };

function readSplit(): { rita: number; book: number } | undefined {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SPLIT_KEY) ?? "null") as unknown;
    if (!raw || typeof raw !== "object") return undefined;
    const { rita, book } = raw as Record<string, unknown>;
    if (typeof rita !== "number" || typeof book !== "number") return undefined;
    if (!(rita > 10 && book > 10 && Math.abs(rita + book - 100) < 1)) return undefined;
    return { rita, book };
  } catch {
    return undefined;
  }
}

function useWide(min: number): boolean {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${min}px)`);
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [min]);
  return wide;
}

/** Marks the reader's selection so it stays visible after the browser's own selection goes. */
function markPicked(range: Range | null) {
  const registry = (globalThis as { CSS?: { highlights?: Map<string, unknown> } }).CSS?.highlights;
  const Highlight = (globalThis as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
  if (!registry || !Highlight) return;
  if (range) registry.set("bkr-pick", new Highlight(range));
  else registry.delete("bkr-pick");
}

export function BookReader({
  book,
  userId,
  startPage,
}: {
  book: ReaderBook;
  userId: string;
  startPage: number;
}) {
  const wide = useWide(900);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"book" | "rita">("book");
  const [split] = useState(readSplit);
  const total = Math.max(1, book.pageCount);
  const [page, setPage] = useState(() => clampPage(startPage, total));
  const [zoom, setZoom] = useState(0);
  const [fit, setFit] = useState<"page" | "width">("page");
  useEffect(() => {
    if (readStore(FIT_KEY) === "width") setFit("width");
  }, []);
  const [tip, setTip] = useState(false);
  useEffect(() => setTip(readStore(TIP_KEY) !== "1"), []);
  const [jump, setJump] = useState(String(page));
  const memoryKey = `book:${book.id}`;

  // ---- the page and the next one ---------------------------------------------------------------
  const pageKey = (n: number) => ["book-page", book.id, n] as const;
  const current = useQuery({
    queryKey: pageKey(page),
    queryFn: () => loadReaderPage(book.id, page),
    staleTime: PAGE_STALE_MS,
    gcTime: PAGE_STALE_MS,
    retry: 1,
    // The page on screen stays while the next arrives (no blank flash between pages).
    placeholderData: keepPreviousData,
  });
  const stale = current.isPlaceholderData;
  const lastShape = useRef(1.414);
  if (current.data) lastShape.current = current.data.height / current.data.width;
  useEffect(() => {
    // The next page (and the one before) wait in the background, picture included.
    for (const n of [page + 1, page - 1]) {
      if (n < 1 || n > total) continue;
      void queryClient
        .prefetchQuery({
          queryKey: pageKey(n),
          queryFn: () => loadReaderPage(book.id, n),
          staleTime: PAGE_STALE_MS,
        })
        .then(() => {
          const next = queryClient.getQueryData<ReaderPage>(pageKey(n));
          if (next) {
            const img = new Image();
            img.decoding = "async";
            img.src = next.url;
          }
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, page, total, queryClient]);

  // The place is remembered (for this reader) and kept in the address (for a refresh).
  useEffect(() => {
    setJump(String(page));
    const timer = window.setTimeout(() => {
      void saveReadingPlace(userId, book.id, page);
      void navigate({
        to: "/books/$bookId/read",
        params: { bookId: book.id },
        search: { page },
        replace: true,
      });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [book.id, navigate, page, userId]);

  // ---- sizes -----------------------------------------------------------------------------------
  const scroller = useRef<HTMLDivElement | null>(null);
  const [pane, setPane] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const read = () => setPane({ width: el.clientWidth, height: el.clientHeight });
    const observer = new ResizeObserver(read);
    observer.observe(el);
    read();
    return () => observer.disconnect();
  }, [wide, tab]);
  // Thin margins on a phone, so the page takes the most room it can.
  const gutter = pane.width < 600 ? 8 : 20;
  const roomWidth = Math.max(220, pane.width - gutter * 2);
  const roomHeight = Math.max(220, pane.height - gutter * 2);
  const shape = current.data ? current.data.height / current.data.width : lastShape.current;
  const fitted =
    fit === "page" ? Math.min(roomWidth, roomHeight / shape, 980) : Math.min(roomWidth, 980);
  const pageWidth = Math.round(fitted * ZOOMS[zoom]);

  // ---- the selection ---------------------------------------------------------------------------
  const textLayer = useRef<HTMLDivElement | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const pickedRef = useRef<Picked | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpenRef = useRef(false);
  menuOpenRef.current = menuOpen;
  const pageRef = useRef<ReaderPage | null>(null);
  // The previous page shown while the next arrives is never the one a selection belongs to.
  pageRef.current = stale ? null : (current.data ?? null);

  const keepPicked = useCallback((next: Picked | null) => {
    pickedRef.current = next;
    setPicked(next);
    markPicked(next?.range ?? null);
  }, []);

  useEffect(() => {
    // Saved 120ms after it stops changing, before any menu opens: on a phone the tap on the circle
    // can clear the browser's selection, so the copy must exist first.
    let timer = 0;
    const onChange = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const selection = document.getSelection();
        const layer = textLayer.current;
        const data = pageRef.current;
        if (!selection || selection.isCollapsed || !selection.rangeCount || !layer || !data) {
          if (!menuOpenRef.current && selection?.isCollapsed) keepPicked(null);
          return;
        }
        const range = selection.getRangeAt(0);
        if (!layer.contains(range.commonAncestorContainer)) return;
        const found = pageQuote(selection.toString(), data.text, 0);
        if (!found) return;
        keepPicked({ page: data.page, quote: found.quote, range: range.cloneRange() });
        setTip(false);
        writeStore(TIP_KEY, "1");
      }, 120);
    };
    document.addEventListener("selectionchange", onChange);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("selectionchange", onChange);
      markPicked(null);
    };
  }, [keepPicked]);

  // A new page: the old selection goes with the old page.
  useEffect(() => {
    if (pickedRef.current && pickedRef.current.page !== page) {
      document.getSelection()?.removeAllRanges();
      keepPicked(null);
    }
  }, [keepPicked, page]);

  const kind = picked ? bookSelectionKind(picked.quote) : null;
  const actions: StudyAction[] = kind
    ? availableActions(kind).filter(
        (action) =>
          BOOK_RING.includes(action) &&
          (action !== "meaning" ||
            (/[A-Za-zÀ-ÿ]/.test(picked!.quote) && picked!.quote.length <= MAX_PHRASE_CHARS)),
      )
    : [];

  // ---- the circle ------------------------------------------------------------------------------
  const work = useRef<HTMLDivElement | null>(null);
  const orbButton = useRef<HTMLButtonElement | null>(null);
  const radial = useRef<RadialHandle | null>(null);
  const [orb, setOrb] = useState<OrbPosition>(() => readStudyMemory(memoryKey).orb ?? DEFAULT_ORB);
  const [movingOrb, setMovingOrb] = useState(false);
  const [openedByKey, setOpenedByKey] = useState(false);
  const [ringMode, setRingMode] = useState<"main" | "language">("main");
  const [sound, setSound] = useState(true);
  const explanation = useExplanationLanguage();
  useEffect(() => setSound(soundOn()), []);
  useEffect(() => installSoundUnlock(), []);
  useEffect(() => {
    if (!menuOpen) setRingMode("main");
  }, [menuOpen]);
  const moveOrb = useCallback(
    (next: OrbPosition) => {
      setOrb(next);
      writeStudyMemory(memoryKey, { orb: next });
    },
    [memoryKey],
  );

  // ---- Rita's answers --------------------------------------------------------------------------
  const textFn = useServerFn(bookStudyText);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [phrase, setPhrase] = useState<{ text: string; context: string } | null>(null);

  async function ask(action: BookTextAction, quote: string, onPage: number, replace?: string) {
    const id = crypto.randomUUID();
    const entry: Answer = {
      id,
      action,
      label: actionItem(action).label,
      quote: quote.length > 160 ? `${quote.slice(0, 157)}…` : quote,
      page: onPage,
      state: "loading",
      text: "",
      full: quote,
    };
    setAnswers((list) =>
      replace ? list.map((a) => (a.id === replace ? entry : a)) : [...list, entry].slice(-30),
    );
    if (!wide) setTab("rita");
    const settle = (patch: Partial<BookAnswer>) =>
      setAnswers((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    try {
      const result = await textFn({
        data: {
          bookId: book.id,
          page: onPage,
          requestId: id,
          selection: quote,
          action,
          language: explanation.value,
        },
      });
      if (result.ok) settle({ state: "done", text: result.text });
      else settle({ state: "failed", text: result.message });
    } catch {
      settle({ state: "failed", text: "ما زبطت هالمرة. جرّب مرة ثانية." });
    }
  }

  // ---- flashcards and questions ----------------------------------------------------------------
  const cardsFn = useServerFn(bookMakeCards);
  const mcqFn = useServerFn(bookMakeMcq);
  const [making, setMaking] = useState<PracticeAction | null>(null);
  const [practiceView, setPracticeView] = useState<PracticeView | null>(null);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const lastPractice = useRef<{ action: PracticeAction; quote: string; page: number } | null>(null);
  const practiceVersion = useRef(0);

  async function practice(action: PracticeAction, retry = false) {
    if (making) return;
    const source = retry ? lastPractice.current : picked ? { action, ...picked } : null;
    if (!source) return;
    lastPractice.current = { action, quote: source.quote, page: source.page };
    const version = ++practiceVersion.current;
    const requestId = crypto.randomUUID();
    setMenuOpen(false);
    setPhrase(null);
    setPracticeOpen(true);
    setMaking(action);
    setPracticeView({
      id: requestId,
      action,
      status: "loading",
      cards: [],
      questions: [],
      message: "",
    });
    const input = {
      data: { bookId: book.id, page: source.page, requestId, selection: source.quote },
    };
    try {
      if (action === "make_cards") {
        const result = await cardsFn(input);
        if (version !== practiceVersion.current) return;
        setPracticeView(
          (view) =>
            view &&
            (result.ok
              ? { ...view, status: "ready", cards: result.cards }
              : { ...view, status: "error", message: result.message }),
        );
      } else {
        const result = await mcqFn(input);
        if (version !== practiceVersion.current) return;
        setPracticeView(
          (view) =>
            view &&
            (result.ok
              ? { ...view, status: "ready", questions: result.questions }
              : { ...view, status: "error", message: result.message }),
        );
      }
    } catch {
      if (version === practiceVersion.current)
        setPracticeView(
          (view) =>
            view && { ...view, status: "error", message: "ما زبطت هالمرة. جرّب مرة ثانية." },
        );
    } finally {
      if (version === practiceVersion.current) setMaking(null);
    }
  }

  function ringPick(id: string) {
    if (id === "lang") return setRingMode("language");
    if (id === "lang:back") return setRingMode("main");
    const language = languageFromId(id);
    if (language) {
      explanation.setValue(language);
      setRingMode("main");
      return;
    }
    const action = id as StudyAction;
    const sel = pickedRef.current;
    if (!sel || !actions.includes(action)) return;
    if (action === "make_cards" || action === "make_mcq") return void practice(action);
    if (action === "meaning") {
      const data = pageRef.current;
      setPhrase({
        text: sel.quote,
        context: data ? (pageQuote(sel.quote, data.text, 600)?.context ?? "") : "",
      });
      setMenuOpen(false);
      return;
    }
    if ((BOOK_TEXT_ACTIONS as readonly string[]).includes(action)) {
      setMenuOpen(false);
      setPhrase(null);
      void ask(action as BookTextAction, sel.quote, sel.page);
    }
  }

  const items: RadialItem[] =
    ringMode === "language"
      ? languageItems(explanation.value)
      : BOOK_RING.map((action) => ({
          ...actionItem(action),
          disabled:
            !actions.includes(action) ||
            (Boolean(making) && (action === "make_cards" || action === "make_mcq")),
          disabledReason:
            making && (action === "make_cards" || action === "make_mcq")
              ? "استنّى لحد ما يخلص تجهيز التدريب الحالي"
              : (DISABLED_REASON[action] ?? "حدّد كلمة أو جملة من الصفحة"),
        }));

  const busy = answers.some((a) => a.state === "loading") || Boolean(making);
  const orbState: OrbState = busy ? "busy" : picked ? "armed" : "idle";

  // ---- moving between pages --------------------------------------------------------------------
  const go = useCallback(
    (next: number) => {
      const target = clampPage(next, total);
      setPage(target);
      scroller.current?.scrollTo({ top: 0, left: 0 });
    },
    [total],
  );
  const rtlBook = /^(ar|fa|ur|he)/.test(book.language);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (menuOpenRef.current || event.altKey || event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const forward = rtlBook ? "ArrowLeft" : "ArrowRight";
      const back = rtlBook ? "ArrowRight" : "ArrowLeft";
      if (event.key === forward || event.key === "PageDown") go(page + 1);
      else if (event.key === back || event.key === "PageUp") go(page - 1);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, page, rtlBook]);

  function submitJump(event: FormEvent) {
    event.preventDefault();
    go(Number(jump));
  }

  const failed = current.isError
    ? current.error instanceof Error && current.error.message === "missing_page"
      ? "هاي الصفحة لسا مش جاهزة."
      : "ما قدرت أفتح الصفحة. تأكد من النت."
    : "";

  const fitLabel = fit === "page" ? "على قدّ العرض" : "الصفحة كاملة";
  const PrevIcon = rtlBook ? ChevronRight : ChevronLeft;
  const NextIcon = rtlBook ? ChevronLeft : ChevronRight;
  const bookPane = (
    <div className="bkr-pane" dir="rtl">
      <div
        className="bkr-progress"
        role="progressbar"
        aria-label="وين وصلت بالكتاب"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={page}
      >
        <span style={{ transform: `scaleX(${(page / total).toFixed(4)})` }} />
      </div>
      <div className="relative min-h-0 flex-1">
        {/* The book's own direction, so a zoomed page starts where its lines start. */}
        <div
          ref={scroller}
          className="bkr-scroll"
          dir={rtlBook ? "rtl" : "ltr"}
          style={{ ["--bkr-gutter" as string]: `${gutter}px` }}
        >
          <div className="bkr-stage">
            <BookPageView
              ref={textLayer}
              page={current.data ?? null}
              ratio={lastShape.current}
              width={pageWidth}
              stale={stale}
              loading={current.isPending}
              failed={failed}
              onRetry={() => void current.refetch()}
            />
          </div>
        </div>
        {tip && current.data?.hasText && (
          <div className="bkr-tip" role="note">
            <p>حدّد أي كلمة أو جملة بإصبعك أو بالماوس، وبعدين اكبس على الدائرة.</p>
            <button
              type="button"
              aria-label="سكّر التلميح"
              onClick={() => {
                setTip(false);
                writeStore(TIP_KEY, "1");
              }}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      <nav className="bkr-bar" aria-label="الصفحات">
        <div className="bkr-turn" dir={rtlBook ? "rtl" : "ltr"}>
          <button
            type="button"
            className="bkr-btn"
            disabled={page <= 1}
            onClick={() => go(page - 1)}
            aria-label="الصفحة السابقة"
          >
            <PrevIcon size={18} aria-hidden="true" />
            <span className="bkr-label">السابقة</span>
          </button>
          <form onSubmit={submitJump} className="bkr-jump" dir="rtl">
            <label className="sr-only" htmlFor="bkr-page">
              رقم الصفحة
            </label>
            <span className="bkr-label" aria-hidden="true">
              صفحة
            </span>
            <input
              id="bkr-page"
              inputMode="numeric"
              enterKeyHint="go"
              value={jump}
              onChange={(event) => setJump(event.target.value.replace(/\D/g, "").slice(0, 4))}
              onFocus={(event) => event.target.select()}
              onBlur={() => setJump(String(page))}
            />
            <span>من {total}</span>
          </form>
          <button
            type="button"
            className="bkr-btn is-primary"
            disabled={page >= total}
            onClick={() => go(page + 1)}
            aria-label="الصفحة التالية"
          >
            <span className="bkr-label">التالية</span>
            <NextIcon size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="bkr-tools" role="group" aria-label="حجم الصفحة">
          <button
            type="button"
            className="bkr-icon"
            aria-label={fitLabel}
            title={fitLabel}
            onClick={() => {
              const next = fit === "page" ? "width" : "page";
              setFit(next);
              setZoom(0);
              writeStore(FIT_KEY, next);
            }}
          >
            {fit === "page" ? (
              <MoveHorizontal size={17} aria-hidden="true" />
            ) : (
              <Maximize2 size={16} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            className="bkr-icon"
            aria-label="صغّر"
            title="صغّر"
            disabled={zoom === 0}
            onClick={() => setZoom((z) => Math.max(0, z - 1))}
          >
            <ZoomOut size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="bkr-icon"
            aria-label="كبّر"
            title="كبّر"
            disabled={zoom === ZOOMS.length - 1}
            onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))}
          >
            <ZoomIn size={17} aria-hidden="true" />
          </button>
        </div>
      </nav>
    </div>
  );

  const hint = "حدّد كلمة أو جملة من الصفحة، وبعدين اكبس على الدائرة.";
  const ritaPane = (
    <div className="flex h-full min-h-0 flex-col bg-white" dir="rtl">
      <BookRitaColumn
        answers={answers}
        hint={hint}
        onRetry={(answer) => {
          const found = answers.find((a) => a.id === answer.id);
          if (found) void ask(found.action, found.full, found.page, found.id);
        }}
      />
    </div>
  );

  const meta = useMemo(
    () =>
      [`صفحة ${picked?.page ?? page}`, kind ? KIND_LABEL[kind] : ""].filter(Boolean).join(" · "),
    [kind, page, picked?.page],
  );

  return (
    <div className="edith-premium flex h-[100dvh] flex-col bg-white text-[var(--pp-ink)]" dir="rtl">
      <header className="st-top">
        <Link to="/books" className="st-top-btn" aria-label="رجوع للمكتبة">
          <ArrowRight size={15} aria-hidden="true" />
          <span className="hidden sm:inline">المكتبة</span>
        </Link>
        <h1 className="sr-only">{book.title}</h1>
        {/* The design makes every h1 a 48px display title, so the visible name is a small line. */}
        <p className="bkr-title" dir="auto" aria-hidden="true">
          {book.title}
        </p>
        {practiceView && (
          <button
            type="button"
            className="st-top-btn is-soft !h-11"
            onClick={() => setPracticeOpen(true)}
          >
            {making ? "جاري تجهيز التدريب…" : "آخر تدريب"}
          </button>
        )}
      </header>

      <div ref={work} className="st-work relative flex min-h-0 flex-1 flex-col">
        {wide ? (
          <Group
            orientation="horizontal"
            dir="ltr"
            className="st-split min-h-0 flex-1"
            defaultLayout={split}
            resizeTargetMinimumSize={{ coarse: 40, fine: 16 }}
            onLayoutChanged={(layout) => {
              try {
                window.localStorage.setItem(SPLIT_KEY, JSON.stringify(layout));
              } catch {
                /* storage can be blocked; the divider still works */
              }
            }}
          >
            <Panel id="rita" defaultSize="40" minSize={300}>
              {ritaPane}
            </Panel>
            <Separator className="st-divider" aria-label="غيّر عرض الكتاب وريتا">
              <span className="st-grip" aria-hidden="true" />
            </Separator>
            <Panel id="book" defaultSize="60" minSize={340}>
              {bookPane}
            </Panel>
          </Group>
        ) : (
          <>
            <div
              role="tablist"
              aria-label="الكتاب وريتا"
              className="flex border-b border-[var(--pp-line)]"
            >
              {(
                [
                  ["book", "الكتاب"],
                  ["rita", busy ? "ريتا بتكتب…" : "ريتا"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  onClick={() => setTab(value)}
                  className={`h-11 flex-1 text-[15px] font-semibold ${
                    tab === value
                      ? "border-b-2 border-[var(--pp-accent)] text-[var(--pp-ink)]"
                      : "text-[var(--pp-muted)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Both stay mounted so the reading place and the answers are kept. */}
            <div className={`min-h-0 flex-1 ${tab === "book" ? "" : "hidden"}`}>{bookPane}</div>
            <div className={`min-h-0 flex-1 ${tab === "rita" ? "" : "hidden"}`}>{ritaPane}</div>
          </>
        )}
        <FloatingOrb
          ref={orbButton}
          state={orbState}
          position={orb}
          onMove={moveOrb}
          open={menuOpen}
          onPress={(viaKey) => {
            setPhrase(null);
            setOpenedByKey(viaKey);
            setMenuOpen((open) => !open);
          }}
          onHoldStart={() => {
            setPhrase(null);
            setOpenedByKey(false);
            setMenuOpen(true);
          }}
          onHoldMove={(x, y) => radial.current?.hover(x, y)}
          onHoldEnd={(x, y) => radial.current?.release(x, y)}
          moving={movingOrb}
          onStopMoving={() => setMovingOrb(false)}
          label={picked ? "شو بدك نعمل بالتحديد؟" : "حدّد جزء من الصفحة"}
        />
        <RadialMenu
          ref={radial}
          open={menuOpen}
          containerRef={work}
          orbRef={orbButton}
          orbKey={`${orb.x.toFixed(3)},${orb.y.toFixed(3)},${wide ? "w" : "n"},${tab}`}
          items={items}
          quote={picked?.quote ?? ""}
          meta={meta}
          hasSelection={Boolean(picked) && ringMode === "main"}
          selectionHint={
            ringMode !== "main" || !kind
              ? undefined
              : kind === "word"
                ? "لتفكيك التركيب، حدّد جملة أو عبارة."
                : kind === "sentence"
                  ? "للمعنى أو سبب الصيغة، حدّد كلمة أو عبارة داخل الجملة."
                  : undefined
          }
          hint={
            ringMode === "language" ? `ريتا بتشرح بـ: ${LANGUAGE_NAMES[explanation.value]}` : hint
          }
          canReport={false}
          onLanguage={ringMode === "main" ? () => setRingMode("language") : undefined}
          busy={false}
          sound={sound}
          autoFocus={openedByKey}
          onToggleSound={() => {
            setSoundOn(!sound);
            setSound(!sound);
          }}
          onPick={ringPick}
          onReport={() => undefined}
          onClear={() => {
            document.getSelection()?.removeAllRanges();
            keepPicked(null);
          }}
          onMoveOrb={() => {
            setMenuOpen(false);
            setMovingOrb(true);
          }}
          onPinOrb={() => moveOrb(snapToEdge(orb))}
          onResetOrb={() => moveOrb(DEFAULT_ORB)}
          onClose={() => setMenuOpen(false)}
        />
        {movingOrb && (
          <p
            role="status"
            className="absolute inset-x-3 top-3 z-30 rounded-xl bg-[var(--pp-ink)] px-3 py-2 text-center text-[13px] text-white"
          >
            حرّك الدائرة بالأسهم (Shift أسرع)، وEnter أو Esc لما تخلص.
          </p>
        )}
        {phrase && (
          <PhraseDialog
            key={JSON.stringify(phrase)}
            phrase={phrase.text}
            context={phrase.context}
            compact
            onClose={() => {
              setPhrase(null);
              orbButton.current?.focus({ preventScroll: true });
            }}
          />
        )}
        {practiceView && (
          <StudyPracticePanel
            key={practiceView.id}
            view={practiceView}
            open={practiceOpen}
            onOpenChange={setPracticeOpen}
            onRetry={() => {
              if (lastPractice.current) void practice(lastPractice.current.action, true);
            }}
            onReturnFocus={() => orbButton.current?.focus({ preventScroll: true })}
          />
        )}
      </div>
    </div>
  );
}
```

## `src/components/books/reader/BookPageView.tsx`

```tsx
// One book page: its picture, and over it the page's words in see-through text, each piece where
// it sits on the picture, so the reader selects real text (the way pdf.js lays its text layer).
// Sizes are parts of the page box (container units), so zooming or turning the tablet needs no
// work. Each piece is stretched to the width of its words on the picture, measured once per page
// with the browser's own layout (so Safari and Chrome both line up).
import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import type { ReaderPage } from "@/lib/book-reader-data";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export const BookPageView = forwardRef<
  HTMLDivElement,
  {
    page: ReaderPage | null;
    /** The page's shape while it loads (from the previous page). */
    ratio: number;
    width: number;
    /** The page shown is the previous one, kept while the next arrives. */
    stale: boolean;
    loading: boolean;
    failed: string;
    onRetry: () => void;
  }
>(function BookPageView({ page, ratio, width, stale, loading, failed, onRetry }, textRef) {
  const [shown, setShown] = useState("");
  // The last picture that finished loading stays under the next one until it is in.
  const [under, setUnder] = useState<{ url: string; ratio: number } | null>(null);
  const layer = useRef<HTMLDivElement | null>(null);
  const pageRatio = page ? page.height / page.width : ratio;
  const height = width * pageRatio;

  const pieces = useMemo(
    () =>
      page
        ? page.runs.map(([text, left, top, w, h], index) => ({ key: index, text, left, top, w, h }))
        : [],
    [page],
  );

  // Each piece's natural width at this size, then the stretch that makes it cover its words. The
  // stretch does not change with zoom (the font grows with the page), so this runs once per page.
  useIsoLayoutEffect(() => {
    const el = layer.current;
    if (!el || !page || !width) return;
    const spans = Array.from(el.children).filter(
      (child): child is HTMLSpanElement => child.tagName === "SPAN",
    );
    for (const span of spans) span.style.transform = "";
    const boxWidth = el.getBoundingClientRect().width;
    const natural = spans.map((span) => span.getBoundingClientRect().width);
    spans.forEach((span, index) => {
      const target = (pieces[index]?.w ?? 0) * boxWidth;
      const stretch = natural[index] > 0 && target > 0 ? target / natural[index] : 1;
      span.style.transform = `scaleX(${stretch.toFixed(4)})`;
    });
    // Measured at one width only; a later zoom keeps the same stretch.
  }, [page, pieces]);

  // While selecting, a blank layer under the words keeps the selection from jumping when the
  // pointer crosses the gaps between lines (pdf.js' "endOfContent").
  useEffect(() => {
    const el = layer.current;
    if (!el) return;
    const start = () => el.classList.add("is-selecting");
    const stop = () => {
      const selection = document.getSelection();
      if (!selection || selection.isCollapsed || !el.contains(selection.anchorNode))
        el.classList.remove("is-selecting");
      else window.setTimeout(() => el.classList.remove("is-selecting"), 0);
    };
    const onChange = () => {
      const selection = document.getSelection();
      if (selection && !selection.isCollapsed && el.contains(selection.anchorNode)) start();
    };
    el.addEventListener("pointerdown", start);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    document.addEventListener("selectionchange", onChange);
    return () => {
      el.removeEventListener("pointerdown", start);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      document.removeEventListener("selectionchange", onChange);
    };
  }, [page]);

  const ready = Boolean(page && shown === page.url);
  const keepUnder =
    under && page && under.url !== page.url && Math.abs(under.ratio - pageRatio) < 0.02;

  return (
    <div
      className="bkr-page"
      style={{ width, height }}
      data-loaded={ready ? "" : undefined}
      data-stale={stale ? "" : undefined}
    >
      {keepUnder && (
        <img src={under.url} alt="" className="bkr-picture is-under" draggable={false} />
      )}
      {page && (
        <img
          key={page.url}
          src={page.url}
          alt=""
          className="bkr-picture"
          decoding="async"
          draggable={false}
          onLoad={() => {
            setShown(page.url);
            setUnder({ url: page.url, ratio: pageRatio });
          }}
        />
      )}
      {page && (
        <div
          ref={(node) => {
            layer.current = node;
            if (typeof textRef === "function") textRef(node);
            else if (textRef) textRef.current = node;
          }}
          className="bkr-text"
          dir="ltr"
          lang="und"
          data-book-text=""
        >
          {pieces.map((piece) => (
            <span
              key={piece.key}
              style={{
                left: `${piece.left * 100}%`,
                top: `${piece.top * 100}%`,
                fontSize: `${piece.h * 100}cqh`,
              }}
            >
              {piece.text}
            </span>
          ))}
          <div className="bkr-end" />
        </div>
      )}
      {page && !page.hasText && ready && <p className="bkr-badge">صفحة صورة بدون نص، ما بتنحدد</p>}
      {((loading && !keepUnder) || (page && !ready && !keepUnder) || stale) && !failed && (
        <div className="bkr-wait" role="status" aria-label="جاري تحميل الصفحة">
          <Loader2 size={20} className="animate-spin" aria-hidden="true" />
        </div>
      )}
      {failed && (
        <div className="bkr-wait is-failed" role="alert">
          <ImageOff size={22} aria-hidden="true" />
          <p>{failed}</p>
          <button type="button" className="rita-btn rita-btn-soft rita-btn-sm" onClick={onRetry}>
            جرّب مرة ثانية
          </button>
        </div>
      )}
    </div>
  );
});
```

## `src/components/books/reader/book-reader.css`

```css
/* The book reader (src/components/books/reader). The page sits on the study page's grey as one
   sheet of paper, fit whole into the pane by default; a hairline under the top bar shows how far
   into the book the reader is; the bar under the page turns pages and sizes the page. */

.bkr-title {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bkr-pane {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: #f4f4f8;
}

/* How far into the book: a 3px accent line growing from the reading side. */
.bkr-progress {
  flex: none;
  height: 3px;
  background: rgb(14 17 22 / 0.06);
}
.bkr-progress span {
  display: block;
  height: 100%;
  background: var(--pp-accent);
  transform-origin: right center;
  transition: transform 240ms cubic-bezier(0.23, 1, 0.32, 1);
}

.bkr-scroll {
  position: absolute;
  inset: 0;
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.bkr-stage {
  display: flex;
  min-width: min-content;
  min-height: 100%;
  align-items: flex-start;
  justify-content: center;
  padding: var(--bkr-gutter, 20px);
}

.bkr-page {
  position: relative;
  flex: none;
  overflow: hidden;
  border-radius: 4px;
  background: #fff;
  box-shadow:
    0 0 0 1px rgb(14 17 22 / 0.05),
    0 2px 6px rgb(14 17 22 / 0.05),
    0 18px 40px -12px rgb(14 17 22 / 0.18);
  container-type: size;
}

.bkr-picture {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  transition: opacity 180ms cubic-bezier(0.23, 1, 0.32, 1);
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  pointer-events: none;
}
.bkr-page[data-loaded] .bkr-picture,
.bkr-picture.is-under {
  opacity: 1;
}
/* The previous page, kept while the next arrives, is dimmed a little. */
.bkr-page[data-stale] .bkr-picture {
  opacity: 0.55;
}
.bkr-page[data-stale] .bkr-text {
  pointer-events: none;
}

/* The page's words, see-through, each piece where it sits on the picture (as pdf.js does). */
.bkr-text {
  position: absolute;
  inset: 0;
  z-index: 1;
  overflow: hidden;
  line-height: 1;
  text-align: initial;
  forced-color-adjust: none;
  -webkit-text-size-adjust: none;
  text-size-adjust: none;
  -webkit-touch-callout: default;
}
.bkr-text span {
  position: absolute;
  color: transparent;
  font-family: sans-serif;
  white-space: pre;
  cursor: text;
  transform-origin: 0 0;
  user-select: text;
  -webkit-user-select: text;
}
.bkr-text span::selection {
  background: rgb(43 109 240 / 0.3);
  color: transparent;
}
/* Under the words: catches the pointer between lines while selecting, so the selection follows
   the text instead of jumping (pdf.js' endOfContent). */
.bkr-end {
  position: absolute;
  inset: 100% 0 0;
  z-index: -1;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
}
.bkr-text.is-selecting .bkr-end {
  top: 0;
}
::highlight(bkr-pick) {
  background-color: rgb(43 109 240 / 0.24);
  color: transparent;
}

.bkr-wait {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 10px;
  padding: 16px;
  color: var(--pp-muted);
  text-align: center;
  font-size: 14px;
  pointer-events: none;
}
.bkr-wait.is-failed {
  background: #fff;
  color: #8c1a31;
  pointer-events: auto;
}

/* A picture-only page says so in a small pill at its top. */
.bkr-badge {
  position: absolute;
  inset-inline: 0;
  top: 10px;
  z-index: 2;
  width: max-content;
  max-width: calc(100% - 20px);
  margin: 0 auto;
  padding: 5px 12px;
  border-radius: 999px;
  background: rgb(14 17 22 / 0.78);
  color: #fff;
  font-size: 12.5px;
  pointer-events: none;
}

/* The first-visit tip: a dark pill floating at the top of the page area (the circle sits low). */
.bkr-tip {
  position: absolute;
  inset-inline: 12px;
  top: 12px;
  z-index: 3;
  display: flex;
  width: fit-content;
  max-width: min(460px, calc(100% - 24px));
  align-items: center;
  gap: 8px;
  margin-inline: auto;
  padding: 8px 8px 8px 14px;
  border-radius: 14px;
  background: var(--pp-ink);
  color: #fff;
  font-size: 13.5px;
  line-height: 1.45;
  box-shadow: 0 10px 30px -10px rgb(14 17 22 / 0.45);
}
.bkr-tip p {
  margin: 0;
}
.bkr-tip button {
  display: grid;
  flex: none;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 10px;
  color: rgb(255 255 255 / 0.8);
}
.bkr-tip button:focus-visible {
  outline: 2px solid #fff;
}

/* The bar under the page. */
.bkr-bar {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px max(8px, env(safe-area-inset-bottom));
  border-top: 1px solid var(--pp-line);
  background: #fff;
  container-type: inline-size;
}
.bkr-turn,
.bkr-tools {
  display: flex;
  align-items: center;
  gap: 6px;
}
.bkr-btn {
  display: inline-flex;
  height: 44px;
  min-width: 44px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding-inline: 12px;
  border: 1px solid var(--pp-line);
  border-radius: 12px;
  background: #fff;
  color: var(--pp-ink);
  font-size: 14px;
  font-weight: 600;
  transition:
    background-color 120ms ease,
    transform 100ms ease-out;
}
.bkr-btn.is-primary {
  border-color: var(--pp-ink);
  background: var(--pp-ink);
  color: #fff;
}
.bkr-btn:disabled {
  opacity: 0.35;
}
.bkr-btn:active:not(:disabled) {
  transform: scale(0.97);
}
.bkr-icon {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: 12px;
  color: var(--pp-ink);
  transition: background-color 120ms ease;
}
.bkr-icon:disabled {
  opacity: 0.35;
}
.bkr-icon:active:not(:disabled) {
  background: var(--pp-grey);
}
@media (hover: hover) and (pointer: fine) {
  .bkr-icon:hover:not(:disabled),
  .bkr-btn:not(.is-primary):hover:not(:disabled) {
    background: var(--pp-grey);
  }
  .bkr-btn.is-primary:hover:not(:disabled) {
    background: #262a33;
  }
}
.bkr-btn:focus-visible,
.bkr-icon:focus-visible {
  outline: 2px solid var(--pp-accent);
  outline-offset: 2px;
}
.bkr-jump {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-inline: 4px;
  color: var(--pp-muted);
  font-size: 14px;
  white-space: nowrap;
}
.bkr-jump input {
  width: 4.4ch;
  height: 40px;
  border: 1.5px solid var(--pp-line);
  border-radius: 10px;
  color: var(--pp-ink);
  /* 16px stops iPhone Safari from zooming the page when the field is tapped. */
  font-size: 16px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  text-align: center;
  outline: none;
}
.bkr-jump input:focus-visible {
  border-color: var(--pp-accent);
}
/* A narrow bar: the buttons keep their icons, the words go. */
@container (max-width: 520px) {
  .bkr-label {
    display: none;
  }
  .bkr-btn {
    padding-inline: 0;
    width: 44px;
  }
  .bkr-tools {
    gap: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bkr-picture,
  .bkr-progress span,
  .bkr-btn {
    transition: none;
  }
}
```

## `src/lib/book-reader-data.ts`

```ts
// What the book reader reads, with the reader's own session (row-level security lets signed-in
// readers see prepared pages of published books only). Page pictures come from the private
// book-pages bucket through signed links made for this reader, an hour at a time.
import { supabase } from "@/integrations/supabase/legacy-client";
import { readRuns, type PageRun } from "@/lib/books-reader";

export type ReaderBook = {
  id: string;
  title: string;
  author: string;
  language: string;
  pageCount: number;
  prepared: boolean;
  filePath: string | null;
};

export type ReaderPage = {
  page: number;
  width: number;
  height: number;
  text: string;
  runs: PageRun[];
  hasText: boolean;
  url: string;
};

const LINK_SECONDS = 3600;

/** The book, or null when it is not there for this reader (not published, or no such book). */
export async function loadReaderBook(bookId: string): Promise<ReaderBook | null> {
  const { data, error } = await supabase
    .from("books")
    .select("id, title, author, language, page_count, prepared_at, file_path")
    .eq("id", bookId)
    .maybeSingle();
  if (error) {
    // Before the reader migration there are no prepared books.
    if (/42703|does not exist|schema cache/i.test(`${error.code ?? ""} ${error.message}`)) {
      const { data: old } = await supabase
        .from("books")
        .select("id, title, author, language, file_path")
        .eq("id", bookId)
        .maybeSingle();
      return old
        ? {
            id: String(old.id),
            title: String(old.title ?? ""),
            author: String(old.author ?? ""),
            language: String(old.language ?? "en"),
            pageCount: 0,
            prepared: false,
            filePath: (old.file_path as string | null) ?? null,
          }
        : null;
    }
    throw new Error(error.message);
  }
  if (!data) return null;
  return {
    id: String(data.id),
    title: String(data.title ?? ""),
    author: String(data.author ?? ""),
    language: String(data.language ?? "en"),
    pageCount: Number(data.page_count) || 0,
    prepared: Boolean(data.prepared_at),
    filePath: (data.file_path as string | null) ?? null,
  };
}

/** One page: its size, words and a signed link to its picture. */
export async function loadReaderPage(bookId: string, page: number): Promise<ReaderPage> {
  const { data, error } = await supabase
    .from("book_pages")
    .select("page, width, height, image_path, text, runs, has_text")
    .eq("book_id", bookId)
    .eq("page", page)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("missing_page");
  const { data: link, error: linkError } = await supabase.storage
    .from("book-pages")
    .createSignedUrl(String(data.image_path), LINK_SECONDS);
  if (linkError || !link?.signedUrl) throw new Error(linkError?.message ?? "no_link");
  return {
    page: Number(data.page),
    width: Number(data.width),
    height: Number(data.height),
    text: String(data.text ?? ""),
    runs: readRuns(data.runs),
    hasText: Boolean(data.has_text),
    url: link.signedUrl,
  };
}

/** The page this reader stopped at, or null. */
export async function loadReadingPlace(bookId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("book_reading_progress")
    .select("page")
    .eq("book_id", bookId)
    .maybeSingle();
  if (error || !data) return null;
  return Number(data.page) || null;
}

/** Remembers the page (one row per reader and book). Failures are quiet: reading goes on. */
export async function saveReadingPlace(userId: string, bookId: string, page: number) {
  await supabase
    .from("book_reading_progress")
    .upsert(
      { user_id: userId, book_id: bookId, page, updated_at: new Date().toISOString() },
      { onConflict: "user_id,book_id" },
    );
}
```

## `src/lib/book-prepare.ts`

```ts
// Preparing a library book for reading (admins only, in their own browser; nothing runs on a
// timer or on the server). The PDF is opened in parts (see openPdfInParts), and page by page:
// drawn to a light picture (WebP, or JPEG where the browser cannot make WebP), its words read with
// their places (books-reader.ts), the picture uploaded to "book-pages/<book>/<page>.<ext>" and the
// page's row written to book_pages. Stopping and starting again picks up the missing pages. When
// every page is in, books.prepared_at is set and readers can open the book.
//
// The job lives in this module (not in a dialog), so closing the editor does not stop it, and any
// screen showing the book sees its progress (usePrepareJob).
import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/legacy-client";
import {
  PAGE_IMAGE_WIDTH,
  PAGE_LIMITS,
  missingPages,
  pageImagePath,
  pageTextFromItems,
} from "@/lib/books-reader";

export const PAGES_BUCKET = "book-pages";
const MAX_PICTURE_BYTES = 4.5 * 1024 * 1024;
const NOT_APPLIED = /could not find|does not exist|schema cache|PGRST20[0-9]|42883|42P01|42703/i;

export type ReaderState = {
  pageCount: number | null;
  preparedAt: string | null;
  /** Pages already written (only counted while preparing is unfinished). */
  done: number;
};

/** Each book's reader state, or null when the reader migration is not in the database yet. */
export async function loadReaderStates(): Promise<Map<string, ReaderState> | null> {
  const { data, error } = await supabase.from("books").select("id, page_count, prepared_at");
  if (error) {
    if (NOT_APPLIED.test(`${error.code ?? ""} ${error.message ?? ""}`)) return null;
    throw new Error(error.message);
  }
  const map = new Map<string, ReaderState>();
  for (const row of (data ?? []) as {
    id: string;
    page_count: number | null;
    prepared_at: string | null;
  }[])
    map.set(row.id, { pageCount: row.page_count, preparedAt: row.prepared_at, done: 0 });
  const unfinished = [...map].filter(([, s]) => s.pageCount && !s.preparedAt).map(([id]) => id);
  if (unfinished.length) {
    const counts = await Promise.all(
      unfinished.map((id) =>
        supabase
          .from("book_pages")
          .select("page", { count: "exact", head: true })
          .eq("book_id", id),
      ),
    );
    unfinished.forEach((id, i) => {
      const state = map.get(id);
      if (state) state.done = counts[i].count ?? 0;
    });
  }
  return map;
}

export type PrepareJob = {
  bookId: string;
  stage: "opening" | "pages" | "finishing" | "done" | "stopped" | "failed";
  done: number;
  total: number;
  /** Pages with no words (scanned pictures): shown as pictures only. */
  scanned: number;
  message: string;
};

// ---- the job store -----------------------------------------------------------------------------

const jobs = new Map<string, PrepareJob>();
const stops = new Map<string, AbortController>();
const listeners = new Set<() => void>();
let snapshot: ReadonlyMap<string, PrepareJob> = new Map();

function publish(job: PrepareJob) {
  jobs.set(job.bookId, job);
  snapshot = new Map(jobs);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Every job this visit started (running or finished). */
export function usePrepareJobs(): ReadonlyMap<string, PrepareJob> {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}

export function isRunning(job: PrepareJob | undefined): boolean {
  return Boolean(
    job && (job.stage === "opening" || job.stage === "pages" || job.stage === "finishing"),
  );
}

/** Asks a running job to stop after the page it is on. */
export function stopPreparing(bookId: string) {
  stops.get(bookId)?.abort();
}

// ---- drawing one page ---------------------------------------------------------------------------

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** The page as a picture (WebP where the browser can make it, JPEG otherwise) and its words. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function drawPage(doc: any, pageNumber: number) {
  const page = await doc.getPage(pageNumber);
  try {
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(4, Math.max(0.5, PAGE_IMAGE_WIDTH / base.width));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot draw the pages.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    let picture: Blob | null = null;
    let type: "webp" | "jpeg" = "webp";
    for (const quality of [0.8, 0.65, 0.5]) {
      const webp = await toBlob(canvas, "image/webp", quality);
      if (!webp || webp.type !== "image/webp") break; // Safari makes PNG instead: use JPEG
      if (webp.size <= MAX_PICTURE_BYTES) {
        picture = webp;
        break;
      }
    }
    if (!picture) {
      type = "jpeg";
      for (const quality of [0.82, 0.65, 0.5, 0.35]) {
        const jpeg = await toBlob(canvas, "image/jpeg", quality);
        if (jpeg && jpeg.type === "image/jpeg" && jpeg.size <= MAX_PICTURE_BYTES) {
          picture = jpeg;
          break;
        }
      }
    }
    const width = canvas.width;
    const height = canvas.height;
    canvas.width = 0; // let the browser free the memory now
    canvas.height = 0;
    if (!picture) throw new Error(`Page ${pageNumber} could not be turned into a picture.`);

    const content = await page.getTextContent({ includeMarkedContent: false });
    const words = pageTextFromItems(content.items ?? [], viewport);
    return { picture, type, width, height, ...words };
  } finally {
    page.cleanup?.();
  }
}

// ---- the job -------------------------------------------------------------------------------------

async function clearPages(bookId: string) {
  const { error } = await supabase.from("book_pages").delete().eq("book_id", bookId);
  if (error) throw new Error(error.message);
  // The pictures: listed and removed a thousand at a time.
  for (;;) {
    const { data, error: listError } = await supabase.storage
      .from(PAGES_BUCKET)
      .list(bookId, { limit: 1000 });
    if (listError || !data?.length) return;
    const { error: removeError } = await supabase.storage
      .from(PAGES_BUCKET)
      .remove(data.map((item) => `${bookId}/${item.name}`));
    if (removeError) return;
  }
}

/**
 * Prepares (or finishes preparing) a book. `file` is the PDF on this device when the admin has it
 * (opened in parts, nothing downloaded); otherwise the saved PDF is read through a signed link.
 * With `again`, the old pages are removed first.
 */
export async function prepareBook(options: {
  bookId: string;
  filePath: string;
  file?: File | null;
  again?: boolean;
}): Promise<PrepareJob> {
  const { bookId } = options;
  if (isRunning(jobs.get(bookId))) return jobs.get(bookId)!;
  const stop = new AbortController();
  stops.set(bookId, stop);
  let job: PrepareJob = { bookId, stage: "opening", done: 0, total: 0, scanned: 0, message: "" };
  const update = (patch: Partial<PrepareJob>) => {
    job = { ...job, ...patch };
    publish(job);
  };
  update({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let doc: any = null;
  try {
    const { openPdfInParts } = await import("@/lib/pdf-page-render");
    let source: File | string;
    if (options.file) source = options.file;
    else {
      const { data, error } = await supabase.storage
        .from("book-files")
        .createSignedUrl(options.filePath, 3600);
      if (error || !data?.signedUrl) throw new Error("ما قدرت أفتح ملف الكتاب.");
      source = data.signedUrl;
    }
    doc = await openPdfInParts(source);
    const total = Math.min(Number(doc.numPages) || 0, PAGE_LIMITS.pages);
    if (!total) throw new Error("الملف ما فيه صفحات.");

    const { data: book, error: bookError } = await supabase
      .from("books")
      .select("page_count, prepared_at, file_path")
      .eq("id", bookId)
      .single();
    if (bookError) throw new Error(bookError.message);
    if (book.file_path !== options.filePath)
      throw new Error("تغيّر ملف الكتاب. افتح المحرر مرة ثانية.");
    const fresh = options.again || book.page_count !== total;
    if (fresh) await clearPages(bookId);
    const { error: startError } = await supabase
      .from("books")
      .update({ page_count: total, prepared_at: null })
      .eq("id", bookId);
    if (startError) throw new Error(startError.message);

    const { data: have } = fresh
      ? { data: [] as { page: number; has_text: boolean }[] }
      : await supabase.from("book_pages").select("page, has_text").eq("book_id", bookId);
    const doneRows = (have ?? []) as { page: number; has_text: boolean }[];
    const todo = missingPages(
      total,
      doneRows.map((row) => row.page),
    );
    update({
      stage: "pages",
      total,
      done: total - todo.length,
      scanned: doneRows.filter((row) => !row.has_text).length,
    });

    // Draw the next page while the last one uploads (at most two uploads at once).
    const uploads = new Set<Promise<void>>();
    let failure: unknown = null;
    for (const pageNumber of todo) {
      if (stop.signal.aborted || failure) break;
      const drawn = await drawPage(doc, pageNumber);
      const path = pageImagePath(bookId, pageNumber, drawn.type);
      const upload = (async () => {
        const { error: uploadError } = await supabase.storage
          .from(PAGES_BUCKET)
          .upload(path, drawn.picture, {
            upsert: true,
            contentType: drawn.type === "webp" ? "image/webp" : "image/jpeg",
            cacheControl: "31536000",
          });
        if (uploadError) throw new Error(uploadError.message);
        const { error: rowError } = await supabase.from("book_pages").upsert({
          book_id: bookId,
          page: pageNumber,
          width: drawn.width,
          height: drawn.height,
          image_path: path,
          text: drawn.text,
          runs: drawn.runs,
        });
        if (rowError) throw new Error(rowError.message);
        update({ done: job.done + 1, scanned: job.scanned + (drawn.text ? 0 : 1) });
      })().catch((error) => {
        failure = failure ?? error;
      });
      uploads.add(upload);
      void upload.finally(() => uploads.delete(upload));
      if (uploads.size >= 2) await Promise.race(uploads);
    }
    await Promise.all(uploads);
    if (failure) throw failure;
    if (stop.signal.aborted) {
      update({ stage: "stopped", message: "وقّفنا. اكبس «كمّل التجهيز» لتكمّل من وين وقفت." });
      return job;
    }

    update({ stage: "finishing" });
    const { error: doneError } = await supabase
      .from("books")
      .update({ prepared_at: new Date().toISOString() })
      .eq("id", bookId);
    if (doneError) throw new Error(doneError.message);
    update({ stage: "done", message: "" });
    return job;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    update({
      stage: "failed",
      message: NOT_APPLIED.test(message)
        ? "القراءة داخل الموقع بتشتغل بعد تطبيق ملف قاعدة البيانات الجديد."
        : message.slice(0, 300) || "ما زبط التجهيز. جرّب مرة ثانية.",
    });
    return job;
  } finally {
    stops.delete(bookId);
    try {
      await doc?.destroy?.();
    } catch {
      /* already gone */
    }
  }
}
```

## `src/lib/books-reader.ts`

```ts
// The book reader's pure parts, shared by the admin's preparation (browser), the reader (browser)
// and the server's checks. Tested with node (books-reader.test.ts).
//
// A prepared page is a picture plus its words: every piece of text pdf.js finds, with where it sits
// on the page as parts of the page's width and height (0 to 1), so the reader can lay the words over
// the picture at any size. The page's text is those pieces in the same order, which is also the
// order the browser reads them back when the reader selects across several of them.
import { MAX_SELECTION_CHARS } from "./study/study-limits.ts";
import type { SelectionKind } from "./study/study-actions.ts";

/** [text, left, top, width, height]; the four numbers are parts of the page (0 to 1). */
export type PageRun = [string, number, number, number, number];

/** The parts of a pdf.js text item that are used here. */
export type TextItemLike = {
  str?: string;
  transform?: number[];
  width?: number;
  hasEOL?: boolean;
};

/** The parts of a pdf.js viewport that are used here. */
export type ViewportLike = { width: number; height: number; scale: number; transform: number[] };

export const PAGE_LIMITS = { text: 60000, runs: 4000, pages: 5000 } as const;
/** The picture's width in pixels: sharp on a tablet at full width, ~100–250 KB as WebP. */
export const PAGE_IMAGE_WIDTH = 1400;
/** How far around the selection the page's text is given to Rita as context. */
export const BOOK_CONTEXT_CHARS = 2400;

/** pdf.js' Util.transform: the product of two [a, b, c, d, e, f] matrices. */
function multiply(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

const round = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 100000) / 100000;

/**
 * The page's words and their places, from pdf.js' getTextContent() items and the viewport the
 * page is drawn with. Turned (rotated) text is left out of both, so the text always matches what
 * the reader can select.
 */
export function pageTextFromItems(
  items: TextItemLike[],
  viewport: ViewportLike,
): { text: string; runs: PageRun[] } {
  const runs: PageRun[] = [];
  const parts: string[] = [];
  let length = 0;
  for (const item of items) {
    const str = String(item.str ?? "").replace(/\s+/g, " ");
    if (!str.trim()) {
      if (item.hasEOL && parts.length) parts.push("\n");
      continue;
    }
    if (!Array.isArray(item.transform) || item.transform.length < 6) continue;
    const tx = multiply(viewport.transform, item.transform);
    // Only text that runs left to right on the page (no turned or vertical text).
    if (Math.abs(tx[1]) > 0.01 * Math.abs(tx[0]) || tx[0] <= 0) continue;
    const fontHeight = Math.hypot(tx[2], tx[3]);
    const width = Math.max(0, Number(item.width ?? 0)) * viewport.scale;
    if (!fontHeight || !width) continue;
    if (runs.length >= PAGE_LIMITS.runs || length + str.length > PAGE_LIMITS.text) break;
    // The baseline is at tx[5]; most fonts rise about 0.8 of their size above it (as pdf.js does).
    const top = tx[5] - fontHeight * 0.8;
    runs.push([
      str,
      round(tx[4] / viewport.width),
      round(top / viewport.height),
      round(width / viewport.width),
      round(fontHeight / viewport.height),
    ]);
    parts.push(str);
    length += str.length + 1;
    parts.push(item.hasEOL ? "\n" : " ");
  }
  const text = parts
    .join("")
    .split("\n")
    .map((line) => line.replace(/ +/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  return { text, runs };
}

/** Reads back the runs saved in book_pages, dropping anything that is not a run. */
export function readRuns(value: unknown): PageRun[] {
  if (!Array.isArray(value)) return [];
  const out: PageRun[] = [];
  for (const run of value) {
    if (!Array.isArray(run) || run.length < 5 || typeof run[0] !== "string") continue;
    const numbers = run.slice(1, 5).map(Number);
    if (numbers.some((n) => !Number.isFinite(n))) continue;
    out.push([run[0], numbers[0], numbers[1], numbers[2], numbers[3]]);
  }
  return out;
}

/** For "is this selection on the page": one form, no spaces, no soft hyphens, lower case. */
export function matchForm(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u00AD\u200B-\u200F\u2028\u2029\uFEFF]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/** Whether the reader's selection is really on the page (spaces and line breaks do not count). */
export function selectionOnPage(selection: string, pageText: string): boolean {
  const wanted = matchForm(selection);
  return wanted.length > 0 && matchForm(pageText).includes(wanted);
}

/**
 * The selection as the page writes it (the page's own text, never the browser's), and the page's
 * text around it for Rita. Null when the selection is not on the page.
 */
export function pageQuote(
  selection: string,
  pageText: string,
  maxContext = BOOK_CONTEXT_CHARS,
): { quote: string; context: string } | null {
  const wanted = matchForm(selection);
  if (!wanted) return null;
  // The page's text without spaces, and where each of its letters is in the page's text.
  const positions: number[] = [];
  let compact = "";
  for (let i = 0; i < pageText.length; i++) {
    const piece = matchForm(pageText[i]);
    for (let k = 0; k < piece.length; k++) positions.push(i);
    compact += piece;
  }
  const at = compact.indexOf(wanted);
  if (at < 0) return null;
  const start = positions[at];
  const end = positions[at + wanted.length - 1] + 1;
  const quote = pageText.slice(start, end).replace(/\s+/g, " ").trim();
  const room = Math.max(0, maxContext - quote.length);
  // Half the room before the selection and the rest after; room one side does not use goes to the other.
  const span = end - start + room;
  let from = Math.max(0, start - Math.floor(room / 2));
  const to = Math.min(pageText.length, from + span);
  from = Math.max(0, Math.min(from, to - span));
  return { quote, context: pageText.slice(from, to).trim() };
}

const LETTER = /\p{L}/u;
const LATIN = /[A-Za-zÀ-ÿ]/;

/** What kind of piece of a page the reader selected (decides which circle actions fit). */
export function bookSelectionKind(exact: string): SelectionKind {
  const text = exact.replace(/\s+/g, " ").trim();
  if (!text || !LETTER.test(text)) return "non_text";
  if (text.length > MAX_SELECTION_CHARS) return "too_long";
  if (!LATIN.test(text)) return "arabic_only";
  const words = text.split(" ").filter((word) => LETTER.test(word)).length;
  if (words <= 1) return "word";
  if (words <= 6 && !/[.!?؟]["'”’)]?$/.test(text)) return "phrase";
  return "sentence";
}

/** The page the reader asked for, kept inside the book. */
export function clampPage(page: unknown, pageCount: number): number {
  const n = Math.floor(Number(page));
  const last = Math.max(1, Math.floor(pageCount) || 1);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, last);
}

/** Where a page's picture lives in the book-pages bucket. */
export function pageImagePath(bookId: string, page: number, type: "webp" | "jpeg"): string {
  return `${bookId}/${page}.${type === "webp" ? "webp" : "jpg"}`;
}

/** The pages still missing, in order (preparing again after a stop picks up from here). */
export function missingPages(pageCount: number, done: Iterable<number>): number[] {
  const have = new Set(done);
  const out: number[] = [];
  for (let page = 1; page <= pageCount; page++) if (!have.has(page)) out.push(page);
  return out;
}
```

## `src/routes/books_.$bookId.read.tsx`

```tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2 } from "lucide-react";
import { BookReader } from "@/components/books/reader/BookReader";
import { useAuth } from "@/hooks/useAuth";
import { bookFileLink } from "@/lib/books-data";
import { loadReaderBook, loadReadingPlace } from "@/lib/book-reader-data";

type ReaderSearch = { page?: number };

export const Route = createFileRoute("/books_/$bookId/read")({
  validateSearch: (search: Record<string, unknown>): ReaderSearch => {
    const page = Math.floor(Number(search.page));
    return Number.isFinite(page) && page >= 1 && page <= 5000 ? { page } : {};
  },
  head: () => ({
    meta: [{ title: "Reading — Uzyra" }, { name: "robots", content: "noindex" }],
  }),
  component: ReaderRoute,
});

function ReaderRoute() {
  const { bookId } = Route.useParams();
  const { page } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/login" });
  }, [loading, navigate, user]);

  const book = useQuery({
    queryKey: ["book-reader", bookId],
    queryFn: () => loadReaderBook(bookId),
    enabled: Boolean(user),
    staleTime: 60_000,
  });
  // Where this reader stopped, unless the address names a page (a refresh, a shared link).
  const [start, setStart] = useState<number | null>(page ?? null);
  useEffect(() => {
    if (start !== null || !user || !book.data?.prepared) return;
    let live = true;
    void loadReadingPlace(bookId).then((place) => live && setStart(place ?? 1));
    return () => {
      live = false;
    };
  }, [book.data?.prepared, bookId, start, user]);

  if (book.data && book.data.prepared && start !== null && user)
    return <BookReader key={bookId} book={book.data} userId={user.id} startPage={start} />;

  const message = book.isError
    ? "ما قدرت أفتح الكتاب. تأكد من النت وجرّب كمان مرة."
    : book.data === null
      ? "هاد الكتاب مش متاح."
      : book.data && !book.data.prepared
        ? "هاد الكتاب لسا مش جاهز للقراءة هون. بتقدر تفتح ملف الـ PDF."
        : "";

  return (
    <div
      className="edith-premium grid min-h-[100dvh] place-items-center bg-[#f4f4f8] p-6 text-[var(--pp-ink)]"
      dir="rtl"
    >
      {message ? (
        <div className="grid max-w-sm justify-items-center gap-4 text-center">
          <p className="text-[16px]">{message}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link to="/books" className="rita-btn rita-btn-soft gap-2">
              <ArrowRight size={15} aria-hidden="true" /> المكتبة
            </Link>
            {book.data && !book.data.prepared && book.data.filePath && (
              <button
                type="button"
                className="rita-btn rita-btn-primary"
                onClick={() => {
                  const path = book.data?.filePath;
                  if (path) void bookFileLink(path).then((url) => window.location.assign(url));
                }}
              >
                افتح ملف PDF
              </button>
            )}
          </div>
        </div>
      ) : (
        <Loader2
          size={24}
          className="animate-spin text-[var(--pp-muted)]"
          aria-label="جاري فتح الكتاب"
        />
      )}
    </div>
  );
}
```

## `supabase/migrations/20261113120000_books_reader.sql`

```sql
-- Library, the reader: a book is read page by page, never as one big PDF download.
--
-- When the admin prepares a book («جهّز الكتاب للقراءة»), their own browser opens the PDF once,
-- turns every page into a light picture (WebP, or JPEG where the browser cannot make WebP) and
-- reads the page's words with where each one sits. The pictures go to the private bucket
-- book-pages under "<book id>/", one row per page goes to book_pages. A reader then loads only
-- the page they look at (and the next one), and the words lie over the picture so they can be
-- chosen and sent to Rita's circle.
--
--   book_pages            one row per prepared page (picture, size, words and their places)
--   books.page_count      how many pages the PDF has (set when preparing starts)
--   books.prepared_at     set once every page is in; the reader opens only then
--   book_reading_progress the page each reader stopped at (their own rows only)
--   book_study_requests   what readers asked the circle, written only by books_take_study_quota
--
-- Replacing a book's PDF clears its pages and prepared_at (the old pages belong to the old PDF).
-- Everything here only adds, and the file can be run again safely.

-- ---------------------------------------------------------------------------------------------
-- The book's own numbers

alter table public.books add column if not exists page_count integer;
alter table public.books add column if not exists prepared_at timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'books_page_count_range') then
    alter table public.books add constraint books_page_count_range
      check (page_count is null or page_count between 1 and 5000);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- The pages

create table if not exists public.book_pages (
  book_id uuid not null references public.books (id) on delete cascade,
  page integer not null check (page between 1 and 5000),
  -- The picture's size in pixels (its shape is the page's shape).
  width integer not null check (width between 16 and 6000),
  height integer not null check (height between 16 and 6000),
  image_path text not null check (char_length(image_path) between 3 and 300),
  -- The page's words in reading order, and each piece of text with its place on the page:
  -- [text, left, top, width, height], the four numbers as parts of the page (0 to 1).
  text text not null default '' check (char_length(text) <= 60000),
  runs jsonb not null default '[]'::jsonb check (jsonb_typeof(runs) = 'array'),
  has_text boolean generated always as (char_length(btrim(text)) > 0) stored,
  created_at timestamptz not null default now(),
  primary key (book_id, page)
);

alter table public.book_pages enable row level security;

drop policy if exists "readers read pages of published books" on public.book_pages;
create policy "readers read pages of published books" on public.book_pages
  for select to authenticated
  using (public.book_is_published(book_id) or public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "admins manage book pages" on public.book_pages;
create policy "admins manage book pages" on public.book_pages
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

revoke all on public.book_pages from anon;
grant select, insert, update, delete on public.book_pages to authenticated;

-- A new PDF means new pages: the old ones go, and the book waits to be prepared again.
create or replace function public.books_reader_reset()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.file_path is distinct from old.file_path then
    delete from public.book_pages where book_id = new.id;
    new.prepared_at := null;
    new.page_count := null;
  end if;
  return new;
end;
$$;

drop trigger if exists books_reader_reset on public.books;
create trigger books_reader_reset
  before update of file_path on public.books
  for each row execute function public.books_reader_reset();

-- ---------------------------------------------------------------------------------------------
-- The pictures: a private bucket, read with links made from the reader's own session

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-pages', 'book-pages', false, 5242880, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "admins manage book pages pictures" on storage.objects;
create policy "admins manage book pages pictures" on storage.objects
  for all to authenticated
  using (bucket_id = 'book-pages' and public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (bucket_id = 'book-pages' and public.has_role(auth.uid(), 'admin'::public.app_role));

-- A signed-in reader may open the pictures under "<book id>/" of a published book.
drop policy if exists "readers open pages of published books" on storage.objects;
create policy "readers open pages of published books" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'book-pages'
    and exists (
      select 1 from public.books b
      where b.id::text = split_part(storage.objects.name, '/', 1) and b.status = 'published'
    )
  );

-- ---------------------------------------------------------------------------------------------
-- Where each reader stopped

create table if not exists public.book_reading_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  page integer not null check (page between 1 and 5000),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

alter table public.book_reading_progress enable row level security;

drop policy if exists "readers read their place" on public.book_reading_progress;
create policy "readers read their place" on public.book_reading_progress
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "readers keep their place" on public.book_reading_progress;
create policy "readers keep their place" on public.book_reading_progress
  for insert to authenticated
  with check (user_id = auth.uid() and public.book_is_published(book_id));

drop policy if exists "readers move their place" on public.book_reading_progress;
create policy "readers move their place" on public.book_reading_progress
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.book_is_published(book_id));

drop policy if exists "readers forget their place" on public.book_reading_progress;
create policy "readers forget their place" on public.book_reading_progress
  for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.book_reading_progress from anon;
grant select, insert, update, delete on public.book_reading_progress to authenticated;

-- ---------------------------------------------------------------------------------------------
-- What readers ask Rita's circle about a page (limits like the lessons' study page)

create table if not exists public.book_study_requests (
  request_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  page integer not null check (page between 1 and 5000),
  action text not null check (char_length(action) between 1 and 40),
  quota_group text not null check (quota_group in ('explain', 'practice', 'cards')),
  selection_len integer not null default 0 check (selection_len between 0 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists book_study_requests_quota
  on public.book_study_requests (user_id, quota_group, created_at desc);

alter table public.book_study_requests enable row level security;

drop policy if exists "readers read their book requests" on public.book_study_requests;
create policy "readers read their book requests" on public.book_study_requests
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::public.app_role));

revoke all on public.book_study_requests from anon;
revoke insert, update, delete on public.book_study_requests from authenticated;
grant select on public.book_study_requests to authenticated;

-- The same generous limits as rita_study_take_quota (src/lib/study/study-limits.ts; a test keeps
-- them equal). A day starts at midnight in Amman. Admins are never limited.
create or replace function public.books_take_study_quota(
  p_request uuid,
  p_book uuid,
  p_page integer,
  p_action text,
  p_group text,
  p_selection_len integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  admin boolean;
  per_min integer;
  per_day integer;
  used_min integer;
  used_day integer;
  day_start timestamptz;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  if p_request is null or p_book is null or p_page is null or p_page not between 1 and 5000
    or char_length(coalesce(p_action, '')) not between 1 and 40 then
    return jsonb_build_object('ok', false, 'code', 'bad_request');
  end if;
  admin := public.has_role(uid, 'admin'::public.app_role);
  if not admin and not public.book_is_published(p_book) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  case p_group
    when 'explain' then
      per_min := 20;
      per_day := 400;
    when 'practice' then
      per_min := 4;
      per_day := 40;
    when 'cards' then
      per_min := 6;
      per_day := 60;
    else
      return jsonb_build_object('ok', false, 'code', 'bad_request');
  end case;

  if not admin then
    -- One reader's requests are counted one at a time.
    perform pg_advisory_xact_lock(hashtext('books_study_quota:' || uid::text));
    day_start := date_trunc('day', now() at time zone 'Asia/Amman') at time zone 'Asia/Amman';
    select
      count(*) filter (where created_at > now() - interval '1 minute'),
      count(*) filter (where created_at >= day_start)
    into used_min, used_day
    from public.book_study_requests
    where user_id = uid
      and quota_group = p_group
      and created_at >= least(day_start, now() - interval '1 minute');
    if used_day >= per_day then
      return jsonb_build_object(
        'ok', false, 'code', 'rate_limited', 'scope', 'day',
        'retry_after', ceil(extract(epoch from (day_start + interval '1 day' - now())))::integer
      );
    end if;
    if used_min >= per_min then
      return jsonb_build_object('ok', false, 'code', 'rate_limited', 'scope', 'minute', 'retry_after', 60);
    end if;
  end if;

  insert into public.book_study_requests (request_id, user_id, book_id, page, action, quota_group, selection_len)
  values (p_request, uid, p_book, p_page, p_action, p_group,
          greatest(0, least(coalesce(p_selection_len, 0), 4000)))
  on conflict (request_id) do nothing;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.books_take_study_quota(uuid, uuid, integer, text, text, integer) from public;
grant execute on function public.books_take_study_quota(uuid, uuid, integer, text, text, integer) to authenticated;
```
