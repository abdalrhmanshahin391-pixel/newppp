import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Flag,
  Lightbulb,
  RotateCcw,
  Target,
  Timer,
  Trophy,
  XCircle,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { lqLoadRun, lqSaveAttempts } from "@/lib/lecture-lab.functions";

type Mode = "study" | "session" | "exam";
type Pool = "all" | "flagged" | "wrong";
type Search = { ids: string; mode: Mode; pool: Pool; minutes: number };

export const Route = createFileRoute("/study/lectures/run")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    ids: String(search["ids"] ?? ""),
    mode: (["study", "session", "exam"] as const).includes(search["mode"] as never)
      ? (search["mode"] as Mode)
      : "study",
    pool: (["all", "flagged", "wrong"] as const).includes(search["pool"] as never)
      ? (search["pool"] as Pool)
      : "all",
    minutes: Number(search["minutes"] ?? 0) || 0,
  }),
  head: () => ({
    meta: [
      { title: "Lecture quiz — RitaJet Lecture Lab" },
      {
        name: "description",
        content: "Study lecture questions in practice, session, or timed exam mode.",
      },
      { property: "og:title", content: "Lecture quiz — RitaJet Lecture Lab" },
      {
        property: "og:description",
        content: "Practice lecture questions with answers, explanations, and progress tracking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LectureRunPage,
});

type Option = { letter: string; body: string; is_correct: boolean };
type Question = {
  id: string;
  lecture_id: string;
  stem: string;
  options: Option[];
  explanation: string;
  point_ref: string | null;
};

function LectureRunPage() {
  const { ids, mode, pool, minutes } = Route.useSearch();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const load = useServerFn(lqLoadRun);
  const save = useServerFn(lqSaveAttempts);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [points, setPoints] = useState<{ title: string; points: string[] }[]>([]);
  const [busy, setBusy] = useState(true);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState(false);
  const [left, setLeft] = useState(minutes * 60);

  const lectureIds = useMemo(() => ids.split(",").filter(Boolean), [ids]);

  useEffect(() => {
    if (!user || !lectureIds.length) return;
    setBusy(true);
    load({ data: { lectureIds, pool } })
      .then((result: any) => {
        const loadedQuestions = (result.questions ?? []) as Question[];
        setQuestions(loadedQuestions);
        if (mode === "study") {
          const answerKey: Record<string, string> = {};
          const revealed: Record<string, boolean> = {};
          loadedQuestions.forEach((question) => {
            const correct = question.options.find((option) => option.is_correct);
            if (correct) answerKey[question.id] = correct.letter;
            revealed[question.id] = true;
          });
          setAnswers(answerKey);
          setSubmitted(revealed);
        }
        setPoints(
          ((result.lectures ?? []) as any[])
            .map((lecture) => ({
              title: String(lecture.title ?? "Lecture"),
              points: Array.isArray(lecture.key_points) ? (lecture.key_points as string[]) : [],
            }))
            .filter((lecture) => lecture.points.length),
        );
      })
      .catch(() => toast.error("Could not load that quiz."))
      .finally(() => setBusy(false));
  }, [user, lectureIds, pool, mode, load]);

  const score = useMemo(() => {
    const correct = questions.filter((question) =>
      question.options.some(
        (option) => option.is_correct && option.letter === answers[question.id],
      ),
    ).length;
    return {
      correct,
      total: questions.length,
      pct: questions.length ? Math.round((correct / questions.length) * 100) : 0,
    };
  }, [questions, answers]);

  const finish = useCallback(async () => {
    setDone(true);
    const rows = questions
      .filter((question) => answers[question.id] || flags[question.id])
      .map((question) => ({
        questionId: question.id,
        lectureId: question.lecture_id,
        correct: question.options.some(
          (option) => option.is_correct && option.letter === answers[question.id],
        ),
        flagged: !!flags[question.id],
      }));
    if (!rows.length) return;
    try {
      await save({
        data: {
          rows,
          score: Math.round(
            (rows.filter((row) => row.correct).length / questions.length) * 100,
          ),
          ...(lectureIds.length === 1 ? { lectureId: lectureIds[0] as string } : {}),
        },
      });
    } catch {
      toast.error("Your result is shown, but it could not be saved.");
    }
  }, [questions, answers, flags, save, lectureIds]);

  useEffect(() => {
    if (mode !== "exam" || done || busy || !questions.length) return;
    if (left <= 0) {
      void finish();
      return;
    }
    const timer = window.setTimeout(() => setLeft((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [mode, left, done, busy, questions.length, finish]);

  const question = questions[current];
  const selected = question ? answers[question.id] : undefined;
  const isRevealed = question ? mode === "study" || !!submitted[question.id] : false;

  function choose(letter: string) {
    if (!question || mode === "study" || submitted[question.id]) return;
    setAnswers((currentAnswers) => ({ ...currentAnswers, [question.id]: letter }));
  }

  function submitAnswer() {
    if (!question || !selected) return;
    setSubmitted((currentSubmitted) => ({ ...currentSubmitted, [question.id]: true }));
  }

  function goNext() {
    if (current + 1 >= questions.length) void finish();
    else setCurrent((index) => index + 1);
  }

  function retryWeak() {
    const missed = questions.filter(
      (item) =>
        !item.options.some(
          (option) => option.is_correct && option.letter === answers[item.id],
        ),
    );
    if (!missed.length) {
      toast.success("Nothing to retry — you got them all.");
      return;
    }
    setQuestions(missed);
    setAnswers({});
    setSubmitted({});
    setCurrent(0);
    setLeft(minutes * 60);
    setDone(false);
  }

  if (loading || busy) return <LoadingState />;
  if (!user) return <SignInState />;
  if (!questions.length) return <EmptyState pool={pool} />;
  if (done) {
    return (
      <ResultsState
        score={score}
        questions={questions}
        answers={answers}
        points={points}
        mode={mode}
        onRetry={retryWeak}
      />
    );
  }

  const progress = Math.round(((current + 1) / questions.length) * 100);

  return (
    <div className="min-h-screen bg-[color:var(--cream)] text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 pb-16 pt-8 md:px-8 md:pt-10">
        <div className="medical-card mb-6 flex items-center justify-between gap-3 px-4 py-4 md:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase text-primary">
              {mode === "exam" ? <Timer /> : mode === "session" ? <RotateCcw /> : <BookOpen />}
              {mode === "study" ? "Study mode" : mode === "session" ? "Session mode" : "Exam mode"}
            </span>
            {pool !== "all" && (
              <span className="hidden text-xs font-semibold text-muted-foreground sm:inline">
                {pool === "flagged" ? "Flagged only" : "Weak spots only"}
              </span>
            )}
          </div>

          <div className="mx-4 hidden max-w-md flex-1 md:block">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {mode === "exam" && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold tabular-nums">
                <Clock /> {formatTime(left)}
              </span>
            )}
            <span className="text-sm font-semibold tabular-nums text-muted-foreground">
              Q{current + 1} / {questions.length}
            </span>
          </div>
        </div>

        <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-muted md:hidden">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <QuestionCard
            question={question}
            mode={mode}
            selected={selected}
            revealed={isRevealed}
            flagged={!!flags[question.id]}
            isFirst={current === 0}
            isLast={current === questions.length - 1}
            onChoose={choose}
            onSubmit={submitAnswer}
            onPrevious={() => setCurrent((index) => Math.max(0, index - 1))}
            onNext={goNext}
            onFlag={() =>
              setFlags((currentFlags) => ({
                ...currentFlags,
                [question.id]: !currentFlags[question.id],
              }))
            }
          />

          <QuestionMap
            questions={questions}
            current={current}
            answers={answers}
            submitted={submitted}
            flags={flags}
            mode={mode}
            onJump={setCurrent}
            onFinish={() => void finish()}
          />
        </div>
      </main>
    </div>
  );
}

function QuestionCard({
  question,
  mode,
  selected,
  revealed,
  flagged,
  isFirst,
  isLast,
  onChoose,
  onSubmit,
  onPrevious,
  onNext,
  onFlag,
}: {
  question: Question;
  mode: Mode;
  selected?: string;
  revealed: boolean;
  flagged: boolean;
  isFirst: boolean;
  isLast: boolean;
  onChoose: (letter: string) => void;
  onSubmit: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onFlag: () => void;
}) {
  return (
    <article className="medical-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-4 md:px-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onFlag}
          aria-pressed={flagged}
          className={flagged ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground"}
        >
          <Flag className={flagged ? "fill-current" : ""} />
          {flagged ? "Flagged" : "Flag question"}
        </Button>
      </div>

      <div className="px-5 py-7 md:px-7">
        <h1 className="font-display text-[21px] font-black leading-[1.35] text-foreground md:text-[25px]">
          {question.stem}
        </h1>
      </div>

      <div className="space-y-3.5 px-5 pb-7 md:px-7">
        {question.options.map((option) => {
          const picked = selected === option.letter;
          const correct = revealed && option.is_correct;
          const wrong = revealed && picked && !option.is_correct;
          return (
            <button
              key={option.letter}
              type="button"
              disabled={mode === "study" || revealed}
              onClick={() => onChoose(option.letter)}
              className={`flex w-full items-center gap-4 rounded-[20px] border px-4 py-4 text-left transition md:px-5 md:py-[18px] ${
                correct
                  ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                  : wrong
                    ? "border-rose-300 bg-rose-50 text-rose-950"
                    : picked
                      ? "border-primary/60 bg-primary/10 text-foreground"
                      : "border-border bg-card text-foreground hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_18px_34px_-28px_rgba(0,0,0,0.5)]"
              } disabled:cursor-default disabled:opacity-100`}
            >
              <span
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border text-[16px] font-black ${
                  correct
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : wrong
                      ? "border-rose-500 bg-rose-500 text-white"
                      : picked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted text-muted-foreground"
                }`}
              >
                {option.letter}
              </span>
              <span className="flex-1 text-[16.5px] font-semibold leading-[1.5] md:text-[17.5px]">
                {option.body}
              </span>
              {correct && <CheckCircle2 className="shrink-0 text-emerald-600" />}
              {wrong && <XCircle className="shrink-0 text-rose-600" />}
            </button>
          );
        })}
      </div>

      {revealed && question.explanation && (
        <div className="mx-5 mb-7 overflow-hidden rounded-2xl border border-rose-900/15 bg-card md:mx-7">
          <div className="border-b border-rose-900/10 bg-rose-50/60 px-5 py-3.5 text-[15px] font-bold text-rose-900">
            Explanation
          </div>
          <div className="px-5 py-5">
            <div className="flex items-center gap-2 text-[15px] font-extrabold text-amber-800">
              <Lightbulb className="text-amber-600" /> Concept
            </div>
            <p className="mt-2 whitespace-pre-line text-[16.5px] leading-[1.65] text-foreground">
              {question.explanation}
            </p>
            {question.point_ref && (
              <p className="mt-3 text-[13px] font-semibold text-muted-foreground">
                From the lecture: {question.point_ref}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-7 md:px-7">
        <button
          type="button"
          onClick={onPrevious}
          disabled={isFirst}
          className="rita-btn rita-btn-secondary gap-2 disabled:opacity-40"
        >
          <ArrowLeft size={17} /> Previous
        </button>
        {mode === "session" && !revealed ? (
          <button
            type="button"
            onClick={onSubmit}
            disabled={!selected}
            className="rita-btn rita-btn-primary disabled:opacity-40"
          >
            Submit answer
          </button>
        ) : (
          <button type="button" onClick={onNext} className="rita-btn rita-btn-primary gap-2">
            {isLast ? "Finish & see results" : "Next question"} <ArrowRight size={17} />
          </button>
        )}
      </div>
    </article>
  );
}

function QuestionMap({
  questions,
  current,
  answers,
  submitted,
  flags,
  mode,
  onJump,
  onFinish,
}: {
  questions: Question[];
  current: number;
  answers: Record<string, string>;
  submitted: Record<string, boolean>;
  flags: Record<string, boolean>;
  mode: Mode;
  onJump: (index: number) => void;
  onFinish: () => void;
}) {
  return (
    <aside className="self-start lg:sticky lg:top-24">
      <div className="medical-card overflow-hidden">
        <div className="border-b border-border px-4 py-3.5 text-[15px] font-bold">Question map</div>
        <div className="grid grid-cols-5 gap-2.5 p-3.5">
          {questions.map((question, index) => {
            const answered = !!answers[question.id];
            const revealed = mode === "study" || !!submitted[question.id];
            const selectedOption = question.options.find((option) => option.letter === answers[question.id]);
            const correct = revealed && selectedOption?.is_correct;
            const wrong = revealed && answered && selectedOption && !selectedOption.is_correct;
            return (
              <Button
                key={question.id}
                type="button"
                variant="outline"
                size="icon"
                onClick={() => onJump(index)}
                aria-label={`Question ${index + 1}${flags[question.id] ? ", flagged" : ""}`}
                className={`relative h-11 w-11 rounded-full text-[14px] font-bold ${
                  index === current
                    ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                    : correct
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : wrong
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : answered
                          ? "border-border bg-muted text-muted-foreground"
                          : "border-border bg-card text-muted-foreground"
                }`}
              >
                {index + 1}
                {flags[question.id] && <Flag className="absolute -right-1 -top-1 fill-amber-400 text-amber-500" />}
              </Button>
            );
          })}
        </div>
        <div className="space-y-2.5 border-t border-border p-3.5">
          <button type="button" onClick={onFinish} className="rita-btn rita-btn-primary !w-full">
            Finish {mode === "study" ? "Study" : mode === "session" ? "Session" : "Exam"}
          </button>
          <Link to="/study/lectures" className="rita-btn rita-btn-secondary !w-full">
            End &amp; exit
          </Link>
        </div>
      </div>
    </aside>
  );
}

function ResultsState({
  score,
  questions,
  answers,
  points,
  mode,
  onRetry,
}: {
  score: { correct: number; total: number; pct: number };
  questions: Question[];
  answers: Record<string, string>;
  points: { title: string; points: string[] }[];
  mode: Mode;
  onRetry: () => void;
}) {
  const missed = questions.filter(
    (question) =>
      !question.options.some(
        (option) => option.is_correct && option.letter === answers[question.id],
      ),
  );
  return (
    <div className="min-h-screen bg-[color:var(--cream)] text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-12 md:px-8">
        <section className="medical-card p-7 text-center md:p-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase text-primary">
            <Trophy /> {mode === "exam" ? "Exam complete" : mode === "session" ? "Session complete" : "Study complete"}
          </span>
          <h1 className="mt-5 font-display text-5xl font-black">{score.pct}%</h1>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            {score.correct} of {score.total} correct
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {missed.length > 0 && (
              <Button type="button" variant="outline" onClick={onRetry} className="rounded-xl">
                <RotateCcw /> Retry weak spots
              </Button>
            )}
            <Button asChild className="rounded-xl">
              <Link to="/study/lectures">Back to Lecture Lab</Link>
            </Button>
          </div>
        </section>

        {missed.length > 0 && (
          <section className="mt-6 space-y-3">
            <h2 className="font-display text-xl font-black">What you missed</h2>
            {missed.map((question) => {
              const correct = question.options.find((option) => option.is_correct);
              return (
                <article key={question.id} className="medical-card p-5">
                  <p className="font-bold leading-snug">{question.stem}</p>
                  <p className="mt-2 text-sm font-bold text-emerald-700">
                    {correct?.letter}. {correct?.body}
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {question.explanation}
                  </p>
                </article>
              );
            })}
          </section>
        )}

        {points.length > 0 && (
          <section className="medical-card mt-6 p-6">
            <h2 className="font-display text-xl font-black">Key points</h2>
            {points.map((group) => (
              <div key={group.title} className="mt-4">
                <h3 className="text-xs font-black uppercase text-primary">{group.title}</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
                  {group.points.map((point) => <li key={point}>{point}</li>)}
                </ul>
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-[color:var(--cream)] text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-16 md:px-8">
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
        <div className="mt-6 h-96 animate-pulse rounded-xl bg-muted" />
      </main>
    </div>
  );
}

function SignInState() {
  return (
    <div className="min-h-screen bg-[color:var(--cream)] text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-black">Lecture quiz</h1>
        <Button asChild className="mt-6 rounded-xl"><Link to="/login">Sign in</Link></Button>
      </main>
    </div>
  );
}

function EmptyState({ pool }: { pool: Pool }) {
  return (
    <div className="min-h-screen bg-[color:var(--cream)] text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-xl px-4 py-24 text-center">
        <Target className="mx-auto h-9 w-9 text-primary" />
        <h1 className="mt-3 font-display text-3xl font-black">Nothing in this pool yet</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {pool === "all" ? "That lecture has no questions." : "Complete the lecture once, then weak spots and flags appear here."}
        </p>
        <Button asChild className="mt-6 rounded-xl"><Link to="/study/lectures">Back to Lecture Lab</Link></Button>
      </main>
    </div>
  );
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}