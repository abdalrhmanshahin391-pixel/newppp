import { supabase } from "@/integrations/supabase/legacy-client";
import { fetchAuthors, type DeckAuthor, DECK_COVERS, coverOf, getDailyShareQuota, type DailyShareQuota } from "@/lib/share-decks";

const db = (t: string) => (supabase.from as any)(t);

/** Question source categories with distinct identities */
export type QuestionSourceType = "bank" | "archive" | "lecture" | "mixed";

/** Who a shared question set is for: one classroom/group, or everyone on RitaJet. */
export type SetAudience = "space" | "public";

export type SharedQuestionSet = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  source_type: QuestionSourceType;
  subject: string | null;
  cover: string;
  emoji: string | null;
  tags: string[];
  question_count: number;
  save_count: number;
  rating_avg?: number;
  rating_count?: number;
  published: boolean;
  audience: SetAudience;
  created_at: string;
  updated_at?: string;
};

export type QuestionOption = {
  letter?: string;
  text: string;
  is_correct?: boolean;
  correct?: boolean;
  explanation?: string;
};

export type SharedQuestionItem = {
  id: string;
  set_id: string;
  owner_id: string;
  source_type: QuestionSourceType;
  subject: string | null;
  subtopic: string | null;
  stem: string;
  options: QuestionOption[];
  explanation: string;
  sort: number;
  created_at?: string;
};

export const SOURCE_TYPE_META: Record<
  QuestionSourceType,
  { label: string; icon: string; badgeClass: string; desc: string }
> = {
  bank: {
    label: "Question Bank",
    icon: "📚",
    badgeClass: "bg-indigo-500/10 text-indigo-800 border-indigo-200/80",
    desc: "Central curriculum & exam practice question bank",
  },
  archive: {
    label: "Archive Exam",
    icon: "🏛️",
    badgeClass: "bg-amber-500/10 text-amber-800 border-amber-200/80",
    desc: "Past papers and AI-verified archive questions",
  },
  lecture: {
    label: "Lecture Lab",
    icon: "🎓",
    badgeClass: "bg-emerald-500/10 text-emerald-800 border-emerald-200/80",
    desc: "Lecture quizzes & topic-based study questions",
  },
  mixed: {
    label: "Multi-Source",
    icon: "✨",
    badgeClass: "bg-purple-500/10 text-purple-800 border-purple-200/80",
    desc: "Composite questions from multiple sources",
  },
};

export const PAGE_SIZE = 24;
export const QUESTION_PAGE = 25;

export type { DeckAuthor };
export { DECK_COVERS, coverOf };

/** One page of the public question-set feed. */
export async function fetchQuestionFeed(opts: {
  search?: string;
  sort?: "new" | "top" | "rated" | "size";
  sourceType?: QuestionSourceType | "all";
  tag?: string;
  page?: number;
}) {
  const page = Math.max(0, opts.page ?? 0);
  let q = db("shared_question_sets")
    .select("*")
    .eq("published", true)
    .eq("audience", "public");

  if (opts.search?.trim()) {
    q = q.ilike("title", `%${opts.search.trim()}%`);
  }
  if (opts.sourceType && opts.sourceType !== "all") {
    q = q.eq("source_type", opts.sourceType);
  }
  if (opts.tag) {
    q = q.contains("tags", [opts.tag]);
  }

  if (opts.sort === "top") {
    q = q.order("save_count", { ascending: false });
  } else if (opts.sort === "rated") {
    q = q.order("rating_avg", { ascending: false }).order("save_count", { ascending: false });
  } else if (opts.sort === "size") {
    q = q.order("question_count", { ascending: false });
  } else {
    q = q.order("created_at", { ascending: false });
  }

  const { data, error } = await q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (error) throw error;
  const sets = (data ?? []) as SharedQuestionSet[];
  const authors = await fetchAuthors(sets.map((s) => s.owner_id));
  return { sets, authors, hasMore: sets.length === PAGE_SIZE, page };
}

export async function fetchMyQuestionSets(userId: string) {
  const { data, error } = await db("shared_question_sets")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .range(0, 199);
  if (error) throw error;
  return (data ?? []) as SharedQuestionSet[];
}

export async function fetchQuestionSet(id: string) {
  const { data, error } = await db("shared_question_sets").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const set = data as SharedQuestionSet;
  const authors = await fetchAuthors([set.owner_id]);
  return { set, author: authors[set.owner_id] ?? null };
}

