// A film & GIF stop on a page of its own, in three stages: watch each clip (captions in English,
// Arabic or both, replay, slow), understand it (meaning, listening, the fitting sentence) and
// practise it (fill the gap, word order, speaking, matching the words). Sounds and Uzyra's cube
// answer each check; the result lists the words learnt and offers to redo only the mistakes.
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Pause,
  Play,
  RotateCcw,
  Turtle,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/legacy-client";
import { listClips } from "@/lib/film-clips.functions";
import {
  blankParts,
  choiceOptions,
  clipCredit,
  matchPairs,
  mixedOrder,
  orderPuzzle,
  pageSteps,
  sameWord,
  shuffled,
  stageOf,
  stopExerciseList,
  targetIndex,
  type ClipPoolEntry,
  type FilmClip,
  type PageStage,
  type PageStep,
  type StopExercise,
} from "@/lib/film-clips";
import { useUiLanguage } from "@/components/language/useUiLanguage";
import { RitaCube } from "@/components/rita-study/RitaCube";
import {
  installSoundUnlock,
  quizDoneSound,
  rightAnswerSound,
  setSoundOn,
  soundOn,
  unlockSound,
  wrongAnswerSound,
} from "@/components/rita-study/tech-sound";
import { FilmSpeaking } from "../FilmSpeaking";
import "../quiz-page/path-quiz-page.css";
import "./path-clips-page.css";

type Copy = (en: string, ar: string) => string;
type Result = "right" | "wrong";
type Stop = { title: string; clip_ids: string[]; clip_exercises: string[] | null };
type Captions = "en" | "ar" | "both";

function useCopy(): Copy {
  const ar = useUiLanguage() === "ar";
  return (en, arabic) => (ar ? arabic : en);
}

function message(error: unknown) {
  return error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : String(error);
}

