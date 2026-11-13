import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Group, Panel, Separator } from "react-resizable-panels";
import { ArrowRight, Download, Loader2, Square } from "lucide-react";
import { toast } from "sonner";
import { RitaRealtimeV3, type StudyBridge } from "@/components/rita/RitaRealtimeV3";
import { studyGuideDownload } from "@/lib/study/study.functions";
import { studyMakeCards, studyMakeMcq } from "@/lib/study/study-practice.functions";
import { StudyPracticeBody, type PracticeView } from "./StudyPracticePanel";
import { PRACTICE_NOTE, practiceTitle } from "@/lib/study/study-practice";
import type { StudyLessonData } from "@/lib/study/study-types";
import { PhraseDialog } from "@/components/rita/PhraseDialog";
import { resolveSelection } from "@/lib/study/study-resolve";
import { MAX_PHRASE_CHARS } from "@/lib/rita-phrase";
import { guideSegmentMap, sectionId } from "@/lib/guides/guide-blocks";
import {
  ACTION_INFO,
  availableActions,
  classifySelection,
  type RitaAction,
  type PracticeAction,
  type StudyAction,
} from "@/lib/study/study-actions";
import { FloatingOrb, type OrbState } from "./FloatingOrb";
import { RadialMenu, type RadialHandle } from "./RadialMenu";
import { FloatingWindow, WindowDots } from "./FloatingWindow";
import { QuestionPreview } from "./QuestionPreview";
import { BRAND_NAME } from "@/lib/brand";
import {
  KIND_LABEL,
  LANGUAGE_NAMES,
  languageFromId,
  languageItems,
  replyRingItems,
  ringItems,
} from "./radial-items";
import { useExplanationLanguage } from "@/hooks/useExplanationLanguage";
import { GuideFrame, type GuideFrameHandle } from "./GuideFrame";
import { DEFAULT_ORB, snapToEdge, type OrbPosition } from "./orb-position";
import { markSelection, readSelection, sectionSegIds, type PageSelection } from "./selection";
import { markReplySelection, readReplySelection, type ReplySelection } from "./reply-selection";
import { readStudyMemory, writeStudyMemory } from "./study-memory";
import { attachTechSelect, drawSelectionFx } from "./tech-select";
import { installSoundUnlock, setSoundOn, soundOn } from "./tech-sound";
import { useStudyRequests } from "./useStudyRequests";
import "./study-meaning.css";

/** Where the divider was left (share of the width for Uzyra and the guide), per browser. */
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
 * "Uzyra - interactive study": the guide on the right, Uzyra on the left (always, even in Arabic),
 * a draggable divider on wide screens and two tabs on phones. Uzyra never starts teaching on her own
 * here; the learner reads and asks.
 */
