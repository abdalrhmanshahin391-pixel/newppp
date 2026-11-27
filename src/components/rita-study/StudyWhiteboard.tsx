import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowUp,
  Captions,
  Check,
  ChevronRight,
  Download,
  LoaderCircle,
  Mic,
  Pause,
  Play,
  RotateCcw,
  X,
} from "lucide-react";
import { studyBoardStep } from "@/lib/study/whiteboard.functions";
import { confirmsBoardStep, type BoardSelection, type BoardStep } from "@/lib/study/whiteboard";
import type { ExplanationLanguage } from "@/lib/explanation-language";
import { recogniser } from "@/lib/browser-speech-recogniser";
import { BoardPaper } from "./BoardPaper";
import { RitaCube } from "./RitaCube";
import { downloadBoard } from "./board-download";
import "./whiteboard.css";

const completeInk = () => 1;
type BoardTiming = { action: string; start: number };
function recordInk(timing: BoardTiming) {
  performance.measure("uzyra.board." + timing.action + ".ink", { start: timing.start });
}
type Sheet = {
  step: BoardStep;
  visibleCommands: number;
  timing: BoardTiming;
  onInk: () => void;
  audio: string | null | Promise<string | null>;
  index: number;
  question: string;
};
type Props = {
  startedAt: number;
  lessonId: string;
  preview: boolean;
  selection: BoardSelection;
  language: ExplanationLanguage;
  shown: boolean;
  onClose: () => void;
  onVoiceGuard: (on: boolean) => void;
};

