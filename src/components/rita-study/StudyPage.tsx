import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Group, Panel, Separator } from "react-resizable-panels";
import { ArrowRight, Download, Loader2, Shuffle, Square, Star } from "lucide-react";
import { toast } from "sonner";
import { RitaRealtimeV3, type StudyBridge } from "@/components/rita/RitaRealtimeV3";
import { studyGuideDownload } from "@/lib/study/study.functions";
import { studyMakeCards, studyMakeMcq } from "@/lib/study/study-practice.functions";
import type { StudyCard, StudyMcq } from "@/lib/study/study-practice";
import { SAMPLE_STUDY_TOPIC, type StudyLessonData } from "@/lib/study/study-types";
import { PhraseDialog } from "@/components/rita/PhraseDialog";
import { guideSegmentMap, sectionId } from "@/lib/guides/guide-blocks";
import {
  ACTION_INFO,
  availableActions,
  classifySelection,
  type RitaAction,
  type StudyAction,
} from "@/lib/study/study-actions";
import { FloatingOrb, type OrbState } from "./FloatingOrb";
import { RadialMenu, type RadialHandle } from "./RadialMenu";
import { FloatingWindow } from "./FloatingWindow";
import {
  KIND_LABEL,
  LANGUAGE_NAMES,
  languageFromId,
  languageItems,
  ringItems,
} from "./radial-items";
import { useExplanationLanguage } from "@/hooks/useExplanationLanguage";
import { GuideFrame, type GuideFrameHandle } from "./GuideFrame";
import { DEFAULT_ORB, snapToEdge, type OrbPosition } from "./orb-position";
import { markSelection, readSelection, sectionSegIds, type PageSelection } from "./selection";
import { readStudyMemory, writeStudyMemory } from "./study-memory";
import { attachTechSelect, drawSelectionFx } from "./tech-select";
import { installSoundUnlock, setSoundOn, soundOn } from "./tech-sound";
import { useStudyRequests } from "./useStudyRequests";

/** Where the divider was left (share of the width for Rita and the guide), per browser. */
const SPLIT_KEY = "uzyra-study-split";

