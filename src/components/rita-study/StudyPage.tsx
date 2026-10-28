import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Group, Panel, Separator } from "react-resizable-panels";
import * as Popover from "@radix-ui/react-popover";
import {
  ArrowRight,
  Download,
  Loader2,
  MessageCircleQuestion,
  Minus,
  Plus,
  Square,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { RitaRealtimeV3, type StudyBridge } from "@/components/rita/RitaRealtimeV3";
import { studyGuideDownload } from "@/lib/study/study.functions";
import type { StudyLessonData } from "@/lib/study/study-types";
import { PhraseDialog } from "@/components/rita/PhraseDialog";
import { guideSegmentMap, sectionId } from "@/lib/guides/guide-blocks";
import {
  ACTION_INFO,
  availableActions,
  classifySelection,
  type RitaAction,
  type StudyAction,
} from "@/lib/study/study-actions";
import { ActionMenu } from "./ActionMenu";
import { FloatingOrb, type OrbState } from "./FloatingOrb";
import { GuideFrame, SHEET_PX, type GuideFrameHandle } from "./GuideFrame";
import { DEFAULT_ORB, snapToEdge, type OrbPosition } from "./orb-position";
import { markSelection, readSelection, sectionSegIds, type PageSelection } from "./selection";
import { readStudyMemory, writeStudyMemory } from "./study-memory";
import { useStudyRequests } from "./useStudyRequests";

const ZOOM_MIN = 0.75;
const ZOOM_MAX = 2;

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

/**
 * "Rita - interactive study": the guide on the right, Rita on the left (always, even in Arabic),
 * a draggable divider on wide screens and two tabs on phones. Rita never starts teaching on her own
 * here; the learner reads and asks.
 */
export function StudyPage({ data }: { data: StudyLessonData }) {
  const { lesson, guide, preview } = data;
  const wide = useWide(900);
  const [tab, setTab] = useState<"guide" | "rita">("guide");
  const frame = useRef<GuideFrameHandle | null>(null);
  const guideBox = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fitted, setFitted] = useState(true);
  const [current, setCurrent] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [ritaSpeaking, setRitaSpeaking] = useState(false);
  const downloadFn = useServerFn(studyGuideDownload);
  const title = lesson.title_ar || lesson.title || guide.title;

  const sections = useMemo(
    () =>
      guide.content.sections.map((section, index) => ({
        id: sectionId(index),
        heading: section.heading,
      })),
    [guide.content],
  );

  // One object for the whole visit: Rita fills `send` while her call is ready.
  const bridge = useMemo<StudyBridge>(() => ({ send: null }), []);
  const lastFocus = useRef("");
  const requests = useStudyRequests({ lessonId: lesson.id, preview, bridge });
  const segments = useMemo(() => guideSegmentMap(guide.content), [guide.content]);

  // The learner's selection, kept even when the browser's own selection goes away (an iPhone tap).
  const [selection, setSelection] = useState<PageSelection | null>(null);
  const selectionRef = useRef<PageSelection | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpenRef = useRef(false);
  menuOpenRef.current = menuOpen;
  const [orb, setOrb] = useState<OrbPosition>(() => readStudyMemory(lesson.id).orb ?? DEFAULT_ORB);
  const [movingOrb, setMovingOrb] = useState(false);
  const [phrase, setPhrase] = useState("");

  const selected = useMemo(() => {
    if (!selection) return null;
    const pieces = selection.segIds
      .map((id) => segments.get(id))
      .filter((piece): piece is NonNullable<typeof piece> => Boolean(piece));
    const kind = classifySelection({ exact: selection.exact, segments: pieces });
    const section = pieces.find((piece) => piece.section)?.section ?? "";
    return { pieces, kind, section };
  }, [segments, selection]);

  const keepSelection = useCallback((next: PageSelection | null) => {
    selectionRef.current = next;
    setSelection(next);
    markSelection(frame.current?.window() ?? null, next?.range ?? null);
  }, []);

  const moveOrb = useCallback(
    (next: OrbPosition) => {
      setOrb(next);
      writeStudyMemory(lesson.id, { orb: next });
    },
    [lesson.id],
  );

  const sendFocus = useCallback(
    (section: string) => {
      if (!section || section === lastFocus.current) return;
      lastFocus.current = section;
      const heading = sections.find((item) => item.id === section)?.heading ?? "";
      bridge.send?.("rita-study-focus", { section, text: heading });
    },
    [bridge, sections],
  );

  useEffect(() => {
    bridge.onEvent = (event) => {
      requests.onRitaEvent(event);
      if (event === "speaking") setRitaSpeaking(true);
      if (event === "quiet" || event === "ended") setRitaSpeaking(false);
      if (event !== "ready") return;
      bridge.send?.("rita-study-state", { state: "reading" });
      const memory = readStudyMemory(lesson.id);
      const heading = sections.find((item) => item.id === memory.section)?.heading;
      // One short line, once: the first visit says how this works; later visits say where we were.
      const line = !memory.introduced
        ? "الدرس قدّامك. اسألني بالصوت، أو حدّد أي جزء من الملف واكبس على الدائرة."
        : heading
          ? `كمّلنا من «${heading}».`
          : "";
      if (line && !preview) bridge.send?.("rita-study-say", { text: line });
      if (!preview) writeStudyMemory(lesson.id, { introduced: true });
      lastFocus.current = "";
      sendFocus(current || memory.section || "");
    };
  }, [bridge, current, lesson.id, preview, requests, sections, sendFocus]);

  // The fitted zoom keeps the whole sheet in view on narrow screens.
  useEffect(() => {
    const box = guideBox.current;
    if (!box || !fitted) return;
    const resize = () => {
      const width = box.clientWidth;
      if (width > 0) setZoom(Math.min(1, Math.max(0.5, (width - 8) / SHEET_PX)));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(box);
    return () => observer.disconnect();
  }, [fitted, wide, tab]);

  const changeZoom = (step: number) => {
    setFitted(false);
    setZoom((value) =>
      Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((value + step) * 100) / 100)),
    );
  };

  // The section in view becomes Rita's focus, and where the next visit starts.
  const onGuideLoad = useCallback(
    (doc: Document) => {
      const win = doc.defaultView;
      if (!win) return;
      const memory = readStudyMemory(lesson.id);
      if (memory.section) doc.getElementById(memory.section)?.scrollIntoView({ block: "start" });
      // The selection is saved 120ms after it stops changing, before any menu opens: on a phone
      // the tap on the circle can clear the browser's selection, so the copy must exist first.
      let picking = 0;
      doc.addEventListener("selectionchange", () => {
        window.clearTimeout(picking);
        picking = window.setTimeout(() => {
          const next = readSelection(doc);
          if (next) {
            keepSelection(next);
            const piece = next.segIds[0] ? segments.get(next.segIds[0]) : null;
            if (piece?.section)
              bridge.send?.("rita-study-focus", {
                section: piece.section,
                text: next.exact.slice(0, 300),
              });
            return;
          }
          // A tap elsewhere in the guide clears it, unless the menu is using it.
          if (!menuOpenRef.current && doc.getSelection()?.isCollapsed) keepSelection(null);
        }, 120);
      });
      let timer = 0;
      win.addEventListener(
        "scroll",
        () => {
          window.clearTimeout(timer);
          timer = window.setTimeout(() => {
            const middle = win.innerHeight / 3;
            let seen = "";
            for (const element of doc.querySelectorAll<HTMLElement>("[data-section]")) {
              if (element.getBoundingClientRect().top <= middle)
                seen = element.dataset.section ?? "";
            }
            const section = seen || sections[0]?.id || "";
            setCurrent(section);
            if (!preview) writeStudyMemory(lesson.id, { section });
            sendFocus(section);
          }, 250);
        },
        { passive: true },
      );
    },
    [bridge, keepSelection, lesson.id, preview, sections, segments, sendFocus],
  );

  const actions: StudyAction[] = selected ? availableActions(selected.kind) : [];

  async function pick(action: StudyAction) {
    const sel = selectionRef.current;
    if (action === "meaning") {
      if (sel) setPhrase(sel.exact);
      setMenuOpen(false);
      return;
    }
    if (action === "report") return;
    const target =
      action === "summarize_section"
        ? {
            segIds: sectionSegIds(
              frame.current?.document() ?? null,
              current || sections[0]?.id || "",
            ),
            exact: "",
          }
        : sel
          ? { segIds: sel.segIds, exact: sel.exact, parts: sel.parts }
          : null;
    if (!target || !target.segIds.length) return;
    setMenuOpen(false);
    const ok = await requests.run(action as RitaAction, target);
    // On a phone, a written answer is in Rita's tab; a spoken one plays while the guide stays open.
    if (ok && !wide && !bridge.send) setTab("rita");
  }

  async function report(note: string) {
    const sel = selectionRef.current;
    if (!sel) return;
    const ok = await requests.report(
      { segIds: sel.segIds, exact: sel.exact, parts: sel.parts },
      note,
    );
    if (ok) setMenuOpen(false);
  }

  const orbState: OrbState = requests.busy ? "busy" : selection ? "armed" : "idle";
  const sectionLabel = (() => {
    const id = selected?.section || current || sections[0]?.id || "";
    const index = sections.findIndex((item) => item.id === id);
    return index >= 0 ? `القسم ${index + 1}` : "";
  })();

  const live = requests.active;
  const liveState =
    live && (live.state === "resolving" || live.state === "sent" || live.state === "started");
  const status = live && (liveState || live.state === "failed") && (
    <div
      role="status"
      className={`rounded-2xl border px-3 py-2.5 text-[14px] ${
        live.state === "failed"
          ? "border-[#f3c4c4] bg-[#fdf1f1] text-[#8c1a31]"
          : "border-[var(--pp-line)] bg-[var(--pp-grey)] text-[var(--pp-ink)]"
      }`}
    >
      <div className="flex items-center gap-2">
        {liveState && <Loader2 size={15} className="shrink-0 animate-spin" aria-hidden="true" />}
        <p className="min-w-0 flex-1">
          {live.state === "failed"
            ? live.message
            : `${ACTION_INFO[live.action].label}: «${live.quote.slice(0, 60)}»`}
        </p>
        {liveState && (
          <button
            type="button"
            onClick={requests.stop}
            className="rita-btn rita-btn-soft rita-btn-sm gap-1 !h-8"
          >
            <Square size={12} fill="currentColor" aria-hidden="true" /> وقّف
          </button>
        )}
      </div>
    </div>
  );

  async function download() {
    setDownloading(true);
    try {
      const { url } = await downloadFn({ data: { lessonId: lesson.id, preview } });
      window.location.assign(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ما قدرت أفتح الملف.");
    } finally {
      setDownloading(false);
    }
  }

  const guidePane = (
    <div className="flex h-full min-h-0 flex-col bg-[#f4f4f8]" dir="rtl">
      <div
        className="flex flex-wrap items-center gap-1.5 border-b border-[var(--pp-line)] bg-white px-3 py-2"
        role="toolbar"
        aria-label="شريط الملف"
      >
        {sections.length > 1 && (
          <label className="flex items-center gap-1.5 text-[14px]">
            <span className="sr-only">القسم</span>
            <select
              value={current || sections[0]?.id}
              onChange={(event) => {
                setCurrent(event.target.value);
                frame.current?.scrollToSection(event.target.value);
              }}
              className="h-9 max-w-[14rem] rounded-lg border border-[var(--pp-line)] bg-white px-2 text-[14px]"
              dir="ltr"
            >
              {sections.map((section, index) => (
                <option key={section.id} value={section.id}>
                  {index + 1}. {section.heading}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="rita-btn rita-btn-soft rita-btn-sm gap-1.5 !h-9"
        >
          <MessageCircleQuestion size={15} aria-hidden="true" />
          اسأل ريتا عن التحديد
        </button>
        <div className="ms-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => changeZoom(-0.1)}
            disabled={zoom <= ZOOM_MIN}
            aria-label="تصغير"
            className="rita-btn rita-btn-quiet rita-btn-sm !h-9 !w-9 !px-0"
          >
            <Minus size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setFitted(true)}
            aria-pressed={fitted}
            className="rita-btn rita-btn-quiet rita-btn-sm !h-9 tabular-nums"
            title="ملاءمة العرض"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => changeZoom(0.1)}
            disabled={zoom >= ZOOM_MAX}
            aria-label="تكبير"
            className="rita-btn rita-btn-quiet rita-btn-sm !h-9 !w-9 !px-0"
          >
            <Plus size={16} aria-hidden="true" />
          </button>
          {guide.allow_download && (
            <button
              type="button"
              onClick={() => void download()}
              disabled={downloading}
              className="rita-btn rita-btn-soft rita-btn-sm gap-1.5 !h-9"
            >
              {downloading ? (
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              ) : (
                <Download size={15} aria-hidden="true" />
              )}
              PDF
            </button>
          )}
        </div>
      </div>
      <div ref={guideBox} className="relative min-h-0 flex-1">
        <GuideFrame
          ref={frame}
          content={guide.content}
          zoom={zoom}
          title={title}
          onLoad={onGuideLoad}
        />
        <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <Popover.Anchor asChild>
            <FloatingOrb
              state={orbState}
              position={orb}
              onMove={moveOrb}
              onPress={() => setMenuOpen((open) => !open)}
              moving={movingOrb}
              onStopMoving={() => setMovingOrb(false)}
              label={selection ? "شو بدك نعمل بالتحديد؟" : "حدّد جزء من الدرس"}
            />
          </Popover.Anchor>
          <Popover.Portal>
            <Popover.Content
              side="top"
              align="start"
              sideOffset={10}
              collisionPadding={12}
              dir="rtl"
              className="edith-premium z-50 overflow-hidden rounded-2xl border border-[var(--pp-line)] bg-white text-[var(--pp-ink)] shadow-[0_12px_40px_rgb(18_17_23/0.16)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
              onOpenAutoFocus={(event) => event.preventDefault()}
            >
              <ActionMenu
                quote={selection?.exact ?? ""}
                kind={selected?.kind ?? null}
                sectionLabel={sectionLabel}
                actions={actions}
                hasSelection={Boolean(selection)}
                busy={false}
                onPick={(action) => void pick(action)}
                onReport={(note) => void report(note)}
                onClear={() => {
                  frame.current?.document()?.getSelection()?.removeAllRanges();
                  keepSelection(null);
                }}
                onMoveOrb={() => {
                  setMenuOpen(false);
                  setMovingOrb(true);
                }}
                onPinOrb={() => moveOrb(snapToEdge(orb))}
                onResetOrb={() => moveOrb(DEFAULT_ORB)}
                onClose={() => setMenuOpen(false)}
              />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        {movingOrb && (
          <p
            role="status"
            className="absolute inset-x-3 top-3 z-30 rounded-xl bg-[var(--pp-ink)] px-3 py-2 text-center text-[13px] text-white"
          >
            حرّك الدائرة بالأسهم (Shift أسرع)، وEnter أو Esc لما تخلص.
          </p>
        )}
        {!wide && tab === "guide" && live && liveState && live.channel === "voice" && (
          <div className="absolute inset-x-3 bottom-3 z-30 flex items-center gap-2 rounded-2xl bg-[var(--pp-ink)] px-3 py-2 text-[14px] text-white">
            <p className="min-w-0 flex-1 truncate">ريتا بتشرح… «{live.quote.slice(0, 40)}»</p>
            <button
              type="button"
              onClick={() => setTab("rita")}
              className="font-semibold underline"
            >
              افتح المحادثة
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const ritaPane = (
    <div className="uz-rita-dark flex h-full min-h-0 flex-col" dir="rtl">
      <RitaRealtimeV3
        study={{ lessonId: lesson.id, preview, title: "ريتا", bridge, children: status }}
      />
    </div>
  );

  return (
    <div className="edith-premium flex h-[100dvh] flex-col bg-white text-[var(--pp-ink)]" dir="rtl">
      <header className="flex items-center gap-3 border-b border-[var(--pp-line)] px-4 py-2.5">
        <Link
          to="/rita-lessons"
          className="rita-btn rita-btn-quiet rita-btn-sm gap-1 !px-2"
          aria-label="رجوع للدروس"
        >
          <ArrowRight size={17} aria-hidden="true" />
          <span className="hidden sm:inline">الدروس</span>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate !text-[17px] font-bold !leading-6 !tracking-normal">{title}</h1>
          <p className="text-[12.5px] font-semibold text-[var(--pp-accent-text)]">
            ريتا — دراسة تفاعلية{preview ? " · معاينة أدمن (ما بينحفظ إشي)" : ""}
          </p>
        </div>
        <Link
          to="/rita-live"
          search={{ lesson: lesson.id, ...(preview ? { preview: true } : {}) }}
          className="rita-btn rita-btn-soft rita-btn-sm gap-1.5"
        >
          <Star size={15} aria-hidden="true" />
          تحدّي الدرس
        </Link>
      </header>

      {wide ? (
        // Rita is always on the left and the guide on the right: the group is laid out left to right.
        <Group orientation="horizontal" dir="ltr" className="min-h-0 flex-1">
          <Panel id="rita" defaultSize="44" minSize={340}>
            {ritaPane}
          </Panel>
          <Separator
            className="w-1 bg-[#121117] transition-colors hover:bg-[var(--pp-accent)] focus-visible:bg-[var(--pp-accent)] focus-visible:outline-none"
            aria-label="غيّر عرض الملف وريتا"
          />
          <Panel id="guide" defaultSize="56" minSize={420}>
            {guidePane}
          </Panel>
        </Group>
      ) : (
        <>
          <div
            role="tablist"
            aria-label="الدرس وريتا"
            className="flex border-b border-[var(--pp-line)]"
          >
            {(
              [
                ["guide", "الدرس"],
                ["rita", ritaSpeaking ? "ريتا بتحكي…" : "ريتا"],
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
          {/* Both stay mounted so the call keeps going and the reading place is kept. */}
          <div className={`min-h-0 flex-1 ${tab === "guide" ? "" : "hidden"}`}>{guidePane}</div>
          <div className={`min-h-0 flex-1 ${tab === "rita" ? "" : "hidden"}`}>{ritaPane}</div>
        </>
      )}
      {phrase && <PhraseDialog phrase={phrase} onClose={() => setPhrase("")} />}
    </div>
  );
}
