import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Pause, Play, RotateCcw, SkipForward, X } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { useUiLanguage } from "@/components/language/useUiLanguage";
import { UzyraWordmark } from "@/components/brand/UzyraWordmark";
import { RepeatCardArt } from "@/components/learn/PlayCardArt";
import { allSaid, mergeSaid, sentenceWords, wordsSaid } from "@/lib/repeat/match";
import { pickRound, type RepeatSentence } from "@/lib/repeat/sentences";
import {
  askForMicrophone,
  hearingMode,
  listen,
  prepareSentence,
  repeatSounds,
  speakSentence,
  wakeAudio,
  type Hearing,
} from "./repeat-voice";
import "./repeat.css";

type Lang = "en" | "ar";
type Step = "intro" | "play" | "end";
type Result = { sentence: RepeatSentence; result: "right" | "skipped" };

/** Repeat: Uzyra says a sentence, the learner says it back, each word turns black as it is said. */
export function RepeatPage() {
  const lang = useUiLanguage();
  const [step, setStep] = useState<Step>("intro");
  const [round, setRound] = useState<RepeatSentence[]>(() => pickRound());
  const [results, setResults] = useState<{ list: Result[]; seconds: number } | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [starting, setStarting] = useState(false);

  // The first two sentences start loading while the learner reads the intro.
  useEffect(() => {
    round.slice(0, 2).forEach((sentence) => void prepareSentence(sentence.en));
  }, [round]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const start = async () => {
    wakeAudio(); // inside the tap, before anything waits
    setStarting(true);
    const allowed = await askForMicrophone();
    setStarting(false);
    if (!allowed) {
      setBlocked(true);
      return;
    }
    setBlocked(false);
    setStep("play");
  };

  if (step === "play") {
    return (
      <RepeatGame
        key={round.map((s) => s.en).join("|")}
        lang={lang}
        round={round}
        onFinished={(list, seconds) => {
          setResults({ list, seconds });
          setStep("end");
        }}
      />
    );
  }

  return (
    <div className="edith-premium min-h-screen bg-white text-[var(--pp-ink)]">
      <SiteHeader />
      <main className="rp-page" dir={lang === "ar" ? "rtl" : "ltr"}>
        {step === "intro" ? (
          <Intro lang={lang} blocked={blocked} starting={starting} onStart={() => void start()} />
        ) : (
          results && (
            <End
              lang={lang}
              results={results.list}
              seconds={results.seconds}
              onAgain={() => {
                setRound(pickRound());
                setResults(null);
                wakeAudio();
                setStep("play");
              }}
            />
          )
        )}
      </main>
    </div>
  );
}

function Intro({
  lang,
  blocked,
  starting,
  onStart,
}: {
  lang: Lang;
  blocked: boolean;
  starting: boolean;
  onStart: () => void;
}) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const mode = typeof window === "undefined" ? "live" : hearingMode();
  return (
    <section className="rp-hero" aria-labelledby="rp-title">
      <h1 id="rp-title" className="rp-hero-title">
        {t("Repeat", "كرر")}
      </h1>
      <p className="rp-hero-line">
        {t(
          "Uzyra says a sentence, you say it back. Every word you say right turns black.",
          "Uzyra بتحكي جملة، وإنت بتكررها بصوتك. كل كلمة بتلفظها صح بتصير سودا.",
        )}
      </p>
      <span className="rp-hero-art" aria-hidden="true">
        <RepeatCardArt />
      </span>
      <ol className="rp-hero-steps">
        <li>{t("Listen to Uzyra", "اسمع Uzyra")}</li>
        <li>{t("Say it back", "كررها بصوتك")}</li>
        <li>{t("10 cards", "10 بطاقات")}</li>
      </ol>
      {mode === "none" ? (
        <p className="rp-note" role="alert">
          {t(
            "This browser can't hear the microphone. Open Uzyra in Safari or Chrome to play.",
            "هاد المتصفح ما بيقدر يسمع المايك. افتح Uzyra على سفاري أو كروم عشان تلعب.",
          )}
        </p>
      ) : (
        <button type="button" className="rp-start" onClick={onStart} disabled={starting}>
          {starting ? t("Opening the microphone…", "عم نفتح المايك…") : t("Start", "ابدأ")}
        </button>
      )}
      {blocked && (
        <p className="rp-note" role="alert">
          {t(
            "Uzyra needs your microphone to hear you. Allow it for this site in the browser settings, then tap Start again.",
            "Uzyra بدها المايك عشان تسمعك. اسمح للموقع يستخدم المايك من إعدادات المتصفح، وبعدين اضغط ابدأ كمان مرة.",
          )}
        </p>
      )}
    </section>
  );
}

