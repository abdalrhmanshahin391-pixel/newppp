import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FLASHCARD_SUBJECTS_KEY } from "@/lib/use-study-subjects";
import { readCards, useCardsVersion, type FlashCardItem } from "@/lib/use-flashcards";
import {
  studyOverview,
  syncReview,
  type Overview,
  type ReviewRow,
  type StudyPrefs,
} from "@/lib/review.functions";
import { useAuth } from "@/hooks/useAuth";

export type CardRef = { id: string; subject: string; sub: string };
export type QueueItem = { row: ReviewRow; card: FlashCardItem };

/** Every flashcard on this device, tagged with where it lives. */
export function collectAllCards(): { refs: CardRef[]; byId: Map<string, FlashCardItem> } {
  const refs: CardRef[] = [];
  const byId = new Map<string, FlashCardItem>();
  if (typeof window === "undefined") return { refs, byId };
  try {
    const raw = window.localStorage.getItem(FLASHCARD_SUBJECTS_KEY);
    const subjects: { name: string; subs?: { name: string }[] }[] = raw ? JSON.parse(raw) : [];
    for (const subject of subjects ?? []) {
      for (const sub of subject.subs ?? []) {
        for (const card of readCards(subject.name, sub.name)) {
          refs.push({ id: card.id, subject: subject.name, sub: sub.name });
          byId.set(card.id, card);
        }
      }
    }
  } catch {
    /* ignore */
  }
  return { refs, byId };
}

/** Due counts, streak, forecast and today's progress for the signed-in student. */
export function useStudyOverview() {
  const { user } = useAuth();
  const version = useCardsVersion();
  const overview = useServerFn(studyOverview);

  const ids = useMemo(() => {
    void version;
    return collectAllCards().refs.map((r) => r.id);
  }, [version]);

  return useQuery<Overview>({
    queryKey: ["study-overview", user?.id ?? "anon", ids.length],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: () => overview({ data: { cardIds: ids } }),
  });
}

export type ReviewScope = { subject?: string; sub?: string } | undefined;

/**
 * Builds the review queue: everything due right now (oldest first) plus a
 * controlled trickle of brand-new cards, capped by the student's settings.
 * Pass a scope to review one subject only.
 */
export function useReviewQueue(scope?: ReviewScope) {
  const { user } = useAuth();
  const version = useCardsVersion();
  const sync = useServerFn(syncReview);
  const qc = useQueryClient();

  const { refs, byId } = useMemo(() => {
    void version;
    return collectAllCards();
  }, [version]);

  const query = useQuery<{ rows: ReviewRow[]; prefs: StudyPrefs }>({
    queryKey: ["review-sync", user?.id ?? "anon", refs.length],
    enabled: !!user,
    staleTime: 15_000,
    queryFn: () => sync({ data: { cards: refs } }),
  });

  const prefs = query.data?.prefs;

  const built = useMemo(() => {
    const now = Date.now();
    const all = (query.data?.rows ?? []).filter((r) => {
      if (r.suspended) return false;
      if (scope?.subject && r.subject !== scope.subject) return false;
      if (scope?.sub && r.sub_subject !== scope.sub) return false;
      return true;
    });

    const withCard = (r: ReviewRow) => {
      const card = byId.get(r.card_id);
      return card ? { row: r, card } : null;
    };

    const due = all
      .filter((r) => r.state !== "new" && new Date(r.due_at).getTime() <= now)
      .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())
      .map(withCard)
      .filter(Boolean) as QueueItem[];

    const fresh = all
      .filter((r) => r.state === "new")
      .map(withCard)
      .filter(Boolean) as QueueItem[];

    const newCap = prefs?.new_per_day ?? 12;
    const reviewCap = prefs?.review_cap ?? 150;
    const pickedDue = due.slice(0, reviewCap);
    const pickedNew = fresh.slice(0, newCap);

    // Sprinkle new cards through the session instead of dumping them at the end.
    const queue: QueueItem[] = [];
    const gap = pickedNew.length ? Math.max(1, Math.floor(pickedDue.length / pickedNew.length)) : 0;
    let n = 0;
    for (let i = 0; i < pickedDue.length; i++) {
      queue.push(pickedDue[i]!);
      if (gap && (i + 1) % gap === 0 && n < pickedNew.length) queue.push(pickedNew[n++]!);
    }
    while (n < pickedNew.length) queue.push(pickedNew[n++]!);

    return {
      queue,
      dueCount: due.length,
      newCount: fresh.length,
      newToday: pickedNew.length,
      total: all.length,
      learning: all.filter((r) => r.state === "learning" || r.state === "relearning").length,
      mastered: all.filter((r) => r.state === "mastered").length,
    };
  }, [query.data, byId, scope?.subject, scope?.sub, prefs?.new_per_day, prefs?.review_cap]);

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["review-sync"] });
    void qc.invalidateQueries({ queryKey: ["study-overview"] });
  }, [qc]);

  return { ...query, ...built, prefs, refresh };
}

/** Per-subject mastery rings for the subject board. */
export function useSubjectMastery() {
  const { user } = useAuth();
  const version = useCardsVersion();
  const sync = useServerFn(syncReview);

  const refs = useMemo(() => {
    void version;
    return collectAllCards().refs;
  }, [version]);

  const query = useQuery<{ rows: ReviewRow[]; prefs: StudyPrefs }>({
    queryKey: ["review-sync", user?.id ?? "anon", refs.length],
    enabled: !!user,
    staleTime: 15_000,
    queryFn: () => sync({ data: { cards: refs } }),
  });

  return useMemo(() => {
    const now = Date.now();
    const map = new Map<
      string,
      { total: number; due: number; fresh: number; learning: number; mastered: number }
    >();
    for (const r of query.data?.rows ?? []) {
      const key = r.subject || "Unsorted";
      const cur = map.get(key) ?? { total: 0, due: 0, fresh: 0, learning: 0, mastered: 0 };
      cur.total += 1;
      if (r.state === "new") cur.fresh += 1;
      else if (r.state === "mastered") cur.mastered += 1;
      else cur.learning += 1;
      if (r.state !== "new" && new Date(r.due_at).getTime() <= now && !r.suspended) cur.due += 1;
      map.set(key, cur);
    }
    return map;
  }, [query.data]);
}
