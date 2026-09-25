import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  EyeOff,
  Eye,
  Plus,
  Search,
  Share2,
  Trash2,
  Layers,
  ListChecks,
  ChevronLeft,
  ChevronRight,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { DeckCard, AuthorChip } from "@/components/share/DeckCard";
import { useAuth } from "@/hooks/useAuth";
import { deleteDeck, fetchFeed, fetchMyDecks, setPublished, getDailyShareQuota } from "@/lib/share-decks";
import {
  coverOf,
  deleteQuestionSet,
  fetchQuestionFeed,
  fetchMyQuestionSets,
  setQuestionSetPublished,
  SOURCE_TYPE_META,
  type SharedQuestionSet,
  type QuestionSourceType,
} from "@/lib/share-questions";

export const Route = createFileRoute("/share/")({
  validateSearch: (s: Record<string, unknown>) => ({
    type: (s.type === "questions" ? "questions" : "flashcards") as "flashcards" | "questions",
  }),
  head: () => ({
    meta: [
      { title: "Shared study materials — flashcards and questions | RitaJet" },
      {
        name: "description",
        content:
          "Browse flashcard decks and question sets shared by students, study them and test your knowledge.",
      },
      { property: "og:title", content: "Shared study materials on RitaJet" },
      {
        property: "og:description",
        content: "Community flashcards and practice question sets you can study anytime.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: SharePage,
});

function SharePage() {
  const { type: initialType } = Route.useSearch();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [mode, setMode] = useState<"flashcards" | "questions">(initialType || "flashcards");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"new" | "top" | "rated" | "size">("new");
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [sourceFilter, setSourceFilter] = useState<QuestionSourceType | "all">("all");
  const [page, setPage] = useState(0);

  // Daily sharing quota query
  const quotaQuery = useQuery({
    queryKey: ["daily-share-quota", user?.id],
    queryFn: () => getDailyShareQuota(user!.id),
    enabled: !!user,
  });

  // Decks queries
  const deckFeed = useQuery({
    queryKey: ["share-feed", search, sort],
    queryFn: () => fetchFeed({ search, sort }),
    enabled: mode === "flashcards",
  });
  const deckMine = useQuery({
    queryKey: ["share-mine", user?.id],
    queryFn: () => fetchMyDecks(user!.id),
    enabled: !!user && mode === "flashcards" && tab === "mine",
  });

  // Questions queries
  const questionFeed = useQuery({
    queryKey: ["qset-feed", search, sort, sourceFilter, page],
    queryFn: () => fetchQuestionFeed({ search, sort, sourceType: sourceFilter, page }),
    enabled: mode === "questions",
  });
  const questionMine = useQuery({
    queryKey: ["qset-mine", user?.id],
    queryFn: () => fetchMyQuestionSets(user!.id),
    enabled: !!user && mode === "questions" && tab === "mine",
  });

  return (
    <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
        {/* Top Header */}
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/70 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-[#7a4b16]">
              <Share2 size={13} /> {mode === "questions" ? "Shared questions" : "Shared flashcards"}
            </span>
            <h1
              className="mt-5 font-display font-black leading-[1.08] tracking-tight"
              style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)" }}
            >
              {mode === "questions"
                ? "Question sets made by students & doctors"
                : "Study decks made by other students"}
            </h1>
            <p className="mt-3 text-lg leading-relaxed text-[#4a453d]">
              {mode === "questions"
                ? "Browse questions from Question Bank and Lecture Lab quizzes. Test your skills in practice mode or save them directly."
                : "Pick a deck, flip through it, and copy it straight into your own subjects — or share yours and let the whole class use it."}
            </p>
          </div>

          {mode === "questions" ? (
            <Link
              data-tour="share-create-btn"
              to="/share/questions/new"
              className="inline-flex items-center gap-2 rounded-full bg-[#8ec63f] px-6 py-3.5 text-[15px] font-black text-white shadow-[0_14px_30px_-16px_rgba(142,198,63,0.9)] transition hover:-translate-y-0.5"
            >
              <Plus size={17} /> Share questions
            </Link>
          ) : (
            <Link
              data-tour="share-create-btn"
              to="/share/new"
              className="inline-flex items-center gap-2 rounded-full bg-[#8ec63f] px-6 py-3.5 text-[15px] font-black text-white shadow-[0_14px_30px_-16px_rgba(142,198,63,0.9)] transition hover:-translate-y-0.5"
            >
              <Plus size={17} /> Share flashcards
            </Link>
          )}
        </div>

        {/* Mode Switcher & Filter Controls Container */}
        <div data-tour="share-filters-switcher" className="mt-8 space-y-4">
          {/* Mode Switcher: Flashcards vs Questions */}
          <div className="flex items-center gap-2 rounded-full border border-black/[0.08] bg-white p-1.5 w-fit shadow-sm">
            <button
              type="button"
              onClick={() => {
                setMode("flashcards");
                setPage(0);
              }}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13.5px] font-black transition ${
                mode === "flashcards"
                  ? "bg-[#23201d] text-white shadow-sm"
                  : "text-[#6b655c] hover:bg-black/[0.04]"
              }`}
            >
              <Layers size={15} /> Flashcards
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("questions");
                setPage(0);
              }}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13.5px] font-black transition ${
                mode === "questions"
                  ? "bg-[#23201d] text-white shadow-sm"
                  : "text-[#6b655c] hover:bg-black/[0.04]"
              }`}
            >
              <ListChecks size={15} /> Questions
            </button>
          </div>

          {/* Filter Controls Row */}
          <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-4 py-2.5 shadow-sm">
            <Search size={15} className="text-[#a29a8d]" />
            <input
              value={search}
              onChange={(e) => {
                setPage(0);
                setSearch(e.target.value);
              }}
              placeholder={mode === "questions" ? "Search question sets…" : "Search decks…"}
              className="w-52 bg-transparent text-sm font-semibold outline-none placeholder:text-[#a29a8d]"
            />
          </div>

          <Seg
            value={tab}
            onChange={(t) => {
              setTab(t);
              setPage(0);
            }}
            options={mode === "questions" ? [["all", "All question sets"], ["mine", "My sets"]] : [["all", "All decks"], ["mine", "My decks"]]}
          />

          {tab === "all" && (
            <Seg
              value={sort}
              onChange={(s) => {
                setSort(s);
                setPage(0);
              }}
              options={[
                ["new", "Newest"],
                ["top", "Most saved"],
                ["rated", "Top rated"],
                ["size", mode === "questions" ? "Most questions" : "Most cards"],
              ]}
            />
          )}

          {/* Question Source Filter (Only for Questions tab) */}
          {mode === "questions" && tab === "all" && (
            <div className="flex items-center gap-1.5 overflow-x-auto rounded-full border border-black/[0.08] bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => {
                  setSourceFilter("all");
                  setPage(0);
                }}
                className={`rounded-full px-3.5 py-1.5 text-[12px] font-black transition ${
                  sourceFilter === "all" ? "bg-[#23201d] text-white" : "text-[#6b655c] hover:bg-black/[0.04]"
                }`}
              >
                All sources
              </button>
              <button
                type="button"
                onClick={() => {
                  setSourceFilter("lecture");
                  setPage(0);
                }}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-black transition ${
                  sourceFilter === "lecture" ? "bg-[#23201d] text-white" : "text-[#6b655c] hover:bg-black/[0.04]"
                }`}
              >
                <span>🎓</span> Lecture Lab
              </button>
              <button
                type="button"
                onClick={() => {
                  setSourceFilter("bank");
                  setPage(0);
                }}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-black transition ${
                  sourceFilter === "bank" ? "bg-[#23201d] text-white" : "text-[#6b655c] hover:bg-black/[0.04]"
                }`}
              >
                <span>📚</span> Question Bank
              </button>
            </div>
          )}
        </div>
        </div>

        {/* Quota dashboard in "My shared items" */}
        {tab === "mine" && user && (
          <div className="mt-8 rounded-2xl border border-black/[0.08] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">📊</span>
                  <h3 className="font-display text-base font-black text-[#23201d]">
                    Daily Sharing Limit: {quotaQuery.data?.usedToday ?? 0} / 5 shared today
                  </h3>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                      quotaQuery.data?.isBlocked
                        ? "bg-red-100 text-red-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {quotaQuery.data?.remaining ?? 5} slots left
                  </span>
                </div>
                <p className="mt-1 max-w-2xl text-xs text-[#6b655c]">
                  You can share up to 5 items daily across flashcards and questions. If you need to upload a new item today after hitting 5/5, simply delete any item you shared today below to immediately recover a sharing slot!
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/share/new"
                  className="rounded-full border border-black/[0.08] bg-[#faf8f5] px-4 py-2 text-xs font-black text-[#23201d] transition hover:bg-black/[0.05]"
                >
                  + New Flashcards
                </Link>
                <Link
                  to="/share/questions/new"
                  className="rounded-full bg-[#8ec63f] px-4 py-2 text-xs font-black text-white transition hover:bg-[#7db534]"
                >
                  + New Questions
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Content Section: Flashcards */}
        {mode === "flashcards" && (
          tab === "all" ? (
            deckFeed.isLoading ? (
              <p className="mt-12 text-[#6b655c]">Loading decks…</p>
            ) : (deckFeed.data?.decks.length ?? 0) === 0 ? (
              <Empty />
            ) : (
              <div data-tour="share-deck-grid" className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {deckFeed.data!.decks.map((d) => (
                  <DeckCard key={d.id} deck={d} author={deckFeed.data!.authors[d.owner_id] ?? null} />
                ))}
              </div>
            )
          ) : !user ? (
            <p className="mt-12 text-[#6b655c]">Sign in to see the decks you shared.</p>
          ) : (deckMine.data?.length ?? 0) === 0 ? (
            <Empty mine />
          ) : (
            <div className="mt-10 space-y-3">
              {deckMine.data!.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-black/[0.07] bg-white px-5 py-4"
                >
                  <span className="text-2xl">{d.emoji || "🃏"}</span>
                  <Link
                    to="/share/$deckId"
                    params={{ deckId: d.id }}
                    className="min-w-0 flex-1 truncate font-display text-[17px] font-black hover:underline"
                  >
                    {d.title}
                  </Link>
                  <span className="text-[13px] font-bold text-[#6b655c]">
                    {d.card_count} cards · {d.save_count} saves
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-black ${
                      d.audience === "space"
                        ? "bg-black/[0.06] text-[#6b655c]"
                        : d.published
                          ? "bg-[#e6f4d8] text-[#3d5c14]"
                          : "bg-black/[0.06] text-[#6b655c]"
                    }`}
                  >
                    {d.audience === "space" ? "Classroom" : d.published ? "Public" : "Hidden"}
                  </span>
                  {d.audience === "public" && (
                    <button
                      onClick={async () => {
                        await setPublished(d.id, !d.published);
                        toast.success(d.published ? "Deck hidden" : "Deck is public again");
                        qc.invalidateQueries({ queryKey: ["share-mine"] });
                        qc.invalidateQueries({ queryKey: ["share-feed"] });
                      }}
                      className="grid h-9 w-9 place-items-center rounded-xl text-[#6b655c] hover:bg-black/[0.06]"
                    >
                      {d.published ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      if (
                        !confirm(
                          `Delete "${d.title}"? Your own cards stay untouched.\n\n✨ Note: If this deck was shared today, deleting it immediately restores 1 slot in your 5/day sharing limit!`,
                        )
                      )
                        return;
                      await deleteDeck(d.id);
                      toast.success("Deck deleted (quota slot restored if shared today)");
                      qc.invalidateQueries({ queryKey: ["share-mine"] });
                      qc.invalidateQueries({ queryKey: ["share-feed"] });
                      qc.invalidateQueries({ queryKey: ["daily-share-quota"] });
                    }}
                    className="grid h-9 w-9 place-items-center rounded-xl text-[#6b655c] hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {/* Content Section: Questions */}
        {mode === "questions" && (
          tab === "all" ? (
            questionFeed.isLoading ? (
              <p className="mt-12 text-[#6b655c]">Loading question sets…</p>
            ) : (questionFeed.data?.sets.length ?? 0) === 0 ? (
              <EmptyQuestions />
            ) : (
              <>
                <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {questionFeed.data!.sets.map((s) => (
                    <QuestionSetCard
                      key={s.id}
                      set={s}
                      author={questionFeed.data!.authors[s.owner_id] ?? null}
                    />
                  ))}
                </div>

                {/* Pagination */}
                <div className="mt-10 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-4 py-2 text-[13px] font-black disabled:opacity-40"
                  >
                    <ChevronLeft size={15} /> Previous
                  </button>
                  <span className="text-[13px] font-bold text-[#6b655c]">Page {page + 1}</span>
                  <button
                    type="button"
                    disabled={!questionFeed.data?.hasMore}
                    onClick={() => setPage((p) => p + 1)}
                    className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-4 py-2 text-[13px] font-black disabled:opacity-40"
                  >
                    Next <ChevronRight size={15} />
                  </button>
                </div>
              </>
            )
          ) : !user ? (
            <p className="mt-12 text-[#6b655c]">Sign in to see the question sets you shared.</p>
          ) : (questionMine.data?.length ?? 0) === 0 ? (
            <EmptyQuestions mine />
          ) : (
            <div className="mt-10 space-y-3">
              {questionMine.data!.map((s) => {
                const sm = SOURCE_TYPE_META[s.source_type || "lecture"];
                return (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center gap-3 rounded-2xl border border-black/[0.07] bg-white px-5 py-4"
                  >
                    <span className="text-2xl">{s.emoji || "❓"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          to="/share/questions/$setId"
                          params={{ setId: s.id }}
                          className="truncate font-display text-[17px] font-black hover:underline"
                        >
                          {s.title}
                        </Link>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${sm.badgeClass}`}
                        >
                          {sm.icon} {sm.label}
                        </span>
                      </div>
                      <p className="text-[12.5px] font-bold text-[#6b655c]">
                        {s.question_count} questions · {s.save_count} saves
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-black ${
                        s.audience === "space"
                          ? "bg-black/[0.06] text-[#6b655c]"
                          : s.published
                            ? "bg-[#e6f4d8] text-[#3d5c14]"
                            : "bg-black/[0.06] text-[#6b655c]"
                      }`}
                    >
                      {s.audience === "space" ? "Classroom" : s.published ? "Public" : "Hidden"}
                    </span>

                    {s.audience === "public" && (
                      <button
                        onClick={async () => {
                          await setQuestionSetPublished(s.id, !s.published);
                          toast.success(s.published ? "Set hidden" : "Set is public again");
                          qc.invalidateQueries({ queryKey: ["qset-mine"] });
                          qc.invalidateQueries({ queryKey: ["qset-feed"] });
                        }}
                        className="grid h-9 w-9 place-items-center rounded-xl text-[#6b655c] hover:bg-black/[0.06]"
                        aria-label={s.published ? "Hide set" : "Publish set"}
                      >
                        {s.published ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    )}

                    <button
                      onClick={async () => {
                        if (
                          !confirm(
                            `Delete "${s.title}"? Your original questions stay untouched.\n\n✨ Note: If this question set was shared today, deleting it immediately restores 1 slot in your 5/day sharing limit!`,
                          )
                        )
                          return;
                        await deleteQuestionSet(s.id);
                        toast.success("Question set deleted (quota slot restored if shared today)");
                        qc.invalidateQueries({ queryKey: ["qset-mine"] });
                        qc.invalidateQueries({ queryKey: ["qset-feed"] });
                        qc.invalidateQueries({ queryKey: ["daily-share-quota"] });
                      }}
                      className="grid h-9 w-9 place-items-center rounded-xl text-[#6b655c] hover:bg-red-50 hover:text-red-600"
                      aria-label="Delete set"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )
        )}
      </main>
    </div>
  );
}

/** Question Set Card with source badge distinction */
export function QuestionSetCard({
  set,
  author,
}: {
  set: SharedQuestionSet;
  author: any;
}) {
  const c = coverOf(set.cover);
  const sourceMeta = SOURCE_TYPE_META[set.source_type || "lecture"];

  return (
    <Link
      to="/share/questions/$setId"
      params={{ setId: set.id }}
      className="group flex flex-col overflow-hidden rounded-[26px] border border-black/[0.07] bg-white shadow-[0_10px_30px_-24px_rgba(0,0,0,0.45)] transition-all duration-300 hover:-translate-y-1"
    >
      <div
        className="relative grid h-28 place-items-center"
        style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
      >
        <span className="text-4xl drop-shadow-sm">{set.emoji || "❓"}</span>

        {/* Top distinction badge */}
        <span
          className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-sky-200 bg-white/95 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-sky-800 shadow-sm"
        >
          ❓ Questions · {sourceMeta.label}
        </span>

        {/* Question count */}
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-black text-[#23201d]">
          <ListChecks size={12} /> {set.question_count}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-[17px] font-black leading-snug tracking-tight text-[#23201d]">
          {set.title}
        </h3>
        {set.description && (
          <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-[#6b655c]">
            {set.description}
          </p>
        )}
        <div className="mt-auto pt-4 flex items-center justify-between">
          <AuthorChip author={author} />
          <div className="flex items-center gap-2">
            {(set.rating_count ?? 0) > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[12px] font-black text-amber-700">
                <Star size={12} className="fill-amber-500 text-amber-500" />
                {Number(set.rating_avg).toFixed(1)}
              </span>
            )}
            {set.save_count > 0 && (
              <span className="text-[11.5px] font-bold text-[#8a8376]">
                {set.save_count} saves
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function Seg<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div className="inline-flex rounded-full border border-black/[0.08] bg-white p-1">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`rounded-full px-4 py-2 text-[13px] font-black transition ${
            value === v ? "bg-[#23201d] text-white" : "text-[#6b655c] hover:bg-black/[0.05]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Empty({ mine }: { mine?: boolean }) {
  return (
    <div className="mt-12 rounded-[28px] border border-dashed border-black/15 bg-white/60 px-8 py-16 text-center">
      <span className="text-4xl">🃏</span>
      <h2 className="mt-4 font-display text-2xl font-black">
        {mine ? "You haven't shared a deck yet" : "No shared decks yet"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[15px] text-[#6b655c]">
        Pick a few of your flashcard subjects and publish them — everyone studying the same topic
        can use them.
      </p>
      <Link
        to="/share/new"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#8ec63f] px-6 py-3 text-sm font-black text-white"
      >
        <Plus size={16} /> Share flashcards
      </Link>
    </div>
  );
}

function EmptyQuestions({ mine }: { mine?: boolean }) {
  return (
    <div className="mt-12 rounded-[28px] border border-dashed border-black/15 bg-white/60 px-8 py-16 text-center">
      <span className="text-4xl">❓</span>
      <h2 className="mt-4 font-display text-2xl font-black">
        {mine ? "You haven't shared a question set yet" : "No shared question sets yet"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[15px] text-[#6b655c]">
        Select questions from Question Bank or Lecture Lab and share them with the RitaJet community.
      </p>
      <Link
        to="/share/questions/new"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#8ec63f] px-6 py-3 text-sm font-black text-white"
      >
        <Plus size={16} /> Share questions
      </Link>
    </div>
  );
}