function clock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function End({
  lang,
  results,
  seconds,
  onAgain,
}: {
  lang: Lang;
  results: Result[];
  seconds: number;
  onAgain: () => void;
}) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const right = results.filter((r) => r.result === "right").length;
  return (
    <section className="rp-end" aria-labelledby="rp-end-title">
      <span className="rp-end-badge" aria-hidden="true">
        <Check strokeWidth={3} />
      </span>
      <h1 id="rp-end-title" className="rp-hero-title">
        {t("Done!", "خلصت!")}
      </h1>
      <p className="rp-end-score">
        {t(
          `You said ${right} of ${results.length} in full`,
          `لفظت ${right} من ${results.length} كاملة`,
        )}
        <span>· {clock(seconds)}</span>
      </p>
      <ul className="rp-end-list">
        {results.map((r) => (
          <li key={r.sentence.en} data-result={r.result}>
            <span dir="ltr">{r.sentence.en}</span>
            <span className="rp-end-ar" dir="rtl">
              {r.sentence.ar}
            </span>
          </li>
        ))}
      </ul>
      <div className="rp-end-actions">
        <button type="button" className="rp-start" onClick={onAgain}>
          {t("Play again", "العب مرة ثانية")}
        </button>
        <Link to="/games" className="rp-link">
          {t("Back to games", "رجوع للألعاب")}
        </Link>
      </div>
    </section>
  );
}

// ---------- The game -------------------------------------------------------------------------

type Phase = "speaking" | "listening" | "missed" | "paused" | "right";

/** Silence this long before the first word, or after the last new word, ends a try. */
const FIRST_WORD_MS = 8000;
const AFTER_WORD_MS = 3500;
/** How long the finished card shows its tick before the next card comes. */
const NEXT_AFTER_MS = 1100;

