import "./lesson-path.css";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ContentRequest } from "./admin/PathContentPanel";
import type { PointerEvent as ReactPointerEvent } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bookmark,
  BookOpenText,
  Check,
  ChevronDown,
  Clapperboard,
  Dumbbell,
  ListChecks,
  Flag,
  FileText,
  FolderOpen,
  Loader2,
  Lock,
  MessageCircle,
  Pencil,
  Plus,
  Shuffle,
  BookOpen,
  Globe2,
  Headphones,
  PenLine,
  Sparkles,
  Trophy,
  Trash2,
  X,
} from "lucide-react";
import {
  adminSetLessonStatus,
  getLessonPreview,
  type LessonPreview,
  type PathLesson,
  type ReviewSuggestion,
} from "@/lib/rita-curriculum.functions";
import {
  exerciseCount,
  exerciseMode,
  type ExerciseMode,
  pathItemTitle,
  mergePath,
  swapRefs,
  type PathItem,
  type PathItemKind,
  type PathRef,
} from "@/lib/rita-path-layout";
import {
  adminAddPathItem,
  adminDeletePathItem,
  adminRenamePathItem,
  adminSavePathLayout,
} from "@/lib/rita-path-items.functions";
import {
  celebratedKey,
  frontierUnit,
  unitDone,
  unitOpen,
  unitsOf,
  visibleUnits,
  type PathUnit,
  type UnitStop,
} from "@/lib/rita-path-units";
import {
  confirmSound,
  installSoundUnlock,
  menuCloseSound,
  menuOpenSound,
  optionNote,
} from "@/components/rita-study/tech-sound";
import { LanguageFlag } from "@/components/language/LanguageFlag";
import { useDismiss } from "@/components/header/useDismiss";
import { useLearningLanguage } from "@/hooks/useLearningLanguage";
import {
  levelRank,
  CEFR,
  levelPageRows,
  nextLevel,
  normalizeLevel,
  startLevelKey,
  statesFrom,
  type Level,
  type LevelCount,
  type LevelRow,
  type ViewState,
} from "@/lib/rita-path-levels";
import { LessonImage } from "./LessonArt";
import { PathStopSheet } from "./PathStopSheet";
import { RitaCube } from "@/components/rita-study/RitaCube";

const PathContentPanel = lazy(() => import("./admin/PathContentPanel"));

// Horizontal offsets that make the path zig-zag, as in the lesson map design.
const ZIGZAG = [0, 64, 90, 64, 0, -64, -90, -64];
/** Height of one stop on the road; editing leaves a gap between stops for the + buttons. */
const ROW = 196;
const ROW_EDITING = 276;
/** How tall a stop's content is (picture, two title lines, the small line). */
const STOP_HEIGHT = 184;
const WIDTH = 360;
const NODE = 88;
/** From the top of a stop to the top of its picture (room for the "you are here" tag). */
const NODE_TOP = 16;
/** Height of a level's banner row, and of the «coming soon» row after the last level. */
const BANNER_ROW = 128;
/** A unit's heading on the road (every unit shown at once, with «ترتيب حر»). */
const UNIT_ROW = 112;
/** The closed (or newly opened) next unit at the end of the road. */
const GATE_ROW = 232;
/** Faint line drawings beside the road: only decoration, nothing about the learner. */
const DOODLES = [BookOpen, MessageCircle, Globe2, Headphones, PenLine, Sparkles];
const FREE_ORDER_KEY = "ritaFreeOrder";
const HOLD_MS = 300;

type Look = "study" | "classic" | PathItemKind | ExerciseMode;

/** Each kind of stop has its own colour, word and picture, used everywhere on the path. */
const LOOK: Record<Look, { color: string; soft: string; word: string; Icon: typeof FileText }> = {
  study: { color: "#16a34a", soft: "#e9f8ef", word: "PDF + صوت", Icon: FileText },
  classic: { color: "#2b6df0", soft: "#e7eefd", word: "محادثة", Icon: MessageCircle },
  exercises: { color: "#f08a24", soft: "#fff1e2", word: "تمارين", Icon: Dumbbell },
  quiz: { color: "#0e8fb0", soft: "#e3f5fa", word: "أسئلة", Icon: ListChecks },
  clips: { color: "#d6336c", soft: "#fde8ef", word: "أفلام وGIF", Icon: Clapperboard },
  resources: { color: "#7c5cff", soft: "#f0ecff", word: "ملفات", Icon: FolderOpen },
  finish: { color: "#121117", soft: "#f4f4f8", word: "النهاية", Icon: Flag },
  unit: { color: "#121117", soft: "#f4f4f8", word: "وحدة", Icon: Bookmark },
};

type Node = { type: "lesson"; lesson: PathLesson } | { type: "item"; item: PathItem };
/** An admin's unit marker: the learner sees it as its unit's heading, never as a stop. */
const isMarker = (node: Node) => node.type === "item" && node.item.kind === "unit";

const idOf = (node: Node) => (node.type === "lesson" ? node.lesson.id : node.item.id);
const refOf = (node: Node): PathRef => ({ type: node.type, id: idOf(node) });
const lookOf = (node: Node): Look =>
  node.type === "item"
    ? (exerciseMode(node.item) ?? node.item.kind)
    : node.lesson.experience === "study"
      ? "study"
      : "classic";

/** Each kind of stop has its own shape (lesson-path.css draws them). */
const SHAPE: Record<Look, string> = {
  classic: "circle",
  study: "squircle",
  exercises: "circle",
  quiz: "diamond",
  clips: "frame",
  resources: "folder",
  finish: "medal",
  unit: "circle",
};

/** The stops an admin can add, each with its own look. */
type NewStop = "unit" | "quiz" | "clips" | "resources" | "finish";
const NEW_STOP_TITLE: Record<"quiz" | "clips" | "resources", string> = {
  quiz: "أسئلة",
  clips: "أفلام وGIF",
  resources: "Resources",
};