function readSplit(): { rita: number; guide: number } | undefined {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SPLIT_KEY) ?? "null") as unknown;
    if (!raw || typeof raw !== "object") return undefined;
    const { rita, guide } = raw as Record<string, unknown>;
    if (typeof rita !== "number" || typeof guide !== "number") return undefined;
    if (!(rita > 10 && guide > 10 && Math.abs(rita + guide - 100) < 1)) return undefined;
    return { rita, guide };
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
  const [split] = useState(readSplit);
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
  // The ring shows the study options, or the three languages Rita can explain in.
  const [ringMode, setRingMode] = useState<"main" | "language">("main");
  const explanation = useExplanationLanguage();
  // The trial floating window, opened from the circle; it grows out of the circle's spot.
  const [windowAt, setWindowAt] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!menuOpen) setRingMode("main");
  }, [menuOpen]);
  const menuOpenRef = useRef(false);
  menuOpenRef.current = menuOpen;
  const [orb, setOrb] = useState<OrbPosition>(() => readStudyMemory(lesson.id).orb ?? DEFAULT_ORB);
  const [movingOrb, setMovingOrb] = useState(false);
  const [phrase, setPhrase] = useState("");
  const work = useRef<HTMLDivElement | null>(null);
  const orbButton = useRef<HTMLButtonElement | null>(null);
  const radial = useRef<RadialHandle | null>(null);
  const [openedByKey, setOpenedByKey] = useState(false);
  const [sound, setSound] = useState(true);
  useEffect(() => setSound(soundOn()), []);
  // Wake the sound on the first touch anywhere (and after every tab switch), before it is needed.
  useEffect(() => installSoundUnlock(), []);

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
    drawSelectionFx(frame.current?.document() ?? null, next?.range ?? null);
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

  // The section in view becomes Rita's focus, and where the next visit starts.
  const onGuideLoad = useCallback(
    (doc: Document) => {
      const memory = readStudyMemory(lesson.id);
      if (memory.section) frame.current?.scrollToSection(memory.section, false);
      // Pen, finger and mouse land on this page's layer over the sheet (Safari runs no listener
      // inside the locked frame); the finished selection comes back here.
      const layer = frame.current?.layer();
      if (layer && frame.current) {
        const handle = frame.current;
        attachTechSelect({
          doc,
          layer,
          toSheet: (x, y) => handle.toSheet(x, y),
          onChange: (range) => {
            if (!range) {
              if (!menuOpenRef.current) keepSelection(null);
              return;
            }
            const next = readSelection(doc);
            if (!next) return;
            keepSelection(next);
            const piece = next.segIds[0] ? segments.get(next.segIds[0]) : null;
            if (piece?.section)
              bridge.send?.("rita-study-focus", {
                section: piece.section,
                text: next.exact.slice(0, 300),
              });
          },
        });
      }
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
    },
    [bridge, keepSelection, lesson.id, segments],
  );

  // The section in view (a third of the way down) becomes Rita's focus, and where the next visit
  // starts. Settles 250ms after the scrolling stops.
  const readingTimer = useRef(0);
  const onGuideScroll = useCallback(
    (readingY: number) => {
      window.clearTimeout(readingTimer.current);
      readingTimer.current = window.setTimeout(() => {
        const doc = frame.current?.document();
        if (!doc) return;
        let seen = "";
        for (const element of doc.querySelectorAll<HTMLElement>("[data-section]")) {
          if (element.getBoundingClientRect().top <= readingY) seen = element.dataset.section ?? "";
        }
        const section = seen || sections[0]?.id || "";
        setCurrent(section);
        if (!preview) writeStudyMemory(lesson.id, { section });
        sendFocus(section);
      }, 250);
    },
    [lesson.id, preview, sections, sendFocus],
  );

  const actions: StudyAction[] = selected ? availableActions(selected.kind) : [];
  // Flashcards and questions made from selections. Kept here until it is decided where they show.
  const makeCardsFn = useServerFn(studyMakeCards);
  const makeMcqFn = useServerFn(studyMakeMcq);
  const [making, setMaking] = useState<"make_cards" | "make_mcq" | null>(null);
  const [made, setMade] = useState<{ cards: StudyCard[]; questions: StudyMcq[] }>({
    cards: [],
    questions: [],
  });

  async function practice(action: "make_cards" | "make_mcq") {
    const sel = selectionRef.current;
    if (!sel || !sel.segIds.length || making) return;
    setMenuOpen(false);
    setMaking(action);
    const input = {
      data: {
        lessonId: lesson.id,
        preview,
        requestId: crypto.randomUUID(),
        selection: { segIds: sel.segIds, exact: sel.exact, parts: sel.parts },
      },
    };
    try {
      if (action === "make_cards") {
        const result = await makeCardsFn(input);
        if (!result.ok) return void toast.message(result.message);
        setMade({ cards: result.cards, questions: made.questions });
        toast.success(
          `جهّزت ${result.cards.length} ${result.cards.length === 1 ? "بطاقة" : "بطاقات"}`,
        );
      } else {
        const result = await makeMcqFn(input);
        if (!result.ok) return void toast.message(result.message);
        setMade({ cards: made.cards, questions: result.questions });
        toast.success(
          `جهّزت ${result.questions.length} ${result.questions.length === 1 ? "سؤال" : "أسئلة"}`,
        );
      }
    } catch {
      toast.error("ما زبطت هالمرة. جرّب مرة ثانية.");
    } finally {
      setMaking(null);
    }
  }

  function ringPick(id: string) {
    if (id === "window-demo") {
      const box = work.current;
      setMenuOpen(false);
      setWindowAt(
        box ? { x: orb.x * box.clientWidth, y: orb.y * box.clientHeight } : { x: 0, y: 0 },
      );
      return;
    }
    if (id === "lang") return setRingMode("language");
    if (id === "lang:back") return setRingMode("main");
    const language = languageFromId(id);
    if (language) {
      explanation.setValue(language);
      setRingMode("main");
      return;
    }
    void pick(id as StudyAction);
  }

  async function pick(action: StudyAction) {
    if (action === "make_cards" || action === "make_mcq") return void practice(action);
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

  const orbState: OrbState = requests.busy || making ? "busy" : selection ? "armed" : "idle";
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
      <div className="relative min-h-0 flex-1">
        <GuideFrame
          ref={frame}
          content={guide.content}
          title={title}
          onLoad={onGuideLoad}
          onScroll={onGuideScroll}
        />
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
    <div className="flex h-full min-h-0 flex-col bg-white" dir="rtl">
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
        {preview && lesson.topic === SAMPLE_STUDY_TOPIC ? (
          <Link
            to="/admin/study-sample"
            search={{ another: true }}
            replace
            className="rita-btn rita-btn-soft rita-btn-sm gap-1.5"
          >
            <Shuffle size={15} aria-hidden="true" />
            دليل ثاني
          </Link>
        ) : null}
        {guide.allow_download && (
          <button
            type="button"
            onClick={() => void download()}
            disabled={downloading}
            className="rita-btn rita-btn-soft rita-btn-sm gap-1.5"
          >
            {downloading ? (
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            ) : (
              <Download size={15} aria-hidden="true" />
            )}
            PDF
          </button>
        )}
        <Link
          to="/rita-live"
          search={{ lesson: lesson.id, ...(preview ? { preview: true } : {}) }}
          className="rita-btn rita-btn-soft rita-btn-sm gap-1.5"
        >
          <Star size={15} aria-hidden="true" />
          تحدّي الدرس
        </Link>
      </header>

      {/* The circle lives over both sides, so it can sit wherever the learner likes. */}
      <div ref={work} className="st-work relative flex min-h-0 flex-1 flex-col">
        {wide ? (
          // Rita is always on the left and the guide on the right: the group is laid out left to right.
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
            <Panel id="rita" defaultSize="50" minSize={320}>
              {ritaPane}
            </Panel>
            <Separator className="st-divider" aria-label="غيّر عرض الملف وريتا">
              <span className="st-grip" aria-hidden="true" />
            </Separator>
            <Panel id="guide" defaultSize="50" minSize={320}>
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
        {windowAt && (
          <FloatingWindow title="نموذج ويندو" origin={windowAt} onClose={() => setWindowAt(null)}>
            <div className="fw-hello">
              <h3>Hello world</h3>
              <p>اسحبها من فوق، كبّرها من الزاوية، والصفحة وراها بتضل شغالة.</p>
            </div>
          </FloatingWindow>
        )}
        <FloatingOrb
          ref={orbButton}
          state={orbState}
          position={orb}
          onMove={moveOrb}
          open={menuOpen}
          onPress={(viaKey) => {
            setOpenedByKey(viaKey);
            setMenuOpen((open) => !open);
          }}
          onHoldStart={() => {
            setOpenedByKey(false);
            setMenuOpen(true);
          }}
          onHoldMove={(x, y) => radial.current?.hover(x, y)}
          onHoldEnd={(x, y) => radial.current?.release(x, y)}
          moving={movingOrb}
          onStopMoving={() => setMovingOrb(false)}
          label={selection ? "شو بدك نعمل بالتحديد؟" : "حدّد جزء من الدرس"}
        />
        <RadialMenu
          ref={radial}
          open={menuOpen}
          containerRef={work}
          orbRef={orbButton}
          orbKey={`${orb.x.toFixed(3)},${orb.y.toFixed(3)},${wide ? "w" : "n"},${tab}`}
          items={
            ringMode === "language" ? languageItems(explanation.value) : ringItems({ actions })
          }
          quote={selection?.exact ?? ""}
          meta={[sectionLabel, selected?.kind ? KIND_LABEL[selected.kind] : ""]
            .filter(Boolean)
            .join(" · ")}
          hasSelection={Boolean(selection) && ringMode === "main"}
          hint={
            ringMode === "language"
              ? `ريتا بتشرح بـ: ${LANGUAGE_NAMES[explanation.value]}`
              : "حدّد كلمة أو جملة من الدرس، وبعدين اكبس على الدائرة."
          }
          canReport={actions.includes("report")}
          busy={false}
          sound={sound}
          autoFocus={openedByKey}
          onToggleSound={() => {
            setSoundOn(!sound);
            setSound(!sound);
          }}
          onPick={ringPick}
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
        {movingOrb && (
          <p
            role="status"
            className="absolute inset-x-3 top-3 z-30 rounded-xl bg-[var(--pp-ink)] px-3 py-2 text-center text-[13px] text-white"
          >
            حرّك الدائرة بالأسهم (Shift أسرع)، وEnter أو Esc لما تخلص.
          </p>
        )}
      </div>
      {phrase && <PhraseDialog phrase={phrase} onClose={() => setPhrase("")} />}
    </div>
  );
}
