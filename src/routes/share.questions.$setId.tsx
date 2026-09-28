import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  FolderPlus,
  Globe,
  HelpCircle,
  ListChecks,
  Loader2,
  Lock,
  Play,
  RotateCcw,
  Share2,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthorChip } from "@/components/share/DeckCard";
import { QuestionSetRating } from "@/components/share/QuestionSetRating";
import { useAuth } from "@/hooks/useAuth";
import {
  coverOf,
  deleteQuestionSet,
  fetchQuestionPage,
  fetchQuestionSet,
  fetchAllSetQuestions,
  isQuestionSetSaved,
  saveQuestionSet,
  setQuestionSetPublished,
  setQuestionSetAudience,
  SOURCE_TYPE_META,
  type SharedQuestionItem,
  QUESTION_PAGE,
} from "@/lib/share-questions";

export const Route = createFileRoute("/share/questions/$setId")({
  head: () => ({
    meta: [
      { title: "Shared question set | RitaJet" },
      {
        name: "description",
        content: "Study questions shared by students, test your knowledge, and save into your own subjects.",
      },
    ],
  }),
  component: QuestionSetDetailPage,
});

export function QuestionSetDetailPage() {
  const { setId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [page, setPage] = useState(0);
  const [practiceMode, setPracticeMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch set info
  const setQuery = useQuery({
    queryKey: ["share-qset", setId],
    queryFn: () => fetchQuestionSet(setId),
  });

  // Fetch page questions
  const pageQuery = useQuery({
    queryKey: ["share-qset-items", setId, page],
    queryFn: () => fetchQuestionPage(setId, page),
  });

  // Saved state
  const savedQuery = useQuery({
    queryKey: ["share-qset-saved", setId, user?.id],
    queryFn: () => isQuestionSetSaved(setId, user!.id),
    enabled: !!user,
  });

  // Practice questions query
  const allQuestionsQuery = useQuery({
    queryKey: ["share-qset-all-items", setId],
    queryFn: () => fetchAllSetQuestions(setId),
    enabled: practiceMode,
  });

  const set = setQuery.data?.set;
  const author = setQuery.data?.author ?? null;
  const isOwner = !!user && set?.owner_id === user.id;

  const totalQuestions = set?.question_count ?? 0;
  const totalPages = Math.ceil(totalQuestions / QUESTION_PAGE) || 1;
  const c = coverOf(set?.cover ?? "sky");
  const sourceMeta = SOURCE_TYPE_META[set?.source_type ?? "lecture"];

  async function handleSave() {
    if (!user) return navigate({ to: "/login" });
    setSaving(true);
    try {
      await saveQuestionSet(setId);
      toast.success("Saved to your study collection");
      qc.invalidateQueries({ queryKey: ["share-qset-saved", setId] });
      qc.invalidateQueries({ queryKey: ["share-qset", setId] });
    } catch (e: any) {
      toast.error(e?.message || "Could not save question set");
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Could not copy link");
    }
  }

  async function handleTogglePublish() {
    if (!set) return;
    try {
      await setQuestionSetPublished(set.id, !set.published);
      toast.success(set.published ? "Question set is now hidden" : "Question set is now public");
      qc.invalidateQueries({ queryKey: ["share-qset", setId] });
    } catch (e: any) {
      toast.error(e?.message || "Could not update visibility");
    }
  }

  async function handleAudienceChange(newAudience: "public" | "space") {
    if (!set) return;
    try {
      await setQuestionSetAudience(set.id, newAudience);
      toast.success(
        newAudience === "public"
          ? "Question set is now shared publicly with everyone on RitaJet!"
          : "Question set is now restricted to your space members only.",
      );
      qc.invalidateQueries({ queryKey: ["share-qset", setId] });
    } catch (e: any) {
      toast.error(e?.message || "Could not change audience");
    }
  }

  async function handleDelete() {
    if (!set) return;
    if (
      !confirm(
        `Delete "${set.title}" for everyone? This cannot be undone.\n\n✨ Note: If this set was shared today, deleting it will immediately free up 1 slot in your 5/day sharing limit!`,
      )
    )
      return;
    try {
      await deleteQuestionSet(set.id);
      toast.success("Question set deleted (daily sharing slot recovered if shared today)");
      void navigate({ to: "/share" });
    } catch (e: any) {
      toast.error(e?.message || "Could not delete set");
    }
  }

  if (setQuery.isLoading) {
    return (
      <div className="min-h-screen" style={{ background: "#fbf5e9" }}>
        <SiteHeader />
        <div className="mx-auto max-w-5xl px-4 py-24 text-center text-sm text-[#6b655c]">
          <Loader2 size={24} className="mx-auto mb-3 animate-spin text-[#8ec63f]" />
          Loading question set…
        </div>
      </div>
    );
  }

  if (!set) {
    return (
      <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
        <SiteHeader />
        <div className="mx-auto max-w-xl px-4 py-24 text-center">
          <span className="text-4xl">❓</span>
          <h1 className="mt-4 font-display text-2xl font-black">Question set not found</h1>
          <p className="mt-2 text-sm text-[#6b655c]">
            This set may have been removed or you may not have access to it.
          </p>
          <Link
            to="/share"
            className="mt-6 inline-flex rounded-full bg-[#23201d] px-6 py-2.5 text-sm font-black text-white"
          >
            Browse shared materials
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-14">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/share"
            className="inline-flex items-center gap-1.5 text-sm font-black text-[#6b655c] transition hover:text-[#23201d]"
          >
            <ArrowLeft size={15} /> All shared materials
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3.5 py-1.5 text-xs font-black text-[#6b655c] transition hover:bg-black/[0.03]"
            >
              <Share2 size={13} /> Copy link
            </button>
            {isOwner && (
              <>
                <button
                  type="button"
                  onClick={() => handleAudienceChange(set.audience === "public" ? "space" : "public")}
                  className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-black text-[#6b655c] transition hover:bg-black/[0.04]"
                  title={set.audience === "public" ? "Restrict to space only" : "Make publicly available"}
                >
                  {set.audience === "public" ? <Lock size={13} /> : <Globe size={13} />}
                  {set.audience === "public" ? "Make Space-only" : "Make Public"}
                </button>
                <button
                  type="button"
                  onClick={handleTogglePublish}
                  className="grid h-8 w-8 place-items-center rounded-full border border-black/[0.08] bg-white text-[#6b655c] transition hover:bg-black/[0.04]"
                  title={set.published ? "Make hidden" : "Make public"}
                >
                  {set.published ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="grid h-8 w-8 place-items-center rounded-full border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
                  title="Delete question set"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Set Hero Header Card */}
        <section
          className="relative overflow-hidden rounded-[28px] p-6 shadow-sm md:p-8"
          style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/90 text-3xl shadow-sm md:h-20 md:w-20 md:text-4xl">
                {set.emoji || "❓"}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-sky-300 bg-white px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-sky-800 shadow-sm">
                    ❓ Question Set
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border bg-white/95 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider ${sourceMeta.badgeClass}`}
                  >
                    {sourceMeta.icon} {sourceMeta.label}
                  </span>
                  {set.subject && (
                    <span className="rounded-full bg-black/15 px-2.5 py-0.5 text-[11px] font-black text-[#23201d]">
                      {set.subject}
                    </span>
                  )}
                  <span className="rounded-full bg-black/10 px-2.5 py-0.5 text-[11px] font-black text-[#23201d]">
                    {set.question_count} Questions
                  </span>
                  <span className="rounded-full bg-black/10 px-2.5 py-0.5 text-[11px] font-black text-[#23201d]">
                    {set.save_count} saves
                  </span>
                  {set.rating_count > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-black text-amber-900 shadow-sm">
                      <Star size={11} className="fill-amber-500 text-amber-500" />
                      {set.rating_avg.toFixed(1)} ({set.rating_count})
                    </span>
                  ) : (
                    <span className="rounded-full bg-black/10 px-2.5 py-0.5 text-[11px] font-black text-[#23201d]">
                      No ratings yet
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/10 px-2.5 py-0.5 text-[11px] font-black text-[#23201d]">
                    {set.audience === "public" ? <Globe size={11} /> : <Lock size={11} />}
                    {set.audience === "public" ? "Public" : "Space only"}
                  </span>
                </div>
                <h1 className="mt-2 font-display text-2xl font-black tracking-tight text-[#23201d] md:text-3xl">
                  {set.title}
                </h1>
                {set.description && (
                  <p className="mt-1.5 max-w-2xl text-[14.5px] leading-relaxed text-[#3d3832]">
                    {set.description}
                  </p>
                )}
                <div className="mt-3">
                  <AuthorChip author={author} />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-row flex-wrap gap-2.5 md:flex-col md:items-end">
              <button
                type="button"
                onClick={() => setPracticeMode(!practiceMode)}
                className="inline-flex items-center gap-2 rounded-full bg-[#23201d] px-5 py-3 text-[14px] font-black text-white shadow-md transition hover:bg-black"
              >
                <Play size={15} fill="white" />
                {practiceMode ? "Exit Practice" : "Practice Mode"}
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving || savedQuery.data}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[13px] font-black transition ${
                  savedQuery.data
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-black/[0.1] bg-white text-[#23201d] hover:bg-white/80"
                }`}
              >
                {savedQuery.data ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                {savedQuery.data ? "Saved in Study" : "Save Question Set"}
              </button>
            </div>
          </div>
        </section>

        {/* Practice Mode Interactive Session */}
        {practiceMode && (
          <section className="mt-8">
            <InteractivePracticeSession
              questions={allQuestionsQuery.data ?? []}
              loading={allQuestionsQuery.isLoading}
              onClose={() => setPracticeMode(false)}
            />
          </section>
        )}

        {/* Browse Questions List */}
        {!practiceMode && (
          <section className="mt-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-black text-[#23201d]">
                Questions Overview ({set.question_count})
              </h2>
              {totalPages > 1 && (
                <span className="text-xs font-bold text-[#6b655c]">
                  Page {page + 1} of {totalPages}
                </span>
              )}
            </div>

            {pageQuery.isLoading ? (
              <div className="py-16 text-center text-sm text-[#6b655c]">
                <Loader2 size={18} className="mx-auto mb-2 animate-spin text-[#8ec63f]" />
                Loading questions…
              </div>
            ) : (pageQuery.data?.length ?? 0) === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/15 bg-white/50 p-8 text-center text-sm text-[#6b655c]">
                No questions found in this set.
              </div>
            ) : (
              pageQuery.data!.map((q, idx) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  index={page * QUESTION_PAGE + idx + 1}
                />
              ))
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-3 pt-4">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-4 py-2 text-xs font-black transition disabled:opacity-40"
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <span className="text-xs font-bold text-[#6b655c]">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-4 py-2 text-xs font-black transition disabled:opacity-40"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            )}
          </section>
        )}

        {/* 5-Star Interactive Rating & Reviews */}
        <div className="mt-12">
          <QuestionSetRating setId={setId} />
        </div>
      </main>
    </div>
  );
}

/** Individual Question Card in Overview */
function QuestionCard({ question, index }: { question: SharedQuestionItem; index: number }) {
  const [showExplanation, setShowExplanation] = useState(false);

  return (
    <article className="overflow-hidden rounded-[24px] border border-black/[0.07] bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-black uppercase tracking-widest text-[#8a8376]">
          Question {index}
        </span>
        {question.subtopic && (
          <span className="rounded-full bg-black/[0.04] px-2.5 py-0.5 text-[10.5px] font-bold text-[#6b655c]">
            {question.subtopic}
          </span>
        )}
      </div>

      <h3 className="mt-2.5 font-display text-[17.5px] font-black leading-snug text-[#23201d]">
        {question.stem}
      </h3>

      <div className="mt-4 space-y-2">
        {question.options?.map((opt: any, i: number) => {
          const isCorrect = opt.is_correct || opt.correct;
          const letter = opt.letter || String.fromCharCode(65 + i);
          return (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-xl border px-4 py-2.5 text-[14px] font-medium transition ${
                isCorrect
                  ? "border-[#8ec63f] bg-[#f4faec] text-[#2c480e]"
                  : "border-black/[0.06] bg-[#faf8f5] text-[#3d3832]"
              }`}
            >
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded text-xs font-black ${
                  isCorrect ? "bg-[#8ec63f] text-white" : "bg-black/[0.06] text-[#6b655c]"
                }`}
              >
                {letter}
              </span>
              <span className="flex-1">{opt.text || opt.body || String(opt)}</span>
              {isCorrect && (
                <span className="inline-flex items-center gap-1 rounded bg-[#8ec63f]/20 px-2 py-0.5 text-[11px] font-black text-[#3d5c14]">
                  <Check size={12} strokeWidth={3} /> Correct
                </span>
              )}
            </div>
          );
        })}
      </div>

      {question.explanation && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowExplanation(!showExplanation)}
            className="inline-flex items-center gap-1.5 text-xs font-black text-[#6b655c] transition hover:text-[#23201d]"
          >
            <HelpCircle size={13} />
            {showExplanation ? "Hide explanation" : "View explanation"}
          </button>

          {showExplanation && (
            <div className="mt-2 rounded-xl border border-black/[0.06] bg-[#fbf5e9]/70 p-4 text-[13.5px] leading-relaxed text-[#4a453d]">
              <p className="font-bold text-[11px] uppercase tracking-wider text-[#8a8376] mb-1">
                Explanation
              </p>
              {question.explanation}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/** Interactive Self-Assessment Practice / Quiz Mode */
function InteractivePracticeSession({
  questions,
  loading,
  onClose,
}: {
  questions: SharedQuestionItem[];
  loading: boolean;
  onClose: () => void;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});

  if (loading) {
    return (
      <div className="rounded-[26px] border border-black/[0.07] bg-white p-12 text-center text-sm text-[#6b655c]">
        <Loader2 size={24} className="mx-auto mb-2 animate-spin text-[#8ec63f]" />
        Preparing questions for practice mode…
      </div>
    );
  }

  if (!questions || questions.length === 0) {
    return (
      <div className="rounded-[26px] border border-black/[0.07] bg-white p-8 text-center">
        <p className="font-display font-black text-lg">No questions available to practice</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 rounded-full bg-[#23201d] px-5 py-2 text-xs font-black text-white"
        >
          Exit
        </button>
      </div>
    );
  }

  const q = questions[currentIdx];
  const hasAnswered = userAnswers[currentIdx] !== undefined;
  const pickedAnswer = userAnswers[currentIdx];

  const handleSelect = (optionIdx: number) => {
    if (hasAnswered) return;
    const isCorrect = !!q.options[optionIdx]?.is_correct || !!q.options[optionIdx]?.correct;
    setUserAnswers((prev) => ({ ...prev, [currentIdx]: optionIdx }));
    setAnsweredCount((c) => c + 1);
    if (isCorrect) setScore((s) => s + 1);
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx((i) => i - 1);
    }
  };

  const progressPercent = Math.round(((currentIdx + 1) / questions.length) * 100);

  return (
    <div className="overflow-hidden rounded-[26px] border border-black/[0.08] bg-white p-6 shadow-sm md:p-8">
      {/* Top Header & Progress */}
      <div className="flex items-center justify-between border-b border-black/[0.06] pb-4">
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-[#8a8376]">
            Practice Session · Question {currentIdx + 1} of {questions.length}
          </span>
          <div className="mt-1 flex items-center gap-3">
            <span className="font-display text-sm font-black text-[#23201d]">
              Score: {score} / {answeredCount} correct
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-full text-[#6b655c] transition hover:bg-black/[0.05]"
          title="Exit Practice"
        >
          <X size={18} />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
        <div
          className="h-full bg-[#8ec63f] transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Question Stem */}
      <div className="mt-6">
        <h3 className="font-display text-xl font-black leading-snug text-[#23201d] md:text-2xl">
          {q.stem}
        </h3>
      </div>

      {/* Options List */}
      <div className="mt-6 space-y-3">
        {q.options?.map((opt: any, i: number) => {
          const isCorrect = opt.is_correct || opt.correct;
          const isSelected = pickedAnswer === i;
          const letter = opt.letter || String.fromCharCode(65 + i);

          let optionStyle = "border-black/[0.08] bg-white hover:border-black/20 text-[#23201d]";
          if (hasAnswered) {
            if (isCorrect) {
              optionStyle = "border-[#8ec63f] bg-[#f4faec] text-[#2c480e] ring-1 ring-[#8ec63f]";
            } else if (isSelected) {
              optionStyle = "border-red-400 bg-red-50 text-red-800 ring-1 ring-red-300";
            } else {
              optionStyle = "border-black/[0.05] bg-black/[0.02] opacity-60";
            }
          }

          return (
            <button
              key={i}
              type="button"
              disabled={hasAnswered}
              onClick={() => handleSelect(i)}
              className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left text-[15px] font-medium transition ${optionStyle}`}
            >
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-xs font-black ${
                  hasAnswered && isCorrect
                    ? "bg-[#8ec63f] text-white"
                    : hasAnswered && isSelected
                      ? "bg-red-500 text-white"
                      : "bg-black/[0.06] text-[#6b655c]"
                }`}
              >
                {letter}
              </span>
              <span className="flex-1">{opt.text || opt.body || String(opt)}</span>
              {hasAnswered && isCorrect && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#8ec63f]/20 px-2 py-0.5 text-xs font-black text-[#3d5c14]">
                  <Check size={13} strokeWidth={3} /> Correct
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Explanation Banner when answered */}
      {hasAnswered && q.explanation && (
        <div className="mt-6 rounded-2xl border border-black/[0.06] bg-[#fbf5e9] p-5">
          <span className="font-bold text-xs uppercase tracking-wider text-[#8a8376]">
            Explanation
          </span>
          <p className="mt-1.5 text-sm leading-relaxed text-[#4a453d]">
            {q.explanation}
          </p>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="mt-8 flex items-center justify-between border-t border-black/[0.06] pt-4">
        <button
          type="button"
          disabled={currentIdx === 0}
          onClick={handlePrev}
          className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] px-4 py-2 text-xs font-black text-[#6b655c] transition hover:bg-black/[0.03] disabled:opacity-40"
        >
          <ChevronLeft size={15} /> Previous
        </button>

        {currentIdx < questions.length - 1 ? (
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#23201d] px-5 py-2 text-xs font-black text-white transition hover:bg-black"
          >
            Next Question <ChevronRight size={15} />
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#8ec63f] px-5 py-2 text-xs font-black text-white transition hover:brightness-105"
          >
            Finish Practice <Check size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