/** One page of questions inside a set. */
export async function fetchQuestionPage(setId: string, page: number) {
  const from = page * QUESTION_PAGE;
  const { data, error } = await db("shared_question_items")
    .select("*")
    .eq("set_id", setId)
    .order("sort", { ascending: true })
    .range(from, from + QUESTION_PAGE - 1);
  if (error) throw error;
  return (data ?? []) as SharedQuestionItem[];
}

/** Fetch all questions in a set for practice/quiz mode. */
export async function fetchAllSetQuestions(setId: string) {
  const { data, error } = await db("shared_question_items")
    .select("*")
    .eq("set_id", setId)
    .order("sort", { ascending: true })
    .range(0, 499);
  if (error) throw error;
  return (data ?? []) as SharedQuestionItem[];
}

/**
 * Publishes questions from Bank, Archive, or Lecture Lab as a shared question set.
 */
export async function publishQuestionSet(input: {
  title: string;
  description: string;
  source_type: QuestionSourceType;
  subject?: string | null;
  cover: string;
  emoji: string | null;
  tags: string[];
  questions: {
    stem: string;
    options: any[];
    explanation?: string;
    subject?: string;
    subtopic?: string;
    source_type?: QuestionSourceType;
  }[];
  spaceId?: string | null;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in");
  if (!input.questions || input.questions.length === 0) {
    throw new Error("Pick at least one subject or lecture that has questions");
  }

  const quota = await getDailyShareQuota(uid);
  if (quota.isBlocked) {
    throw new Error(
      "Daily sharing limit reached (5/5 items today). Delete an item you shared today to free up a slot."
    );
  }

  const toSpace = !!input.spaceId;
  const { data: set, error } = await db("shared_question_sets")
    .insert({
      owner_id: uid,
      title: input.title.trim(),
      description: input.description.trim() || null,
      source_type: input.source_type,
      subject: input.subject || null,
      cover: input.cover,
      emoji: input.emoji,
      tags: toSpace ? [] : input.tags,
      question_count: input.questions.length,
      audience: toSpace ? "space" : "public",
      published: !toSpace,
    })
    .select("id")
    .single();
  if (error) throw error;

  const rows = input.questions.map((q, i) => ({
    set_id: set.id,
    owner_id: uid,
    source_type: q.source_type || input.source_type,
    subject: q.subject || input.subject || null,
    subtopic: q.subtopic || null,
    stem: q.stem,
    options: q.options ?? [],
    explanation: q.explanation ?? "",
    sort: i,
  }));

  for (let i = 0; i < rows.length; i += 500) {
    const { error: insErr } = await db("shared_question_items").insert(rows.slice(i, i + 500));
    if (insErr) throw insErr;
  }

  if (input.spaceId) {
    const { error: spErr } = await db("space_question_sets").insert({
      space_id: input.spaceId,
      set_id: set.id,
      added_by: uid,
    });
    if (spErr) throw spErr;
  }
  return set.id as string;
}

export async function setQuestionSetPublished(setId: string, published: boolean) {
  const { data, error } = await db("shared_question_sets")
    .update({ published })
    .eq("id", setId)
    .select("id");
  if (error) throw error;
  if (!(data ?? []).length) throw new Error("Only the student who shared this set can change it.");
}

export async function deleteQuestionSet(setId: string) {
  const { data, error } = await db("shared_question_sets").delete().eq("id", setId).select("id");
  if (error) throw error;
  if (!(data ?? []).length) throw new Error("Only the student who shared this set can delete it.");
}

/** Move question set between public feed and classroom space */
export async function setQuestionSetAudience(setId: string, audience: SetAudience) {
  const { data, error } = await db("shared_question_sets")
    .update({ audience, published: audience === "public" })
    .eq("id", setId)
    .select("id");
  if (error) throw error;
  if (!(data ?? []).length) throw new Error("Only the student who shared this set can change it.");
}

export type QuestionSetRatingSummary = {
  avg: number;
  count: number;
  mine: { stars: number; note: string | null } | null;
  breakdown: Record<string, number>;
};

export async function fetchQuestionSetRating(setId: string, spaceId?: string | null): Promise<QuestionSetRatingSummary> {
  const { data, error } = await (supabase.rpc as any)("question_set_rating_summary", {
    _set_id: setId,
    _space_id: spaceId ?? null,
  });
  if (error) throw error;
  return (data ?? { avg: 0, count: 0, mine: null, breakdown: {} }) as QuestionSetRatingSummary;
}

export async function rateQuestionSet(
  setId: string,
  stars: number,
  note?: string,
  spaceId?: string | null,
) {
  const { error } = await (supabase.rpc as any)("rate_question_set", {
    _set_id: setId,
    _stars: stars,
    _note: note?.trim() || null,
    _space_id: spaceId ?? null,
  });
  if (error) throw error;
}

/** Check if user has saved this question set. */
export async function isQuestionSetSaved(setId: string, userId: string) {
  const { data } = await db("shared_question_saves")
    .select("set_id")
    .eq("set_id", setId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

/** Save a question set into user's personal saves and bump counter. */
export async function saveQuestionSet(setId: string) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in");

  await db("shared_question_saves").upsert({ set_id: setId, user_id: uid });
  await (supabase as any).rpc("bump_question_set_saves", { _set_id: setId });
}

/** Question sets that were added into one classroom or study group. */
export async function fetchSpaceQuestionSets(spaceId: string) {
  const { data, error } = await db("space_question_sets")
    .select("set_id, created_at")
    .eq("space_id", spaceId)
    .order("created_at", { ascending: false })
    .range(0, 199);
  if (error) throw error;
  const ids = ((data ?? []) as { set_id: string }[]).map((r) => r.set_id);
  if (ids.length === 0) return [] as SharedQuestionSet[];
  const { data: sets } = await db("shared_question_sets").select("*").in("id", ids);
  return (sets ?? []) as SharedQuestionSet[];
}

export async function removeQuestionSetFromSpace(spaceId: string, setId: string) {
  const { error } = await db("space_question_sets")
    .delete()
    .eq("space_id", spaceId)
    .eq("set_id", setId);
  if (error) throw error;
}

/** Represents a selectable topic/group of questions inside a subject */
export type SelectableItem = {
  id: string;
  title: string;
  questionCount: number;
  questions?: {
    id: string;
    stem: string;
    options: any[];
    explanation?: string;
  }[];
};

/** Represents a subject in the tree with its sub-items */
export type QuestionSubjectNode = {
  id: string;
  name: string;
  sourceType: QuestionSourceType;
  items: SelectableItem[];
  totalQuestions: number;
};

/**
 * Loads available subjects and questions for a user from the 3 distinct sources:
 * 1. Question Bank
 * 2. Archive Questions
 * 3. Lecture Lab Quizzes
 */
export async function fetchUserQuestionSources(userId: string): Promise<{
  bank: QuestionSubjectNode[];
  archive: QuestionSubjectNode[];
  lecture: QuestionSubjectNode[];
}> {
  // 1. Fetch Question Bank subjects & questions
  const { data: bankSubs } = await db("subjects")
    .select("id, name")
    .order("name", { ascending: true });

  const bankNodes: QuestionSubjectNode[] = [];
  if (bankSubs && bankSubs.length > 0) {
    const subIds = bankSubs.map((s: any) => s.id);
    const { data: bankQs } = await db("questions")
      .select("id, subject_id, stem, explanation")
      .in("subject_id", subIds)
      .limit(1000);

    const qsBySub: Record<string, any[]> = {};
    for (const q of (bankQs ?? []) as any[]) {
      if (!qsBySub[q.subject_id]) qsBySub[q.subject_id] = [];
      qsBySub[q.subject_id].push(q);
    }

    for (const s of bankSubs as any[]) {
      const qs = qsBySub[s.id] ?? [];
      if (qs.length > 0) {
        bankNodes.push({
          id: s.id,
          name: s.name,
          sourceType: "bank",
          totalQuestions: qs.length,
          items: [
            {
              id: s.id,
              title: "All Questions",
              questionCount: qs.length,
              questions: qs.map((q) => ({
                id: q.id,
                stem: q.stem,
                options: [],
                explanation: q.explanation || "",
              })),
            },
          ],
        });
      }
    }
  }

  // 2. Archive source disabled per user directive (archive removed)
  const archiveNodes: QuestionSubjectNode[] = [];

  // 3. Fetch Lecture Lab questions
  const { data: lqSubs } = await db("lq_subjects")
    .select("id, name")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  const { data: lqTopics } = await db("lq_subtopics")
    .select("id, subject_id, name")
    .eq("user_id", userId);

  const { data: lqLecs } = await db("lq_lectures")
    .select("id, subtopic_id, title, question_count")
    .eq("user_id", userId);

  const lectureNodes: QuestionSubjectNode[] = [];
  if (lqSubs && lqSubs.length > 0) {
    const lecsByTopic: Record<string, any[]> = {};
    for (const l of (lqLecs ?? []) as any[]) {
      if (!lecsByTopic[l.subtopic_id]) lecsByTopic[l.subtopic_id] = [];
      lecsByTopic[l.subtopic_id].push(l);
    }

    const topicsBySub: Record<string, any[]> = {};
    for (const t of (lqTopics ?? []) as any[]) {
      if (!topicsBySub[t.subject_id]) topicsBySub[t.subject_id] = [];
      topicsBySub[t.subject_id].push(t);
    }

    for (const s of lqSubs as any[]) {
      const subtopics = topicsBySub[s.id] ?? [];
      const items: SelectableItem[] = [];
      let total = 0;

      for (const t of subtopics) {
        const lectures = lecsByTopic[t.id] ?? [];
        for (const l of lectures) {
          const count = l.question_count || 0;
          total += count;
          items.push({
            id: l.id,
            title: `${t.name} · ${l.title}`,
            questionCount: count,
          });
        }
      }

      if (items.length > 0) {
        lectureNodes.push({
          id: s.id,
          name: s.name,
          sourceType: "lecture",
          items,
          totalQuestions: total,
        });
      }
    }
  }

  return {
    bank: bankNodes,
    archive: archiveNodes,
    lecture: lectureNodes,
  };
}

/** Load full questions for specific selected items (lectures, bank subjects, archive topics) */
export async function fetchQuestionsForPublish(
  sourceType: QuestionSourceType,
  selectedIds: string[],
): Promise<{ stem: string; options: any[]; explanation: string; subject?: string; subtopic?: string }[]> {
  if (selectedIds.length === 0) return [];

  if (sourceType === "lecture") {
    // selectedIds are lecture_ids
    const { data: qs, error } = await db("lq_questions")
      .select("stem, options, explanation, sort_order")
      .in("lecture_id", selectedIds)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (qs ?? []).map((q: any) => ({
      stem: q.stem,
      options: q.options || [],
      explanation: q.explanation || "",
    }));
  }

  if (sourceType === "bank") {
    // selectedIds are subject_ids
    const { data: qs, error } = await db("questions")
      .select("id, stem, explanation, subject_id")
      .in("subject_id", selectedIds)
      .limit(1000);
    if (error) throw error;

    const qIds = (qs ?? []).map((q: any) => q.id);
    let optionsByQ: Record<string, any[]> = {};
    if (qIds.length > 0) {
      const { data: opts } = await db("question_options")
        .select("question_id, text, is_correct, sort_order")
        .in("question_id", qIds)
        .order("sort_order", { ascending: true });
      for (const opt of (opts ?? []) as any[]) {
        if (!optionsByQ[opt.question_id]) optionsByQ[opt.question_id] = [];
        optionsByQ[opt.question_id].push({
          text: opt.text,
          is_correct: !!opt.is_correct,
        });
      }
    }

    return (qs ?? []).map((q: any) => ({
      stem: q.stem,
      options: optionsByQ[q.id] || [],
      explanation: q.explanation || "",
    }));
  }

  if (sourceType === "archive") {
    // selectedIds are formatted as `${subject}:::${subtopic}`
    const pairs = selectedIds.map((id) => {
      const [subj, subtop] = id.split(":::");
      return { subj, subtop };
    });

    const subjects = [...new Set(pairs.map((p) => p.subj))];
    const { data: qs, error } = await db("study_questions")
      .select("stem, options, explanation, subject, subtopic")
      .in("subject", subjects)
      .limit(1000);
    if (error) throw error;

    const matched = (qs ?? []).filter((q: any) =>
      selectedIds.includes(`${q.subject}:::${q.subtopic}`),
    );

    return matched.map((q: any) => ({
      stem: q.stem,
      options: q.options || [],
      explanation: q.explanation || "",
      subject: q.subject,
      subtopic: q.subtopic,
    }));
  }

  return [];
}
