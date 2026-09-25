import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Send,
  AlertTriangle,
  Sparkles,
  BookOpen,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { openAuth } from "@/lib/auth-dialog";
import { useAuth } from "@/hooks/useAuth";
import { getDailyShareQuota } from "@/lib/share-decks";
import {
  DECK_COVERS,
  coverOf,
  publishQuestionSet,
  fetchUserQuestionSources,
  fetchQuestionsForPublish,
  type QuestionSourceType,
  type QuestionSubjectNode,
} from "@/lib/share-questions";
import { listMySpaces } from "@/lib/spaces";

const EMOJIS = ["❓", "🩺", "🧬", "💊", "🫀", "🧠", "🔬", "🦴", "🧪", "📚", "🎯", "⚡"];

export const Route = createFileRoute("/share/questions/new")({
  validateSearch: (s: Record<string, unknown>): { space?: string; source?: "lecture" | "bank" } => {
    const rawSpace = typeof s.space === "string" ? s.space.trim() : "";
    return {
      space: rawSpace && rawSpace !== "undefined" && rawSpace !== "null" ? rawSpace : undefined,
      source: s.source === "bank" ? "bank" : "lecture",
    };
  },
  head: () => ({
    meta: [
      { title: "Share Exam Questions | RitaJet" },
      {
        name: "description",
        content: "Publish question sets from Lecture Lab or Question Bank for fellow students.",
      },
    ],
  }),
  component: NewQuestionSetPage,
});

