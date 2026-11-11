// The book reader: the same layout as the study page (Rita on the left, the page on the right, a
// draggable divider on wide screens, two tabs on phones, and the floating circle over both). Only
// the page being read is loaded (a light picture and its words), with the next one ready behind
// it, so a 500 MB book opens as fast as a short one and never freezes the device.
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Group, Panel, Separator } from "react-resizable-panels";
import {
  ArrowRight,
  Bookmark,
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
import {
  SETTLE_MS,
  aheadCount,
  bookSelectionKind,
  clampPage,
  metaBlock,
  crossedMilestone,
  minutesLeftLabel,
  nextChapterStart,
  paceSample,
  pageQuote,
  pickTier,
  prefetchPlan,
  secondsPerPage,
  signWindow,
  tierPath,
  type Tier,
} from "@/lib/books-reader";
import {
  fetchBookmarks,
  fetchManifest,
  fetchMetaBlock,
  fetchPageWords,
  linksMissing,
  saveReadingPlace,
  setBookmark,
  signPagePaths,
  type PageMeta,
  type PageView,
  type PageWords,
  type ReaderBook,
  type BookManifest,
} from "@/lib/book-reader-data";
import {
  decodePicture,
  dropPicturesExcept,
  fetchPicture,
  lastPictureMs,
} from "@/lib/book-pictures";
import {
  BOOK_TEXT_ACTIONS,
  bookMakeCards,
  bookMakeMcq,
  bookStudyText,
  type BookTextAction,
} from "@/lib/books-study.functions";
import { BookPageView } from "./BookPageView";
import { BookScrubber } from "./BookScrubber";
import { BookPanel } from "./BookPanel";
import { BookRitaColumn, type BookAnswer } from "./BookRitaColumn";
import { useTurnGestures } from "./useTurnGestures";
import "@/components/rita-study/study-meaning.css";
import "./book-reader.css";

const SPLIT_KEY = "uzyra-book-split";
/** Per browser: how the page fits ("page": all of it in view; "width": the pane's width). */
const FIT_KEY = "uzyra-book-fit";
/** Per browser: the first-visit tip about selecting was seen. */
const TIP_KEY = "uzyra-book-tip";
/** Per browser: the reader's last seconds per page (for "minutes left in the chapter"). */
const PACE_KEY = "uzyra-book-pace";
/** Per browser: "1" switches on zooming by finger (double tap, pinch). */
const ZOOM_KEY = "uzyra-book-gesture-zoom";

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
/** Pages, words and links stay in memory this long (links are reused for hours). */
const PAGE_STALE_MS = 45 * 60 * 1000;

// ---- the queries behind a page --------------------------------------------------------------

function metaQuery(bookId: string, block: number, total: number) {
  return {
    queryKey: ["book-meta", bookId, block] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchMetaBlock(bookId, block, total, signal),
    staleTime: Infinity,
    gcTime: PAGE_STALE_MS,
  };
}

/** How the reader's screen asks for pictures: the manifest (if any) and the pixels needed. */
type Sizing = { manifest: BookManifest | null; need: number };

/**
 * A page ready to show: its light info and its signed picture link. With a manifest, the light
 * info is already in memory and the picture is the size that fits the screen (900 / 1400 /
 * 2200 px); without one, light info is read 40 pages per request and the picture is 1400 px.
 */
function viewQuery(
  client: QueryClient,
  bookId: string,
  userId: string,
  page: number,
  total: number,
  dir: 1 | -1,
  sizing: Sizing,
) {
  const { manifest, need } = sizing;
  const tierOf = (n: number): Tier => {
    const entry = manifest?.pages[n - 1];
    return entry ? pickTier(need, entry.tiers) : "std";
  };
  return {
    queryKey: ["book-view", bookId, page, tierOf(page)] as const,
    queryFn: async (): Promise<PageView> => {
      let meta: PageMeta;
      let known: (n: number) => string | undefined;
      if (manifest) {
        const entry = manifest.pages[page - 1];
        if (!entry) throw new Error("missing_page");
        meta = {
          page,
          width: entry.width,
          height: entry.height,
          imagePath: tierPath(bookId, page, tierOf(page), entry.type),
          hasText: entry.hasText,
          thumbhash: entry.thumbhash,
          color: entry.color,
        };
        known = (n) => {
          const other = manifest.pages[n - 1];
          return other ? tierPath(bookId, n, tierOf(n), other.type) : undefined;
        };
      } else {
        const own = await client.ensureQueryData(metaQuery(bookId, metaBlock(page), total));
        const found = own.find((m) => m.page === page);
        if (!found) throw new Error("missing_page");
        meta = found;
        // Light info already in memory (this block, and any other block read before).
        known = (n) =>
          client
            .getQueryData<PageMeta[]>(["book-meta", bookId, metaBlock(n)])
            ?.find((m) => m.page === n)?.imagePath;
      }
      const nearby = signWindow(page, total, dir);
      // A new batch only when fewer than 10 pages ahead are signed (or on their way).
      const close = Array.from({ length: 10 }, (_, i) => page + (i + 1) * dir)
        .map(known)
        .filter((path): path is string => Boolean(path));
      const batch = linksMissing(userId, [meta.imagePath, ...close]).length
        ? nearby.map(known).filter((path): path is string => Boolean(path))
        : [];
      const links = await signPagePaths(userId, [meta.imagePath, ...batch]);
      // Without a manifest, the other block of the window is read in the background.
      if (!manifest)
        for (const block of new Set(nearby.map(metaBlock)))
          if (block !== metaBlock(page))
            void client.prefetchQuery(metaQuery(bookId, block, total)).catch(() => undefined);
      const url = links[meta.imagePath];
      if (!url) throw new Error("no_link");
      return { ...meta, url };
    },
    staleTime: PAGE_STALE_MS,
    gcTime: PAGE_STALE_MS,
    retry: 1,
    retryDelay: 1500,
  };
}

function wordsQuery(bookId: string, page: number) {
  return {
    queryKey: ["book-words", bookId, page] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchPageWords(bookId, page, signal),
    staleTime: PAGE_STALE_MS,
    gcTime: PAGE_STALE_MS,
  };
}

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
  resumed = false,
}: {
  book: ReaderBook;
  userId: string;
  startPage: number;
  /** Opened at the page this reader stopped at (not page 1, not from the address). */
  resumed?: boolean;
}) {
  const wide = useWide(900);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"book" | "rita">("book");
  const [split] = useState(readSplit);
  const total = Math.max(1, book.pageCount);
  const [page, setPage] = useState(() => clampPage(startPage, total));
  const [zoom, setZoom] = useState(0);
  // Phones open fit to width (a whole page is tiny there); a choice made with the button stays.
  const [fit, setFit] = useState<"page" | "width">("page");
  useEffect(() => {
    const saved = readStore(FIT_KEY);
    if (saved === "width" || saved === "page") setFit(saved);
    else if (!window.matchMedia("(min-width: 900px)").matches) setFit("width");
  }, []);
  const [tip, setTip] = useState(false);
  useEffect(() => setTip(readStore(TIP_KEY) !== "1"), []);
  const [jump, setJump] = useState(String(page));
  const memoryKey = `book:${book.id}`;

  // ---- the manifest (one request: every page's size and preview, the outline) ----------------
  const manifestOf = useQuery({
    queryKey: ["book-manifest", book.id] as const,
    queryFn: () => fetchManifest(book.id),
    staleTime: Infinity,
    gcTime: PAGE_STALE_MS,
  });
  // Until it answers, pages load the phase 1 way (it is one small request).
  const manifest = manifestOf.data ?? null;
  const lastShape = useRef(1.414);

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
  const shape = manifest?.pages[page - 1]
    ? manifest.pages[page - 1].height / manifest.pages[page - 1].width
    : lastShape.current;
  const fitted =
    fit === "page" ? Math.min(roomWidth, roomHeight / shape, 980) : Math.min(roomWidth, 980);
  const pageWidth = Math.round(fitted * ZOOMS[zoom]);

  // The picture size asked for: the sheet's width × the screen's density (zoom included).
  const [density, setDensity] = useState(1);
  useEffect(() => setDensity(Math.min(3, window.devicePixelRatio || 1)), []);
  const sizing: Sizing = { manifest, need: pageWidth * density };
  // The size bucket pages are read ahead in: none until the manifest has answered and the pane is
  // measured (else the pages ahead would be fetched in the wrong size); a zoom that needs a bigger
  // size reads the pages ahead again in it.
  const sizeKey =
    manifestOf.isPending || !pane.width
      ? ""
      : manifest
        ? pickTier(sizing.need, ["mid", "std", "zoom"])
        : "std";

  // ---- the page, and the pages around it ------------------------------------------------------
  // The reading direction and the last turns decide what is fetched ahead.
  const dirRef = useRef<1 | -1>(1);
  const lastPage = useRef(page);
  const turns = useRef<number[]>([]);
  const [turn, setTurn] = useState(0);
  const [motion, setMotion] = useState(0);
  // The last turn came right after another (fast flipping): pictures wait for the reader to stop.
  const [flipping, setFlipping] = useState(false);
  if (lastPage.current !== page) {
    dirRef.current = page > lastPage.current ? 1 : -1;
    lastPage.current = page;
  }
  const current = useQuery({
    ...viewQuery(queryClient, book.id, userId, page, total, dirRef.current, sizing),
    // The manifest decides the size; wait for its answer (one small request) before the page.
    enabled: !manifestOf.isPending,
    // The previous page's sheet stays while the new page's info arrives (a few ms when cached).
    placeholderData: keepPreviousData,
  });
  // A placeholder of another page is not shown; the same page in another size (zooming) is, so
  // its picture stays on screen until the new size is in.
  const view =
    current.isPlaceholderData && current.data?.page !== page ? null : (current.data ?? null);
  if (current.data) lastShape.current = current.data.height / current.data.width;

  const sizingRef = useRef(sizing);
  sizingRef.current = sizing;

  // The words wait until the reader stays on a page; pages read ahead are already there.
  const [settled, setSettled] = useState(page);
  const wordsOf = useQuery({ ...wordsQuery(book.id, page), enabled: settled === page });
  const words: PageWords | null = wordsOf.data && wordsOf.data.page === page ? wordsOf.data : null;

  useEffect(() => {
    // Turned again before the page on screen came in: the old plan is dropped.
    let alive = true;
    const timer = window.setTimeout(() => {
      setSettled(page);
      if (!sizeKey) return;
      const dir = dirRef.current;
      const ahead = aheadCount(turns.current, lastPictureMs());
      const plan = prefetchPlan(page, dir, total, ahead);
      const keepWords = new Set([page, ...plan.words]);
      const keepViews = new Set([page, ...plan.pictures]);
      // Flipped past: stop what is no longer wanted.
      void queryClient.cancelQueries({
        predicate: (q) =>
          q.queryKey[1] === book.id &&
          ((q.queryKey[0] === "book-words" && !keepWords.has(q.queryKey[2] as number)) ||
            (q.queryKey[0] === "book-view" && !keepViews.has(q.queryKey[2] as number))),
      });
      const wanted = new Set<string>();
      if (current.data && !current.isPlaceholderData) wanted.add(current.data.imagePath);
      const sizingNow = sizingRef.current;
      // The page on screen first: the pages ahead start once its picture is in (or after 1.5 s).
      const first = queryClient
        .fetchQuery(viewQuery(queryClient, book.id, userId, page, total, dir, sizingNow))
        .then((view) => {
          wanted.add(view.imagePath);
          return decodePicture(view.imagePath, view.url, "high");
        })
        .catch(() => undefined);
      const onScreen = Promise.race([first, new Promise((done) => window.setTimeout(done, 1500))]);
      for (const n of plan.pictures) {
        const near = n === page + dir || n === page - dir;
        void onScreen
          .then(() =>
            alive
              ? queryClient.fetchQuery(
                  viewQuery(queryClient, book.id, userId, n, total, dir, sizingNow),
                )
              : null,
          )
          .then((next) => {
            if (!next || !alive) return;
            wanted.add(next.imagePath);
            // The pages right beside are decoded; the ones further ahead only cached.
            if (near) void decodePicture(next.imagePath, next.url, "low").catch(() => undefined);
            else fetchPicture(next.imagePath, next.url);
          })
          .catch(() => undefined);
      }
      void onScreen.then(() => alive && window.setTimeout(() => dropPicturesExcept(wanted), 0));
      for (const n of plan.words) void queryClient.prefetchQuery(wordsQuery(book.id, n));
    }, SETTLE_MS);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, page, total, queryClient, userId, sizeKey]);

  // The place is remembered (for this reader) and kept in the address (for a refresh); leaving
  // the tab or the app saves it at once.
  const pageNow = useRef(page);
  pageNow.current = page;
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden")
        void saveReadingPlace(userId, book.id, pageNow.current);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [book.id, userId]);
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

  // ---- the selection ---------------------------------------------------------------------------
  const textLayer = useRef<HTMLDivElement | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const pickedRef = useRef<Picked | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpenRef = useRef(false);
  menuOpenRef.current = menuOpen;
  const pageRef = useRef<PageWords | null>(null);
  // Only the words of the page on screen can be selected.
  pageRef.current = words;

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
  // The book's own direction: from its manifest, else from its language.
  const rtlBook = manifest ? manifest.dir === "rtl" : /^(ar|fa|ur|he)/.test(book.language);
  // The page number in the middle of the page while flipping fast (from the 2nd quick turn).
  const [toast, setToast] = useState(false);
  const toastTimer = useRef(0);
  const go = useCallback(
    (next: number) => {
      const target = clampPage(next, total);
      if (target === pageNow.current) return;
      const now = Date.now();
      const quick = turns.current.length > 0 && now - turns.current[turns.current.length - 1] < 400;
      turns.current = [...turns.current.slice(-5), now];
      if (quick) setToast(true);
      setFlipping(quick);
      window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(false), 600);
      // Forward comes from the right in a left-to-right book, from the left in a right-to-left one.
      const forward = target > pageNow.current ? 1 : -1;
      setMotion(rtlBook ? -forward : forward);
      setTurn((n) => n + 1);
      setPage(target);
      scroller.current?.scrollTo({ top: 0, left: 0 });
    },
    [rtlBook, total],
  );
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (menuOpenRef.current || event.altKey || event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.closest?.(".bkr-toc")) return;
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

  // Zooming by finger (double tap, pinch) stays off until it is tried on a real iPad: switched on
  // per browser with localStorage "uzyra-book-gesture-zoom" = "1".
  const [fingerZoom, setFingerZoom] = useState(false);
  useEffect(() => setFingerZoom(readStore(ZOOM_KEY) === "1"), []);
  // Touch: a swipe across the page or a tap on its outer edges turns it (selection always wins).
  const stage = useRef<HTMLDivElement | null>(null);
  useTurnGestures({
    scroller,
    stage,
    rtl: rtlBook,
    page,
    total,
    blocked: () => menuOpenRef.current,
    onTurn: go,
    layoutKey: `${wide}-${tab}`,
    zoom: { on: fingerZoom, index: zoom, levels: ZOOMS, set: setZoom },
  });
  // A page no wider than its pane leaves sideways moves to the swipe (up/down and pinch stay the
  // browser's); a zoomed, wider page scrolls sideways itself and turns only from its edge.
  const wider = pageWidth + gutter * 2 > pane.width + 1;
  // While the scrubber's card shows, the page-number toast stays away.
  const [scrubbing, setScrubbing] = useState(false);

  // ---- bookmarks, and words found by a search ---------------------------------------------------
  const marksOf = useQuery({
    queryKey: ["book-bookmarks", book.id] as const,
    queryFn: () => fetchBookmarks(book.id),
    staleTime: Infinity,
  });
  // null: the database has no bookmarks yet (or they could not be read) — the icon stays away.
  const bookmarks = marksOf.data ?? null;
  const marked = Boolean(bookmarks?.includes(page));
  // A short ink note over the page ("انحفظت صفحة 12 · تراجع"), gone after 3.5 s.
  const [note, setNote] = useState<{ text: string; action?: [string, () => void] } | null>(null);
  const noteTimer = useRef(0);
  const say = useCallback((text: string, action?: [string, () => void], ms = 3500) => {
    window.clearTimeout(noteTimer.current);
    setNote({ text, action });
    noteTimer.current = window.setTimeout(() => setNote(null), ms);
  }, []);
  useEffect(() => () => window.clearTimeout(noteTimer.current), []);
  const toggleMark = useCallback(
    (n: number, on: boolean, quiet = false) => {
      const key = ["book-bookmarks", book.id] as const;
      const before = queryClient.getQueryData<number[] | null>(key) ?? [];
      const after = on
        ? [...new Set([...before, n])].sort((a, b) => a - b)
        : before.filter((x) => x !== n);
      queryClient.setQueryData(key, after);
      setBookmark(book.id, n, on).then(
        () => {
          if (quiet) return;
          say(on ? `انحفظت صفحة ${n}` : `انشالت علامة صفحة ${n}`, [
            "تراجع",
            () => toggleMark(n, !on, true),
          ]);
        },
        () => {
          queryClient.setQueryData(key, before);
          say("ما زبطت العلامة. تأكد من النت.");
        },
      );
    },
    [book.id, queryClient, say],
  );
  // Back where you stopped: «رجعتك لصفحة 87 · من الأول», for 4 s.
  useEffect(() => {
    if (resumed && startPage > 1) say(`رجعتك لصفحة ${startPage}`, ["من الأول", () => go(1)], 4000);
    // Once, when the reader opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Milestones: the first time past 25 / 50 / 75% and the last page of a book, the progress line
  // pulses once (kept per browser); the last page also says so.
  const [pulse, setPulse] = useState(0);
  const lastSeen = useRef(page);
  useEffect(() => {
    const was = lastSeen.current;
    lastSeen.current = page;
    if (page <= was || total < 4) return;
    const key = `uzyra-book-milestones:${book.id}`;
    let reached: number[] = [];
    try {
      const saved = JSON.parse(window.localStorage.getItem(key) ?? "[]");
      if (Array.isArray(saved)) reached = saved.filter((n) => typeof n === "number");
    } catch {
      reached = [];
    }
    const now = crossedMilestone(was, page, total, reached);
    if (now === null) return;
    try {
      window.localStorage.setItem(key, JSON.stringify([...reached, now]));
    } catch {
      /* not kept */
    }
    setPulse((n) => n + 1);
    if (now === 100) say("خلّصت الكتاب 🎉", undefined, 4000);
  }, [book.id, page, total, say]);

  const [hit, setHit] = useState<{ page: number; terms: string[] } | null>(null);
  const jumpTo = useCallback(
    (n: number, terms?: string[]) => {
      setHit(terms?.length ? { page: n, terms } : null);
      go(n);
    },
    [go],
  );
  const [touchy, setTouchy] = useState(false);
  useEffect(
    () => setTouchy(window.matchMedia?.("(hover: none) and (pointer: coarse)").matches ?? false),
    [],
  );

  // The reader's own pace (seconds per page, kept in this browser), for "minutes left".
  const [pace, setPace] = useState<number[]>([]);
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(PACE_KEY) ?? "[]");
      if (Array.isArray(saved)) setPace(saved.filter((n) => typeof n === "number").slice(-10));
    } catch {
      /* none kept */
    }
  }, []);
  const pageSince = useRef({ page, at: Date.now() });
  useEffect(() => {
    const was = pageSince.current;
    pageSince.current = { page, at: Date.now() };
    if (was.page === page) return;
    const sample = paceSample((Date.now() - was.at) / 1000);
    if (sample === null) return;
    setPace((list) => {
      const next = [...list, sample].slice(-10);
      try {
        window.localStorage.setItem(PACE_KEY, JSON.stringify(next));
      } catch {
        /* not kept */
      }
      return next;
    });
  }, [page]);
  const leftLabel = useMemo(() => {
    if (!manifest?.outline.length) return null;
    const end = nextChapterStart(manifest.outline, page, total);
    return minutesLeftLabel(end - page, secondsPerPage(pace), end > total);
  }, [manifest, page, total, pace]);

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
      <BookScrubber
        bookId={book.id}
        userId={userId}
        page={page}
        total={total}
        rtl={rtlBook}
        manifest={manifest}
        onJump={go}
        onScrubbing={setScrubbing}
        marks={bookmarks ?? []}
        pulse={pulse}
      />
      <div className="relative min-h-0 flex-1">
        {/* The book's own direction, so a zoomed page starts where its lines start. */}
        <div
          ref={scroller}
          className={`bkr-scroll${wider ? "" : " is-swipe"}${fingerZoom ? " is-finger-zoom" : ""}`}
          dir={rtlBook ? "rtl" : "ltr"}
          style={{ ["--bkr-gutter" as string]: `${gutter}px` }}
        >
          <div ref={stage} className="bkr-stage">
            <BookPageView
              ref={textLayer}
              view={view}
              words={words}
              ratio={lastShape.current}
              width={pageWidth}
              motion={motion}
              turn={turn}
              settle={flipping}
              failed={failed}
              onRetry={() => void current.refetch()}
              found={hit && hit.page === page ? hit.terms : null}
            />
          </div>
        </div>
        {note && (
          <div className="bkr-note" role="status">
            <span>{note.text}</span>
            {note.action && (
              <button
                type="button"
                onClick={() => {
                  const run = note.action?.[1];
                  setNote(null);
                  run?.();
                }}
              >
                {note.action[0]}
              </button>
            )}
          </div>
        )}
        {toast && !scrubbing && (
          <p className="bkr-toast" aria-hidden="true">
            {page} / {total}
          </p>
        )}
        {tip && view?.hasText && !scrubbing && (
          <div className="bkr-tip" role="note">
            <p>
              حدّد أي كلمة أو جملة بإصبعك أو بالماوس، وبعدين اكبس على الدائرة.
              {touchy && " اسحب الصفحة أو اكبس على طرفها لتقلب."}
            </p>
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
            {leftLabel && <span className="bkr-left">· {leftLabel}</span>}
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
        <div className="bkr-tools" role="group" aria-label="أدوات الصفحة">
          <BookPanel
            bookId={book.id}
            userId={userId}
            manifest={manifest}
            page={page}
            onJump={jumpTo}
            left={leftLabel}
            bookmarks={bookmarks}
            onUnmark={(n) => toggleMark(n, false)}
          />
          {bookmarks !== null && (
            <button
              type="button"
              className={`bkr-icon${marked ? " is-on" : ""}`}
              aria-pressed={marked}
              aria-label={marked ? `شيل علامة صفحة ${page}` : `علّم صفحة ${page}`}
              title={marked ? "شيل العلامة" : "علّم هالصفحة"}
              onClick={() => toggleMark(page, !marked)}
            >
              <Bookmark size={17} aria-hidden="true" fill={marked ? "currentColor" : "none"} />
            </button>
          )}
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
