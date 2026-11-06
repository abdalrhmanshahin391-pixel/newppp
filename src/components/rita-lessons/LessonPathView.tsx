import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Check,
  Dumbbell,
  FileText,
  FolderOpen,
  Loader2,
  Lock,
  MessageCircle,
  Pencil,
  Plus,
  Star,
} from "lucide-react";
import type { PathLesson, ReviewSuggestion } from "@/lib/rita-curriculum.functions";
import {
  mergePath,
  swapRefs,
  type PathItem,
  type PathItemKind,
  type PathRef,
} from "@/lib/rita-path-layout";
import { adminAddPathItem, adminSavePathLayout } from "@/lib/rita-path-items.functions";
import {
  confirmSound,
  installSoundUnlock,
  menuCloseSound,
  menuOpenSound,
  optionNote,
} from "@/components/rita-study/tech-sound";
import { LessonImage, LessonStars } from "./LessonArt";
import { PathStopSheet } from "./PathStopSheet";

// Horizontal offsets that make the path zig-zag, as in the lesson map design.
const ZIGZAG = [0, 64, 90, 64, 0, -64, -90, -64];
/** Height of one stop on the road; editing leaves a gap between stops for the + buttons. */
const ROW = 212;
const ROW_EDITING = 262;
/** How tall a stop's content is (stars, picture, two title lines, the small line). */
const STOP_HEIGHT = 206;
const WIDTH = 360;
const NODE = 104;
const FREE_ORDER_KEY = "ritaFreeOrder";
const HOLD_MS = 300;

type Look = "study" | "classic" | PathItemKind;

/** Each kind of stop has its own colour, word and picture, used everywhere on the path. */
const LOOK: Record<Look, { color: string; soft: string; word: string; Icon: typeof FileText }> = {
  study: { color: "#16a34a", soft: "#e9f8ef", word: "PDF + صوت", Icon: FileText },
  classic: { color: "#2b6df0", soft: "#e7eefd", word: "محادثة", Icon: MessageCircle },
  exercises: { color: "#f08a24", soft: "#fff1e2", word: "تمارين", Icon: Dumbbell },
  resources: { color: "#7c5cff", soft: "#f0ecff", word: "ملفات", Icon: FolderOpen },
};

type Node = { type: "lesson"; lesson: PathLesson } | { type: "item"; item: PathItem };

const idOf = (node: Node) => (node.type === "lesson" ? node.lesson.id : node.item.id);
const refOf = (node: Node): PathRef => ({ type: node.type, id: idOf(node) });
const lookOf = (node: Node): Look =>
  node.type === "item" ? node.item.kind : node.lesson.experience === "study" ? "study" : "classic";

