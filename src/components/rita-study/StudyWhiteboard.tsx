import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  AudioLines,
  BookOpen,
  Minus,
  Plus,
  Layers,
  ChevronLeft,
  Check,
  ChevronRight,
  CornerDownLeft,
  LoaderCircle,
  MessageCircle,
  Mic,
  Pause,
  Play,
  RotateCcw,
  VolumeX,
} from "lucide-react";
import { studyBoardStep } from "@/lib/study/whiteboard.functions";
import { confirmsBoardStep, type BoardSelection, type BoardStep } from "@/lib/study/whiteboard";
import type { ExplanationLanguage } from "@/lib/explanation-language";
import { recogniser } from "@/lib/browser-speech-recogniser";
import { BoardPaper } from "./BoardPaper";
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
}: {
  sheet: Sheet;
  shown: boolean;
  onReady: (ready: boolean) => void;
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
    if (state !== "playing" || !silent) return;
    const timer = window.setTimeout(finish, Math.max(0, (1 - clock()) * duration));
    return () => clearTimeout(timer);
  }, [state, silent, clock, duration, finish, run]);
  return (
    <>
      <div className="wb-sheet" dir="auto">
        <div className="wb-heading">
          <span aria-hidden="true" />
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
      <div className="wb-transcript">
        <button
          type="button"
          className="wb-audio"
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
        </button>
        <div>
          <span className="wb-speaker">
            {silent ? <VolumeX /> : <AudioLines />}
            {src === undefined
              ? "جارٍ تحضير الصوت…"
              : silent
                ? "الصوت غير متاح · نص الشرح"
                : "يوزرا"}
          </span>
          <p dir="auto">{sheet.step.narration}</p>
          {state !== "done" && shown && (
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
        </div>
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
  const [zoom, setZoom] = useState(100);
  const source = useRef<HTMLDivElement>(null);
  const activeSection = useRef<HTMLElement>(null);
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
  // The voice time ran out (calls and the board share it): the board stops here.
  const [timeOver, setTimeOver] = useState(false);
  const timeOverRef = useRef(false);
  const [voiceNote, setVoiceNote] = useState("");
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
  const stopForTime = () => {
    timeOverRef.current = true;
    setTimeOver(true);
    setHandsFree(false);
    setAsking(false);
  };
  const load = async (index: number, question = "") => {
    if (pending.current || timeOverRef.current) return;
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
        if (mounted.current) {
          if (response.timeOver) stopForTime();
          setProblem(response.message);
        }
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
      void Promise.resolve(reply.voice)
        .then((voice) => {
          if (!mounted.current) return;
          if (voice === "over") stopForTime();
          else if (voice === "call") setVoiceNote("الصوت موقف وانت بمكالمة مع يوزرا.");
          else if (voice === "none") setVoiceNote("خطتك ما فيها وقت صوت، فالشرح بدون صوت.");
        })
        .catch(() => undefined);
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
      <section className="wb" dir="rtl" aria-label="سبورة يوزرا">
        <header className="wb-top" dir="ltr">
          <button
            className="wb-back"
            type="button"
            onClick={onClose}
            aria-label="رجوع إلى الدرس"
            autoFocus
          >
            <ChevronLeft />
          </button>
          <strong dir="auto">{pages[0]?.step.title || "سبورة يوزرا"}</strong>
          <div className="wb-tools">
            <button
              type="button"
              aria-label="تصغير السبورة"
              disabled={zoom <= 75}
              onClick={() => setZoom(zoom - 25)}
            >
              <Minus />
            </button>
            <button aria-label="الحجم الأصلي" onClick={() => setZoom(100)}>
              {zoom}%
            </button>
            <button
              type="button"
              aria-label="تكبير السبورة"
              disabled={zoom >= 150}
              onClick={() => setZoom(zoom + 25)}
            >
              <Plus />
            </button>
          </div>
          <button
            className="wb-source-button"
            type="button"
            title="الفقرة المحدّدة"
            aria-label="عرض الفقرة المحدّدة"
            onClick={() => {
              setExpanded(true);
              source.current?.scrollIntoView({ block: "start" });
            }}
          >
            <BookOpen size={18} />
          </button>
        </header>
        <div className="wb-scroll" ref={scrollArea}>
          <div ref={source} className="wb-reference">
            <BookOpen size={17} />
            <div>
              <strong>من الفقرة المحدّدة</strong>
              <blockquote className={expanded ? "is-expanded" : ""} dir="auto">
                {selection.exact}
              </blockquote>
            </div>
            {selection.exact.length > 55 && (
              <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
                {expanded ? "طيّ" : "عرض الكل"}
              </button>
            )}
          </div>
          <div className="wb-canvas" style={{ width: canvasWidth || "100%", zoom: zoom / 100 }}>
            {pages.map((sheet, i) => (
              <article
                className="wb-topic"
                key={i}
                ref={i === cursor ? activeSection : undefined}
                data-active={i === cursor}
                data-followup={Boolean(sheet.question)}
              >
                <div className="wb-topic-label">
                  <Layers size={14} />
                  {sheet.question ? "سؤال عن القسم" : "القسم"} {["١", "٢", "٣"][sheet.index]}
                </div>
                {sheet.question && (
                  <p className="wb-question" dir="auto">
                    {sheet.question}
                  </p>
                )}
                {i === cursor && !finished ? (
                  <Playback sheet={sheet} shown={shown && !busy && !asking} onReady={setReady} />
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
        <footer className="wb-footer">
          {timeOver && !busy ? (
            <div className="wb-status" role="alert">
              <span>خلص وقتك ولا يمكنك الإكمال.</span>
              <a href="/pricing">شوف الخطط</a>
              <button type="button" onClick={onClose}>
                العودة للدرس
              </button>
            </div>
          ) : null}
          {!timeOver && busy && (
            <div role="status" className="wb-status">
              <LoaderCircle className="wb-spin" />
              {page ? "يوزرا بتحضّر الرسم التالي…" : "يوزرا بتحضّر شرح الفقرة…"}
            </div>
          )}
          {problem && !timeOver && (
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
          {page &&
            !busy &&
            !timeOver &&
            (asking && !finished ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  respond(draft);
                }}
              >
                <label htmlFor="wb-ask">شو حابّ أوضّح بهالخطوة؟</label>
                <div className="wb-field">
                  <input
                    id="wb-ask"
                    autoFocus
                    value={draft}
                    maxLength={300}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="اكتب سؤالك…"
                    dir="auto"
                  />
                  <button aria-label="إرسال السؤال" disabled={!draft.trim()}>
                    <CornerDownLeft />
                  </button>
                </div>
                <button type="button" className="wb-link" onClick={() => setAsking(false)}>
                  رجوع للشرح
                </button>
              </form>
            ) : (
              <>
                {voiceNote && <p className="wb-hint">{voiceNote}</p>}
                <p aria-live="polite" className="wb-hint">
                  {finished
                    ? ""
                    : micHint ||
                      (hearing
                        ? "الميكروفون شغّال. احكي «تمام» أو اسأل يوزرا."
                        : ready
                          ? canHear
                            ? "وقفت هون. احكي «تمام» بالميكروفون أو تابع بالزر."
                            : "وقفت هون. منكمّل؟"
                          : "اسمع الشرح وتابع القلم.")}
                </p>
                <div className="wb-controls">
                  <button
                    type="button"
                    className="wb-primary"
                    onClick={finished ? onClose : advance}
                  >
                    {finished
                      ? "العودة للدرس"
                      : page.index === 2 && cursor === pages.length - 1
                        ? "تمام، فهمت"
                        : "تمام، كمّلي"}{" "}
                    {finished ? <Check /> : <ArrowLeft />}
                  </button>
                  {!finished && (
                    <>
                      <button
                        type="button"
                        className="wb-small"
                        onClick={() => setAsking(true)}
                        aria-label="اسأل عن هذه الخطوة"
                      >
                        <MessageCircle />
                        <span>عندي سؤال</span>
                      </button>
                      {canHear && (
                        <button
                          type="button"
                          className="wb-icon"
                          aria-label="المتابعة بالصوت"
                          title="المتابعة بالصوت"
                          aria-pressed={handsFree}
                          onClick={() => {
                            setMicHint("");
                            setHandsFree(!handsFree);
                          }}
                        >
                          <Mic />
                        </button>
                      )}
                    </>
                  )}
                  {cursor > 0 && (
                    <button
                      type="button"
                      className="wb-icon"
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
              </>
            ))}
        </footer>
      </section>
    </dialog>
  );
}