/** The language being learned and the level the learner is at; a tap switches the language. */
function PathLanguage({ level }: { level: Level }) {
  const { language, languages, pending, setLanguage } = useLearningLanguage();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, root);
  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        className="lp-lang"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`لغة التعلّم: ${language?.name_ar ?? ""} · المستوى ${level}. غيّر اللغة`}
        onClick={() => setOpen((value) => !value)}
      >
        {language && <LanguageFlag language={language} size={26} />}
        <span dir="ltr">
          {language?.name_native ?? "…"} · {level}
        </span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <div className="lp-lang-menu" role="menu">
          {languages.map((item) => {
            const on = item.code === language?.code;
            return (
              <button
                key={item.code}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                disabled={pending !== null}
                onClick={async () => {
                  if (!on && !(await setLanguage(item.code))) return;
                  close();
                }}
              >
                <LanguageFlag language={item} size={24} />
                <span className="min-w-0 flex-1 truncate">{item.name_ar}</span>
                <span className="lp-lang-native" dir="ltr">
                  {item.name_native}
                </span>
                {pending === item.code ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : on ? (
                  <Check size={15} />
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * The lesson map: a zig-zag road of round stops. Lessons (a green PDF + voice lesson or a blue
 * conversation) and the stops an admin adds between them (orange exercises, purple files). An
 * admin can switch to editing: hold a stop and drop it on another to swap them, or press a + on
 * the road to add a stop there. Every change is saved at once and undone if saving fails.
 */
export function LessonPathView({
  lessons,
  items,
  reviews,
  error,
  isAdmin,
  language,
  onOpenLesson,
  onReload,
  selectedLevel,
  onLevelChange,
}: {
  lessons: PathLesson[] | null;
  items: PathItem[];
  reviews: ReviewSuggestion[];
  error: string;
  isAdmin: boolean;
  language: string | null;
  onOpenLesson: (lesson: PathLesson) => void;
  onReload: () => Promise<void>;
  selectedLevel?: Level;
  onLevelChange: (level: Level, keepPosition?: boolean) => void;
}) {
  const saveFn = useServerFn(adminSavePathLayout);
  const addFn = useServerFn(adminAddPathItem);
  const deleteItemFn = useServerFn(adminDeletePathItem);
  const renameFn = useServerFn(adminRenamePathItem);
  const navigate = useNavigate();
  const cubeLevels = useRef({ input: 0, output: 0 });
  const lessonStatus = useServerFn(adminSetLessonStatus);
  const [hint, setHint] = useState("");
  // Free order only relaxes the sequencing (any lesson can be opened); it does
  // not change what the learner can access.
  const [freeOrder, setFreeOrder] = useState(false);
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState<ContentRequest | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [sheet, setSheet] = useState<PathItem | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState("");
  const [dragId, setDragId] = useState("");
  const [overId, setOverId] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const [party, setParty] = useState<PathUnit | null>(null);
  const [away, setAway] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    setFreeOrder(window.localStorage.getItem(FREE_ORDER_KEY) === "1");
    return installSoundUnlock();
  }, []);

  // The server's lists, merged into one road (kept local so a move shows at once).
  useEffect(() => {
    if (!lessons) return;
    setNodes(mergePath(lessons, items) as Node[]);
  }, [lessons, items]);

  function toggleFreeOrder() {
    setFreeOrder((current) => {
      window.localStorage.setItem(FREE_ORDER_KEY, current ? "0" : "1");
      return !current;
    });
  }

  const { language: learning, languages } = useLearningLanguage();
  const lessonList = lessons ?? [];
  // Lessons in road order (the server's order), for the level a learner chose to start from.
  const lessonOrder = useMemo(
    () => nodes.flatMap((node) => (node.type === "lesson" ? [node.lesson] : [])),
    [nodes],
  );
  const [startLevel, setStartLevel] = useState<Level | null>(null);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(startLevelKey(language));
      setStartLevel(saved ? normalizeLevel(saved) : null);
    } catch {
      setStartLevel(null);
    }
  }, [language]);
  const states = useMemo(
    () => statesFrom(lessonOrder, (lesson) => lesson.level, startLevel),
    [lessonOrder, startLevel],
  );
  const stateOf = (lesson: PathLesson): ViewState => states.get(lesson.id) ?? lesson.state;
  const current = lessonOrder.find((lesson) => states.get(lesson.id) === "current");
  const lowest = lessonOrder.length
    ? Math.min(...lessonOrder.map((lesson) => levelRank(lesson.level)))
    : 0;
  const headerLevel: Level =
    current?.level ?? startLevel ?? lessonOrder[0]?.level ?? normalizeLevel(null);

  function startFrom(level: Level | null) {
    try {
      if (level) window.localStorage.setItem(startLevelKey(language), level);
      else window.localStorage.removeItem(startLevelKey(language));
    } catch {
      /* private mode: the choice lasts until the page closes */
    }
    setStartLevel(level);
    confirmSound();
  }

  const pageLevel = selectedLevel ?? headerLevel;
  const previousLevel = CEFR[levelRank(pageLevel) - 1];
  const followingLevel = nextLevel(pageLevel);
  const hasFollowingContent = nodes.some((node) => {
    const level = node.type === "lesson" ? node.lesson.level : node.item.map_level;
    return level !== undefined && levelRank(level) > levelRank(pageLevel);
  });
  const allRows = useMemo(
    () =>
      levelPageRows(nodes, pageLevel, (node) => ({
        level: node.type === "lesson" ? node.lesson.level : null,
        finishOf:
          node.type === "item" && node.item.kind === "finish"
            ? normalizeLevel(node.item.title)
            : null,
        itemLevel: node.type === "item" ? node.item.map_level : undefined,
        done: node.type === "lesson" && states.get(node.lesson.id) === "done",
      })),
    [nodes, pageLevel, states],
  );
  // ---- units: the level is shown one short unit at a time (see rita-path-units.ts) ----
  const units = useMemo(
    () =>
      unitsOf(
        pageLevel,
        allRows.map((r): UnitStop => {
          if (r.type === "banner") return { kind: "banner" };
          if (r.type === "node" && r.node.type === "lesson")
            return { kind: "lesson", state: states.get(r.node.lesson.id) ?? r.node.lesson.state };
          if (r.type === "node" && r.node.type === "item" && r.node.item.kind === "unit")
            return { kind: "marker", id: r.node.item.id, title: r.node.item.title };
          return { kind: "stop" };
        }),
      ),
    [allRows, pageLevel, states],
  );
  const frontier = frontierUnit(units);
  const [unitChoice, setUnitChoice] = useState<{ level: Level; key: string } | null>(null);
  const [unitMove, setUnitMove] = useState<"next" | "back">("next");
  const chosen =
    unitChoice && unitChoice.level === pageLevel
      ? units.findIndex((unit) => unit.key === unitChoice.key)
      : -1;
  const unitIndex =
    chosen >= 0 && unitOpen(units, chosen, frontier) ? chosen : Math.max(0, frontier);
  const pageUnit: PathUnit | undefined = units[unitIndex];
  const nextUnit: PathUnit | undefined = units[unitIndex + 1];
  const nextOpen = nextUnit ? unitOpen(units, unitIndex + 1, frontier) : false;
  // Learners see one unit; «ترتيب حر» shows every unit under its heading; editing shows it all.
  const unitMode = !editing && !freeOrder && Boolean(pageUnit);

  function goUnit(index: number) {
    const unit = units[index];
    if (!unit || !unitOpen(units, index, frontier)) return;
    setUnitMove(index < unitIndex ? "back" : "next");
    setUnitChoice({ level: pageLevel, key: unit.key });
    setHint("");
    confirmSound();
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }

  // A unit finished since the last visit gets its moment once (remembered on the device, per
  // language and level). The first visit only remembers what was already finished.
  useEffect(() => {
    if (!lessons || editing || !units.length) return;
    const key = `${celebratedKey(language)}:${pageLevel}`;
    const finished = units.filter((unit) => unit.lessons > 0 && unitDone(unit)).map((u) => u.key);
    let seen: unknown = null;
    try {
      const saved = window.localStorage.getItem(key);
      seen = saved ? JSON.parse(saved) : null;
    } catch {
      seen = null;
    }
    const remember = (keys: string[]) => {
      try {
        window.localStorage.setItem(key, JSON.stringify([...new Set(keys)]));
      } catch {
        /* private mode: nothing to remember */
      }
    };
    if (!Array.isArray(seen)) {
      remember(finished);
      return;
    }
    const known = seen.map(String);
    const fresh = units.find(
      (unit) => unit.lessons > 0 && unitDone(unit) && !known.includes(unit.key),
    );
    if (!fresh) return;
    remember([...known, ...finished]);
    setParty(fresh);
  }, [lessons, editing, units, language, pageLevel]);

  type ViewRow =
    | (typeof allRows)[number]
    | { type: "unit"; unit: PathUnit }
    | { type: "gate"; unit: PathUnit; open: boolean };
  const rows = useMemo((): ViewRow[] => {
    if (editing) return allRows.filter((r) => r.type !== "finish");
    if (!units.length) return allRows;
    const stops = (list: typeof allRows) =>
      list.filter((r) => !(r.type === "node" && isMarker(r.node)));
    if (!unitMode || !pageUnit) {
      const out: ViewRow[] = [];
      allRows.forEach((r, index) => {
        const starts = units.find((unit) => unit.start === index);
        if (starts && units.length > 1) out.push({ type: "unit", unit: starts });
        if (!(r.type === "node" && isMarker(r.node))) out.push(r);
      });
      return out;
    }
    const banner = allRows[0];
    return [
      ...(unitIndex === 0 && banner?.type === "banner" ? [banner] : []),
      ...stops(allRows.slice(pageUnit.start, pageUnit.end)),
      ...(nextUnit ? [{ type: "gate" as const, unit: nextUnit, open: nextOpen }] : []),
    ];
  }, [allRows, editing, units, unitMode, pageUnit, unitIndex, nextUnit, nextOpen]);
  const lastNodeOnPage = allRows
    .slice()
    .reverse()
    .find((r) => r.type === "node");
  const nextLevelIndex = nodes.findIndex(
    (node) => node.type === "lesson" && levelRank(node.lesson.level) > levelRank(pageLevel),
  );
  const endOfPage =
    lastNodeOnPage?.type === "node"
      ? lastNodeOnPage.nodeIndex + 1
      : nextLevelIndex < 0
        ? nodes.length
        : nextLevelIndex;
  const hasPageLessons = lessonOrder.some((lesson) => lesson.level === pageLevel);

  function showLevel(level: Level) {
    setHint("");
    setAdding(null);
    onLevelChange(level);
  }

  async function removeLesson(lesson: PathLesson) {
    const title = lesson.title_ar || lesson.title;
    if (!window.confirm(`إزالة «${title}» من المسار وإعادته إلى المسوّدة؟`)) return;
    // Pin this page before refreshing in case the removed lesson was the current lesson.
    if (!selectedLevel) onLevelChange(pageLevel, true);
    setBusy(true);
    try {
      await lessonStatus({ data: { lessonId: lesson.id, status: "draft" } });
      setNodes((previous) => previous.filter((node) => idOf(node) !== lesson.id));
      await onReload();
      toast.success("انشال الدرس من المسار وصار مسوّدة.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذّرت إزالة الدرس. جرّب مرة ثانية.");
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(item: PathItem) {
    if (!window.confirm(`أكيد بدك تحذف «${pathItemTitle(item)}» من المسار؟`)) return;
    setBusy(true);
    try {
      await deleteItemFn({ data: { id: item.id } });
      setNodes((previous) => previous.filter((node) => idOf(node) !== item.id));
      await onReload();
      toast.success("انحذفت المحطة من المسار.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذّر حذف المحطة. جرّب مرة ثانية.");
    } finally {
      setBusy(false);
    }
  }

  const counts = new Map<Level, LevelCount>();
  for (const r of allRows) if (r.type === "banner") counts.set(r.level, r.count);

  const row = editing ? ROW_EDITING : ROW;
  const layout = useMemo(() => {
    let top = 0;
    let stop = 0;
    return rows.map((r) => {
      const h =
        r.type === "banner"
          ? BANNER_ROW
          : r.type === "unit"
            ? UNIT_ROW
            : r.type === "gate"
              ? GATE_ROW
              : row;
      const isStop = r.type === "node" || r.type === "finish";
      const x = isStop ? WIDTH / 2 + ZIGZAG[stop++ % ZIGZAG.length] : WIDTH / 2;
      // The road runs into the top of the next unit's card.
      const y = isStop ? top + NODE_TOP + NODE / 2 : r.type === "gate" ? top + 48 : top + h / 2;
      const entry = { top, h, x, y };
      top += h;
      return entry;
    });
  }, [rows, row]);
  const segment = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const midY = (from.y + to.y) / 2;
    return `M${from.x} ${from.y} C${from.x} ${midY} ${to.x} ${midY} ${to.x} ${to.y}`;
  };
  const points = layout;
  const currentRow = rows.findIndex(
    (r) =>
      r.type === "node" && r.node.type === "lesson" && states.get(r.node.lesson.id) === "current",
  );
  const road = points
    .slice(1)
    .map((point, index) => segment(points[index], point))
    .join(" ");
  const walked = points
    .slice(1, Math.max(0, currentRow) + 1)
    .map((point, index) => segment(points[index], point))
    .join(" ");
  const last = layout[layout.length - 1];
  const height = (last ? last.top + last.h : row) + (editing ? 130 : 30);
  const nodeRows = rows.flatMap((r, index) => (r.type === "node" ? [index] : []));

  function open(node: Node) {
    if (node.type === "item" && node.item.kind === "exercises") {
      // Admins manage a stop's content while editing (or when it is still empty); otherwise
      // everyone, admins included, opens the exercises to solve them.
      if (isAdmin && (editing || !exerciseCount(node.item))) setContent({ item: node.item });
      else if (exerciseMode(node.item) === "quiz")
        // A quiz stop opens its own page (one question at a time, with sounds).
        void navigate({ to: "/path-quiz/$itemId", params: { itemId: node.item.id } });
      else if (exerciseMode(node.item) === "clips" && node.item.clip_ids?.length)
        // A film & GIF stop opens its own page (watch, understand, practise).
        void navigate({ to: "/path-clips/$itemId", params: { itemId: node.item.id } });
      else if (exerciseCount(node.item)) setSheet(node.item);
      else setHint("لسا ما انضافت تمارين لهاي المحطة.");
      return;
    }
    if (editing) {
      if (isAdmin) {
        // A lesson is reviewed and published on its own page; an exercise stop opens here.
        if (node.type === "lesson")
          void navigate({ to: "/admin/publish", search: { lesson: node.lesson.id } });
        else if (node.item.kind === "unit") void renameUnit(node.item);
        else setContent({ item: node.item });
      }
      return;
    }
    if (node.type === "item") {
      if (node.item.kind === "finish") {
        showFinish(normalizeLevel(node.item.title));
        return;
      }
      setSheet(node.item);
      return;
    }
    if (stateOf(node.lesson) === "locked" && !freeOrder) {
      setHint("أكمل الدرس الحالي أولاً لفتح هذا الدرس — أو فعّل «ترتيب حر» فوق.");
      return;
    }
    onOpenLesson(node.lesson);
  }

  function showFinish(level: Level) {
    const count = counts.get(level) ?? { lessons: 0, done: 0 };
    const finished = count.lessons > 0 && count.done >= count.lessons;
    // Learners are never told how many lessons a level holds; editing still shows the count.
    setHint(
      finished
        ? `خلّصت المستوى ${level} كله. برافو!`
        : editing
          ? `خلّصت ${count.done} من ${count.lessons} دروس بالمستوى ${level}. كمّل للنهاية.`
          : "كمّل وحدة وحدة لتوصل لخط النهاية.",
    );
  }

  function openReview(review: ReviewSuggestion) {
    const lesson = lessonList.find((item) => item.id === review.id);
    if (lesson) onOpenLesson(lesson);
  }

  // ---- editing: hold, drag onto another stop, drop to swap ----
  const board = useRef<HTMLDivElement>(null);
  const press = useRef<{
    id: string;
    pointerId: number;
    x: number;
    y: number;
    timer: number;
    active: boolean;
    grabX: number;
    grabY: number;
    el: HTMLElement;
    over: string;
    moved: boolean;
  } | null>(null);
  const swallowClick = useRef(false);

  // «ارجع لدرسك» shows while the current lesson is out of sight on its unit's page.
  useEffect(() => {
    if (!unitMode || !pageUnit?.current) {
      setAway(null);
      return;
    }
    const el = board.current?.querySelector<HTMLElement>('[data-state="current"]');
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setAway(null);
        else setAway(entry.boundingClientRect.top < 0 ? "up" : "down");
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [unitMode, pageUnit, rows]);

  const endPress = useCallback(() => {
    const state = press.current;
    if (!state) return;
    window.clearTimeout(state.timer);
    state.el.style.transform = "";
    press.current = null;
    setDragId("");
    setOverId("");
  }, []);

  function onPointerDown(event: ReactPointerEvent<HTMLElement>, node: Node) {
    if (!editing || busy || event.button > 0) return;
    const el = event.currentTarget;
    const id = idOf(node);
    press.current = {
      id,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      timer: 0,
      active: false,
      grabX: 0,
      grabY: 0,
      el,
      over: "",
      moved: false,
    };
    press.current.timer = window.setTimeout(() => {
      const state = press.current;
      if (!state || state.id !== id || state.moved) return;
      state.active = true;
      const rect = el.getBoundingClientRect();
      state.grabX = state.x - rect.left;
      state.grabY = state.y - rect.top;
      try {
        el.setPointerCapture(state.pointerId);
      } catch {
        /* the pointer may already be gone */
      }
      navigator.vibrate?.(12);
      menuOpenSound();
      setDragId(id);
    }, HOLD_MS);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const state = press.current;
    if (!state || event.pointerId !== state.pointerId) return;
    if (!state.active) {
      if (Math.hypot(event.clientX - state.x, event.clientY - state.y) > 8) state.moved = true;
      return;
    }
    const box = board.current?.getBoundingClientRect();
    if (!box) return;
    const left = event.clientX - box.left - state.grabX;
    const top = event.clientY - box.top - state.grabY;
    state.el.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px) scale(1.1)`;
    // The stop under the finger (by its centre) is the one it will swap with.
    const px = event.clientX - box.left;
    const py = event.clientY - box.top;
    let best = "";
    let bestIndex = -1;
    let bestDistance = 72;
    rows.forEach((r, index) => {
      if (r.type !== "node") return;
      const centre = layout[index];
      const id = idOf(r.node);
      if (id === state.id) return;
      const distance = Math.hypot(centre.x - px, centre.y - py);
      if (distance < bestDistance) {
        best = id;
        bestIndex = index;
        bestDistance = distance;
      }
    });
    if (best !== state.over) {
      state.over = best;
      setOverId(best);
      if (best) optionNote(bestIndex);
    }
    // Near the top or bottom of the screen the page follows the finger.
    if (event.clientY < 90) window.scrollBy(0, -14);
    else if (event.clientY > window.innerHeight - 90) window.scrollBy(0, 14);
  }

  async function onPointerUp(event: ReactPointerEvent<HTMLElement>) {
    const state = press.current;
    if (!state || event.pointerId !== state.pointerId) return;
    if (!state.active) {
      endPress();
      return;
    }
    swallowClick.current = true;
    const target = state.over;
    const from = state.id;
    endPress();
    if (!target) {
      menuCloseSound();
      return;
    }
    const before = nodes;
    const order = swapRefs(before.map(refOf), from, target);
    const byId = new Map(before.map((node) => [idOf(node), node]));
    const next = order.map((ref) => byId.get(ref.id)!) as Node[];
    setNodes(next);
    confirmSound();
    setBusy(true);
    try {
      await saveFn({ data: { list: order } });
      await onReload();
    } catch (cause) {
      setNodes(before);
      toast.error(cause instanceof Error ? cause.message : "ما انحفظ الترتيب. جرّب مرة ثانية.");
    } finally {
      setBusy(false);
    }
  }

  async function renameUnit(item: PathItem) {
    const name = window.prompt("اسم الوحدة (هدفها، مثلاً «تعريف عن حالك»):", item.title);
    if (name === null || !name.trim() || name.trim() === item.title) return;
    setBusy(true);
    try {
      await renameFn({ data: { id: item.id, title: name.trim().slice(0, 120) } });
      await onReload();
      confirmSound();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "ما انحفظ الاسم. جرّب مرة ثانية.");
    } finally {
      setBusy(false);
    }
  }

  async function add(stop: NewStop, index: number) {
    setAdding(null);
    let unitName = "";
    if (stop === "unit") {
      const name = window.prompt("اسم الوحدة الجديدة (هدفها، مثلاً «تعريف عن حالك»):", "");
      if (name === null) return;
      unitName = name.trim().slice(0, 120) || "وحدة جديدة";
    }
    setBusy(true);
    const kind: PathItemKind = stop === "quiz" || stop === "clips" ? "exercises" : stop;
    try {
      const created = await addFn({
        data: {
          language,
          level: pageLevel,
          kind,
          ...(kind === "exercises" && { mode: stop as ExerciseMode }),
          title: stop === "finish" ? pageLevel : stop === "unit" ? unitName : NEW_STOP_TITLE[stop],
          list: nodes.map(refOf),
          index,
        },
      });
      setNodes((list) => [
        ...list.slice(0, index),
        { type: "item", item: created },
        ...list.slice(index),
      ]);
      // A new quiz, clips or resources stop opens straight on its content.
      if (kind !== "finish" && kind !== "unit") setContent({ item: created });
      setFresh(created.id);
      confirmSound();
      window.setTimeout(() => setFresh(""), 900);
      await onReload();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      toast.error(
        stop === "unit" && /kind_check|check constraint/i.test(message)
          ? "الوحدات بحاجة لتحديث قاعدة البيانات: طبّق ملف SQL الوحدات أولاً."
          : message || "ما انضافت المحطة. جرّب مرة ثانية.",
      );
    } finally {
      setBusy(false);
    }
  }

  // The + buttons: in the gap between every two stops, and one after the last.
  const gap = (row - STOP_HEIGHT) / 2;
  const lastNode = layout[nodeRows[nodeRows.length - 1]];
  const pluses = editing
    ? [
        ...nodeRows.slice(1).map((rowIndex, index) => {
          const previous = rows[nodeRows[index]];
          return {
            index: previous.type === "node" ? previous.nodeIndex + 1 : endOfPage,
            x: (layout[nodeRows[index]].x + layout[rowIndex].x) / 2,
            y: layout[rowIndex].top - gap / 2,
          };
        }),
        {
          index: endOfPage,
          x: lastNode ? lastNode.x : WIDTH / 2,
          y: lastNode ? lastNode.top + row - gap + 34 : BANNER_ROW + 12,
        },
      ]
    : [];

  function renderRow(r: (typeof rows)[number], index: number) {
    const place = layout[index];
    if (r.type === "unit") {
      return (
        <UnitHeading
          key={`unit-${r.unit.key}`}
          unit={r.unit}
          top={place.top}
          index={index}
          open={freeOrder || unitOpen(units, units.indexOf(r.unit), frontier)}
        />
      );
    }
    if (r.type === "gate") {
      return (
        <UnitGate
          key={`gate-${r.unit.key}`}
          unit={r.unit}
          open={r.open}
          top={place.top}
          index={index}
          onOpen={() => goUnit(units.indexOf(r.unit))}
        />
      );
    }
    if (r.type === "banner") {
      return (
        <LevelBanner
          key={`${r.type}-${r.level}-${index}`}
          row={r}
          top={place.top}
          index={index}
          editing={editing}
          startLevel={startLevel}
          lowest={lowest}
          onStart={startFrom}
          learner={!editing}
        />
      );
    }
    if (r.type === "finish") {
      return (
        <FinishStop
          key={`finish-${r.level}-${index}`}
          level={r.level}
          count={r.count}
          x={place.x}
          top={place.top}
          index={index}
          onOpen={() => showFinish(r.level)}
          learner={!editing}
        />
      );
    }
    const node = r.node;
    const id = idOf(node);
    const centre = place;
    const look = LOOK[lookOf(node)];
    const lesson = node.type === "lesson" ? node.lesson : null;
    const state = lesson ? stateOf(lesson) : null;
    const locked = state === "locked";
    const isCurrent = state === "current";
    const finishLevel =
      node.type === "item" && node.item.kind === "finish" ? normalizeLevel(node.item.title) : null;
    const finishCount = finishLevel ? counts.get(finishLevel) : undefined;
    const finished = Boolean(
      finishCount && finishCount.lessons > 0 && finishCount.done >= finishCount.lessons,
    );
    const title = lesson
      ? lesson.title || lesson.title_ar
      : finishLevel
        ? `نهاية ${finishLevel}`
        : node.type === "item"
          ? pathItemTitle(node.item)
          : "";
    return (
      <Fragment key={id}>
        <button
          type="button"
          onClick={() => {
            if (swallowClick.current) {
              swallowClick.current = false;
              return;
            }
            open(node);
          }}
          onPointerDown={(event) => onPointerDown(event, node)}
          onPointerMove={onPointerMove}
          onPointerUp={(event) => void onPointerUp(event)}
          onPointerCancel={endPress}
          onContextMenu={(event) => editing && event.preventDefault()}
          className="lp-node"
          data-state={editing ? undefined : (state ?? undefined)}
          data-drag={dragId === id ? "" : undefined}
          data-over={overId === id ? "" : undefined}
          data-fresh={fresh === id ? "" : undefined}
          style={{
            ["--x" as string]: `${centre.x - 85}px`,
            ["--y" as string]: `${place.top}px`,
            ["--i" as string]: index,
            ["--c" as string]: finished ? "#c88a12" : look.color,
            ["--soft" as string]: finished ? "#fff6df" : look.soft,
          }}
          aria-label={`${title} — ${look.word}${locked ? " (مقفل)" : ""}`}
        >
          {isCurrent && !editing && <span className="lp-here">إنت هون</span>}
          <span className="block" style={{ height: NODE_TOP - 4 }} aria-hidden="true" />
          <span
            className="lp-disc"
            data-shape={SHAPE[lookOf(node)]}
            style={{ width: NODE, height: NODE }}
          >
            {isCurrent && !editing && <span className="lp-pulse" aria-hidden="true" />}
            <span className="lp-under" />
            {lesson ? (
              <LessonImage
                src={lesson.image_url}
                alt=""
                className={`lp-face ${locked ? "is-locked" : ""}`}
              />
            ) : finished ? (
              <span className="lp-face lp-item-face">
                <span className="lp-icon">
                  <Trophy size={32} strokeWidth={2.1} aria-hidden="true" />
                </span>
              </span>
            ) : (
              <span className="lp-face lp-item-face">
                <span className="lp-icon">
                  <look.Icon size={32} strokeWidth={2.1} aria-hidden="true" />
                </span>
              </span>
            )}
            {locked && (
              <span className="lp-badge is-lock">
                <Lock size={15} />
              </span>
            )}
            {state === "done" && (
              <span className="lp-badge is-done">
                <Check size={16} strokeWidth={3} />
              </span>
            )}
            {node.type === "item" && node.item.kind === "resources" && (
              <span className="lp-count">{node.item.resource_count}</span>
            )}
            <span className="lp-pill">{look.word}</span>
          </span>
          <span className={`lp-title ${locked ? "is-locked" : ""}`}>{title}</span>
          {lesson ? (
            lesson.in_progress && !locked ? (
              <span className="lp-sub is-accent">قيد التقدّم</span>
            ) : (
              <span className="lp-sub">
                {lesson.kind === "vocabulary" ? "كلمات" : "قواعد"}
                {lesson.objective_count > 0 ? ` · ${lesson.objective_count} أهداف` : ""}
              </span>
            )
          ) : node.type === "item" && node.item.kind === "resources" ? (
            <span className="lp-sub">ملفات وروابط</span>
          ) : finishLevel ? (
            <span className="lp-sub">{finishLine(finishCount, !editing)}</span>
          ) : node.type === "item" && node.item.kind === "unit" ? (
            <span className="lp-sub">بداية وحدة · اكبس لتغيّر اسمها</span>
          ) : (
            <span className="lp-sub">
              {node.type === "item" && exerciseCount(node.item)
                ? exerciseMode(node.item) === "quiz"
                  ? `${exerciseCount(node.item)} أسئلة`
                  : exerciseMode(node.item) === "clips"
                    ? `${exerciseCount(node.item)} مقاطع`
                    : `تمارين المحطة · ${exerciseCount(node.item)}`
                : isAdmin
                  ? "اضغط لإضافة المحتوى"
                  : "قريباً"}
            </span>
          )}
        </button>
        {editing && isAdmin && lesson && (
          <button
            type="button"
            className="lp-del"
            style={{ top: place.top + 178, left: centre.x }}
            disabled={busy}
            aria-label={`إزالة من المسار · ${title}`}
            onClick={() => void removeLesson(lesson)}
          >
            <Trash2 size={14} /> إزالة
          </button>
        )}
        {editing &&
          isAdmin &&
          node.type === "item" &&
          (node.item.kind === "exercises" ||
            node.item.kind === "resources" ||
            node.item.kind === "unit") && (
            <button
              type="button"
              className="lp-del"
              style={{ top: place.top + 178, left: centre.x }}
              disabled={busy}
              aria-label={`احذف المحطة · ${title}`}
              onClick={() => void removeItem(node.item)}
            >
              <Trash2 size={14} /> احذف
            </button>
          )}
      </Fragment>
    );
  }

  const heroCount = counts.get(pageLevel);
  const partyIndex = party ? units.findIndex((unit) => unit.key === party.key) : -1;

  return (
    <main
      dir="rtl"
      className={`edith-premium lp min-h-screen bg-white pb-32 text-[var(--pp-ink)] ${isAdmin && content ? "pc-path-open" : ""}`}
      data-editing={editing ? "" : undefined}
      style={{ fontFamily: "var(--font-grotesk)" }}
    >
      <header className="lp-top sticky top-0 z-30">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link to="/learn" hash="rita" aria-label="رجوع" className="lp-back">
            <ArrowRight size={20} />
          </Link>
          <PathLanguage level={pageLevel} />
          <div className="flex items-center gap-1.5">
            {!editing && (
              <button
                type="button"
                onClick={toggleFreeOrder}
                aria-pressed={freeOrder}
                title={freeOrder ? "الترتيب الحر شغّال: كل الدروس مفتوحة" : "افتح أي درس بترتيب حر"}
                className={`lp-edit ${freeOrder ? "is-on" : ""}`}
              >
                <Shuffle size={14} aria-hidden="true" />
                ترتيب حر
              </button>
            )}
            {isAdmin && (
              <Link to="/admin/curricula" className="lp-edit">
                <FolderOpen size={15} /> مصنع الدروس
              </Link>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setEditing((value) => !value);
                  setAdding(null);
                }}
                aria-pressed={editing}
                className={`lp-edit ${editing ? "is-on" : ""}`}
              >
                {editing ? <Check size={15} /> : <Pencil size={14} />}
                {editing ? "تم" : "تعديل المسار"}
              </button>
            )}
          </div>
        </div>
      </header>

      <section
        className="lp-hero"
        key={unitMode && pageUnit ? `hero-${pageUnit.key}` : "hero"}
        data-move={unitMove}
      >
        <div className="lp-hero-text">
          {unitMode && pageUnit ? (
            <>
              <p className="lp-eyebrow">
                {learning && <LanguageFlag language={learning} size={16} />}
                {pageLevel} · الوحدة {pageUnit.number}
              </p>
              <h2 className="lp-heading">{pageUnit.title ?? `الوحدة ${pageUnit.number}`}</h2>
              {pageUnit.lessons > 0 && (
                <div className="lp-progress">
                  <p>
                    {unitDone(pageUnit) ? (
                      "خلّصت هالوحدة كلها. برافو!"
                    ) : (
                      <>
                        خلّصت <b>{pageUnit.done}</b> من {pageUnit.lessons} بهالوحدة
                      </>
                    )}
                  </p>
                  <span
                    className="lp-progress-bar"
                    role="progressbar"
                    aria-label={`التقدّم بالوحدة ${pageUnit.number}`}
                    aria-valuemin={0}
                    aria-valuemax={pageUnit.lessons}
                    aria-valuenow={pageUnit.done}
                  >
                    <span style={{ width: `${(pageUnit.done / pageUnit.lessons) * 100}%` }} />
                  </span>
                </div>
              )}
              <div className="lp-hero-actions">
                {current && pageUnit.current ? (
                  <button
                    type="button"
                    className="lp-continue"
                    onClick={() => onOpenLesson(current)}
                  >
                    <span className="lp-continue-label">كمّل</span>
                    <span className="lp-continue-title">{current.title || current.title_ar}</span>
                    <ArrowLeft size={18} aria-hidden="true" />
                  </button>
                ) : nextUnit && nextOpen && unitDone(pageUnit) ? (
                  <button
                    type="button"
                    className="lp-continue"
                    onClick={() => goUnit(unitIndex + 1)}
                  >
                    افتح الوحدة {nextUnit.number}
                    <ArrowLeft size={18} aria-hidden="true" />
                  </button>
                ) : null}
                <button type="button" className="lp-guide-open" onClick={() => setGuideOpen(true)}>
                  <BookOpenText size={17} aria-hidden="true" />
                  دليل الوحدة
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="lp-eyebrow">
                المستوى {pageLevel}
                {learning ? " · " : ""}
                {learning && <LanguageFlag language={learning} size={16} />}
              </p>
              <h2 className="lp-heading">دروسك مع يوزرا</h2>
              {editing && heroCount && heroCount.lessons > 0 && (
                <div className="lp-progress">
                  <p>
                    خلّصت <b>{heroCount.done}</b> من {heroCount.lessons} دروس بـ {pageLevel}
                  </p>
                  <span
                    className="lp-progress-bar"
                    role="progressbar"
                    aria-label={`التقدّم بالمستوى ${pageLevel}`}
                    aria-valuemin={0}
                    aria-valuemax={heroCount.lessons}
                    aria-valuenow={heroCount.done}
                  >
                    <span style={{ width: `${(heroCount.done / heroCount.lessons) * 100}%` }} />
                  </span>
                </div>
              )}
              {current?.level === pageLevel && !editing && (
                <button type="button" className="lp-continue" onClick={() => onOpenLesson(current)}>
                  <span className="lp-continue-label">كمّل</span>
                  <span className="lp-continue-title">{current.title || current.title_ar}</span>
                  <ArrowLeft size={18} aria-hidden="true" />
                </button>
              )}
            </>
          )}
        </div>
        <span className="lp-hero-cube" aria-hidden="true">
          <RitaCube levelsRef={cubeLevels} mode="idle" label="" />
        </span>
      </section>

      {unitMode && units.length > 1 && (
        <nav className="lp-units" aria-label="وحدات المستوى">
          {units.slice(0, visibleUnits(units)).map((unit, index) => {
            const open = unitOpen(units, index, frontier);
            const done = unit.lessons > 0 && unitDone(unit);
            return (
              <Fragment key={unit.key}>
                {index > 0 && <span className="lp-units-line" data-done={done ? "" : undefined} />}
                <button
                  type="button"
                  className="lp-unit-pill"
                  data-state={
                    !open ? "locked" : done ? "done" : index === frontier ? "current" : "open"
                  }
                  aria-current={index === unitIndex ? "page" : undefined}
                  aria-disabled={!open || undefined}
                  title={unit.title ?? `الوحدة ${unit.number}`}
                  aria-label={
                    open
                      ? `الوحدة ${unit.number}${unit.title ? ` · ${unit.title}` : ""}${done ? " · خلصت" : ""}`
                      : `الوحدة ${unit.number} · مقفولة لحد ما تخلّص الوحدة اللي قبلها`
                  }
                  onClick={() =>
                    open ? goUnit(index) : setHint("خلّص الوحدة اللي قبلها وبتنفتحلك هاي.")
                  }
                >
                  {!open ? (
                    <Lock size={15} aria-hidden="true" />
                  ) : done ? (
                    <Check size={17} strokeWidth={3} aria-hidden="true" />
                  ) : (
                    unit.number
                  )}
                </button>
              </Fragment>
            );
          })}
        </nav>
      )}

      <section className="mx-auto max-w-md px-4 text-center">
        {isAdmin && lessons && !error && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="lp-edit"
              disabled={busy}
              onClick={() => void add("quiz", endOfPage)}
            >
              <Plus size={16} /> أضف محطة أسئلة
            </button>
            <button
              type="button"
              className="lp-edit"
              disabled={busy}
              onClick={() => void add("clips", endOfPage)}
            >
              <Plus size={16} /> أضف محطة أفلام وGIF
            </button>
            <Link to="/admin/clips" className="lp-edit">
              <Clapperboard size={16} aria-hidden="true" /> مكتبة المقاطع
            </Link>
          </div>
        )}
        {editing && (
          <p className="lp-edit-hint">
            اضغط مطوّلاً على أي محطة واسحبها فوق ثانية عشان يتبدّلوا. اكبس الدرس لتفتح صفحته
            بالمراجعة والنشر، أو + لإضافة تمارين أو ملفات. الوحدات بتنقسم لحالها كل 5 دروس، أو حط
            «بداية وحدة» من + لتحدّدها وتسمّيها.
          </p>
        )}
      </section>

      {reviews.length > 0 && !editing && (
        <section className="mx-auto mt-4 max-w-md px-4">
          <div className="rounded-2xl bg-[var(--pp-grey)] p-3 text-right">
            <p className="text-xs font-bold text-[var(--pp-accent-text)]">مراجعة مقترحة</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {reviews.slice(0, 4).map((review) => (
                <button
                  key={review.id}
                  type="button"
                  onClick={() => openReview(review)}
                  className="min-h-10 rounded-lg bg-white px-3 py-2 text-xs font-bold text-[var(--pp-ink)]"
                >
                  {review.title} · قبل {review.daysAgo} يوم
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {error && (
        <p className="mx-auto mt-6 max-w-md rounded-2xl bg-red-50 px-4 py-3 text-center text-sm font-bold text-red-700">
          {error}
        </p>
      )}
      {!lessons && !error && (
        <div className="grid place-items-center py-24 text-[var(--pp-accent-text)]">
          <Loader2 className="animate-spin" />
        </div>
      )}
      {lessons && !hasPageLessons && !editing && (
        <div className="mx-auto mt-16 max-w-xs text-center">
          {learning && (
            <span className="mx-auto mb-3 grid w-fit">
              <LanguageFlag language={learning} size={40} />
            </span>
          )}
          <p className="font-semibold text-[var(--pp-ink)]">
            لسا ما في دروس منشورة للمستوى {pageLevel}.
          </p>
          {!isAdmin && (
            <p className="mt-1 text-sm text-[var(--pp-muted)]">
              {languages.length > 1
                ? "بتقدر تبدّل اللغة من العلم فوق، أو جرّب محادثة حرة مع يوزرا:"
                : "جرّب محادثة حرة مع يوزرا حتى تجهز الدروس:"}
            </p>
          )}
          {isAdmin && (
            <Link to="/admin/curricula" className="rita-btn rita-btn-primary mt-4">
              اصنع دروس للمستوى {pageLevel} بمصنع الدروس
            </Link>
          )}
          {!isAdmin && (
            <Link to="/rita-live" className="rita-btn rita-btn-primary mt-4 gap-2 !inline-flex">
              <MessageCircle size={16} /> محادثة حرة مع يوزرا
            </Link>
          )}
        </div>
      )}

      {lessons && (lastNodeOnPage || editing) && (
        <div
          ref={board}
          key={unitMode && pageUnit ? `board-${pageLevel}-${pageUnit.key}` : `board-${pageLevel}`}
          className="lp-board relative mx-auto mt-8"
          data-move={unitMode ? unitMove : undefined}
          style={{ width: WIDTH, height }}
        >
          <svg
            className="pointer-events-none absolute inset-0"
            width={WIDTH}
            height={height}
            aria-hidden="true"
          >
            <path d={road} className="lp-road" />
            {walked && <path d={walked} className="lp-road is-walked" />}
            {road &&
              !editing &&
              [0, 1, 2].map((dot) => (
                <circle key={dot} r="2.4" className="lp-spark">
                  <animateMotion
                    dur={`${Math.max(6, nodes.length * 2.4)}s`}
                    // Started in the past, so each light is already on the road (never parked at 0,0).
                    begin={`-${dot * Math.max(2, nodes.length * 0.8)}s`}
                    repeatCount="indefinite"
                    path={road}
                  />
                </circle>
              ))}
          </svg>
          {!editing &&
            nodeRows.map((rowIndex, index) => {
              const next = layout[rowIndex + 1];
              if (index % 2 === 1 || !next || rows[rowIndex + 1].type !== "node") return null;
              const centre = layout[rowIndex];
              const Doodle = DOODLES[(index / 2) % DOODLES.length];
              // Halfway to the next stop, on the side the road is not leaning to.
              const side = (centre.x + next.x) / 2 >= WIDTH / 2 ? -1 : 1;
              return (
                <span
                  key={`doodle-${index}`}
                  className="lp-doodle"
                  aria-hidden="true"
                  style={{
                    left: WIDTH / 2 + side * 150 - 14,
                    top: (centre.y + next.y) / 2 - 14,
                    ["--i" as string]: index,
                  }}
                >
                  <Doodle size={28} strokeWidth={1.4} />
                </span>
              );
            })}

          {editing || rows.length < 16
            ? rows.map(renderRow)
            : Array.from({ length: Math.ceil(rows.length / 8) }, (_, group) => {
                const first = group * 8;
                const last = layout[Math.min(first + 7, rows.length - 1)];
                const top = layout[first].top - 32;
                return (
                  <div
                    className="lp-row-group"
                    key={first}
                    style={{ top, height: last.top + last.h + 32 - top }}
                  >
                    <div className="lp-row-origin" style={{ top: -top }}>
                      {rows
                        .slice(first, first + 8)
                        .map((row, offset) => renderRow(row, first + offset))}
                    </div>
                  </div>
                );
              })}

          {pluses.map((plus) => (
            <div
              key={`plus-${plus.index}`}
              className="lp-plus-wrap"
              style={{ left: plus.x, top: plus.y }}
            >
              <button
                type="button"
                className="lp-plus"
                aria-label="أضف محطة هون"
                aria-expanded={adding === plus.index}
                disabled={busy}
                onClick={() => setAdding(adding === plus.index ? null : plus.index)}
              >
                <Plus size={18} strokeWidth={2.6} />
              </button>
              {adding === plus.index && (
                <div className="lp-add" role="menu">
                  {(["unit", "quiz", "clips", "resources", "finish"] as NewStop[]).map((kind) => {
                    const Icon = LOOK[kind].Icon;
                    return (
                      <button
                        key={kind}
                        type="button"
                        role="menuitem"
                        onClick={() => void add(kind, plus.index)}
                        style={{
                          ["--c" as string]: LOOK[kind].color,
                          ["--soft" as string]: LOOK[kind].soft,
                        }}
                      >
                        <span>
                          <Icon size={18} />
                        </span>
                        {kind === "unit"
                          ? "بداية وحدة"
                          : kind === "quiz"
                            ? "أسئلة من Lecture Lab"
                            : kind === "clips"
                              ? "أفلام وGIF"
                              : kind === "resources"
                                ? "ملفات وروابط"
                                : `خط نهاية ${pageLevel}`}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {lessons && !error && (previousLevel || followingLevel) && (
        <nav
          aria-label="مستويات الدروس"
          className="mx-auto my-6 flex max-w-md flex-wrap justify-between gap-3 px-4 pb-8"
        >
          {previousLevel && (
            <button
              type="button"
              disabled={busy}
              className="lp-prev"
              onClick={() => showLevel(previousLevel)}
            >
              ارجع إلى {previousLevel}
            </button>
          )}
          {followingLevel &&
            (!unitMode || !nextUnit) &&
            (isAdmin || hasFollowingContent ? (
              <button
                type="button"
                disabled={busy}
                className="lp-next"
                onClick={() => showLevel(followingLevel)}
              >
                انتقل إلى {followingLevel}
                <ArrowLeft size={17} aria-hidden="true" />
              </button>
            ) : (
              <span className="text-sm text-[var(--pp-muted)]">
                المستوى {followingLevel} · قريبًا
              </span>
            ))}
        </nav>
      )}
      {hint && (
        <p
          className="fixed inset-x-4 bottom-28 z-30 mx-auto max-w-sm rounded-lg bg-[var(--pp-ink)] px-4 py-3 text-center text-[15px] font-semibold text-white"
          onClick={() => setHint("")}
        >
          {hint}
        </p>
      )}

      {current?.level === pageLevel && !editing && (
        <div className="lp-bottom fixed inset-x-0 bottom-0 z-20 px-4 py-3">
          <div className="mx-auto flex max-w-md items-center justify-between gap-4">
            <div className="min-w-0 text-right">
              <p className="text-[11.5px] font-semibold text-[var(--pp-muted)]">الدرس الحالي</p>
              <p className="truncate text-[14px] font-semibold">
                {current.title || current.title_ar}
              </p>
            </div>
            <button type="button" onClick={() => onOpenLesson(current)} className="lp-go shrink-0">
              متابعة
              <ArrowLeft size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {unitMode && away && current && pageUnit?.current && (
        <button
          type="button"
          className="lp-back-to"
          onClick={() =>
            board.current?.querySelector('[data-state="current"]')?.scrollIntoView({
              block: "center",
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "auto"
                : "smooth",
            })
          }
        >
          {away === "up" ? (
            <ArrowUp size={18} aria-hidden="true" />
          ) : (
            <ArrowDown size={18} aria-hidden="true" />
          )}
          ارجع لدرسك
        </button>
      )}

      {party && (
        <UnitCelebration
          unit={party}
          next={partyIndex >= 0 ? (units[partyIndex + 1] ?? null) : null}
          level={pageLevel}
          following={followingLevel && hasFollowingContent ? followingLevel : null}
          onNext={() => {
            setParty(null);
            goUnit(partyIndex + 1);
          }}
          onLevel={(level) => {
            setParty(null);
            showLevel(level);
          }}
          onClose={() => setParty(null)}
        />
      )}

      {guideOpen && pageUnit && (
        <UnitGuide
          unit={pageUnit}
          level={pageLevel}
          lessons={allRows
            .slice(pageUnit.start, pageUnit.end)
            .flatMap((r) => (r.type === "node" && r.node.type === "lesson" ? [r.node.lesson] : []))}
          stateOf={stateOf}
          onClose={() => setGuideOpen(false)}
        />
      )}

      {isAdmin && content && (
        <Suspense
          fallback={
            <p
              className={`fixed inset-y-0 right-0 z-50 grid w-full place-items-center border-l border-[var(--pp-line)] bg-white text-[var(--pp-ink)] ${content.item?.kind === "exercises" ? "" : "min-[1100px]:w-[58vw]"}`}
              role="status"
            >
              تحميل إدارة المحتوى…
            </p>
          }
        >
          <PathContentPanel
            request={content}
            language={language}
            items={items}
            onClose={() => setContent(null)}
            onReload={onReload}
          />
        </Suspense>
      )}
      {sheet && (
        <PathStopSheet
          item={sheet}
          admin={isAdmin && (sheet.kind !== "exercises" || editing)}
          color={LOOK[exerciseMode(sheet) ?? sheet.kind].color}
          onClose={() => setSheet(null)}
          onChanged={onReload}
        />
      )}
    </main>
  );
}

function finishLine(count: LevelCount | undefined, learner = false) {
  if (!count || count.lessons === 0) return "خط النهاية";
  if (count.done >= count.lessons) return "خلّصت المستوى";
  // Learners are not told how many lessons a level holds.
  return learner ? "خط النهاية" : `${count.done} من ${count.lessons} دروس`;
}

/** The finish line drawn after a level's last lesson (when the admin placed none of their own). */
function FinishStop({
  level,
  count,
  x,
  top,
  index,
  onOpen,
  learner = false,
}: {
  level: Level;
  count: LevelCount;
  x: number;
  top: number;
  index: number;
  onOpen: () => void;
  learner?: boolean;
}) {
  const finished = count.lessons > 0 && count.done >= count.lessons;
  const look = LOOK.finish;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="lp-node lp-finish"
      data-finished={finished ? "" : undefined}
      style={{
        ["--x" as string]: `${x - 85}px`,
        ["--y" as string]: `${top}px`,
        ["--i" as string]: index,
        ["--c" as string]: look.color,
        ["--soft" as string]: look.soft,
      }}
      aria-label={`نهاية المستوى ${level} — ${finishLine(count, learner)}`}
    >
      <span className="block" style={{ height: NODE_TOP - 4 }} aria-hidden="true" />
      <span className="lp-disc" data-shape="medal" style={{ width: NODE, height: NODE }}>
        <span className="lp-under" />
        <span className="lp-face lp-item-face">
          {finished ? (
            <Trophy size={32} strokeWidth={2.1} aria-hidden="true" />
          ) : (
            <Flag size={32} strokeWidth={2.1} aria-hidden="true" />
          )}
        </span>
        <span className="lp-pill">{look.word}</span>
      </span>
      <span className="lp-title">نهاية {level}</span>
      <span className="lp-sub">{finishLine(count, learner)}</span>
    </button>
  );
}

/** A level's banner on the road, or the «coming soon» one after the last level. */
const LEVEL_NAME: Partial<Record<Level, string>> = {
  A1: "مبتدئ · A1",
  A2: "أساسي · A2",
  B1: "متوسط · B1",
  B2: "فوق المتوسط · B2",
  C1: "متقدّم · C1",
  C2: "متمكّن · C2",
};

/** What a learner can do at the end of each level (after the CEFR descriptions), in plain words. */
const LEVEL_CAN: Partial<Record<Level, string>> = {
  A1: "بآخرها بتعرّف عن حالك، وبتسأل وبتجاوب عن أشياء بسيطة متل الأكل والمكان.",
  A2: "بآخرها بتحكي عن يومك وعيلتك وشغلك، وبتدبّر حالك بالسفر والتسوّق.",
  B1: "بآخرها بتحكي عن تجاربك وخططك، وبتفهم الفكرة الرئيسية بالحكي الواضح.",
  B2: "بآخرها بتناقش وبتدافع عن رأيك، وبتفهم معظم الأفلام والأخبار.",
  C1: "بآخرها بتحكي بطلاقة عن مواضيع معقّدة بالشغل والدراسة.",
  C2: "بآخرها بتفهم تقريباً كل شي بتسمعه أو بتقرأه، وبتعبّر بدقة.",
};

function LevelBanner({
  row,
  top,
  index,
  editing,
  startLevel,
  lowest,
  onStart,
  learner = false,
}: {
  row: Extract<LevelRow<unknown>, { type: "banner" }>;
  top: number;
  index: number;
  editing: boolean;
  startLevel: Level | null;
  lowest: number;
  onStart: (level: Level | null) => void;
  /** Learners see what the level lets them do, never how many lessons it holds. */
  learner?: boolean;
}) {
  const rank = levelRank(row.level);
  const startedHere = startLevel === row.level && rank > lowest;
  const canStart = !editing && rank > lowest && !startedHere && row.count.done < row.count.lessons;
  const canReset =
    !editing && rank === lowest && startLevel !== null && levelRank(startLevel) > lowest;
  return (
    <div className="lp-level" style={{ top: top + 12, ["--i" as string]: index }}>
      <span className="lp-level-chip" dir="ltr">
        {row.level}
      </span>
      <span className="min-w-0 flex-1">
        <span className="lp-level-name">{LEVEL_NAME[row.level] ?? `المستوى ${row.level}`}</span>
        <span className="lp-level-sub">
          {learner
            ? (LEVEL_CAN[row.level] ?? "")
            : `${row.count.done} من ${row.count.lessons} دروس`}
          {startedHere ? " · بدأت من هون" : ""}
        </span>
        {!learner && row.count.lessons > 0 && (
          <span className="lp-level-bar" aria-hidden="true">
            <span style={{ width: `${(row.count.done / row.count.lessons) * 100}%` }} />
          </span>
        )}
      </span>
      {canStart && (
        <button type="button" className="lp-level-go" onClick={() => onStart(row.level)}>
          ابدأ من هون
        </button>
      )}
      {canReset && (
        <button type="button" className="lp-level-go" onClick={() => onStart(null)}>
          ابدأ من الأول
        </button>
      )}
    </div>
  );
}

/** A unit's heading on the road, when every unit shows at once («ترتيب حر»). */
function UnitHeading({
  unit,
  top,
  index,
  open,
}: {
  unit: PathUnit;
  top: number;
  index: number;
  open: boolean;
}) {
  const done = unit.lessons > 0 && unitDone(unit);
  return (
    <div className="lp-unit-head" style={{ top: top + 16, ["--i" as string]: index }}>
      <span className="lp-unit-num" data-done={done ? "" : undefined} dir="ltr">
        {done ? <Check size={18} strokeWidth={3} aria-hidden="true" /> : unit.number}
      </span>
      <span className="min-w-0 flex-1">
        <span className="lp-unit-kicker">الوحدة {unit.number}</span>
        <span className="lp-unit-name">{unit.title ?? (open ? "كمّل على الطريق" : "بعدين")}</span>
      </span>
      {!open && <Lock size={16} className="text-[var(--pp-muted)]" aria-hidden="true" />}
    </div>
  );
}

/**
 * The next unit, at the end of the road: closed (a few faint stops behind a dashed card, and when
 * it opens), or opened (a black card with «افتح الوحدة n»). Never says how many lessons it holds.
 */
function UnitGate({
  unit,
  open,
  top,
  index,
  onOpen,
}: {
  unit: PathUnit;
  open: boolean;
  top: number;
  index: number;
  onOpen: () => void;
}) {
  return (
    <div
      className="lp-gate"
      data-open={open ? "" : undefined}
      style={{ top: top + 24, ["--i" as string]: index }}
    >
      <span className="lp-gate-ghosts" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="lp-gate-icon" aria-hidden="true">
        {open ? <Sparkles size={20} /> : <Lock size={18} />}
      </span>
      <span className="lp-gate-kicker">الوحدة {unit.number}</span>
      <span className="lp-gate-title">{unit.title ?? (open ? "جاهزة إلك" : "الوحدة الجاية")}</span>
      {open ? (
        <button type="button" className="lp-gate-go" onClick={onOpen}>
          افتح الوحدة {unit.number}
          <ArrowLeft size={17} aria-hidden="true" />
        </button>
      ) : (
        <span className="lp-gate-note">بتنفتح لما تخلّص هالوحدة</span>
      )}
    </div>
  );
}

/** The moment a unit is finished: Uzyra's cube, a few sparks, and the way on. */
function UnitCelebration({
  unit,
  next,
  level,
  following,
  onNext,
  onLevel,
  onClose,
}: {
  unit: PathUnit;
  next: PathUnit | null;
  level: Level;
  following: Level | null;
  onNext: () => void;
  onLevel: (level: Level) => void;
  onClose: () => void;
}) {
  const cube = useRef({ input: 0, output: 0 });
  const primary = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Once, when it appears: the sound, the focus, and Escape to close.
  useEffect(() => {
    confirmSound();
    primary.current?.focus({ preventScroll: true });
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const levelDone = !next;
  return (
    <div className="lp-party" role="dialog" aria-modal="true" aria-labelledby="lp-party-title">
      <div className="lp-party-card">
        <span className="lp-party-burst" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <i
              key={i}
              style={{ ["--a" as string]: `${(i * 360) / 14}deg`, ["--d" as string]: i }}
            />
          ))}
        </span>
        <span className="lp-party-cube" aria-hidden="true">
          <RitaCube levelsRef={cube} mode="speaking" label="" />
        </span>
        <p className="lp-party-kicker">
          {levelDone ? `المستوى ${level}` : `الوحدة ${unit.number}`}
          {unit.title ? ` · ${unit.title}` : ""}
        </p>
        <h2 id="lp-party-title" className="lp-party-title">
          {levelDone ? `خلّصت ${level}!` : "خلّصت الوحدة!"}
        </h2>
        <p className="lp-party-lead">
          {next
            ? `الوحدة ${next.number} صارت مفتوحة إلك.`
            : following
              ? `المستوى ${following} مستنّيك.`
              : "برافو! كمّل على هالطريق كل يوم شوي."}
        </p>
        <div className="lp-party-actions">
          {next ? (
            <button ref={primary} type="button" className="lp-continue" onClick={onNext}>
              افتح الوحدة {next.number}
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
          ) : following ? (
            <button
              ref={primary}
              type="button"
              className="lp-continue"
              onClick={() => onLevel(following)}
            >
              انتقل إلى {following}
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
          ) : null}
          <button type="button" className="lp-party-later" onClick={onClose}>
            {next || following ? "بعدين" : "تمام"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The unit's guide: what each of its lessons teaches (their goals), before or after taking them. */
function UnitGuide({
  unit,
  level,
  lessons,
  stateOf,
  onClose,
}: {
  unit: PathUnit;
  level: Level;
  lessons: PathLesson[];
  stateOf: (lesson: PathLesson) => ViewState;
  onClose: () => void;
}) {
  const preview = useServerFn(getLessonPreview);
  const [goals, setGoals] = useState<Record<string, LessonPreview["lesson"]["objectives"] | null>>(
    {},
  );
  const close = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    close.current?.focus({ preventScroll: true });
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    let live = true;
    for (const lesson of lessons) {
      preview({ data: { lessonId: lesson.id } })
        .then((found) => {
          if (live) setGoals((old) => ({ ...old, [lesson.id]: found.lesson.objectives }));
        })
        .catch(() => {
          if (live) setGoals((old) => ({ ...old, [lesson.id]: null }));
        });
    }
    return () => {
      live = false;
    };
    // The unit's lessons are fixed while the guide is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="lp-guide-back" onClick={onClose}>
      <aside
        className="lp-guide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lp-guide-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="lp-guide-head">
          <div className="min-w-0">
            <p className="lp-guide-kicker">
              {level} · الوحدة {unit.number}
            </p>
            <h2 id="lp-guide-title" className="lp-guide-title">
              {unit.title ?? `دليل الوحدة ${unit.number}`}
            </h2>
          </div>
          <button
            ref={close}
            type="button"
            className="lp-guide-x"
            aria-label="سكّر الدليل"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <p className="lp-guide-lead">
          {LEVEL_CAN[level] ? `المستوى ${level}: ${LEVEL_CAN[level]}` : "شو رح تتعلّم بهالوحدة."}
        </p>
        <ol className="lp-guide-list">
          {lessons.map((lesson, index) => {
            const state = stateOf(lesson);
            const list = goals[lesson.id];
            return (
              <li key={lesson.id} data-state={state}>
                <span className="lp-guide-num" aria-hidden="true">
                  {state === "done" ? <Check size={15} strokeWidth={3} /> : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="lp-guide-lesson" dir="auto">
                    {lesson.title || lesson.title_ar}
                  </p>
                  <p className="lp-guide-meta">
                    {lesson.kind === "vocabulary" ? "كلمات" : "قواعد"}
                    {state === "done" ? " · خلصته" : state === "current" ? " · إنت هون" : ""}
                  </p>
                  {list === undefined ? (
                    <p className="lp-guide-wait">
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" /> عم بجيب
                      أهداف الدرس…
                    </p>
                  ) : list && list.length > 0 ? (
                    <ul className="lp-guide-goals">
                      {list.map((goal) => (
                        <li key={goal.id} dir="auto">
                          {goal.text_ar || goal.text}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}
