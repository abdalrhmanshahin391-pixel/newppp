import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, RotateCcw, Sparkles } from "lucide-react";
import { StudyLayout, StudyHeading } from "@/components/study/StudyLayout";
import { SignedOutPanel } from "@/components/study/SignedOutPanel";
import { useAuth } from "@/hooks/useAuth";
import { fetchCards, fetchSubjects, markReviewed } from "@/lib/flashcards";
import { gradeCard } from "@/lib/review.functions";
import { FlipCard } from "@/components/study/FlipCard";

/** One face of the session card. */
function SessionFace({ side, text, hint }: { side: string; text: string; hint?: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center overflow-auto rounded-[2rem] border border-black/[0.06] bg-white px-8 py-10 text-center shadow-[0_20px_50px_-30px_rgba(35,32,29,0.3)]">
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b3aa9c]">{side}</span>
      <span
        className="mt-5 font-display font-black leading-tight text-[#23201d]"
        style={{ fontSize: "clamp(1.4rem, 3vw, 2.1rem)" }}
      >
        {text}
      </span>
      {hint && <span className="mt-6 text-[13.5px] font-semibold text-[#b3aa9c]">{hint}</span>}
    </div>
  );
}

const SM2_GRADES = [
  { g: 0, label: "Again", key: "1", hint: "10 min", bg: "#f6ddd5", ink: "#7d3421" },
  { g: 1, label: "Hard", key: "2", hint: "1 d", bg: "#fbe3c8", ink: "#7a4b16" },
  { g: 2, label: "Good", key: "3", hint: "6 d", bg: "#d6e8f6", ink: "#1f4c6d" },
  { g: 3, label: "Easy", key: "4", hint: "8 d", bg: "#d8ecdd", ink: "#215237" },
] as const;

function getGradeHint(g: number, reviews: number) {
  if (g === 0) return "10 min";
  if (reviews === 0) {
    if (g === 1) return "1 d";
    if (g === 2) return "1 d";
    return "4 d";
  }
  if (reviews === 1) {
    if (g === 1) return "3 d";
    if (g === 2) return "6 d";
    return "8 d";
  }
  if (g === 1) return "+20%";
  if (g === 2) return "x2.5";
  return "x3.3";
}