function Playback({
  sheet,
  shown,
  onReady,
  captions,
  controls,
  status,
  onPlaying,
}: {
  sheet: Sheet;
  shown: boolean;
  onReady: (ready: boolean) => void;
  /** The narration as words on screen (always when there is no voice). */
  captions: boolean;
  /** Where the play/pause button and the voice status go (the board's top-left cluster). */
  controls: HTMLElement | null;
  status: HTMLElement | null;
  onPlaying: (playing: boolean) => void;
}) {
  const heard = useRef(false);
  const audio = useRef<HTMLAudioElement>(null);
  const [src, setSrc] = useState<string | null | undefined>(() =>
    typeof sheet.audio === "string" || sheet.audio === null ? sheet.audio : undefined,
  );
  const time = useRef({ start: 0, progress: 0, running: false, voiced: Boolean(src), floor: 0 });
  const wantsVoice = useRef(true);
  useEffect(() => {
    let live = true;
    Promise.resolve(sheet.audio).then((value) => {
      if (live) setSrc(value);
    });
    return () => {
      live = false;
    };
  }, [sheet.audio]);
  const [state, setState] = useState<"playing" | "paused" | "done">("paused");
  const [silent, setSilent] = useState(!src);
  const [run, setRun] = useState(0);
  const duration = Math.min(11000, Math.max(3200, sheet.step.narration.length * 68));
  const clock = useCallback(() => {
    const t = time.current;
    if (!t.running && t.progress === 1) return 1;
    if (
      t.voiced &&
      audio.current &&
      Number.isFinite(audio.current.duration) &&
      audio.current.duration > 0
    )
      return Math.max(t.floor, Math.min(1, audio.current.currentTime / audio.current.duration));
    if (t.voiced || !t.running) return t.progress;
    return Math.min(1, t.progress + (performance.now() - t.start) / duration);
  }, [duration]);
  const finish = useCallback(() => {
    time.current.progress = 1;
    time.current.running = false;
    setState("done");
    onReady(true);
  }, [onReady]);
  const pause = useCallback(() => {
    wantsVoice.current = false;
    time.current.progress = clock();
    time.current.running = false;
    audio.current?.pause();
    setState((old) => (old === "done" ? old : "paused"));
  }, [clock]);
  const play = useCallback(
    (attachVoice = false) => {
      wantsVoice.current = true;
      onReady(false);
      const t = time.current;
      if (t.progress >= 1 && !attachVoice) {
        t.floor = 0;
        t.progress = 0;
        if (audio.current) audio.current.currentTime = 0;
      }
      t.start = performance.now();
      t.running = true;
      setRun((number) => number + 1);
      setState("playing");
      const player = audio.current;
      if (t.voiced && player)
        void player.play().catch((error: Error) => {
          if (!t.running) return;
          if (error.name === "NotAllowedError") {
            pause();
            return;
          }
          if (error.name === "AbortError") return;
          t.voiced = false;
          t.start = performance.now();
          setSilent(true);
        });
    },
    [onReady, pause],
  );
  const visible = useRef(shown);
  visible.current = shown;
  useEffect(() => {
    const timer = time.current;
    const player = audio.current;
    if (visible.current) play();
    return () => {
      timer.running = false;
      player?.pause();
    };
  }, [play]);
  useEffect(() => {
    if (!src || time.current.voiced) return;
    const t = time.current;
    t.floor = clock();
    t.progress = t.floor;
    t.voiced = true;
    setSilent(false);
    if (visible.current && wantsVoice.current) play(true);
  }, [src, clock, play]);
  useEffect(() => {
    if (!shown) pause();
  }, [shown, pause]);
  useEffect(() => {
    onPlaying(state === "playing");
  }, [state, onPlaying]);
  useEffect(() => () => onPlaying(false), [onPlaying]);
  useEffect(() => {
    if (state !== "playing" || !silent) return;
    const timer = window.setTimeout(finish, Math.max(0, (1 - clock()) * duration));
    return () => clearTimeout(timer);
  }, [state, silent, clock, duration, finish, run]);
  // Words on screen when asked for, or when it is known there is no voice.
  const showText = captions || (silent && src !== undefined);
  const voiceNote =
    src === undefined ? "جارٍ تحضير الصوت…" : silent ? "الصوت غير متاح · نص الشرح" : "";
  return (
    <>
      {controls &&
        createPortal(
          <button
            type="button"
            className="wb-round"
            disabled={!shown}
            onClick={state === "playing" ? pause : () => play()}
            aria-label={
              state === "playing"
                ? "إيقاف الشرح مؤقتًا"
                : state === "done"
                  ? "إعادة الشرح"
                  : "تشغيل الشرح"
            }
          >
            {state === "playing" ? <Pause /> : state === "done" ? <RotateCcw /> : <Play />}
          </button>,
          controls,
        )}
      {status && voiceNote && createPortal(<span className="wb-voice">{voiceNote}</span>, status)}
      <div className="wb-sheet" dir="auto">
        <div className="wb-heading">
          <h2>{sheet.step.title}</h2>
        </div>
        <BoardPaper
          key={run}
          visibleCommands={sheet.visibleCommands}
          onInk={sheet.onInk}
          step={sheet.step}
          clock={clock}
          playing={state === "playing" && shown}
        />
      </div>
      <div className="wb-transcript" data-hidden={showText ? undefined : ""}>
        <p dir="auto">{sheet.step.narration}</p>
        {showText && state !== "done" && shown && (
          <div className="wb-reading">
            {state === "paused" && (
              <button type="button" onClick={() => play()}>
                تشغيل الشرح
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                wantsVoice.current = false;
                audio.current?.pause();
                finish();
              }}
            >
              عرض الخطوة كاملة
            </button>
          </div>
        )}
        <audio
          ref={audio}
          src={src || undefined}
          preload="auto"
          onPlaying={() => {
            if (!heard.current) {
              heard.current = true;
              performance.measure("uzyra.board." + sheet.timing.action + ".voice", {
                start: sheet.timing.start,
              });
            }
          }}
          onEnded={finish}
          onError={() => {
            time.current.voiced = false;
            time.current.start = performance.now();
            setSilent(true);
          }}
        />
      </div>
    </>
  );
}

