// The quiz of a path quiz stop on a page of its own: one question at a time, instant marking
// with a sound and a short reaction from Uzyra's cube, and a result page at the end.
// Marking happens on the server (answer_path_quiz); the page never holds the answer key.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/legacy-client";
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
import "./path-quiz-page.css";

type Published = { version: string; questions: { stem: string; options: string[] }[] };
type Mark = { choice: number; answer: number; explanation: string | null };
type Copy = (en: string, ar: string) => string;
type Reaction = "" | "right" | "wrong";

const LETTERS = "ABCDEFGH";

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

export function PathQuizPage({ itemId }: { itemId: string }) {
  const t = useCopy();
  const ar = useUiLanguage() === "ar";
  const navigate = useNavigate();
  const [sound, setSound] = useState(true);
  const [run, setRun] = useState(0);
  const leaveCheck = useRef<() => boolean>(() => true);

  useEffect(() => {
    setSound(soundOn());
    return installSoundUnlock();
  }, []);

  const stop = useQuery({
    queryKey: ["path-quiz-stop", itemId],
    queryFn: async () => {
      const r = await supabase
        .from("rita_path_items")
        .select("title")
        .eq("id", itemId)
        .maybeSingle();
      if (r.error) throw r.error;
      return (r.data as { title: string } | null)?.title ?? "";
    },
    refetchOnWindowFocus: false,
  });
  const quiz = useQuery({
    queryKey: ["published-path-quiz", itemId],
    queryFn: async () => {
      const r = await supabase.rpc("read_path_quiz", { p_item: itemId });
      if (r.error) throw r.error;
      return r.data as Published | null;
    },
    refetchOnWindowFocus: false,
    staleTime: 0,
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
  const questions = quiz.data?.questions ?? [];

  return (
    <main className="edith-premium pqp" dir={ar ? "rtl" : "ltr"}>
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
          {stop.data || t("Quiz", "اختبار")}
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

      {quiz.isPending ? (
        <section className="pqp-body" aria-busy="true">
          <p className="sr-only" role="status">
            {t("Loading the quiz…", "عم نحمّل الاختبار…")}
          </p>
          <div className="pqp-skel pqp-skel-bar" />
          <div className="pqp-skel pqp-skel-title" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="pqp-skel pqp-skel-option" />
          ))}
        </section>
      ) : quiz.isError ? (
        <Notice
          title={t("The quiz didn't load", "ما قدرنا نحمّل الاختبار")}
          body={message(quiz.error)}
          action={t("Try again", "أعد المحاولة")}
          onAction={() => void quiz.refetch()}
          onBack={back}
          t={t}
        />
      ) : !quiz.data || !questions.length ? (
        <Notice
          title={t("No quiz here yet", "لسا ما في اختبار هون")}
          body={t(
            "This stop's questions haven't been published yet.",
            "أسئلة هاي المحطة لسا ما انتشرت.",
          )}
          onBack={back}
          t={t}
        />
      ) : (
        <Round
          key={`${quiz.data.version}-${run}`}
          itemId={itemId}
          quiz={quiz.data}
          t={t}
          setLeaveCheck={(check) => (leaveCheck.current = check)}
          onRetry={() => setRun((n) => n + 1)}
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

function Round({
  itemId,
  quiz,
  t,
  setLeaveCheck,
  onRetry,
  onBack,
}: {
  itemId: string;
  quiz: Published;
  t: Copy;
  setLeaveCheck: (check: () => boolean) => void;
  onRetry: () => void;
  onBack: () => void;
}) {
  const total = quiz.questions.length;
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reaction, setReaction] = useState<Reaction>("");
  const levels = useRef({ input: 0, output: 0 });
  const feedback = useRef<HTMLDivElement>(null);
  const foot = useRef<HTMLElement>(null);
  const done = index >= total;
  const q = quiz.questions[index];
  const mark = marks[index];

  useEffect(() => {
    setLeaveCheck(() =>
      done || marks.length === 0
        ? true
        : window.confirm(
            t(
              "Leave the quiz? Your answers so far will be lost.",
              "بدك تطلع من الاختبار؟ رح تضيع إجاباتك.",
            ),
          ),
    );
  }, [done, marks.length, setLeaveCheck, t]);

  const confirm = useCallback(async () => {
    if (choice === null || busy || mark || done) return;
    unlockSound();
    setBusy(true);
    setError("");
    try {
      const r = await supabase.rpc("answer_path_quiz", {
        p_item: itemId,
        p_version: quiz.version,
        p_index: index,
        p_choice: choice,
      });
      if (r.error) throw r.error;
      const result = r.data as { answer: number; explanation: string | null };
      const right = result.answer === choice;
      setMarks((old) => [...old, { choice, ...result }]);
      if (right) rightAnswerSound();
      else wrongAnswerSound();
      setReaction(right ? "right" : "wrong");
      window.setTimeout(() => setReaction(""), 700);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }, [busy, choice, done, index, itemId, mark, quiz.version]);

  const next = useCallback(() => {
    if (!mark) return;
    setIndex((i) => i + 1);
    setChoice(null);
    setError("");
    window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
  }, [mark]);

  // The page keeps room under the answers for the fixed action bar, however tall it grows.
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
  }, [done]);

  // The feedback takes the focus so screen readers hear the result and Enter moves on.
  useEffect(() => {
    if (mark) feedback.current?.focus({ preventScroll: true });
  }, [mark]);

  useEffect(() => {
    if (done || !q) return;
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const key = event.key.toUpperCase();
      const at = /^[1-8]$/.test(key) ? Number(key) - 1 : LETTERS.indexOf(key);
      if (key.length === 1 && at >= 0 && at < q.options.length && !mark) {
        event.preventDefault();
        setChoice(at);
      } else if (event.key === "Enter" && !(target instanceof HTMLButtonElement)) {
        event.preventDefault();
        if (mark) next();
        else void confirm();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirm, done, mark, next, q]);

  if (done) return <Result quiz={quiz} marks={marks} t={t} onRetry={onRetry} onBack={onBack} />;

  const right = mark ? mark.answer === mark.choice : false;
  return (
    <>
      <section className="pqp-body">
        <ol className="pqp-steps" aria-label={t("Progress", "التقدّم")}>
          {quiz.questions.map((_, i) => {
            const m = marks[i];
            const state = m
              ? m.answer === m.choice
                ? "right"
                : "wrong"
              : i === index
                ? "now"
                : "todo";
            return (
              <li
                key={i}
                data-state={state}
                aria-label={`${t("Question", "سؤال")} ${i + 1}: ${
                  state === "right"
                    ? t("right", "صح")
                    : state === "wrong"
                      ? t("wrong", "غلط")
                      : state === "now"
                        ? t("now", "الحالي")
                        : t("not yet", "لسا")
                }`}
              />
            );
          })}
        </ol>

        <div className="pqp-ask">
          <span className="pqp-cube" data-reaction={reaction || undefined} aria-hidden="true">
            <RitaCube levelsRef={levels} mode={busy ? "thinking" : "idle"} label="" />
          </span>
          <p className="pqp-count">
            {t("Question", "سؤال")} {index + 1} {t("of", "من")} {total}
          </p>
        </div>
        <h1 className="pqp-question" dir="auto">
          {q.stem}
        </h1>

        <div
          className="pqp-options"
          role="radiogroup"
          aria-label={t("Answers", "الإجابات")}
          data-shake={mark && !right ? "" : undefined}
        >
          {q.options.map((body, i) => {
            const state = mark
              ? i === mark.answer
                ? "right"
                : i === mark.choice
                  ? "wrong"
                  : "off"
              : choice === i
                ? "picked"
                : "idle";
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={choice === i}
                className="pqp-option"
                data-state={state}
                disabled={!!mark || busy}
                onClick={() => {
                  unlockSound();
                  setChoice(i);
                }}
              >
                <span className="pqp-key">{LETTERS[i]}</span>
                <span className="pqp-text" dir="auto">
                  {body}
                </span>
                {state === "right" && (
                  <Check
                    className="pqp-mark"
                    size={22}
                    aria-label={t("Right answer", "الإجابة الصح")}
                  />
                )}
                {state === "wrong" && (
                  <X className="pqp-mark" size={22} aria-label={t("Your answer", "إجابتك")} />
                )}
              </button>
            );
          })}
        </div>
        {error && (
          <p className="pqp-error" role="alert" dir="auto">
            {error}
          </p>
        )}
      </section>

      <footer
        ref={foot}
        className="pqp-foot"
        data-state={mark ? (right ? "right" : "wrong") : undefined}
      >
        <div className="pqp-foot-in">
          {mark ? (
            <div className="pqp-feedback" ref={feedback} tabIndex={-1} role="status">
              <div className="pqp-feedback-text">
                <strong>{right ? t("Right!", "صح!") : t("Not this time", "مش هالمرة")}</strong>
                {!right && (
                  <p dir="auto">
                    {t("The answer:", "الجواب الصح:")} {q.options[mark.answer]}
                  </p>
                )}
                {mark.explanation && <p dir="auto">{mark.explanation}</p>}
              </div>
              <button type="button" className="pqp-btn pqp-btn-dark" onClick={next}>
                {index + 1 === total ? t("See your result", "شوف نتيجتك") : t("Next", "التالي")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="pqp-btn pqp-btn-dark pqp-check"
              disabled={choice === null || busy}
              onClick={() => void confirm()}
            >
              {busy && <Loader2 className="animate-spin" size={18} aria-hidden="true" />}
              {t("Check", "تحقّق")}
            </button>
          )}
        </div>
      </footer>
    </>
  );
}

function Result({
  quiz,
  marks,
  t,
  onRetry,
  onBack,
}: {
  quiz: Published;
  marks: Mark[];
  t: Copy;
  onRetry: () => void;
  onBack: () => void;
}) {
  const total = marks.length;
  const score = marks.filter((m) => m.answer === m.choice).length;
  const share = total ? score / total : 0;
  const [shown, setShown] = useState(reducedMotion() ? score : 0);
  const levels = useRef({ input: 0, output: 0 });
  const wrong = marks.map((m, i) => ({ m, i })).filter(({ m }) => m.answer !== m.choice);

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
        ? t("Good. Go over your mistakes below.", "شغل حلو. راجع غلطاتك تحت.")
        : t(
            "Keep going. Try it again after a look at the answers.",
            "ولا يهمك. راجع الأجوبة وجرّب كمان مرة.",
          );

  return (
    <section className="pqp-body pqp-result">
      <span className="pqp-cube pqp-cube-big" aria-hidden="true">
        <RitaCube levelsRef={levels} mode="speaking" label="" />
      </span>
      <p className="pqp-count">{t("Your result", "نتيجتك")}</p>
      <p className="pqp-score" aria-label={`${score} / ${total}`}>
        <span>{shown}</span>
        <small>/ {total}</small>
      </p>
      <p className="pqp-verdict">{verdict}</p>
      <div className="pqp-row">
        <button type="button" className="pqp-btn pqp-btn-dark" onClick={onBack}>
          {t("Back to the path", "ارجع للمسار")}
        </button>
        <button type="button" className="pqp-btn pqp-btn-line" onClick={onRetry}>
          <RotateCcw size={17} aria-hidden="true" />
          {t("Try again", "أعد المحاولة")}
        </button>
      </div>

      {wrong.length > 0 && (
        <div className="pqp-review">
          <h2>{t("Your mistakes", "غلطاتك")}</h2>
          <ol>
            {wrong.map(({ m, i }) => (
              <li key={i}>
                <p className="pqp-review-q" dir="auto">
                  {quiz.questions[i].stem}
                </p>
                <p className="pqp-review-line" data-state="wrong" dir="auto">
                  <X size={16} aria-hidden="true" /> {quiz.questions[i].options[m.choice]}
                </p>
                <p className="pqp-review-line" data-state="right" dir="auto">
                  <Check size={16} aria-hidden="true" /> {quiz.questions[i].options[m.answer]}
                </p>
                {m.explanation && (
                  <p className="pqp-review-why" dir="auto">
                    {m.explanation}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