function UkFlag() {
  return (
    <svg
      viewBox="0 0 60 40"
      className="h-6 w-9 overflow-hidden rounded-md shadow-sm"
      aria-label="English"
    >
      <rect width="60" height="40" fill="#1F3F8F" />
      <path d="M0 0l60 40M60 0L0 40" stroke="#fff" strokeWidth="8" />
      <path d="M0 0l60 40M60 0L0 40" stroke="#D7263D" strokeWidth="3" />
      <path d="M30 0v40M0 20h60" stroke="#fff" strokeWidth="12" />
      <path d="M30 0v40M0 20h60" stroke="#D7263D" strokeWidth="7" />
    </svg>
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
}: {
  lessons: PathLesson[] | null;
  items: PathItem[];
  reviews: ReviewSuggestion[];
  error: string;
  isAdmin: boolean;
  language: string | null;
  onOpenLesson: (lesson: PathLesson) => void;
  onReload: () => Promise<void>;
}) {
  const saveFn = useServerFn(adminSavePathLayout);
  const addFn = useServerFn(adminAddPathItem);
  const [hint, setHint] = useState("");
  // Free order only relaxes the sequencing (any lesson can be opened); it does
  // not change what the learner can access.
  const [freeOrder, setFreeOrder] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [sheet, setSheet] = useState<PathItem | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState("");
  const [dragId, setDragId] = useState("");
  const [overId, setOverId] = useState("");
  const [shake, setShake] = useState("");

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

  const lessonList = lessons ?? [];
  const current = lessonList.find((lesson) => lesson.state === "current");
  const totalStars = lessonList.reduce((sum, lesson) => sum + lesson.stars, 0);
  const completed = lessonList.filter((lesson) => lesson.state === "done").length;
  const currentIndex = nodes.findIndex(
    (node) => node.type === "lesson" && node.lesson.state === "current",
  );

  const row = editing ? ROW_EDITING : ROW;
  const centres = useMemo(
    () =>
      nodes.map((_, index) => ({
        x: WIDTH / 2 + ZIGZAG[index % ZIGZAG.length],
        y: index * row + 40 + NODE / 2,
      })),
    [nodes, row],
  );
  const segment = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const midY = (from.y + to.y) / 2;
    return `M${from.x} ${from.y} C${from.x} ${midY} ${to.x} ${midY} ${to.x} ${to.y}`;
  };
  const road = centres
    .slice(1)
    .map((point, index) => segment(centres[index], point))
    .join(" ");
  const walked = centres
    .slice(1, Math.max(0, currentIndex) + 1)
    .map((point, index) => segment(centres[index], point))
    .join(" ");
  const height = Math.max(1, nodes.length) * row + (editing ? 90 : 30);

  function open(node: Node) {
    if (editing) {
      if (node.type === "item") setSheet(node.item);
      return;
    }
    if (node.type === "item") {
      if (node.item.kind === "resources") setSheet(node.item);
      else {
        // Exercises: only their look for now.
        setShake(node.item.id);
        window.setTimeout(() => setShake(""), 450);
      }
      return;
    }
    if (node.lesson.state === "locked" && !freeOrder) {
      setHint("أكمل الدرس الحالي أولاً لفتح هذا الدرس — أو فعّل الوضع الحر.");
      return;
    }
    onOpenLesson(node.lesson);
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
    centres.forEach((centre, index) => {
      const id = idOf(nodes[index]);
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

  async function add(kind: PathItemKind, index: number) {
    setAdding(null);
    setBusy(true);
    try {
      const created = await addFn({
        data: {
          language,
          kind,
          title: kind === "exercises" ? "تمارين" : "Resources",
          list: nodes.map(refOf),
          index,
        },
      });
      setNodes((list) => [
        ...list.slice(0, index),
        { type: "item", item: created },
        ...list.slice(index),
      ]);
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
  const gapY = (index: number) => index * row - (row - STOP_HEIGHT) / 2;
  const pluses = editing
    ? [
        ...centres.slice(1).map((point, index) => ({
          index: index + 1,
          x: (centres[index].x + point.x) / 2,
          y: gapY(index + 1),
        })),
        {
          index: nodes.length,
          x: nodes.length ? centres[nodes.length - 1].x : WIDTH / 2,
          y: nodes.length ? gapY(nodes.length) + 34 : 60,
        },
      ]
    : [];

  return (
    <main
      dir="rtl"
      className="edith-premium lp min-h-screen bg-white pb-32 text-[var(--pp-ink)]"
      data-editing={editing ? "" : undefined}
      style={{ fontFamily: "var(--font-grotesk)" }}
    >
      <header className="sticky top-0 z-30 border-b border-[var(--pp-line)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-4 py-3">
          <Link
            to="/learn"
            hash="rita"
            aria-label="رجوع"
            className="grid h-10 w-10 place-items-center rounded-full text-[var(--pp-muted)] hover:bg-[var(--pp-grey)]"
          >
            <ArrowRight size={22} />
          </Link>
          <div className="flex items-center gap-2 text-sm font-bold">
            <UkFlag />
            <span dir="ltr">English · A1</span>
          </div>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => {
                setEditing((value) => !value);
                setAdding(null);
              }}
              aria-pressed={editing}
              className={`lp-edit ${editing ? "is-on" : ""}`}
            >
              {editing ? <Check size={16} /> : <Pencil size={15} />}
              {editing ? "تم" : "تعديل المسار"}
            </button>
          ) : (
            <span className="w-10" />
          )}
        </div>
      </header>

      <section className="mx-auto max-w-md px-4 pt-7 text-center">
        <h2 className="text-[30px] font-bold leading-9">دروسك مع يوزرا</h2>
        <p className="mt-1.5 text-sm font-semibold text-[var(--pp-muted)]">
          تحدّث مع يوزرا، حقّق أهداف كل درس، واجمع النجوم.
        </p>
        {lessonList.length > 0 && (
          <div className="lp-stats">
            <div className="lp-stat">
              <span className="lp-stat-n">
                {completed}
                <span className="lp-stat-of"> / {lessonList.length}</span>
              </span>
              <span className="lp-stat-w">دروس خلّصتها</span>
            </div>
            <div className="lp-stat">
              <span className="lp-stat-n">
                <Star size={18} fill="#FFC83D" stroke="#E8A400" aria-hidden="true" />
                {totalStars}
              </span>
              <span className="lp-stat-w">نجمة</span>
            </div>
            <div
              className="lp-bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={lessonList.length}
              aria-valuenow={completed}
              aria-label="تقدّمك في الدروس"
            >
              <span style={{ width: `${(completed / lessonList.length) * 100}%` }} />
            </div>
          </div>
        )}
        <div className="lp-legend" aria-label="ألوان المسار">
          {(Object.keys(LOOK) as Look[]).map((look) => (
            <span key={look}>
              <i style={{ background: LOOK[look].color }} />
              {LOOK[look].word}
            </span>
          ))}
        </div>
        {!editing && (
          <button
            type="button"
            onClick={toggleFreeOrder}
            aria-pressed={freeOrder}
            className="mt-2 min-h-10 rounded-lg px-3 text-xs font-bold text-[var(--pp-muted)] underline decoration-[var(--pp-line)] underline-offset-4 hover:text-[var(--pp-ink)]"
          >
            {freeOrder ? "الوضع الحر مفعّل — أوقفه" : "الوضع الحر: افتح أي درس بترتيب حر"}
          </button>
        )}
        {editing && (
          <p className="lp-edit-hint">
            اضغط مطوّلاً على أي محطة واسحبها فوق ثانية عشان يتبدّلوا. اكبس + لإضافة تمارين أو ملفات.
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
      {lessons && nodes.length === 0 && !editing && (
        <div className="mx-auto mt-16 max-w-xs text-center">
          <p className="font-bold text-[var(--pp-ink)]">لا توجد دروس منشورة بعد.</p>
          <p className="mt-1 text-sm font-semibold text-[var(--pp-muted)]">
            جرّب محادثة حرة مع يوزرا حتى تجهز الدروس:
          </p>
          <Link to="/rita-live" className="rita-btn rita-btn-primary mt-4 gap-2 !inline-flex">
            <MessageCircle size={16} /> محادثة حرة مع يوزرا
          </Link>
        </div>
      )}

      {lessons && (nodes.length > 0 || editing) && (
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
          </svg>

          {nodes.map((node, index) => {
            const id = idOf(node);
            const centre = centres[index];
            const look = LOOK[lookOf(node)];
            const lesson = node.type === "lesson" ? node.lesson : null;
            const locked = lesson?.state === "locked";
            const isCurrent = lesson?.state === "current";
            const title = lesson
              ? lesson.title || lesson.title_ar
              : node.type === "item"
                ? node.item.title
                : "";
            return (
              <button
                key={id}
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
                data-shake={shake === id ? "" : undefined}
                style={{
                  ["--x" as string]: `${centre.x - 75}px`,
                  ["--y" as string]: `${index * row}px`,
                  ["--i" as string]: index,
                  ["--c" as string]: look.color,
                  ["--soft" as string]: look.soft,
                }}
                aria-label={`${title} — ${look.word}${locked ? " (مقفل)" : ""}`}
              >
                {isCurrent && !editing && <span className="lp-here">إنت هون</span>}
                {lesson ? (
                  <LessonStars stars={lesson.stars} />
                ) : (
                  <span className="block h-[22px]" />
                )}
                <span className="lp-disc" style={{ width: NODE, height: NODE }}>
                  {isCurrent && !editing && <span className="lp-pulse" aria-hidden="true" />}
                  <span className="absolute inset-0 rounded-full bg-white" />
                  {lesson ? (
                    <LessonImage
                      src={lesson.image_url}
                      alt=""
                      className={`lp-face ${locked ? "is-locked" : ""}`}
                    />
                  ) : (
                    <span className="lp-face lp-item-face">
                      <look.Icon size={40} strokeWidth={2.2} aria-hidden="true" />
                    </span>
                  )}
                  {locked && (
                    <span className="lp-badge is-lock">
                      <Lock size={15} />
                    </span>
                  )}
                  {lesson?.state === "done" && (
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
                ) : (
                  <span className="lp-sub">قريباً</span>
                )}
              </button>
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
                  {(["exercises", "resources"] as PathItemKind[]).map((kind) => {
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
                        {kind === "exercises" ? "تمارين" : "ملفات وروابط"}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {hint && (
        <p
          className="fixed inset-x-4 bottom-28 z-30 mx-auto max-w-sm rounded-lg bg-[var(--pp-ink)] px-4 py-3 text-center text-[15px] font-semibold text-white"
          onClick={() => setHint("")}
        >
          {hint}
        </p>
      )}

      {current && !editing && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--pp-line)] bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center justify-between gap-4">
            <div className="min-w-0 text-right">
              <p className="text-xs font-semibold text-[var(--pp-muted)]">الدرس الحالي</p>
              <p className="truncate text-[15px] font-bold">{current.title || current.title_ar}</p>
            </div>
            <button
              type="button"
              onClick={() => onOpenLesson(current)}
              className="rita-btn rita-btn-primary shrink-0"
            >
              متابعة
            </button>
          </div>
        </div>
      )}

      {sheet && (
        <PathStopSheet
          item={sheet}
          admin={isAdmin}
          color={LOOK[sheet.kind].color}
          onClose={() => setSheet(null)}
          onChanged={onReload}
        />
      )}
    </main>
  );
}