export function NewQuestionSetPage() {
  const { space: spaceIdParam, source: initialSource } = Route.useSearch();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [sourceType, setSourceType] = useState<"lecture" | "bank">(initialSource === "bank" ? "bank" : "lecture");
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(spaceIdParam || null);
  const [destination, setDestination] = useState<"public" | "space">(spaceIdParam ? "space" : "public");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagText, setTagText] = useState("");
  const [cover, setCover] = useState("sky");
  const [emoji, setEmoji] = useState("❓");
  const [saving, setSaving] = useState(false);

  // Selected item IDs (e.g. lecture IDs or question bank subject IDs)
  const [pickedItemIds, setPickedItemIds] = useState<Set<string>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());

  // Load question trees for current user
  const sourcesQuery = useQuery({
    queryKey: ["user-question-sources", user?.id],
    queryFn: () => fetchUserQuestionSources(user!.id),
    enabled: !!user,
  });

  // Load spaces user belongs to
  const spacesQuery = useQuery({
    queryKey: ["user-my-spaces", user?.id],
    queryFn: () => listMySpaces(user!.id),
    enabled: !!user,
  });

  // Daily sharing quota query
  const quotaQuery = useQuery({
    queryKey: ["daily-share-quota", user?.id],
    queryFn: () =>
      getDailyShareQuota(user!.id).catch(() => ({
        decksToday: 0,
        questionsToday: 0,
        usedToday: 0,
        limit: 5,
        remaining: 5,
        isBlocked: false,
      })),
    enabled: !!user,
  });
  const quota = quotaQuery.data;

  const currentNodes: QuestionSubjectNode[] = useMemo(() => {
    if (!sourcesQuery.data) return [];
    return sourcesQuery.data[sourceType] || [];
  }, [sourcesQuery.data, sourceType]);

  // When source changes, reset selections
  const handleSourceChange = (st: "lecture" | "bank") => {
    setSourceType(st);
    setPickedItemIds(new Set());
    setExpandedSubjects(new Set());
  };

  const c = coverOf(cover);
  const toSpace = destination === "space";

  // Calculate total questions selected
  const totalSelectedQuestions = useMemo(() => {
    let count = 0;
    for (const node of currentNodes) {
      for (const item of node.items) {
        if (pickedItemIds.has(item.id)) {
          count += item.questionCount;
        }
      }
    }
    return count;
  }, [currentNodes, pickedItemIds]);

  // Selected nodes list
  const selectedNodes = useMemo(
    () => currentNodes.filter((n) => n.items.some((it) => pickedItemIds.has(it.id))),
    [currentNodes, pickedItemIds],
  );

  // Toggle all items in a subject
  const toggleSubject = (node: QuestionSubjectNode) => {
    const next = new Set(pickedItemIds);
    const itemIds = node.items.map((it) => it.id);
    const allSelected = itemIds.length > 0 && itemIds.every((id) => next.has(id));

    if (allSelected) {
      itemIds.forEach((id) => next.delete(id));
    } else {
      itemIds.forEach((id) => next.add(id));
    }
    setPickedItemIds(next);
  };

  // Toggle single item
  const toggleItem = (itemId: string) => {
    const next = new Set(pickedItemIds);
    if (next.has(itemId)) {
      next.delete(itemId);
    } else {
      next.add(itemId);
    }
    setPickedItemIds(next);
  };

  // Select all subjects
  const selectAllSubjects = () => {
    const next = new Set<string>();
    for (const node of currentNodes) {
      for (const it of node.items) {
        next.add(it.id);
      }
    }
    setPickedItemIds(next);
  };

  // Clear all selections
  const deselectAll = () => {
    setPickedItemIds(new Set());
  };

  // Toggle expand subject
  const toggleExpand = (nodeId: string) => {
    const next = new Set(expandedSubjects);
    if (next.has(nodeId)) {
      next.delete(nodeId);
    } else {
      next.add(nodeId);
    }
    setExpandedSubjects(next);
  };

  // Smart title auto-fill
  const autoFillTitle = () => {
    if (selectedNodes.length === 1) {
      const nodeName = selectedNodes[0].name;
      setTitle(sourceType === "lecture" ? `${nodeName} — Lecture Quizzes` : `${nodeName} — Exam Practice Bank`);
    } else if (selectedNodes.length > 1) {
      setTitle(`${selectedNodes[0].name} & Others — Practice Set`);
    }
  };

  async function publish() {
    if (!user) {
      toast.error("Please sign in to share questions");
      return;
    }
    if (quota?.isBlocked) {
      toast.error("Daily sharing quota reached (5/5). Delete an item uploaded today to unlock a slot.");
      return;
    }
    const finalTitle = title.trim() || (selectedNodes.length > 0 ? `${selectedNodes[0].name} Practice Questions` : "");
    if (!finalTitle) {
      toast.error("Please give your question set a title");
      return;
    }
    if (pickedItemIds.size === 0) {
      toast.error("Please select at least one topic that contains questions");
      return;
    }
    if (toSpace && !selectedSpaceId) {
      toast.error("Please select a classroom or space to share with");
      return;
    }

    setSaving(true);
    try {
      const selectedArray = Array.from(pickedItemIds);
      const questions = await fetchQuestionsForPublish(sourceType as QuestionSourceType, selectedArray);

      if (!questions || questions.length === 0) {
        throw new Error("No questions found in the selected topics.");
      }

      const tags = tagText
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      const subjectLabel =
        selectedNodes.length === 1
          ? selectedNodes[0].name
          : selectedNodes.length > 1
            ? `${selectedNodes.length} Subjects`
            : null;

      const newSetId = await publishQuestionSet({
        title: finalTitle,
        description: description.trim() || null,
        source_type: sourceType,
        subject: subjectLabel,
        cover,
        emoji,
        tags,
        questions,
        spaceId: toSpace ? selectedSpaceId : null,
      });

      toast.success(`Published question set with ${questions.length} questions!`);

      if (toSpace && selectedSpaceId) {
        void navigate({ to: "/spaces/$spaceId", params: { spaceId: selectedSpaceId } });
      } else {
        void navigate({ to: "/share/questions/$setId", params: { setId: newSetId } });
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to share question set");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbf5e9]">
        <SiteHeader />
        <div className="mx-auto flex max-w-5xl items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-[#8ec63f]" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#fbf5e9] text-[#23201d]">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-20 text-center">
          <span className="text-5xl">❓</span>
          <h1 className="mt-4 font-display text-3xl font-black">Sign in to share questions</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#6b655c]">
            You need to be signed in to your RitaJet account to publish question sets.
          </p>
          <button
            type="button"
            onClick={() => openAuth("signin", "/share/questions/new")}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#8ec63f] px-6 py-3 text-sm font-black text-white shadow-sm transition hover:brightness-105"
          >
            Sign in
          </button>
        </main>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-xl border border-black/[0.1] bg-white px-4 py-2.5 text-sm font-semibold outline-none transition focus:border-[#8ec63f]";

  return (
    <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
        {/* Navigation Breadcrumb */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          {spaceIdParam ? (
            <Link
              to="/spaces/$spaceId"
              params={{ spaceId: spaceIdParam }}
              className="inline-flex items-center gap-1.5 text-sm font-black text-[#6b655c] transition hover:text-[#23201d]"
            >
              <ArrowLeft size={15} /> Back to space
            </Link>
          ) : (
            <Link
              to="/share"
              className="inline-flex items-center gap-1.5 text-sm font-black text-[#6b655c] transition hover:text-[#23201d]"
            >
              <ArrowLeft size={15} /> Back to shared resources
            </Link>
          )}

          <Link
            to="/share/new"
            className="inline-flex items-center gap-1 text-xs font-black text-purple-700 hover:underline"
          >
            🃏 Prefer sharing flashcards instead?
          </Link>
        </div>

        {/* Page Title & Status Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-sky-800">
                ❓ Questions
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-black ${
                  quota?.isBlocked
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800"
                }`}
              >
                Quota: {quota?.usedToday ?? 0} / 5 shared today ({quota?.remaining ?? 5} left)
              </span>
            </div>
            <h1 className="mt-2 font-display text-3xl font-black tracking-tight md:text-4xl">
              Share Questions & Practice Quizzes
            </h1>
            <p className="mt-1 max-w-2xl text-[14px] text-[#6b655c]">
              Select questions from your Lecture Lab quizzes or curriculum Question Bank and publish a verified practice set.
            </p>
          </div>

          {/* Destination Switcher */}
          <div className="flex items-center gap-1 rounded-full border border-black/[0.08] bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => {
                setDestination("public");
                setSelectedSpaceId(null);
              }}
              className={`rounded-full px-4 py-2 text-xs font-black transition ${
                destination === "public" ? "bg-[#23201d] text-white" : "text-[#6b655c] hover:bg-black/[0.04]"
              }`}
            >
              🌍 Public Community
            </button>
            <button
              type="button"
              onClick={() => {
                setDestination("space");
                if (!selectedSpaceId && spacesQuery.data && spacesQuery.data.length > 0) {
                  setSelectedSpaceId(spacesQuery.data[0].id);
                }
              }}
              className={`rounded-full px-4 py-2 text-xs font-black transition ${
                destination === "space" ? "bg-[#23201d] text-white" : "text-[#6b655c] hover:bg-black/[0.04]"
              }`}
            >
              🔒 Classroom / Space
            </button>
          </div>
        </div>

        {quota?.isBlocked && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/90 p-4 text-xs font-semibold text-red-800">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <p className="font-bold">Daily sharing limit reached (5/5 items shared today)</p>
              <p className="mt-1 leading-relaxed">
                You have used all 5 sharing slots today. Simply delete an item you shared today in{" "}
                <Link to="/share" className="font-black text-red-900 underline">
                  My Shared Items
                </Link>{" "}
                to immediately recover an upload slot!
              </p>
            </div>
          </div>
        )}

        {/* STEP 1: Two Clean Question Sources (Archive Completely Removed) */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => handleSourceChange("lecture")}
            className={`group flex items-center gap-4 rounded-2xl border p-5 text-left transition-all ${
              sourceType === "lecture"
                ? "border-[#8ec63f] bg-white shadow-md ring-2 ring-[#8ec63f]"
                : "border-black/[0.08] bg-white/70 hover:bg-white hover:border-black/20"
            }`}
          >
            <div
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition ${
                sourceType === "lecture" ? "bg-[#8ec63f] text-white" : "bg-black/[0.05] text-[#23201d]"
              }`}
            >
              <GraduationCap size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-display text-[16px] font-black text-[#23201d]">
                  Lecture Lab Quizzes
                </span>
                {sourceType === "lecture" && (
                  <span className="rounded-full bg-[#8ec63f]/15 px-2 py-0.5 text-[10px] font-black text-[#3d5c14]">
                    Selected
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[12.5px] leading-snug text-[#6b655c]">
                Quizzes and practice questions generated from your lecture summaries.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSourceChange("bank")}
            className={`group flex items-center gap-4 rounded-2xl border p-5 text-left transition-all ${
              sourceType === "bank"
                ? "border-[#6366f1] bg-white shadow-md ring-2 ring-[#6366f1]"
                : "border-black/[0.08] bg-white/70 hover:bg-white hover:border-black/20"
            }`}
          >
            <div
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition ${
                sourceType === "bank" ? "bg-[#6366f1] text-white" : "bg-black/[0.05] text-[#23201d]"
              }`}
            >
              <BookOpen size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-display text-[16px] font-black text-[#23201d]">
                  Question Bank
                </span>
                {sourceType === "bank" && (
                  <span className="rounded-full bg-[#6366f1]/15 px-2 py-0.5 text-[10px] font-black text-[#4338ca]">
                    Selected
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[12.5px] leading-snug text-[#6b655c]">
                Official curriculum questions categorized by medical subject.
              </p>
            </div>
          </button>
        </div>

        {/* STEP 2 & 3: Main Studio Layout */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_370px]">
          {/* Left Column: Select Subjects & Topics */}
          <section className="rounded-[26px] border border-black/[0.07] bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] pb-4">
              <div>
                <h2 className="font-display text-lg font-black text-[#23201d]">
                  Pick Topics to Include
                </h2>
                <p className="mt-0.5 text-xs text-[#6b655c]">
                  Tick subjects to include all questions, or expand to cherry-pick.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllSubjects}
                  className="rounded-full border border-black/[0.1] bg-black/[0.03] px-3.5 py-1.5 text-xs font-black text-[#23201d] transition hover:bg-black/[0.07]"
                >
                  Select All
                </button>
                {pickedItemIds.size > 0 && (
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="rounded-full border border-black/[0.1] px-3.5 py-1.5 text-xs font-bold text-[#8a8376] transition hover:bg-black/[0.04]"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {sourcesQuery.isLoading ? (
              <div className="py-20 text-center text-sm text-[#6b655c]">
                <Loader2 size={24} className="mx-auto mb-3 animate-spin text-[#8ec63f]" />
                Loading questions…
              </div>
            ) : currentNodes.length === 0 ? (
              <div className="py-20 text-center text-[#6b655c]">
                <span className="text-4xl">📭</span>
                <p className="mt-3 font-display text-base font-black text-[#23201d]">No questions found</p>
                <p className="mt-1 text-xs max-w-sm mx-auto">
                  {sourceType === "lecture"
                    ? "You haven't generated any Lecture Lab quizzes yet. Summarize a lecture and generate practice questions to share them!"
                    : "No questions currently found in the central Question Bank."}
                </p>
              </div>
            ) : (
              <div className="mt-4 max-h-[560px] space-y-2.5 overflow-y-auto pr-1">
                {currentNodes.map((node) => {
                  const nodeItemIds = node.items.map((it) => it.id);
                  const selectedCountInNode = node.items.filter((it) => pickedItemIds.has(it.id)).length;
                  const allSelectedInNode = nodeItemIds.length > 0 && selectedCountInNode === nodeItemIds.length;
                  const isExpanded = expandedSubjects.has(node.id);

                  return (
                    <div
                      key={node.id}
                      className={`overflow-hidden rounded-2xl border transition ${
                        allSelectedInNode
                          ? "border-[#8ec63f]/60 bg-[#f8fcf5]"
                          : selectedCountInNode > 0
                            ? "border-black/[0.15] bg-[#fafaf8]"
                            : "border-black/[0.07] bg-white hover:border-black/20"
                      }`}
                    >
                      {/* Subject Header Row */}
                      <div className="flex items-center justify-between px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleSubject(node)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <span
                            className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
                              allSelectedInNode
                                ? "border-[#8ec63f] bg-[#8ec63f] text-white"
                                : selectedCountInNode > 0
                                  ? "border-[#8ec63f] bg-[#8ec63f]/20 text-[#3d5c14]"
                                  : "border-black/25 bg-white"
                            }`}
                          >
                            {(allSelectedInNode || selectedCountInNode > 0) && (
                              <Check size={12} strokeWidth={3} />
                            )}
                          </span>
                          <span className="font-display text-[14.5px] font-black text-[#23201d] truncate">
                            {node.name}
                          </span>
                        </button>

                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-black/[0.05] px-2.5 py-0.5 text-[11px] font-black text-[#6b655c]">
                            {node.totalQuestions} Qs
                          </span>
                          {node.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(node.id)}
                              className="grid h-7 w-7 place-items-center rounded-lg text-[#8a8376] hover:bg-black/[0.05]"
                              aria-label="Toggle subtopics"
                            >
                              {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Subtopics / Lectures Expansion */}
                      {isExpanded && node.items.length > 1 && (
                        <div className="border-t border-black/[0.05] bg-white/60 px-4 py-2 space-y-1">
                          {node.items.map((item) => {
                            const isPicked = pickedItemIds.has(item.id);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => toggleItem(item.id)}
                                className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left transition hover:bg-black/[0.04]"
                              >
                                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                  <span
                                    className={`grid h-4 w-4 shrink-0 place-items-center rounded border transition ${
                                      isPicked
                                        ? "border-[#8ec63f] bg-[#8ec63f] text-white"
                                        : "border-black/20 bg-white"
                                    }`}
                                  >
                                    {isPicked && <Check size={10} strokeWidth={3} />}
                                  </span>
                                  <span className="truncate text-[13px] font-semibold text-[#3d3832]">
                                    {item.title}
                                  </span>
                                </div>
                                <span className="text-[11px] font-bold text-[#8a8376]">
                                  {item.questionCount} Qs
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Right Column: Set Details, Live Preview & Publish */}
          <aside className="space-y-5">
            {/* Live Visual Card Preview */}
            <div
              className="relative flex h-36 flex-col justify-between overflow-hidden rounded-[26px] p-5 shadow-sm"
              style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#23201d]">
                  {sourceType === "lecture" ? "🎓 Lecture Quizzes" : "📚 Question Bank"}
                </span>
                <span className="rounded-full bg-black/25 px-2.5 py-0.5 text-[11px] font-black text-white">
                  {totalSelectedQuestions} Questions
                </span>
              </div>
              <div className="grid place-items-center">
                <span className="text-5xl drop-shadow-sm">{emoji}</span>
              </div>
              <div className="text-center font-display text-[15px] font-black truncate text-[#23201d]">
                {title || (selectedNodes.length > 0 ? `${selectedNodes[0].name} Practice Set` : "Untitled Question Set")}
              </div>
            </div>

            {/* Set Configuration Form */}
            <div className="space-y-4 rounded-[26px] border border-black/[0.07] bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-black text-[#23201d]">
                  Set Details
                </h3>
                {selectedNodes.length > 0 && (
                  <button
                    type="button"
                    onClick={autoFillTitle}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#8ec63f] hover:underline"
                  >
                    <Sparkles size={12} /> Auto-suggest title
                  </button>
                )}
              </div>

              {toSpace && (
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-[#6b655c]">
                    Target Classroom / Space
                  </label>
                  <select
                    value={selectedSpaceId || ""}
                    onChange={(e) => setSelectedSpaceId(e.target.value)}
                    className={`mt-1.5 ${inputClass}`}
                  >
                    {spacesQuery.isLoading ? (
                      <option>Loading spaces…</option>
                    ) : (spacesQuery.data?.length ?? 0) === 0 ? (
                      <option>No spaces found</option>
                    ) : (
                      spacesQuery.data?.map((sp: any) => (
                        <option key={sp.id} value={sp.id}>
                          {sp.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-[#6b655c]">
                  Title
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Cardiology & ECG Bank Review"
                  className={`mt-1.5 ${inputClass}`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-[#6b655c]">
                  Short Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Briefly describe what concepts are covered."
                  rows={2}
                  className={`mt-1.5 ${inputClass} resize-none`}
                />
              </div>

              {!toSpace && (
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-[#6b655c]">
                    Tags (comma separated)
                  </label>
                  <input
                    value={tagText}
                    onChange={(e) => setTagText(e.target.value)}
                    placeholder="cardiology, exam, year3"
                    className={`mt-1.5 ${inputClass}`}
                  />
                </div>
              )}

              {/* Cover Color Picker */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-[#6b655c]">
                  Cover Theme
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(DECK_COVERS).map(([key, v]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCover(key)}
                      aria-label={key}
                      className={`h-7 w-7 rounded-full transition ${
                        cover === key ? "ring-2 ring-[#23201d] ring-offset-2" : "hover:scale-105"
                      }`}
                      style={{ background: `linear-gradient(135deg, ${v.from}, ${v.to})` }}
                    />
                  ))}
                </div>
              </div>

              {/* Emoji Picker */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-[#6b655c]">
                  Emoji Icon
                </label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setEmoji(em)}
                      className={`grid h-8 w-8 place-items-center rounded-xl text-base transition ${
                        emoji === em ? "bg-[#23201d]" : "bg-black/[0.04] hover:bg-black/[0.08]"
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Status Counter */}
              <div className="rounded-2xl bg-[#fbf5e9] px-4 py-3 text-[13px] font-bold text-[#4a453d]">
                {pickedItemIds.size} topics selected · {totalSelectedQuestions} questions
              </div>

              {/* Publish Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={publish}
                  disabled={saving || totalSelectedQuestions === 0 || quota?.isBlocked}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#8ec63f] px-6 py-3.5 text-[15px] font-black text-white shadow-[0_12px_24px_-12px_rgba(142,198,63,0.8)] transition hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                  {saving
                    ? "Publishing…"
                    : quota?.isBlocked
                      ? "Daily Limit Reached (5/5)"
                      : totalSelectedQuestions === 0
                        ? "Pick Topics Above"
                        : toSpace
                          ? `Share to Space (${totalSelectedQuestions} Qs)`
                          : `Publish Questions (${totalSelectedQuestions} Qs)`}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