export function StudyWhiteboard({
  startedAt,
  lessonId,
  preview,
  selection,
  language,
  shown,
  onClose,
  onVoiceGuard,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(0);
  useEffect(() => {
    const observer = new ResizeObserver((entries) => setCanvasWidth(entries[0].contentRect.width));
    observer.observe(scrollArea.current!);
    return () => observer.disconnect();
  }, []);
  const activeSection = useRef<HTMLElement>(null);
  const levels = useRef({ input: 0, output: 0 });
  const [captions, setCaptions] = useState(false);
  const [talking, setTalking] = useState(false);
  const [controls, setControls] = useState<HTMLElement | null>(null);
  const [status, setStatus] = useState<HTMLElement | null>(null);
  const [saving, setSaving] = useState(false);
  const board = useRef<HTMLElement>(null);
  const footer = useRef<HTMLElement>(null);
  // The words under the drawing float just above the question bar, whatever its height.
  useEffect(() => {
    const foot = footer.current!;
    const observer = new ResizeObserver(() =>
      board.current?.style.setProperty("--wb-foot", `${foot.offsetHeight}px`),
    );
    observer.observe(foot);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const el = dialog.current!;
    el.showModal();
    return () => el.close();
  }, []);
  const generate = useServerFn(studyBoardStep);
  const [pages, setPages] = useState<Sheet[]>([]);
  const [cursor, setCursor] = useState(0);
  const page = pages[cursor];
  useEffect(() => {
    activeSection.current?.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion:reduce)").matches ? "instant" : "smooth",
    });
  }, [page]);
  const [busy, setBusy] = useState(true);
  const [problem, setProblem] = useState("");
  const [ready, setReady] = useState(false);
  const [asking, setAsking] = useState(false);
  const [draft, setDraft] = useState("");
  const [handsFree, setHandsFree] = useState(false);
  const [hearing, setHearing] = useState(false);
  const [micHint, setMicHint] = useState("");
  const [canHear, setCanHear] = useState(false);
  const [finished, setFinished] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const mounted = useRef(false),
    pending = useRef(false);
  const failed = useRef({ index: 0, question: "" });
  const initial = useRef(false);
  const initialClick = useRef(true);
  const [firstRow, setFirstRow] = useState<BoardStep | null>(null);
  const firstSection = useRef<HTMLElement>(null);
  const onFirstInk = useRef<() => void>(undefined);
  useEffect(() => {
    if (firstRow) firstSection.current?.scrollIntoView({ block: "nearest" });
  }, [firstRow]);
  const load = async (index: number, question = "") => {
    if (pending.current) return;
    const timing = {
      action: question ? "question" : index ? "continue" : "open",
      start: index || question || !initialClick.current ? performance.now() : startedAt,
    };
    initialClick.current = false;
    let recordedInk = false;
    const onInk = () => {
      if (recordedInk) return;
      recordedInk = true;
      recordInk(timing);
    };
    onFirstInk.current = onInk;
    pending.current = true;
    failed.current = { index, question };
    setProblem("");
    setBusy(true);
    setAsking(false);
    try {
      const response = await generate({
        signal: AbortSignal.timeout(75000),
        data: {
          lessonId,
          preview,
          selection,
          language,
          previous: pages
            .slice(0, cursor + 1)
            .slice(-5)
            .map((p) =>
              [
                p.question,
                p.step.title,
                ...p.step.commands.flatMap((c) => (c.op === "write" ? [c.text] : [])),
                p.step.narration,
              ]
                .filter(Boolean)
                .join("\n")
                .slice(0, 1200),
            ),
          index,
          question,
        },
      });
      if (!response.ok) {
        if (mounted.current) setProblem(response.message);
        return;
      }
      // Subscribe immediately so a failed stream cannot leave an unhandled deferred rejection.
      const completed = response.completion.catch(() => null);
      const first = await response.previewStep;
      if (mounted.current && first) setFirstRow(first);
      const reply = await completed;
      if (!reply) throw new Error("Board stream closed");
      if (!mounted.current) return;
      if (!reply.ok) {
        setProblem(reply.message);
        return;
      }
      const samePrefix =
        first &&
        first.commands.every(
          (command, i) => JSON.stringify(command) === JSON.stringify(reply.step.commands[i]),
        );
      const next = {
        visibleCommands: samePrefix ? first.commands.length : 0,
        timing,
        onInk,
        step: reply.step,
        audio: Promise.resolve(reply.audio).catch(() => null),
        index,
        question,
      };
      const insert = pages.length ? cursor + 1 : 0;
      setPages((old) => [...old.slice(0, insert), next, ...old.slice(insert)]);
      setCursor(insert);
      setReady(false);
      setDraft("");
      setMicHint("");
    } catch {
      if (mounted.current) setProblem("انقطع الاتصال. الفقرة محفوظة، جرّب مرة ثانية.");
    } finally {
      pending.current = false;
      if (mounted.current) {
        setFirstRow(null);
        setBusy(false);
      }
    }
  };
  const start = useRef(load);
  useEffect(() => {
    mounted.current = true;
    if (!initial.current) {
      initial.current = true;
      void start.current(0);
    }
    setCanHear(Boolean(recogniser()));
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (shown) onVoiceGuard(true);
    return () => {
      if (shown) onVoiceGuard(false);
    };
  }, [shown, onVoiceGuard]);
  function advance() {
    if (pending.current || !page || finished) return;
    setAsking(false);
    setProblem("");
    setMicHint("");
    if (cursor < pages.length - 1) {
      setReady(false);
      setCursor(cursor + 1);
    } else if (page.index < 2) void load(page.index + 1);
    else {
      setFinished(true);
      setHandsFree(false);
    }
  }
  function respond(value: string) {
    const words = value.trim().slice(0, 300);
    if (!words || pending.current) return;
    if (confirmsBoardStep(words)) advance();
    else void load(page.index, words);
  }
  const handleWords = useRef(respond);
  handleWords.current = respond;
  useEffect(() => {
    if (!handsFree || !ready || !shown || busy || asking || problem || finished) return;
    const Voice = recogniser();
    if (!Voice) return;
    const rec = new Voice();
    let live = true,
      heard = false;
    rec.lang = language === "en" ? "en-US" : "ar-JO";
    rec.interimResults = false;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      if (!live || heard) return;
      const words = e.results[0]?.[0]?.transcript;
      if (words) {
        heard = true;
        setHearing(false);
        handleWords.current(words);
      }
    };
    rec.onerror = () => {
      if (live) {
        setHandsFree(false);
        setMicHint("تعذّر سماعك. بتقدر تكتب سؤالك أو تكبس «تمام».");
      }
    };
    rec.onend = () => {
      if (live) {
        setHearing(false);
        if (!heard) setHandsFree(false);
      }
    };
    try {
      rec.start();
      setHearing(true);
    } catch {
      setHandsFree(false);
      setMicHint("الميكروفون غير متاح.");
    }
    return () => {
      live = false;
      rec.onend = null;
      rec.onerror = null;
      rec.onresult = null;
      rec.abort();
      setHearing(false);
    };
  }, [handsFree, ready, shown, busy, asking, problem, finished, language, cursor]);
  const cubeMode = busy ? "thinking" : talking ? "speaking" : "idle";
  return (
    <dialog
      className="wb-dialog"
      ref={dialog}
      aria-label="سبورة يوزرا"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <section
        ref={board}
        className="wb"
        dir="rtl"
        aria-label="سبورة يوزرا"
        data-captions={captions ? "" : undefined}
      >
        <header className="wb-top" dir="ltr">
          <div className="wb-cluster">
            <span className="wb-avatar" aria-hidden="true">
              <RitaCube levelsRef={levels} mode={cubeMode} label="" />
            </span>
            <span ref={setControls} className="wb-slot" />
            <button
              type="button"
              className="wb-round"
              aria-pressed={captions}
              aria-label="نص الشرح"
              title="نص الشرح"
              onClick={() => setCaptions(!captions)}
            >
              <Captions />
            </button>
            <button
              type="button"
              className="wb-round"
              aria-label="نزّل السبورة كصورة"
              title="نزّل السبورة كصورة"
              disabled={!page || saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await downloadBoard(activeSection.current, page?.step.title ?? "");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? <LoaderCircle className="wb-spin" /> : <Download />}
            </button>
            <span ref={setStatus} className="wb-slot" />
          </div>
          <button
            className="wb-close"
            type="button"
            onClick={onClose}
            aria-label="رجوع إلى الدرس"
            autoFocus
          >
            <X />
          </button>
        </header>
        <div className="wb-scroll" ref={scrollArea}>
          <div className="wb-reference">
            <span>من الفقرة</span>
            <blockquote className={expanded ? "is-expanded" : ""} dir="auto">
              {selection.exact}
            </blockquote>
            {selection.exact.length > 55 && (
              <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
                {expanded ? "طيّ" : "عرض الكل"}
              </button>
            )}
          </div>
          <div className="wb-canvas" style={{ width: canvasWidth || "100%" }}>
            {pages.map((sheet, i) => (
              <article
                className="wb-topic"
                key={i}
                ref={i === cursor ? activeSection : undefined}
                data-active={i === cursor}
                data-followup={Boolean(sheet.question)}
              >
                {sheet.question && (
                  <p className="wb-question" dir="auto">
                    <span>سؤالك</span>
                    {sheet.question}
                  </p>
                )}
                {i === cursor && !finished ? (
                  <Playback
                    sheet={sheet}
                    shown={shown && !busy && !asking}
                    onReady={setReady}
                    captions={captions}
                    controls={controls}
                    status={status}
                    onPlaying={setTalking}
                  />
                ) : (
                  <>
                    <div className="wb-sheet">
                      <div className="wb-heading">
                        <h2 dir="auto">{sheet.step.title}</h2>
                      </div>
                      <BoardPaper step={sheet.step} clock={completeInk} playing={false} />
                    </div>
                    <p className="wb-saved-note" dir="auto">
                      {sheet.step.narration}
                    </p>
                  </>
                )}
              </article>
            ))}
            {firstRow && busy && (
              <article ref={firstSection} className="wb-topic" data-active="true">
                <div className="wb-sheet">
                  <div className="wb-heading">
                    <h2 dir="auto">{firstRow.title}</h2>
                  </div>
                  <BoardPaper
                    step={firstRow}
                    clock={completeInk}
                    playing={false}
                    onInk={onFirstInk.current}
                  />
                </div>
              </article>
            )}
          </div>
          {finished && (
            <div role="status" className="wb-complete">
              <Check /> خلصنا شرح الفقرة.
            </div>
          )}
        </div>
        <footer className="wb-footer" ref={footer}>
          {busy && (
            <div role="status" className="wb-status">
              <LoaderCircle className="wb-spin" />
              {page ? "يوزرا بتحضّر الرسم التالي…" : "يوزرا بتحضّر شرح الفقرة…"}
            </div>
          )}
          {problem && (
            <div className="wb-status" role="alert">
              <span>{problem}</span>
              <button
                type="button"
                onClick={() => void load(failed.current.index, failed.current.question)}
              >
                جرّب مرة ثانية
              </button>
            </div>
          )}
          {(micHint || hearing) && (
            <p aria-live="polite" className="wb-hint">
              {micHint || "الميكروفون شغّال. احكي «تمام» أو اسأل يوزرا."}
            </p>
          )}
          {page && !busy && (
            <div className="wb-next">
              <button type="button" className="wb-primary" onClick={finished ? onClose : advance}>
                {finished
                  ? "العودة للدرس"
                  : page.index === 2 && cursor === pages.length - 1
                    ? "تمام، فهمت"
                    : "تمام، كمّلي"}{" "}
                {finished ? <Check /> : <ArrowLeft />}
              </button>
              {cursor > 0 && (
                <button
                  type="button"
                  className="wb-back-step"
                  title="القسم السابق"
                  aria-label="القسم السابق"
                  onClick={() => {
                    setFinished(false);
                    setProblem("");
                    setReady(false);
                    setCursor(cursor - 1);
                  }}
                >
                  <ChevronRight />
                </button>
              )}
            </div>
          )}
          <form
            className="wb-ask"
            dir="ltr"
            onSubmit={(e) => {
              e.preventDefault();
              respond(draft);
            }}
          >
            {canHear && (
              <button
                type="button"
                className="wb-mic"
                aria-label="المتابعة بالصوت"
                title="المتابعة بالصوت"
                aria-pressed={handsFree}
                disabled={!page || busy || finished}
                onClick={() => {
                  setMicHint("");
                  setHandsFree(!handsFree);
                }}
              >
                <Mic />
              </button>
            )}
            <div className="wb-field">
              <button
                aria-label="إرسال السؤال"
                disabled={!draft.trim() || !page || busy || finished}
              >
                <ArrowUp />
              </button>
              <label htmlFor="wb-ask" className="wb-sr">
                اسأل عن هذه الخطوة
              </label>
              <input
                id="wb-ask"
                value={draft}
                maxLength={300}
                disabled={!page || busy || finished}
                onChange={(e) => setDraft(e.target.value)}
                onFocus={() => setAsking(true)}
                onBlur={() => {
                  if (!draft.trim()) setAsking(false);
                }}
                placeholder="اطرح سؤالًا متابعًا…"
                dir={draft ? "auto" : "rtl"}
                autoComplete="off"
              />
            </div>
          </form>
        </footer>
      </section>
    </dialog>
  );
}