export const Route = createFileRoute("/study/session")({
  validateSearch: (search: Record<string, unknown>) => ({
    ids: typeof search.ids === "string" ? search.ids : "",
  }),
  head: () => ({
    meta: [
      { title: "Study session — RitaJet flashcards" },
      { name: "description", content: "SM-2 spaced repetition flashcard session." },
      { property: "og:title", content: "Study session — RitaJet flashcards" },
      { property: "og:description", content: "SuperMemo SM-2 spaced repetition study session." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SessionPage,
});

function SessionPage() {
  const { ids } = Route.useSearch();
  const { user } = useAuth();
  const subjectIds = useMemo(() => ids.split(",").filter(Boolean), [ids]);

  const subjects = useQuery({ queryKey: ["flash-subjects"], queryFn: fetchSubjects, enabled: !!user });
  const cards = useQuery({
    queryKey: ["flash-cards", ids],
    queryFn: () => fetchCards(subjectIds),
    enabled: !!user && subjectIds.length > 0,
  });

  const gradeFn = useServerFn(gradeCard);

  const [order, setOrder] = useState<number[] | null>(null);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  const list = cards.data ?? [];
  const seq = order ?? list.map((_, i) => i);
  const card = list[seq[pos] ?? -1];

  const names = (subjects.data ?? [])
    .filter((s) => subjectIds.includes(s.id))
    .map((s) => s.name)
    .join(" · ");

  const restart = () => {
    setOrder(null);
    setPos(0);
    setFlipped(false);
    setKnown(0);
    setLastFeedback(null);
    startTimeRef.current = Date.now();
  };

  const shuffle = () => {
    const next = list.map((_, i) => i);
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j]!, next[i]!];
    }
    setOrder(next);
    setPos(0);
    setFlipped(false);
    setKnown(0);
    setLastFeedback(null);
    startTimeRef.current = Date.now();
  };

  const answer = useCallback(
    async (grade: number) => {
      if (!card || busy) return;
      setBusy(true);
      const elapsed = Math.min(600_000, Math.max(0, Date.now() - startTimeRef.current));

      // 1. Update basic legacy counters in flash_cards
      void markReviewed(card.id, card.reviews);

      // 2. Schedule via SM-2 in review.server
      const subjectName = (subjects.data ?? []).find((s) => s.id === card.subject_id)?.name ?? "";
      try {
        const res = await gradeFn({
          data: {
            cardId: card.id,
            subject: subjectName,
            sub: "",
            grade,
            ms: elapsed,
            flagged: false,
          },
        });
        if (res?.memory) {
          setLastFeedback(`Scheduled: ${res.memory}`);
        }
      } catch (err) {
        console.warn("SM-2 grading fallback:", err);
      } finally {
        setBusy(false);
      }

      if (grade >= 2) {
        setKnown((k) => k + 1);
      }
      setFlipped(false);
      setPos((p) => p + 1);
      startTimeRef.current = Date.now();
    },
    [card, busy, gradeFn, subjects.data],
  );

  // Keyboard navigation: Space to flip, 1-4 to grade
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space" || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && !busy) {
        if (e.key === "1") void answer(0);
        else if (e.key === "2") void answer(1);
        else if (e.key === "3") void answer(2);
        else if (e.key === "4") void answer(3);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, busy, answer]);

  const rail = [
    { label: "Back to subjects", icon: <ArrowLeft size={15} />, to: "/study" },
    { label: "Shuffle", icon: <RotateCcw size={15} />, onClick: shuffle },
    { label: "Restart", onClick: restart },
  ];

  const done = list.length > 0 && pos >= list.length;

  return (
    <StudyLayout rail={rail}>
      {!user ? (
        <SignedOutPanel what="your flashcards" />
      ) : (
        <div className="mx-auto max-w-3xl">
          <StudyHeading eyebrow={names || "SM-2 Session"} title={done ? "Session finished" : "SM-2 Study session"} />

          {list.length === 0 && cards.isSuccess && (
            <p className="mt-8 text-[15px] text-[#6d665c]">
              There are no cards in this selection yet.{" "}
              <Link to="/study" className="font-bold underline">
                Add some first
              </Link>
              .
            </p>
          )}

          {!done && card && (
            <>
              <div className="mt-6 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-[color:var(--primary)] transition-all"
                    style={{ width: `${(pos / list.length) * 100}%` }}
                  />
                </div>
                <span className="text-[13px] font-bold text-[#a29a8d]">
                  {pos + 1} / {list.length}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setFlipped((f) => !f)}
                className="mt-8 block w-full text-left"
                aria-label="Flip card"
              >
                <FlipCard
                  flipped={flipped}
                  className="h-[19rem] w-full"
                  front={<SessionFace side="Question" text={card.front} hint="Tap (or press Space) to reveal" />}
                  back={<SessionFace side="Answer" text={card.back} hint="Grade using SM-2 buttons below" />}
                />
              </button>

              {lastFeedback && (
                <div className="mt-4 flex justify-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-3.5 py-1 text-xs font-bold text-[#7a7164]">
                    <Sparkles size={13} /> {lastFeedback}
                  </span>
                </div>
              )}

              {flipped ? (
                <div className="mt-6">
                  <p className="mb-3 text-center text-xs font-bold uppercase tracking-wider text-[#a79c8c]">
                    How well did you recall this? (Keys 1 · 2 · 3 · 4)
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {SM2_GRADES.map((g) => (
                      <button
                        key={g.g}
                        type="button"
                        disabled={busy}
                        onClick={() => void answer(g.g)}
                        className="rounded-2xl px-4 py-4 text-center transition-transform active:scale-[0.97] disabled:opacity-60 shadow-sm"
                        style={{ background: g.bg, color: g.ink }}
                      >
                        <span className="block text-[17px] font-black">{g.label}</span>
                        <span className="block text-[11px] font-bold opacity-75">
                          {getGradeHint(g.g, card.reviews)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setFlipped(true)}
                    className="rita-pill inline-flex h-12 items-center rounded-full px-8 text-[15px] font-semibold"
                  >
                    Reveal answer
                  </button>
                </div>
              )}
            </>
          )}

          {done && (
            <div className="mt-8 rounded-[2rem] bg-white p-10 text-center">
              <p className="font-display text-[2.4rem] font-black leading-none text-[#23201d]">
                {known}/{list.length}
              </p>
              <p className="mt-3 text-[15px] text-[#6d665c]">
                cards successfully remembered and scheduled via SM-2.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={shuffle}
                  className="rita-pill inline-flex h-12 items-center rounded-full px-8 text-[15px] font-semibold"
                >
                  Go again, shuffled
                </button>
                <Link
                  to="/study"
                  className="inline-flex h-12 items-center rounded-full border border-black/10 px-8 text-[15px] font-semibold"
                >
                  Back to subjects
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </StudyLayout>
  );
}