function RepeatGame({
  lang,
  round,
  onFinished,
}: {
  lang: Lang;
  round: RepeatSentence[];
  onFinished: (results: Result[], seconds: number) => void;
}) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("speaking");
  const [said, setSaid] = useState<boolean[]>([]);
  const [done, setDone] = useState<Result[]>([]);
  const [showAr, setShowAr] = useState(false);
  const [tried, setTried] = useState(false);
  const [problem, setProblem] = useState<null | "denied" | "failed">(null);
  const [seconds, setSeconds] = useState(0);
  const [praise, setPraise] = useState(0);
  const run = useRef<{ abort: AbortController; hearing: Hearing | null; timers: number[] } | null>(
    null,
  );
  const saidRef = useRef<boolean[]>([]);
  const doneRef = useRef<Result[]>([]);
  const secondsRef = useRef(0);
  const cardRef = useRef<HTMLElement | null>(null);
  const finishedRef = useRef(false);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  const stopRun = useCallback(() => {
    const current = run.current;
    run.current = null;
    if (!current) return;
    current.abort.abort();
    current.timers.forEach((id) => window.clearTimeout(id));
    current.hearing?.stop();
  }, []);

  const newRun = useCallback(() => {
    stopRun();
    const fresh: { abort: AbortController; hearing: Hearing | null; timers: number[] } = {
      abort: new AbortController(),
      hearing: null,
      timers: [],
    };
    run.current = fresh;
    return fresh;
  }, [stopRun]);

  const advance = useCallback(
    (at: number, result: Result["result"]) => {
      stopRun();
      const list = [...doneRef.current, { sentence: round[at], result }];
      doneRef.current = list;
      setDone(list);
      if (at + 1 >= round.length) {
        finishedRef.current = true;
        repeatSounds.finished();
        onFinishedRef.current(list, secondsRef.current);
        return;
      }
      setIndex(at + 1);
    },
    [round, stopRun],
  );

  const hear = useCallback(
    (at: number) => {
      const current = newRun();
      const live = () => run.current === current && !current.abort.signal.aborted;
      const words = sentenceWords(round[at].en);
      setPhase("listening");
      setTried(true);
      setProblem(null);
      repeatSounds.listen();
      const silence = (ms: number) => {
        current.timers.forEach((id) => window.clearTimeout(id));
        current.timers = [
          window.setTimeout(() => {
            if (!live()) return;
            current.hearing?.stop();
            setPhase((p) => (p === "listening" ? "missed" : p));
          }, ms),
        ];
      };
      current.hearing = listen({
        maxMs: 3000 + words.length * 800,
        onHeard: (text) => {
          if (!live()) return;
          const next = mergeSaid(saidRef.current, wordsSaid(words, text));
          if (next.some((s, i) => s !== saidRef.current[i])) {
            saidRef.current = next;
            setSaid(next);
            if (hearingMode() === "live") silence(AFTER_WORD_MS);
          }
          if (allSaid(next)) {
            current.abort.abort();
            current.hearing?.stop();
            setPhase("right");
            setPraise((n) => n + 1);
            repeatSounds.right();
            const id = window.setTimeout(() => advance(at, "right"), NEXT_AFTER_MS);
            run.current = { abort: new AbortController(), hearing: null, timers: [id] };
          }
        },
        onEnd: (why) => {
          if (!live()) return;
          if (why === "denied" || why === "failed") setProblem(why);
          setPhase((p) => (p === "listening" ? "missed" : p));
        },
      });
      if (hearingMode() === "live") silence(FIRST_WORD_MS);
    },
    [advance, newRun, round],
  );

  const say = useCallback(
    (at: number) => {
      const current = newRun();
      saidRef.current = sentenceWords(round[at].en).map(() => false);
      setSaid(saidRef.current);
      setPhase("speaking");
      const next = round[at + 1];
      if (next) void prepareSentence(next.en);
      void speakSentence(round[at].en, current.abort.signal).then(() => {
        if (run.current === current && !current.abort.signal.aborted) hear(at);
      });
    },
    [hear, newRun, round],
  );

  // Each new card: Uzyra says it, then listens.
  useEffect(() => {
    setShowAr(false);
    setTried(false);
    setProblem(null);
    say(index);
    const card = cardRef.current;
    if (card) {
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      card.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "end" });
    }
  }, [index, say]);

  useEffect(() => stopRun, [stopRun]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (finishedRef.current) return;
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Leaving the tab stops the microphone; coming back waits for a tap.
  useEffect(() => {
    const away = () => {
      if (document.hidden && run.current) {
        stopRun();
        setPhase((p) => (p === "right" ? p : "paused"));
      }
    };
    document.addEventListener("visibilitychange", away);
    return () => document.removeEventListener("visibilitychange", away);
  }, [stopRun]);

  const sentence = round[index];
  const words = useMemo(() => sentenceWords(sentence.en), [sentence]);
  const progress = (done.length + (phase === "right" ? 1 : 0)) / round.length;
  const praiseLine = [t("Well done! That's right", "أحسنت! إجابة صحيحة"), t("Great", "رائع")][
    praise % 2
  ];

  const label =
    phase === "speaking"
      ? t("Uzyra is speaking…", "Uzyra عم تحكي…")
      : phase === "listening"
        ? t("Say the sentence…", "كرر العبارة…")
        : phase === "right"
          ? praiseLine
          : phase === "paused"
            ? t("Paused", "متوقف")
            : problem === "denied"
              ? t("Uzyra can't use the microphone", "Uzyra مش قادرة تستخدم المايك")
              : problem === "failed"
                ? t("Uzyra couldn't hear you", "Uzyra ما قدرت تسمعك")
                : t("Not all of it yet. Try again", "لسا مش كاملة. جرّب كمان مرة");

  const resume = () => {
    wakeAudio();
    if (tried) hear(index);
    else say(index);
  };

  return (
    <div className="rp-play" dir={lang === "ar" ? "rtl" : "ltr"}>
      <header className="rp-top">
        <Link to="/games" className="rp-icon" aria-label={t("Leave the game", "اطلع من اللعبة")}>
          <X aria-hidden="true" />
        </Link>
        <UzyraWordmark size={20} />
        <span className="rp-icon is-blank" aria-hidden="true" />
      </header>

      <ol className="rp-feed" aria-label={t("Cards", "البطاقات")}>
        {done.map((r) => (
          <li key={r.sentence.en} className="rp-card is-past" data-result={r.result}>
            {r.result === "right" ? (
              <span className="rp-tick" aria-label={t("Said in full", "انلفظت كاملة")}>
                <Check strokeWidth={3} aria-hidden="true" />
              </span>
            ) : (
              <span className="rp-skipped">{t("Skipped", "تخطّيت")}</span>
            )}
            <p className="rp-line" dir="ltr">
              {r.sentence.en}
            </p>
            <p className="rp-ar" dir="rtl">
              {r.sentence.ar}
            </p>
          </li>
        ))}
        <li
          key={sentence.en}
          ref={(node) => {
            cardRef.current = node;
          }}
          className="rp-card is-now"
          data-phase={phase}
        >
          {phase === "right" && (
            <span className="rp-tick is-new" aria-hidden="true">
              <Check strokeWidth={3} />
            </span>
          )}
          <p className="rp-label" data-phase={phase} aria-live="polite">
            {phase === "listening" && <span className="rp-mic-dot" aria-hidden="true" />}
            {label}
          </p>
          <p className="rp-line" dir="ltr" aria-label={sentence.en}>
            {words.map((word, i) => (
              <span key={i} className="rp-word" data-said={said[i] || undefined}>
                {word.text}
                {i < words.length - 1 ? " " : ""}
              </span>
            ))}
          </p>
          {showAr || phase === "right" ? (
            <p className="rp-ar" dir="rtl">
              {sentence.ar}
            </p>
          ) : (
            <button type="button" className="rp-show-ar" onClick={() => setShowAr(true)}>
              {t("Show translation", "إظهار الترجمة")}
            </button>
          )}
          {problem === "denied" && (
            <p className="rp-note">
              {t(
                "Allow the microphone for this site in the browser settings, then tap ▶.",
                "اسمح للموقع يستخدم المايك من إعدادات المتصفح، وبعدين اضغط ▶.",
              )}
            </p>
          )}
          <div
            className="rp-controls"
            dir="ltr"
            role="group"
            aria-label={t("Card controls", "تحكم البطاقة")}
          >
            <button
              type="button"
              className="rp-ctrl"
              onClick={() => {
                wakeAudio();
                say(index);
              }}
              disabled={phase === "right"}
              aria-label={t("Hear it again", "اسمعها كمان مرة")}
            >
              <RotateCcw aria-hidden="true" />
            </button>
            {phase === "paused" || phase === "missed" ? (
              <button
                type="button"
                className="rp-ctrl is-main"
                onClick={resume}
                aria-label={t("Try again", "جرّب كمان مرة")}
              >
                <Play aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                className="rp-ctrl"
                onClick={() => {
                  stopRun();
                  setPhase("paused");
                }}
                disabled={phase === "right"}
                aria-label={t("Pause", "إيقاف")}
              >
                <Pause aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              className="rp-ctrl"
              onClick={() => advance(index, "skipped")}
              disabled={!tried || phase === "right"}
              aria-label={t("Skip", "تخطي")}
            >
              <SkipForward aria-hidden="true" />
            </button>
          </div>
        </li>
      </ol>

      <footer className="rp-bottom">
        <span
          className="rp-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={round.length}
          aria-valuenow={done.length}
          aria-label={t("Cards done", "البطاقات اللي خلصت")}
        >
          <span className="rp-track-fill" style={{ transform: `scaleX(${progress})` }} />
        </span>
        <span className="rp-time">
          {done.length + 1 > round.length ? round.length : done.length + 1}/{round.length} ·{" "}
          {clock(seconds)}
        </span>
      </footer>
    </div>
  );
}
