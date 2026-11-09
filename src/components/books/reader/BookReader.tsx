// The book reader: the same layout as the study page (Rita on the left, the page on the right, a
// draggable divider on wide screens, two tabs on phones, and the floating circle over both). Only
// the page being read is loaded (a light picture and its words), with the next one ready behind
// it, so a 500 MB book opens as fast as a short one and never freezes the device.
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Group, Panel, Separator } from "react-resizable-panels";
import { ArrowRight, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
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
  });
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
  const [paneWidth, setPaneWidth] = useState(0);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setPaneWidth(el.clientWidth));
    observer.observe(el);
    setPaneWidth(el.clientWidth);
    return () => observer.disconnect();
  }, [wide, tab]);
  const fitWidth = Math.max(240, Math.min(paneWidth - 32, 980));
  const pageWidth = Math.round(fitWidth * ZOOMS[zoom]);

  // ---- the selection ---------------------------------------------------------------------------
  const textLayer = useRef<HTMLDivElement | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const pickedRef = useRef<Picked | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpenRef = useRef(false);
  menuOpenRef.current = menuOpen;
  const pageRef = useRef<ReaderPage | null>(null);
  pageRef.current = current.data ?? null;

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
      scroller.current?.scrollTo({ top: 0 });
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

  const bookPane = (
    <div className="bkr-pane" dir="rtl">
      <div ref={scroller} className="bkr-scroll">
        {current.data && !current.data.hasText && (
          <p className="bkr-note">هاي الصفحة صورة بدون نص، فما بتنحدد. كمّل للصفحة الجاية.</p>
        )}
        <div className="bkr-stage">
          <BookPageView
            ref={textLayer}
            page={current.data ?? null}
            ratio={lastShape.current}
            width={pageWidth}
            loading={current.isPending}
            failed={failed}
            onRetry={() => void current.refetch()}
          />
        </div>
      </div>
      <nav className="bkr-bar" aria-label="الصفحات" dir="ltr">
        <div className="bkr-zoom">
          <button
            type="button"
            className="bkr-icon"
            aria-label="صغّر"
            disabled={zoom === 0}
            onClick={() => setZoom((z) => Math.max(0, z - 1))}
          >
            <ZoomOut size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="bkr-icon"
            aria-label="كبّر"
            disabled={zoom === ZOOMS.length - 1}
            onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))}
          >
            <ZoomIn size={17} aria-hidden="true" />
          </button>
        </div>
        <div className="bkr-turn" dir={rtlBook ? "rtl" : "ltr"}>
          <button
            type="button"
            className="bkr-icon"
            aria-label="الصفحة السابقة"
            disabled={page <= 1}
            onClick={() => go(page - 1)}
          >
            {rtlBook ? (
              <ChevronRight size={18} aria-hidden="true" />
            ) : (
              <ChevronLeft size={18} aria-hidden="true" />
            )}
          </button>
          <form onSubmit={submitJump} className="bkr-jump" dir="rtl">
            <label className="sr-only" htmlFor="bkr-page">
              رقم الصفحة
            </label>
            <span aria-hidden="true">صفحة</span>
            <input
              id="bkr-page"
              inputMode="numeric"
              value={jump}
              onChange={(event) => setJump(event.target.value.replace(/\D/g, "").slice(0, 4))}
              onBlur={() => setJump(String(page))}
            />
            <span>من {total}</span>
          </form>
          <button
            type="button"
            className="bkr-icon"
            aria-label="الصفحة الجاية"
            disabled={page >= total}
            onClick={() => go(page + 1)}
          >
            {rtlBook ? (
              <ChevronLeft size={18} aria-hidden="true" />
            ) : (
              <ChevronRight size={18} aria-hidden="true" />
            )}
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
