import "./lesson-path.css";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ContentRequest } from "./admin/PathContentPanel";
import type { PointerEvent as ReactPointerEvent } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
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
} from "lucide-react";
import {
  adminSetLessonStatus,
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
  adminSavePathLayout,
} from "@/lib/rita-path-items.functions";
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
};

type Node = { type: "lesson"; lesson: PathLesson } | { type: "item"; item: PathItem };

const idOf = (node: Node) => (node.type === "lesson" ? node.lesson.id : node.item.id);
const refOf = (node: Node): PathRef => ({ type: node.type, id: idOf(node) });
const lookOf = (node: Node): Look =>
  node.type === "item"
    ? (exerciseMode(node.item) ?? node.item.kind)
    : node.lesson.experience === "study"
      ? "study"
      : "classic";

/** The stops an admin can add, each with its own look. */
type NewStop = "quiz" | "clips" | "resources" | "finish";
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
  const navigate = useNavigate();
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
  const rows = useMemo(
    () => allRows.filter((r) => !editing || r.type !== "finish"),
    [allRows, editing],
  );
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
      const h = r.type === "banner" ? BANNER_ROW : row;
      const isStop = r.type === "node" || r.type === "finish";
      const x = isStop ? WIDTH / 2 + ZIGZAG[stop++ % ZIGZAG.length] : WIDTH / 2;
      const y = isStop ? top + NODE_TOP + NODE / 2 : top + h / 2;
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
      else if (exerciseCount(node.item)) setSheet(node.item);
      else setHint("لسا ما انضافت تمارين لهاي المحطة.");
      return;
    }
    if (editing) {
      if (isAdmin)
        setContent(node.type === "lesson" ? { lessonId: node.lesson.id } : { item: node.item });
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
    setHint(
      count.lessons > 0 && count.done >= count.lessons
        ? `خلّصت المستوى ${level} كله. برافو!`
        : `خلّصت ${count.done} من ${count.lessons} دروس بالمستوى ${level}. كمّل للنهاية.`,
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

  async function add(stop: NewStop, index: number) {
    setAdding(null);
    setBusy(true);
    const kind: PathItemKind = stop === "quiz" || stop === "clips" ? "exercises" : stop;
    try {
      const created = await addFn({
        data: {
          language,
          level: pageLevel,
          kind,
          ...(kind === "exercises" && { mode: stop as ExerciseMode }),
          title: stop === "finish" ? pageLevel : NEW_STOP_TITLE[stop],
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
      if (kind !== "finish") setContent({ item: created });
      setFresh(created.id);
      confirmSound();
      window.setTimeout(() => setFresh(""), 900);
      await onReload();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "ما انضافت المحطة. جرّب مرة ثانية.");
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
          <span className="lp-disc" style={{ width: NODE, height: NODE }}>
            {isCurrent && !editing && <span className="lp-pulse" aria-hidden="true" />}
            <span className="absolute inset-0 rounded-full bg-white" />
            {lesson ? (
              <LessonImage
                src={lesson.image_url}
                alt=""
                className={`lp-face ${locked ? "is-locked" : ""}`}
              />
            ) : finished ? (
              <span className="lp-face lp-item-face">
                <Trophy size={32} strokeWidth={2.1} aria-hidden="true" />
              </span>
            ) : (
              <span className="lp-face lp-item-face">
                <look.Icon size={32} strokeWidth={2.1} aria-hidden="true" />
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
            <span className="lp-sub">{finishLine(finishCount)}</span>
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
            className="rita-btn rita-btn-quiet absolute min-h-11 text-red-700"
            style={{ top: place.top + 174, left: centre.x, transform: "translateX(-50%)" }}
            disabled={busy}
            aria-label={`إزالة من المسار · ${title}`}
            onClick={() => void removeLesson(lesson)}
          >
            <Trash2 size={15} /> إزالة من المسار
          </button>
        )}
        {editing &&
          isAdmin &&
          node.type === "item" &&
          (node.item.kind === "exercises" || node.item.kind === "resources") && (
            <button
              type="button"
              className="rita-btn rita-btn-quiet absolute min-h-11 text-red-700"
              style={{ top: place.top + 174, left: centre.x, transform: "translateX(-50%)" }}
              disabled={busy}
              aria-label={`احذف المحطة · ${title}`}
              onClick={() => void removeItem(node.item)}
            >
              <Trash2 size={15} /> احذف المحطة
            </button>
          )}
      </Fragment>
    );
  }

  return (
    <main
      dir="rtl"
      className={`edith-premium lp min-h-screen bg-white pb-32 text-[var(--pp-ink)] ${isAdmin && content ? "pc-path-open" : ""}`}
      data-editing={editing ? "" : undefined}
      style={{ fontFamily: "var(--font-grotesk)" }}
    >
      <header className="sticky top-0 z-30 border-b border-[var(--pp-line)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link
            to="/learn"
            hash="rita"
            aria-label="رجوع"
            className="grid h-10 w-10 place-items-center rounded-full text-[var(--pp-muted)] hover:bg-[var(--pp-grey)]"
          >
            <ArrowRight size={22} />
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
              <button
                type="button"
                className="lp-edit"
                aria-haspopup="dialog"
                aria-expanded={Boolean(content)}
                onClick={() => {
                  setEditing(true);
                  setContent({ level: pageLevel });
                }}
              >
                <FolderOpen size={15} /> إدارة المحتوى
              </button>
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

      <section className="mx-auto max-w-md px-4 pt-7 text-center">
        <h2 className="lp-heading">دروسك مع يوزرا</h2>
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
            اضغط مطوّلاً على أي محطة واسحبها فوق ثانية عشان يتبدّلوا. اكبس الدرس لتحريره أو + لإضافة
            درس أو تمارين أو ملفات.
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
            <button
              type="button"
              className="rita-btn rita-btn-primary mt-4"
              onClick={() => {
                setContent({
                  level: pageLevel,
                  insert: {
                    before: nodes[endOfPage - 1] ? idOf(nodes[endOfPage - 1]) : undefined,
                    after: nodes[endOfPage] ? idOf(nodes[endOfPage]) : undefined,
                  },
                });
              }}
            >
              أضف أول درس للمستوى {pageLevel}
            </button>
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
          className="lp-board relative mx-auto mt-8"
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
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      const before = nodes[plus.index - 1];
                      const after = nodes[plus.index];
                      setContent({
                        level: pageLevel,
                        insert: {
                          before: before ? idOf(before) : undefined,
                          after: after ? idOf(after) : undefined,
                        },
                      });
                      setAdding(null);
                    }}
                  >
                    <span>
                      <BookOpen size={18} />
                    </span>
                    درس من كتاب أو درس موجود
                  </button>
                  {(["quiz", "clips", "resources", "finish"] as NewStop[]).map((kind) => {
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
                        {kind === "quiz"
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
              className="rita-btn rita-btn-quiet"
              onClick={() => showLevel(previousLevel)}
            >
              ارجع إلى {previousLevel}
            </button>
          )}
          {followingLevel &&
            (isAdmin || hasFollowingContent ? (
              <button
                type="button"
                disabled={busy}
                className="rita-btn rita-btn-primary"
                onClick={() => showLevel(followingLevel)}
              >
                انتقل إلى {followingLevel}
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
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--pp-line)] bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center justify-between gap-4">
            <div className="min-w-0 text-right">
              <p className="text-[11.5px] font-semibold text-[var(--pp-muted)]">الدرس الحالي</p>
              <p className="truncate text-[14px] font-semibold">
                {current.title || current.title_ar}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenLesson(current)}
              className="rita-btn rita-btn-primary lp-go shrink-0"
            >
              متابعة
            </button>
          </div>
        </div>
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

function finishLine(count: LevelCount | undefined) {
  if (!count || count.lessons === 0) return "خط النهاية";
  return count.done >= count.lessons ? "خلّصت المستوى" : `${count.done} من ${count.lessons} دروس`;
}

/** The finish line drawn after a level's last lesson (when the admin placed none of their own). */
function FinishStop({
  level,
  count,
  x,
  top,
  index,
  onOpen,
}: {
  level: Level;
  count: LevelCount;
  x: number;
  top: number;
  index: number;
  onOpen: () => void;
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
      aria-label={`نهاية المستوى ${level} — ${finishLine(count)}`}
    >
      <span className="block" style={{ height: NODE_TOP - 4 }} aria-hidden="true" />
      <span className="lp-disc" style={{ width: NODE, height: NODE }}>
        <span className="absolute inset-0 rounded-full bg-white" />
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
      <span className="lp-sub">{finishLine(count)}</span>
    </button>
  );
}

/** A level's banner on the road, or the «coming soon» one after the last level. */
function LevelBanner({
  row,
  top,
  index,
  editing,
  startLevel,
  lowest,
  onStart,
}: {
  row: Extract<LevelRow<unknown>, { type: "banner" }>;
  top: number;
  index: number;
  editing: boolean;
  startLevel: Level | null;
  lowest: number;
  onStart: (level: Level | null) => void;
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
        <span className="lp-level-name">المستوى {row.level}</span>
        <span className="lp-level-sub">
          {row.count.done} من {row.count.lessons} دروس{startedHere ? " · بدأت من هون" : ""}
        </span>
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