function reducedMotion() {
  return (
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

async function readStop(itemId: string): Promise<Stop | null> {
  const full = await supabase
    .from("rita_path_items")
    .select("title, clip_ids, clip_exercises")
    .eq("id", itemId)
    .maybeSingle();
  // Before the clip_exercises column exists: the stop uses every exercise.
  const r = full.error
    ? await supabase
        .from("rita_path_items")
        .select("title, clip_ids")
        .eq("id", itemId)
        .maybeSingle()
    : full;
  if (r.error) throw r.error;
  const row = r.data as Partial<Stop> | null;
  if (!row) return null;
  return {
    title: row.title ?? "",
    clip_ids: Array.isArray(row.clip_ids) ? row.clip_ids : [],
    clip_exercises: Array.isArray(row.clip_exercises) ? row.clip_exercises : null,
  };
}

export function PathClipsPage({ itemId }: { itemId: string }) {
  const t = useCopy();
  const ar = useUiLanguage() === "ar";
  const navigate = useNavigate();
  const listFn = useServerFn(listClips);
  const [sound, setSound] = useState(true);
  const leaveCheck = useRef<() => boolean>(() => true);

  useEffect(() => {
    setSound(soundOn());
    return installSoundUnlock();
  }, []);

  const stop = useQuery({
    queryKey: ["path-clips-stop", itemId],
    queryFn: () => readStop(itemId),
    refetchOnWindowFocus: false,
  });
  const ids = stop.data?.clip_ids ?? [];
  const clips = useQuery({
    queryKey: ["path-clips", itemId, ids.join(",")],
    queryFn: () => listFn({ data: { ids } }),
    enabled: ids.length > 0,
    refetchOnWindowFocus: false,
    gcTime: 0,
  });

  const back = useCallback(() => {
    if (!leaveCheck.current()) return;
    void navigate({ to: "/rita-lessons" });
  }, [navigate]);

  function toggleSound() {
    const next = !sound;
    setSoundOn(next);
    setSound(next);
    if (next) unlockSound();
  }

  const BackIcon = ar ? ArrowRight : ArrowLeft;
  const error = stop.error ?? clips.error;
  const loading = stop.isPending || (ids.length > 0 && clips.isPending);
  const list = clips.data?.clips ?? [];

  return (
    <main className="edith-premium pqp pcp" dir={ar ? "rtl" : "ltr"}>
      <div className="pqp-dots" aria-hidden="true" />
      <header className="pqp-top">
        <button
          type="button"
          className="pqp-icon"
          onClick={back}
          aria-label={t("Back to the path", "ارجع للمسار")}
        >
          <BackIcon size={20} />
        </button>
        <p className="pqp-name" dir="auto">
          {stop.data?.title || t("Film & GIF", "أفلام وGIF")}
        </p>
        <button
          type="button"
          className="pqp-icon"
          onClick={toggleSound}
          aria-pressed={sound}
          aria-label={sound ? t("Turn sound off", "اطفِ الصوت") : t("Turn sound on", "شغّل الصوت")}
        >
          {sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
      </header>

      {loading ? (
        <section className="pqp-body" aria-busy="true">
          <p className="sr-only" role="status">
            {t("Loading the clips…", "عم نحمّل المقاطع…")}
          </p>
          <div className="pqp-skel pqp-skel-bar" />
          <div className="pqp-skel pcp-skel-video" />
          <div className="pqp-skel pqp-skel-option" />
        </section>
      ) : error ? (
        <Notice
          title={t("The clips didn't load", "ما قدرنا نحمّل المقاطع")}
          body={message(error)}
          action={t("Try again", "أعد المحاولة")}
          onAction={() => void (stop.error ? stop.refetch() : clips.refetch())}
          onBack={back}
          t={t}
        />
      ) : !list.length ? (
        <Notice
          title={t("No clips here yet", "لسا ما في مقاطع هون")}
          body={t("Clips haven't been added to this stop yet.", "لسا ما انضافت مقاطع لهاي المحطة.")}
          onBack={back}
          t={t}
        />
      ) : (
        <Session
          clips={list}
          pool={clips.data?.pool ?? []}
          allowed={stopExerciseList(stop.data?.clip_exercises)}
          t={t}
          setLeaveCheck={(check) => (leaveCheck.current = check)}
          onBack={back}
        />
      )}
    </main>
  );
}

function Notice({
  title,
  body,
  action,
  onAction,
  onBack,
  t,
}: {
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
  onBack: () => void;
  t: Copy;
}) {
  return (
    <section className="pqp-body pqp-notice" role="alert">
      <h1>{title}</h1>
      <p dir="auto">{body}</p>
      <div className="pqp-row">
        {action && onAction && (
          <button type="button" className="pqp-btn pqp-btn-dark" onClick={onAction}>
            {action}
          </button>
        )}
        <button type="button" className="pqp-btn pqp-btn-line" onClick={onBack}>
          {t("Back to the path", "ارجع للمسار")}
        </button>
      </div>
    </section>
  );
}

/** One run over the steps; «redo the mistakes» starts a new run with only those steps. */
function Session({
  clips,
  pool,
  allowed,
  t,
  setLeaveCheck,
  onBack,
}: {
  clips: FilmClip[];
  pool: ClipPoolEntry[];
  allowed: ReturnType<typeof stopExerciseList>;
  t: Copy;
  setLeaveCheck: (check: () => boolean) => void;
  onBack: () => void;
}) {
  const all = useMemo(() => pageSteps(clips, allowed), [clips, allowed]);
  const [run, setRun] = useState({ key: 0, steps: all });
  return (
    <Round
      key={run.key}
      steps={run.steps}
      clips={clips}
      pool={pool}
      t={t}
      setLeaveCheck={setLeaveCheck}
      onBack={onBack}
      onRestart={(steps) => setRun((old) => ({ key: old.key + 1, steps: steps ?? all }))}
    />
  );
}

const STAGES: { id: PageStage; en: string; ar: string }[] = [
  { id: "watch", en: "Watch", ar: "شاهد" },
  { id: "understand", en: "Understand", ar: "افهم" },
  { id: "practise", en: "Practise", ar: "تمرّن" },
];

function Round({
  steps,
  clips,
  pool,
  t,
  setLeaveCheck,
  onBack,
  onRestart,
}: {
  steps: PageStep[];
  clips: FilmClip[];
  pool: ClipPoolEntry[];
  t: Copy;
  setLeaveCheck: (check: () => boolean) => void;
  onBack: () => void;
  onRestart: (steps?: PageStep[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<number, Result>>({});
  const [reaction, setReaction] = useState<"" | Result>("");
  const levels = useRef({ input: 0, output: 0 });
  const foot = useRef<HTMLElement>(null);
  const done = index >= steps.length;
  const step = steps[index];
  const stage = step ? stageOf(step) : "practise";
  const answered = Object.keys(results).length;

  useEffect(() => {
    setLeaveCheck(() =>
      done || index === 0
        ? true
        : window.confirm(
            t("Leave? Your progress here will be lost.", "بدك تطلع؟ رح يضيع تقدّمك بهاي المحطة."),
          ),
    );
  }, [done, index, setLeaveCheck, t]);

  // Room under the content for the fixed action bar, however tall it grows.
  useEffect(() => {
    const bar = foot.current;
    const page = bar?.closest<HTMLElement>(".pqp");
    if (!bar || !page || typeof ResizeObserver === "undefined") return;
    const sizer = new ResizeObserver(() =>
      page.style.setProperty("--pqp-foot", `${Math.ceil(bar.offsetHeight)}px`),
    );
    sizer.observe(bar);
    return () => {
      sizer.disconnect();
      page.style.removeProperty("--pqp-foot");
    };
  }, [done, index]);

  const grade = useCallback(
    (result: Result) => {
      unlockSound();
      setResults((old) => ({ ...old, [index]: result }));
      if (result === "right") rightAnswerSound();
      else wrongAnswerSound();
      setReaction(result);
      window.setTimeout(() => setReaction(""), 700);
    },
    [index],
  );

  const go = useCallback((to: number) => {
    setIndex(to);
    window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
  }, []);

  if (done)
    return (
      <Finish
        steps={steps}
        results={results}
        clips={clips}
        t={t}
        onBack={onBack}
        onRestart={onRestart}
      />
    );

  const clip = step.type === "match" ? undefined : clips[step.clip];
  const graded = Object.values(results);
  return (
    <section className="pqp-body pcp-body">
      <div className="pcp-head">
        <ol className="pcp-stages" aria-label={t("Stages", "المراحل")}>
          {STAGES.map((item, i) => {
            const at = STAGES.findIndex((s) => s.id === stage);
            return (
              <li key={item.id} data-state={i < at ? "done" : i === at ? "now" : "todo"}>
                {i < at ? <Check size={14} aria-hidden="true" /> : <b>{i + 1}</b>}
                {t(item.en, item.ar)}
              </li>
            );
          })}
        </ol>
        <div
          className="pcp-bar"
          role="progressbar"
          aria-label={t("Progress", "التقدّم")}
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={index}
        >
          <span style={{ width: `${(index / steps.length) * 100}%` }} />
        </div>
        <div className="pqp-ask pcp-ask">
          <span className="pqp-cube" data-reaction={reaction || undefined} aria-hidden="true">
            <RitaCube levelsRef={levels} mode="idle" label="" />
          </span>
          <p className="pqp-count">
            {step.type === "watch"
              ? `${t("Clip", "مقطع")} ${step.clip + 1} ${t("of", "من")} ${clips.length}`
              : `${index + 1} / ${steps.length}`}
            {answered > 0 && (
              <span className="pcp-tally">
                <Check size={14} aria-hidden="true" /> {graded.filter((r) => r === "right").length}
                <X size={14} aria-hidden="true" /> {graded.filter((r) => r === "wrong").length}
              </span>
            )}
          </p>
        </div>
      </div>

      {step.type === "watch" && clip ? (
        <Watch
          key={index}
          clip={clip}
          t={t}
          footRef={foot}
          canGoBack={index > 0}
          onBack={() => go(index - 1)}
          onNext={() => go(index + 1)}
        />
      ) : step.type === "match" ? (
        <Match
          key={index}
          clips={clips}
          t={t}
          footRef={foot}
          onGrade={grade}
          onNext={() => go(index + 1)}
        />
      ) : clip && step.type === "exercise" ? (
        <Exercise
          key={index}
          clip={clip}
          exercise={step.exercise}
          pool={pool}
          t={t}
          footRef={foot}
          onGrade={grade}
          onNext={() => go(index + 1)}
        />
      ) : null}
    </section>
  );
}

function Highlight({ text, word }: { text: string; word: string }) {
  const i = targetIndex(text, word);
  if (i < 0 || !word) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + word.length)}</mark>
      {text.slice(i + word.length)}
    </>
  );
}

function Credit({ clip }: { clip: FilmClip }) {
  const label = clipCredit(clip);
  const href = clip.credit_url || clip.gif_page;
  if (!label) return null;
  return (
    <p className="pcp-credit" dir="ltr">
      {href ? (
        <a href={href} target="_blank" rel="noreferrer">
          {label}
        </a>
      ) : (
        label
      )}
      {clip.kind === "gif" && <span> · Powered by GIPHY</span>}
    </p>
  );
}

/** A clip's picture: a video with sound (its trimmed part) or a silent GIF loop. */
function Media({
  clip,
  t,
  video,
  big = false,
}: {
  clip: FilmClip;
  t: Copy;
  video: RefObject<HTMLVideoElement | null>;
  big?: boolean;
}) {
  const gif = clip.kind === "gif";
  const [playing, setPlaying] = useState(false);
  const [slow, setSlow] = useState(false);
  const [failed, setFailed] = useState(false);
  const start = clip.start_s ?? 0;

  async function play(rate = slow ? 0.75 : 1) {
    const el = video.current;
    if (!el) return;
    unlockSound();
    try {
      if (failed) el.load();
      setFailed(false);
      if (!gif) el.currentTime = start;
      el.playbackRate = rate;
      await el.play();
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className={big ? "pcp-media pcp-media-big" : "pcp-media"}>
      <div className="pcp-screen">
        {gif ? (
          <video
            ref={video}
            src={clip.gif_mp4 ?? undefined}
            poster={clip.gif_still ?? undefined}
            aria-label={t("GIF", "صورة متحركة")}
            muted
            loop
            autoPlay={!reducedMotion()}
            playsInline
            onPlaying={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() => setFailed(true)}
          />
        ) : (
          <video
            ref={video}
            src={clip.video_url ?? undefined}
            poster={clip.poster_url ?? undefined}
            preload="metadata"
            playsInline
            onClick={() => (playing ? video.current?.pause() : void play())}
            onLoadedMetadata={(event) => {
              if (start && event.currentTarget.currentTime < start)
                event.currentTarget.currentTime = start;
            }}
            onTimeUpdate={(event) => {
              if (clip.end_s != null && event.currentTarget.currentTime >= clip.end_s)
                event.currentTarget.pause();
            }}
            onPlaying={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onError={() => setFailed(true)}
          />
        )}
        {!gif && !playing && (
          <button
            type="button"
            className="pcp-bigplay"
            aria-label={t("Play the clip", "شغّل المقطع")}
            onClick={() => void play()}
          >
            <Play size={30} />
          </button>
        )}
      </div>
      <div className="pcp-controls">
        <button
          type="button"
          className="pcp-chip"
          onClick={() => (playing ? video.current?.pause() : void play())}
        >
          {playing ? <Pause size={16} /> : gif ? <Play size={16} /> : <RotateCcw size={16} />}
          {playing ? t("Pause", "إيقاف") : gif ? t("Play", "شغّل") : t("Replay", "أعد")}
        </button>
        {!gif && (
          <button
            type="button"
            className="pcp-chip"
            aria-pressed={slow}
            onClick={() => {
              const next = !slow;
              setSlow(next);
              void play(next ? 0.75 : 1);
            }}
          >
            <Turtle size={16} />
            {t("Slow", "ببطء")}
          </button>
        )}
        {failed && (
          <button type="button" className="pcp-chip pcp-chip-warn" onClick={() => void play()}>
            {t("Couldn't play · retry", "ما اشتغل · أعد المحاولة")}
          </button>
        )}
      </div>
    </div>
  );
}

function Watch({
  clip,
  t,
  footRef,
  canGoBack,
  onBack,
  onNext,
}: {
  clip: FilmClip;
  t: Copy;
  footRef: RefObject<HTMLElement | null>;
  canGoBack: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [captions, setCaptions] = useState<Captions>("both");
  return (
    <>
      <h1 className="pcp-title">
        {clip.kind === "gif" ? t("Watch", "شاهد") : t("Watch and listen", "شاهد واسمع")}
      </h1>
      <Media clip={clip} t={t} video={video} big />
      <div className="pcp-captions-switch" role="group" aria-label={t("Subtitles", "الترجمة")}>
        {(
          [
            ["en", "English"],
            ["ar", "عربي"],
            ["both", t("Both", "الاثنين")],
          ] as [Captions, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={captions === value}
            onClick={() => setCaptions(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="pcp-lines">
        {captions !== "ar" && (
          <p className="pcp-line-en" dir="ltr" lang="en">
            <Highlight text={clip.en} word={clip.target} />
          </p>
        )}
        {captions !== "en" && clip.ar && (
          <p className="pcp-line-ar" dir="rtl" lang="ar">
            <Highlight text={clip.ar} word={clip.target_ar} />
          </p>
        )}
      </div>
      {(clip.target || clip.context_ar) && (
        <aside className="pcp-word" aria-label={t("The word", "الكلمة")}>
          {clip.target && (
            <p className="pcp-word-pair">
              <span dir="ltr" lang="en">
                {clip.target}
              </span>
              {clip.target_ar && (
                <>
                  <span aria-hidden="true">←</span>
                  <span dir="rtl" lang="ar">
                    {clip.target_ar}
                  </span>
                </>
              )}
            </p>
          )}
          {clip.context_ar && (
            <p className="pcp-word-context" dir="rtl" lang="ar">
              {clip.context_ar}
            </p>
          )}
        </aside>
      )}
      <Credit clip={clip} />
      <Foot footRef={footRef}>
        <div className="pcp-foot-row">
          {canGoBack && (
            <button type="button" className="pqp-btn pqp-btn-line" onClick={onBack}>
              {t("Previous", "السابق")}
            </button>
          )}
          <button type="button" className="pqp-btn pqp-btn-dark pcp-grow" onClick={onNext}>
            {t("Next", "التالي")}
          </button>
        </div>
      </Foot>
    </>
  );
}

function Foot({
  footRef,
  state,
  children,
}: {
  footRef: RefObject<HTMLElement | null>;
  state?: Result;
  children: ReactNode;
}) {
  return (
    <footer ref={footRef} className="pqp-foot" data-state={state}>
      <div className="pqp-foot-in">{children}</div>
    </footer>
  );
}

function Feedback({
  result,
  answer,
  extra,
  t,
  onNext,
}: {
  result: Result;
  answer?: ReactNode;
  extra?: ReactNode;
  t: Copy;
  onNext: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => box.current?.focus({ preventScroll: true }), []);
  return (
    <div
      className="pqp-feedback"
      ref={box}
      tabIndex={-1}
      role="status"
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget) {
          event.preventDefault();
          onNext();
        }
      }}
    >
      <div className="pqp-feedback-text">
        <strong>{result === "right" ? t("Right!", "صح!") : t("Not this time", "مش هالمرة")}</strong>
        {result === "wrong" && answer && (
          <p>
            {t("The answer:", "الجواب الصح:")} {answer}
          </p>
        )}
        {extra}
      </div>
      <button type="button" className="pqp-btn pqp-btn-dark" onClick={onNext}>
        {t("Next", "التالي")}
      </button>
    </div>
  );
}

const LETTERS = "ABC";

function Exercise({
  clip,
  exercise,
  pool,
  t,
  footRef,
  onGrade,
  onNext,
}: {
  clip: FilmClip;
  exercise: Exclude<StopExercise, "match">;
  pool: ClipPoolEntry[];
  t: Copy;
  footRef: RefObject<HTMLElement | null>;
  onGrade: (result: Result) => void;
  onNext: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const choice = exercise === "meaning" || exercise === "listen" || exercise === "sentence";
  const right = exercise === "meaning" ? clip.ar : clip.en;
  const [options] = useState(() =>
    choice
      ? choiceOptions(
          right,
          pool.map((entry) => (exercise === "meaning" ? entry.ar : entry.en)),
        )
      : [],
  );
  const { prefix, words } = orderPuzzle(clip.en, clip.target);
  const [bank] = useState(() => mixedOrder(words.length));
  const [picked, setPicked] = useState<number[]>([]);
  const [chosen, setChosen] = useState<string>();
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<Result>();
  const gap = blankParts(clip.en, clip.target);
  const input = useRef<HTMLInputElement>(null);

  const ready = choice
    ? chosen !== undefined
    : exercise === "order"
      ? picked.length === words.length
      : typed.trim() !== "";

  function check() {
    if (!ready || result) return;
    const ok = choice
      ? chosen === right
      : exercise === "order"
        ? picked.map((i) => words[i]).join(" ") === words.join(" ")
        : sameWord(typed, gap?.word ?? clip.target);
    const next: Result = ok ? "right" : "wrong";
    setResult(next);
    onGrade(next);
  }

  // Keys 1–3 choose an answer; Enter checks.
  useEffect(() => {
    if (!choice || result) return;
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const at = /^[1-3]$/.test(event.key) ? Number(event.key) - 1 : -1;
      if (at >= 0 && at < options.length) setChosen(options[at]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choice, options, result]);

  useEffect(() => {
    if (exercise === "blank") input.current?.focus({ preventScroll: true });
  }, [exercise]);

  const title = {
    meaning: t("What does it mean?", "شو معنى الجملة اللي سمعتها؟"),
    listen: t("Which sentence did you hear?", "أي جملة سمعت؟"),
    sentence: t("Which sentence fits the GIF?", "أي جملة بتناسب الصورة؟"),
    blank: t("Fill in the missing word", "اكتب الكلمة الناقصة"),
    order: t("Build the sentence", "رتّب كلمات الجملة"),
    speak: t("Say the sentence", "انطق الجملة"),
  }[exercise];
  const hint =
    exercise === "meaning"
      ? t("Play the clip, then choose.", "شغّل المقطع واختار المعنى.")
      : exercise === "listen"
        ? t("No subtitles this time. Listen closely.", "بدون ترجمة هالمرة. اسمع منيح.")
        : exercise === "blank" || exercise === "order"
          ? clip.ar
          : "";

  if (exercise === "speak")
    return (
      <>
        <h1 className="pcp-title">{title}</h1>
        <Media clip={clip} t={t} video={video} />
        <div className="pcp-lines">
          <p className="pcp-line-en" dir="ltr" lang="en">
            <Highlight text={clip.en} word={clip.target} />
          </p>
          <p className="pcp-line-ar" dir="rtl" lang="ar">
            {clip.ar}
          </p>
        </div>
        <div className="pcp-speak">
          <FilmSpeaking t={t} stopVideo={() => video.current?.pause()} onDone={onNext} />
        </div>
        <Foot footRef={footRef}>
          <button type="button" className="pqp-btn pqp-btn-line pqp-check" onClick={onNext}>
            {t("Skip", "تخطَّ")}
          </button>
        </Foot>
      </>
    );

  return (
    <>
      <h1 className="pcp-title">{title}</h1>
      {hint && (
        <p className="pcp-hint" dir="auto">
          {hint}
        </p>
      )}
      <Media clip={clip} t={t} video={video} />

      {choice && (
        <div
          className="pqp-options pcp-options"
          role="radiogroup"
          aria-label={t("Answers", "الإجابات")}
          data-shake={result === "wrong" ? "" : undefined}
        >
          {options.map((option, i) => {
            const state = result
              ? option === right
                ? "right"
                : option === chosen
                  ? "wrong"
                  : "off"
              : chosen === option
                ? "picked"
                : "idle";
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={chosen === option}
                className="pqp-option"
                data-state={state}
                disabled={!!result}
                onClick={() => setChosen(option)}
              >
                <span className="pqp-key">{LETTERS[i]}</span>
                <span className="pqp-text" dir={exercise === "meaning" ? "rtl" : "ltr"}>
                  {option}
                </span>
                {state === "right" && <Check className="pqp-mark" size={22} aria-hidden="true" />}
                {state === "wrong" && <X className="pqp-mark" size={22} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}

      {exercise === "blank" && gap && (
        <form
          className="pcp-gap"
          dir="ltr"
          lang="en"
          data-state={result}
          data-shake={result === "wrong" ? "" : undefined}
          onSubmit={(event) => {
            event.preventDefault();
            if (result) onNext();
            else check();
          }}
        >
          <span>{gap.before}</span>
          <input
            ref={input}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            disabled={!!result}
            aria-label={t("The missing word", "الكلمة الناقصة")}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            size={Math.max(4, gap.word.length + 1)}
          />
          <span>{gap.after}</span>
        </form>
      )}

      {exercise === "order" && (
        <>
          <div
            className="pcp-answer"
            dir="ltr"
            aria-label={t("Your sentence", "جملتك")}
            data-shake={result === "wrong" ? "" : undefined}
          >
            {prefix && <strong>{prefix}</strong>}
            {words.map((word, i) => {
              const id = picked[i];
              return id === undefined ? (
                <span
                  key={i}
                  aria-hidden="true"
                  className="pcp-slot"
                  style={{ width: `${Math.min(10, Math.max(3, word.length))}ch` }}
                />
              ) : (
                <button
                  key={i}
                  type="button"
                  disabled={!!result}
                  data-state={result ? (words[id] === word ? "right" : "wrong") : undefined}
                  onClick={() => setPicked(picked.filter((_, n) => n !== i))}
                >
                  {words[id]}
                </button>
              );
            })}
          </div>
          <div className="pcp-bank" dir="ltr">
            {bank.map((id) => (
              <button
                key={id}
                type="button"
                disabled={!!result || picked.includes(id)}
                onClick={() => setPicked([...picked, id])}
              >
                {words[id]}
              </button>
            ))}
          </div>
        </>
      )}

      <Foot footRef={footRef} state={result}>
        {result ? (
          <Feedback
            result={result}
            t={t}
            onNext={onNext}
            answer={
              <bdi dir={exercise === "meaning" ? "rtl" : "ltr"}>
                {exercise === "blank" ? (gap?.word ?? clip.target) : right}
              </bdi>
            }
            extra={
              exercise !== "meaning" && clip.ar ? (
                <p dir="rtl" lang="ar" className="pcp-feedback-ar">
                  {clip.ar}
                </p>
              ) : undefined
            }
          />
        ) : (
          <button
            type="button"
            className="pqp-btn pqp-btn-dark pqp-check"
            disabled={!ready}
            onClick={check}
          >
            {t("Check", "تحقّق")}
          </button>
        )}
      </Foot>
    </>
  );
}

/** Match the stop's words to their meanings: tap a word, then its meaning. */
function Match({
  clips,
  t,
  footRef,
  onGrade,
  onNext,
}: {
  clips: FilmClip[];
  t: Copy;
  footRef: RefObject<HTMLElement | null>;
  onGrade: (result: Result) => void;
  onNext: () => void;
}) {
  const pairs = useMemo(() => matchPairs(clips), [clips]);
  const [left] = useState(() => shuffled(pairs.map((_, i) => i)));
  const [right] = useState(() => shuffled(pairs.map((_, i) => i)));
  const [pickedEn, setPickedEn] = useState<number | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [miss, setMiss] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [result, setResult] = useState<Result>();

  function pickAr(i: number) {
    if (pickedEn === null || matched.includes(i)) return;
    unlockSound();
    if (pickedEn === i) {
      const next = [...matched, i];
      setMatched(next);
      setPickedEn(null);
      if (next.length === pairs.length) {
        const final: Result = mistakes === 0 ? "right" : "wrong";
        setResult(final);
        onGrade(final);
      } else rightAnswerSound();
    } else {
      wrongAnswerSound();
      setMistakes((n) => n + 1);
      setMiss(i);
      window.setTimeout(() => setMiss(null), 450);
    }
  }

  return (
    <>
      <h1 className="pcp-title">{t("Match the words", "وصّل كل كلمة بمعناها")}</h1>
      <p className="pcp-hint">
        {t("Tap a word, then its meaning.", "اكبس على الكلمة، وبعدين على معناها.")}
      </p>
      <div className="pcp-match">
        <div className="pcp-match-col" dir="ltr" lang="en">
          {left.map((i) => (
            <button
              key={i}
              type="button"
              aria-pressed={pickedEn === i}
              data-state={matched.includes(i) ? "right" : pickedEn === i ? "picked" : undefined}
              disabled={matched.includes(i)}
              onClick={() => setPickedEn(i)}
            >
              {pairs[i].en}
            </button>
          ))}
        </div>
        <div className="pcp-match-col" dir="rtl" lang="ar">
          {right.map((i) => (
            <button
              key={i}
              type="button"
              data-state={matched.includes(i) ? "right" : miss === i ? "wrong" : undefined}
              data-shake={miss === i ? "" : undefined}
              disabled={matched.includes(i) || pickedEn === null}
              onClick={() => pickAr(i)}
            >
              {pairs[i].ar}
            </button>
          ))}
        </div>
      </div>
      <Foot footRef={footRef} state={result}>
        {result ? (
          <Feedback
            result={result}
            t={t}
            onNext={onNext}
            extra={
              result === "wrong" ? (
                <p>{t(`${mistakes} wrong tries`, `${mistakes} محاولات غلط`)}</p>
              ) : undefined
            }
          />
        ) : (
          <p className="pcp-foot-note">
            {matched.length} / {pairs.length}
          </p>
        )}
      </Foot>
    </>
  );
}

function Finish({
  steps,
  results,
  clips,
  t,
  onBack,
  onRestart,
}: {
  steps: PageStep[];
  results: Record<number, Result>;
  clips: FilmClip[];
  t: Copy;
  onBack: () => void;
  onRestart: (steps?: PageStep[]) => void;
}) {
  const entries = Object.entries(results).map(([i, r]) => ({ step: steps[Number(i)], result: r }));
  const total = entries.length;
  const score = entries.filter((e) => e.result === "right").length;
  const share = total ? score / total : 1;
  const [shown, setShown] = useState(reducedMotion() ? score : 0);
  const levels = useRef({ input: 0, output: 0 });
  const wrongSteps = entries.filter((e) => e.result === "wrong").map((e) => e.step);
  const wrongClips = [
    ...new Set(wrongSteps.flatMap((s) => (s.type === "exercise" ? [s.clip] : []))),
  ];
  const words = useMemo(() => {
    const seen = new Set<string>();
    return clips.filter((clip) => {
      const key = clip.target.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [clips]);

  useEffect(() => {
    quizDoneSound(share);
    if (reducedMotion() || score === 0) return;
    const start = performance.now();
    const length = Math.min(900, 120 * score);
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / length);
      setShown(Math.round(score * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score, share]);

  const verdict =
    share >= 0.8
      ? t("Excellent work.", "ممتاز!")
      : share >= 0.5
        ? t("Good. Redo your mistakes to lock them in.", "شغل حلو. أعد الغلطات عشان تثبت.")
        : t(
            "Keep going. Watch the clips again and retry.",
            "ولا يهمك. شوف المقاطع مرة ثانية وجرّب.",
          );

  return (
    <section className="pqp-body pqp-result">
      <span className="pqp-cube pqp-cube-big" aria-hidden="true">
        <RitaCube levelsRef={levels} mode="speaking" label="" />
      </span>
      <p className="pqp-count">{t("Your result", "نتيجتك")}</p>
      {total > 0 ? (
        <p className="pqp-score" aria-label={`${score} / ${total}`}>
          <span>{shown}</span>
          <small>/ {total}</small>
        </p>
      ) : (
        <p className="pqp-score">
          <Check size={64} aria-hidden="true" />
        </p>
      )}
      <p className="pqp-verdict">{verdict}</p>
      <div className="pqp-row">
        <button type="button" className="pqp-btn pqp-btn-dark" onClick={onBack}>
          {t("Back to the path", "ارجع للمسار")}
        </button>
        {wrongSteps.length > 0 && (
          <button
            type="button"
            className="pqp-btn pqp-btn-line"
            onClick={() => onRestart(wrongSteps)}
          >
            <RotateCcw size={17} aria-hidden="true" />
            {t("Redo my mistakes", "أعد الغلط بس")}
          </button>
        )}
        <button type="button" className="pqp-btn pqp-btn-line" onClick={() => onRestart()}>
          {t("Start over", "من الأول")}
        </button>
      </div>

      {words.length > 0 && (
        <div className="pqp-review">
          <h2>{t("Words you learnt", "الكلمات اللي تعلمتها")}</h2>
          <ul className="pcp-words">
            {words.map((clip) => (
              <li key={clip.id}>
                <span dir="ltr" lang="en">
                  {clip.target}
                </span>
                <span dir="rtl" lang="ar">
                  {clip.target_ar}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {wrongClips.length > 0 && (
        <div className="pqp-review">
          <h2>{t("Go over these", "راجع هدول")}</h2>
          <ol>
            {wrongClips.map((i) => (
              <li key={i}>
                <p className="pqp-review-q" dir="ltr" lang="en">
                  <Highlight text={clips[i].en} word={clips[i].target} />
                </p>
                <p className="pqp-review-why" dir="rtl" lang="ar">
                  {clips[i].ar}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