export function StudyPage({
  data,
  onReady,
}: {
  data: StudyLessonData;
  /** The guide has been drawn (the lesson intro over the page may leave now). */
  onReady?: () => void;
}) {
  const readyRef = useRef(onReady);
  useEffect(() => {
    readyRef.current = onReady;
  });
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

  // One object for the whole visit: Uzyra fills `send` while her call is ready.
  const bridge = useMemo<StudyBridge>(() => ({ send: null }), []);
  const lastFocus = useRef("");
  const requests = useStudyRequests({ lessonId: lesson.id, preview, bridge });
  const segments = useMemo(() => guideSegmentMap(guide.content), [guide.content]);

  // The learner's selection, kept even when the browser's own selection goes away (an iPhone tap).
  const [selection, setSelection] = useState<PageSelection | null>(null);
  const selectionRef = useRef<PageSelection | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // The ring shows the study options, or the three languages Uzyra can explain in.
  const [ringMode, setRingMode] = useState<"main" | "language">("main");
  const explanation = useExplanationLanguage();
  // The floating window: the cards and questions made from a selection, or the temporary question
  // design preview. Hidden with its X it stays alive, and the ••• at the bottom brings it back;
  // slid off the right edge, its tab brings it back. `reveal` grows to bring it back from the side.
  const [win, setWin] = useState<{
    at: { x: number; y: number };
    shown: boolean;
    content: "practice" | "preview";
    reveal: number;
  } | null>(null);
  useEffect(() => {
    if (!menuOpen) setRingMode("main");
  }, [menuOpen]);
  const menuOpenRef = useRef(false);
  menuOpenRef.current = menuOpen;
  const [orb, setOrb] = useState<OrbPosition>(() => readStudyMemory(lesson.id).orb ?? DEFAULT_ORB);
  const [movingOrb, setMovingOrb] = useState(false);
  const [phrase, setPhrase] = useState<{ text: string; context: string } | null>(null);
  const closePhrase = useCallback(() => {
    setPhrase(null);
    orbButton.current?.focus({ preventScroll: true });
  }, []);
  const phrasePlaying = useCallback(
    (playing: boolean) => bridge.phrasePlaying?.(playing),
    [bridge],
  );
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

  // A selection in Uzyra's own answers (the left column): its own options and its dark red. Only
  // one of the two selections lives at a time; the newest wins.
  const [replySelection, setReplySelection] = useState<ReplySelection | null>(null);
  const replySelectionRef = useRef<ReplySelection | null>(null);
  const [replyProblem, setReplyProblem] = useState("");
  const ritaBox = useRef<HTMLDivElement | null>(null);

  const keepReplySelection = useCallback((next: ReplySelection | null) => {
    replySelectionRef.current = next;
    setReplySelection(next);
    markReplySelection(next?.range ?? null);
    if (ritaBox.current)
      drawSelectionFx(document, next?.range ?? null, { host: ritaBox.current, tone: "reply" });
  }, []);

  const keepSelection = useCallback(
    (next: PageSelection | null) => {
      selectionRef.current = next;
      setSelection(next);
      markSelection(frame.current?.window() ?? null, next?.range ?? null);
      drawSelectionFx(frame.current?.document() ?? null, next?.range ?? null);
      if (next) {
        if (replySelectionRef.current) document.getSelection()?.removeAllRanges();
        keepReplySelection(null);
        setReplyProblem("");
      }
    },
    [keepReplySelection],
  );

  // Selecting in Uzyra's answers. Saved 120ms after it stops changing, before any menu opens (a tap
  // on the circle can clear the browser's selection on a phone, so the copy must exist first).
  useEffect(() => {
    const root = ritaBox.current;
    if (!root) return;
    const stop = attachTechSelect({
      doc: document,
      layer: root,
      host: root,
      tone: "reply",
      scope: "[data-reply-text]",
      toSheet: (x, y) => ({ x, y }),
      onChange: (range) => {
        if (!range) {
          if (!menuOpenRef.current) keepReplySelection(null);
          return;
        }
        const read = readReplySelection(root);
        if (read && !("problem" in read)) {
          frame.current?.document()?.getSelection()?.removeAllRanges();
          keepSelection(null);
          setReplyProblem("");
          keepReplySelection(read);
        }
      },
    });
    let redrawFrame = 0;
    const redraw = () => {
      cancelAnimationFrame(redrawFrame);
      redrawFrame = requestAnimationFrame(() =>
        drawSelectionFx(document, replySelectionRef.current?.range ?? null, {
          host: root,
          tone: "reply",
        }),
      );
    };
    root.addEventListener("scroll", redraw, true);
    const resize = new ResizeObserver(redraw);
    resize.observe(root);
    return () => {
      cancelAnimationFrame(redrawFrame);
      resize.disconnect();
      root.removeEventListener("scroll", redraw, true);
      stop();
      root.querySelector("#st-fx-reply")?.remove();
    };
  }, [keepReplySelection, keepSelection, wide]);

  useEffect(() => {
    let picking = 0;
    const onChange = () => {
      window.clearTimeout(picking);
      picking = window.setTimeout(() => {
        const root = ritaBox.current;
        if (!root) return;
        const read = readReplySelection(root);
        if (read && "problem" in read) {
          if (!menuOpenRef.current) {
            // The newest selection wins even when it is not usable: the guide's goes too.
            if (selectionRef.current) {
              frame.current?.document()?.getSelection()?.removeAllRanges();
              keepSelection(null);
            }
            keepReplySelection(null);
            setReplyProblem(read.problem);
          }
          return;
        }
        if (read) {
          // The guide's selection goes: the newest one wins.
          if (selectionRef.current) {
            frame.current?.document()?.getSelection()?.removeAllRanges();
            keepSelection(null);
          }
          setReplyProblem("");
          keepReplySelection(read);
          return;
        }
        // A tap elsewhere on this page clears it, unless the menu is using it.
        if (!menuOpenRef.current && document.getSelection()?.isCollapsed) {
          if (replySelectionRef.current) keepReplySelection(null);
          setReplyProblem("");
        }
      }, 120);
    };
    document.addEventListener("selectionchange", onChange);
    return () => {
      window.clearTimeout(picking);
      document.removeEventListener("selectionchange", onChange);
      markReplySelection(null);
    };
  }, [keepReplySelection, keepSelection]);

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

  // The section in view becomes Uzyra's focus, and where the next visit starts.
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
      // The guide is drawn and placed: one more frame, then tell the intro it may leave.
      requestAnimationFrame(() => readyRef.current?.());
    },
    [bridge, keepSelection, lesson.id, segments],
  );

  // The section in view (a third of the way down) becomes Uzyra's focus, and where the next visit
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

  const actions: StudyAction[] = selected
    ? availableActions(selected.kind).filter(
        (action) =>
          action !== "meaning" ||
          (Boolean(selection && /[A-Za-zÀ-ÿ]/.test(selection.exact)) &&
            (selection?.exact.length ?? 0) <= MAX_PHRASE_CHARS &&
            selected.kind !== "table_cells"),
      )
    : [];
  // Generated practice stays in this lesson visit; retry uses the original selection.
  const makeCardsFn = useServerFn(studyMakeCards);
  const makeMcqFn = useServerFn(studyMakeMcq);
  const [making, setMaking] = useState<PracticeAction | null>(null);
  const [practiceView, setPracticeView] = useState<PracticeView | null>(null);
  const practiceBusy = useRef(false);
  const practiceVersion = useRef(0);
  const lastPractice = useRef<{
    action: PracticeAction;
    selection: { segIds: string[]; exact: string; parts?: string[] };
  } | null>(null);
  useEffect(
    () => () => {
      practiceVersion.current += 1;
    },
    [],
  );

  async function practice(action: PracticeAction, retry = false) {
    if (practiceBusy.current) return;
    const sel = retry ? lastPractice.current?.selection : selectionRef.current;
    if (!sel || !sel.segIds.length || (!retry && !actions.includes(action))) return;
    const saved = {
      segIds: [...sel.segIds],
      exact: sel.exact,
      parts: sel.parts ? [...sel.parts] : undefined,
    };
    lastPractice.current = { action, selection: saved };
    practiceBusy.current = true;
    const version = ++practiceVersion.current;
    const requestId = crypto.randomUUID();
    setMenuOpen(false);
    setPhrase(null);
    requests.stop();
    openWindow("practice");
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
      data: {
        lessonId: lesson.id,
        preview,
        requestId,
        selection: saved,
      },
    };
    try {
      if (action === "make_cards") {
        const result = await makeCardsFn(input);
        if (version !== practiceVersion.current) return;
        if (!result.ok) {
          setPracticeView(
            (view) =>
              view && { ...view, status: "error", message: result.message, code: result.code },
          );
          return;
        }
        setPracticeView((view) => view && { ...view, status: "ready", cards: result.cards });
      } else {
        const result = await makeMcqFn(input);
        if (version !== practiceVersion.current) return;
        if (!result.ok) {
          setPracticeView(
            (view) =>
              view && { ...view, status: "error", message: result.message, code: result.code },
          );
          return;
        }
        setPracticeView(
          (view) => view && { ...view, status: "ready", questions: result.questions },
        );
      }
    } catch {
      if (version === practiceVersion.current)
        setPracticeView(
          (view) =>
            view && {
              ...view,
              status: "error",
              message: "ما زبطت هالمرة. جرّب مرة ثانية.",
              code: "failed",
            },
        );
    } finally {
      if (version === practiceVersion.current) {
        practiceBusy.current = false;
        setMaking(null);
      }
    }
  }

  /**
   * Opens the floating window with this content, growing out of the circle. If it is already open
   * with it, it is shown again (and comes back if it was slid to the side).
   */
  function openWindow(content: "practice" | "preview") {
    const box = work.current;
    const at = box ? { x: orb.x * box.clientWidth, y: orb.y * box.clientHeight } : { x: 0, y: 0 };
    setWin((current) =>
      current && current.content === content
        ? {
            ...current,
            at: current.shown ? current.at : at,
            shown: true,
            reveal: current.reveal + 1,
          }
        : { at, shown: true, content, reveal: 0 },
    );
  }

  function ringPick(id: string) {
    if (id === "window-demo") {
      setMenuOpen(false);
      openWindow("preview");
      return;
    }
    if (id === "lang") return setRingMode("language");
    if (id === "lang:back") return setRingMode("main");
    if (id === "explain_reply") {
      const reply = replySelectionRef.current;
      if (!reply) return;
      setMenuOpen(false);
      void requests.runReply(reply).then((ok) => {
        if (!ok) return;
        document.getSelection()?.removeAllRanges();
        keepReplySelection(null);
      });
      return;
    }
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
      if (!sel || !actions.includes("meaning")) return;
      const resolved = resolveSelection(guide.content, sel, "meaning");
      if (!resolved.ok) {
        toast.message("حدّد كلمة أو عبارة قصيرة من الدرس مرة ثانية.");
        return;
      }
      requests.stop();
      setPhrase({ text: resolved.quote, context: resolved.context });
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
    setPhrase(null);
    setMenuOpen(false);
    // Show loading and retry in the conversation immediately, including when the request fails.
    if (!wide && !bridge.send) setTab("rita");
    await requests.run(action as RitaAction, target);
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

  const orbState: OrbState =
    requests.busy || making ? "busy" : selection || replySelection ? "armed" : "idle";
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
        {live.state === "failed" && (
          <button
            type="button"
            className="rita-btn rita-btn-soft rita-btn-sm"
            onClick={() => ringPick(live.action)}
          >
            جرّب مرة ثانية
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
            <p className="min-w-0 flex-1 truncate">يوزرا بتشرح… «{live.quote.slice(0, 40)}»</p>
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
    <div
      ref={ritaBox}
      className="st-reply-pane relative flex h-full min-h-0 flex-col bg-white"
      dir="rtl"
    >
      <RitaRealtimeV3
        study={{ lessonId: lesson.id, preview, title: "يوزرا", bridge, children: status }}
      />
    </div>
  );

  return (
    <div className="edith-premium flex h-[100dvh] flex-col bg-white text-[var(--pp-ink)]" dir="rtl">
      <header className="st-top">
        <Link to="/rita-lessons" className="st-top-btn" aria-label="رجوع للدروس">
          <ArrowRight size={15} aria-hidden="true" />
          <span className="hidden sm:inline">الدروس</span>
        </Link>
        <h1 className="sr-only">{title}</h1>
        {preview && <p className="sr-only">معاينة أدمن، لا يتم حفظ التقدم.</p>}
        <div className="flex-1" />
        {practiceView && (
          <button
            type="button"
            className="st-top-btn is-soft !h-11"
            onClick={() => openWindow("practice")}
          >
            {making ? "جاري تجهيز التدريب…" : "آخر تدريب"}
          </button>
        )}
        {guide.allow_download && (
          <button
            type="button"
            onClick={() => void download()}
            disabled={downloading}
            className="st-top-btn is-soft"
          >
            {downloading ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <Download size={14} aria-hidden="true" />
            )}
            PDF
          </button>
        )}
      </header>

      {/* The circle lives over both sides, so it can sit wherever the learner likes. */}
      <div ref={work} className="st-work relative flex min-h-0 flex-1 flex-col">
        {wide ? (
          // Uzyra is always on the left and the guide on the right: the group is laid out left to right.
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
            <Separator className="st-divider" aria-label="غيّر عرض الملف ويوزرا">
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
              aria-label="الدرس ويوزرا"
              className="flex border-b border-[var(--pp-line)]"
            >
              {(
                [
                  ["guide", "الدرس"],
                  ["rita", ritaSpeaking ? "يوزرا بتحكي…" : "يوزرا"],
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
        {win && (
          <FloatingWindow
            key={win.content}
            title={
              win.content === "practice" && practiceView ? practiceTitle(practiceView) : BRAND_NAME
            }
            variant={win.content === "practice" ? "practice" : "questions"}
            origin={win.at}
            shown={win.shown}
            revealSignal={win.reveal}
            tabLabel={win.content === "practice" ? "أظهر نافذة التدريب" : "أظهر النافذة"}
            onHidden={() => {
              setWin((current) => current && { ...current, shown: false });
              orbButton.current?.focus({ preventScroll: true });
            }}
          >
            {win.content === "practice" && practiceView ? (
              <div className="edith-premium st-practice-window" dir="rtl">
                <p className="st-practice-window-note">{PRACTICE_NOTE}</p>
                <StudyPracticeBody
                  key={practiceView.id}
                  view={practiceView}
                  onRetry={() => {
                    if (lastPractice.current) void practice(lastPractice.current.action, true);
                  }}
                  onSwitch={(action) => void practice(action, true)}
                  onClose={() => {
                    setWin(null);
                    orbButton.current?.focus({ preventScroll: true });
                  }}
                />
              </div>
            ) : (
              <QuestionPreview />
            )}
          </FloatingWindow>
        )}
        {win && !win.shown && (
          <WindowDots
            title={
              win.content === "practice" && practiceView ? practiceTitle(practiceView) : BRAND_NAME
            }
            onShow={() => setWin((current) => current && { ...current, shown: true })}
            onClose={() => setWin(null)}
          />
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
          label={
            replySelection
              ? "اشرحلي هاد الجزء من رد يوزرا"
              : selection
                ? "شو بدك نعمل بالتحديد؟"
                : "حدّد جزء من الدرس"
          }
          tone={replySelection && !selection ? "reply" : undefined}
        />
        <RadialMenu
          ref={radial}
          open={menuOpen}
          containerRef={work}
          orbRef={orbButton}
          orbKey={`${orb.x.toFixed(3)},${orb.y.toFixed(3)},${wide ? "w" : "n"},${tab}`}
          items={
            ringMode === "language"
              ? languageItems(explanation.value)
              : replySelection
                ? replyRingItems()
                : ringItems({ actions }).map((item) =>
                    making && (item.id === "make_cards" || item.id === "make_mcq")
                      ? {
                          ...item,
                          disabled: true,
                          disabledReason: "استنّى لحد ما يخلص تجهيز التدريب الحالي",
                        }
                      : item,
                  )
          }
          quote={replySelection?.exact ?? selection?.exact ?? ""}
          meta={
            replySelection
              ? "من جواب يوزرا"
              : [sectionLabel, selected?.kind ? KIND_LABEL[selected.kind] : ""]
                  .filter(Boolean)
                  .join(" · ")
          }
          hasSelection={Boolean(selection || replySelection) && ringMode === "main"}
          selectionHint={
            ringMode !== "main" || replySelection || !selected
              ? undefined
              : selected.kind === "word"
                ? "لتفكيك التركيب، حدّد جملة أو عبارة."
                : selected.kind === "sentence"
                  ? "للمعنى أو سبب الصيغة، حدّد كلمة أو عبارة داخل الجملة."
                  : selected.kind === "phrase"
                    ? undefined
                    : "للخدمات المتخصصة، حدّد كلمة أو جملة واحدة من الدرس."
          }
          tone={replySelection && ringMode === "main" ? "reply" : undefined}
          hint={
            ringMode === "language"
              ? `يوزرا بتشرح بـ: ${LANGUAGE_NAMES[explanation.value]}`
              : replyProblem || "حدّد كلمة أو جملة من الدرس، وبعدين اكبس على الدائرة."
          }
          canReport={!replySelection && actions.includes("report")}
          onLanguage={
            ringMode === "main" && !replySelection ? () => setRingMode("language") : undefined
          }
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
            document.getSelection()?.removeAllRanges();
            keepReplySelection(null);
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
            onPlayingChange={phrasePlaying}
            onClose={closePhrase}
          />
        )}
      </div>
    </div>
  );
}
