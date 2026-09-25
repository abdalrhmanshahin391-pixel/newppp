import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import { z } from "zod";

export type CardRef = { id: string; subject: string; sub: string };

export type ReviewRow = {
  card_id: string;
  subject: string;
  sub_subject: string;
  ease: number;
  difficulty: number | null;
  stability: number | null;
  interval_days: number;
  reps: number;
  lapses: number;
  step: number;
  state: string;
  suspended?: boolean;
  last_review_at?: string | null;
  due_at: string;
  leech?: boolean;
  flagged?: boolean;
  /** Days until the card returns for Again / Hard / Good / Easy. */
  previews?: number[];
};

export type StudyPrefs = {
  daily_goal: number;
  retention: number;
  new_per_day: number;
  review_cap: number;
};

export type Overview = {
  due: number;
  new: number;
  streak: number;
  goal: number;
  today: { cards: number; correct: number; minutes: number; goal_met: boolean };
  week: { day: string; cards: number; goal_met: boolean }[];
  forecast: { day: string; cards: number }[];
  retention: { recalled: number; total: number; percent: number };
  prefs: StudyPrefs;
};

const cardSchema = z.object({
  id: z.string().min(1).max(120),
  subject: z.string().max(120).default(""),
  sub: z.string().max(120).default(""),
});

const todayKey = () => new Date().toISOString().slice(0, 10);

const DEFAULT_PREFS: StudyPrefs = {
  daily_goal: 20,
  retention: 0.9,
  new_per_day: 12,
  review_cap: 150,
};

function readPrefs(row: any): StudyPrefs {
  return {
    daily_goal: row?.daily_goal ?? DEFAULT_PREFS.daily_goal,
    retention: Number(row?.retention ?? DEFAULT_PREFS.retention),
    new_per_day: row?.new_per_day ?? DEFAULT_PREFS.new_per_day,
    review_cap: row?.review_cap ?? DEFAULT_PREFS.review_cap,
  };
}

/**
 * Cards live in the browser, their memory lives here. The client sends its
 * card inventory; we create any missing memory rows and hand back the
 * schedule plus the student's settings so the workspace can build the queue.
 */
export const syncReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cards: z.array(cardSchema).max(4000) }).parse(d))
  .handler(async ({ data, context }): Promise<{ rows: ReviewRow[]; prefs: StudyPrefs }> => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;

    const { data: existing, error } = await supabase
      .from("card_reviews")
      .select(
        "card_id, subject, sub_subject, ease, difficulty, stability, interval_days, reps, lapses, step, state, suspended, leech, last_review_at, due_at",
      )
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    const known = new Map<string, ReviewRow>((existing ?? []).map((r: ReviewRow) => [r.card_id, r]));

    const missing = data.cards.filter((c) => !known.has(c.id));
    if (missing.length) {
      const rows = missing.map((c) => ({
        user_id: userId,
        card_id: c.id,
        subject: c.subject,
        sub_subject: c.sub,
        due_at: new Date().toISOString(),
      }));
      const { error: insErr } = await supabase
        .from("card_reviews")
        .upsert(rows, { onConflict: "user_id,card_id" });
      if (insErr) throw new Error(insErr.message);
      for (const c of missing) {
        known.set(c.id, {
          card_id: c.id,
          subject: c.subject,
          sub_subject: c.sub,
          ease: 2.5,
          difficulty: null,
          stability: null,
          interval_days: 0,
          reps: 0,
          lapses: 0,
          step: 0,
          state: "new",
          suspended: false,
          leech: false,
          last_review_at: null,
          due_at: new Date().toISOString(),
        });
      }
    }

    const [{ data: flags }, { data: prefRow }] = await Promise.all([
      supabase.from("card_flags").select("card_id").eq("user_id", userId),
      supabase
        .from("study_prefs")
        .select("daily_goal, retention, new_per_day, review_cap")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    const prefs = readPrefs(prefRow);
    const flagged = new Set((flags ?? []).map((f: any) => f.card_id as string));

    const { previewIntervals } = await import("@/lib/review.server");
    const ids = new Set(data.cards.map((c) => c.id));

    const rows = [...known.values()]
      .filter((r) => ids.has(r.card_id))
      .map((r) => ({
        ...r,
        flagged: flagged.has(r.card_id),
        previews: previewIntervals(r, {
          flagged: flagged.has(r.card_id),
          retention: prefs.retention,
          seed: r.card_id,
        }),
      }));

    return { rows, prefs };
  });

/** Grade one card: reschedule it, log the answer, move the day totals. */
export const gradeCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cardId: z.string().min(1).max(120),
        subject: z.string().max(120).default(""),
        sub: z.string().max(120).default(""),
        grade: z.number().int().min(0).max(3),
        ms: z.number().int().min(0).max(600_000).default(0),
        flagged: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    const { schedule, streakFrom, memoryLabel, memoryStrength, LEECH_THRESHOLD } = await import(
      "@/lib/review.server"
    );

    const { data: prefRow } = await supabase
      .from("study_prefs")
      .select("daily_goal, retention, new_per_day, review_cap")
      .eq("user_id", userId)
      .maybeSingle();
    const prefs = readPrefs(prefRow);

    const { data: row } = await supabase
      .from("card_reviews")
      .select(
        "ease, difficulty, stability, interval_days, reps, lapses, step, state, last_review_at",
      )
      .eq("user_id", userId)
      .eq("card_id", data.cardId)
      .maybeSingle();

    const prev = {
      ease: row?.ease ?? 2.5,
      difficulty: row?.difficulty ?? null,
      stability: row?.stability ?? null,
      interval_days: Number(row?.interval_days ?? 0),
      reps: row?.reps ?? 0,
      lapses: row?.lapses ?? 0,
      step: row?.step ?? 0,
      state: row?.state ?? "new",
      last_review_at: row?.last_review_at ?? null,
    };

    /** Days since the card was last seen — the "you'd have forgotten this" gap. */
    const elapsedDays = prev.last_review_at
      ? (Date.now() - new Date(prev.last_review_at).getTime()) / 86_400_000
      : 0;

    const next = schedule(prev, data.grade, {
      flagged: data.flagged,
      retention: prefs.retention,
      seed: data.cardId,
    });
    const leech = next.lapses >= LEECH_THRESHOLD;

    const { error: upErr } = await supabase.from("card_reviews").upsert(
      {
        user_id: userId,
        card_id: data.cardId,
        subject: data.subject,
        sub_subject: data.sub,
        ...next,
        leech,
        last_grade: data.grade,
      },
      { onConflict: "user_id,card_id" },
    );
    if (upErr) throw new Error(upErr.message);

    await supabase.from("review_events").insert({
      user_id: userId,
      card_id: data.cardId,
      subject: data.subject,
      grade: data.grade,
      ms: data.ms,
      elapsed_days: Number(elapsedDays.toFixed(3)),
      prev,
    });

    // Day totals
    const day = todayKey();
    const { data: dayRow } = await supabase
      .from("study_days")
      .select("cards, correct, ms")
      .eq("user_id", userId)
      .eq("day", day)
      .maybeSingle();

    const cards = (dayRow?.cards ?? 0) + 1;
    const correct = (dayRow?.correct ?? 0) + (data.grade >= 2 ? 1 : 0);
    await supabase.from("study_days").upsert(
      {
        user_id: userId,
        day,
        cards,
        correct,
        ms: (dayRow?.ms ?? 0) + data.ms,
        goal_met: cards >= prefs.daily_goal,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,day" },
    );

    const { data: days } = await supabase
      .from("study_days")
      .select("day, goal_met, frozen")
      .eq("user_id", userId)
      .order("day", { ascending: false })
      .limit(400);

    return {
      due_at: next.due_at,
      interval_days: next.interval_days,
      state: next.state,
      stability: next.stability,
      difficulty: next.difficulty,
      strength: memoryStrength(next.stability),
      memory: memoryLabel(next.stability),
      /** How long it had been since the last look — used for "save moments". */
      elapsed_days: Number(elapsedDays.toFixed(2)),
      leech,
      today: { cards, correct, goal: prefs.daily_goal, goal_met: cards >= prefs.daily_goal },
      streak: streakFrom(days ?? []),
    };
  });

/** Put the last answer back the way it was — the undo button in a session. */
export const undoLastGrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;

    const { data: ev } = await supabase
      .from("review_events")
      .select("id, card_id, grade, ms, prev, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!ev?.prev) return { ok: false as const };

    const prev = ev.prev as Record<string, unknown>;
    await supabase
      .from("card_reviews")
      .update({
        ease: prev["ease"] ?? 2.5,
        difficulty: prev["difficulty"] ?? null,
        stability: prev["stability"] ?? null,
        interval_days: prev["interval_days"] ?? 0,
        reps: prev["reps"] ?? 0,
        lapses: prev["lapses"] ?? 0,
        step: prev["step"] ?? 0,
        state: prev["state"] ?? "new",
        last_review_at: prev["last_review_at"] ?? null,
        due_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("card_id", ev.card_id);

    await supabase.from("review_events").delete().eq("id", ev.id).eq("user_id", userId);

    const day = todayKey();
    const { data: dayRow } = await supabase
      .from("study_days")
      .select("cards, correct, ms")
      .eq("user_id", userId)
      .eq("day", day)
      .maybeSingle();
    if (dayRow) {
      await supabase
        .from("study_days")
        .update({
          cards: Math.max(0, (dayRow.cards ?? 0) - 1),
          correct: Math.max(0, (dayRow.correct ?? 0) - (ev.grade >= 2 ? 1 : 0)),
          ms: Math.max(0, (dayRow.ms ?? 0) - (ev.ms ?? 0)),
        })
        .eq("user_id", userId)
        .eq("day", day);
    }

    return { ok: true as const, cardId: ev.card_id as string };
  });

/** Pause a card that keeps fighting the student, or bring it back. */
export const setCardSuspended = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ cardId: z.string().min(1).max(120), suspended: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    const { error } = await supabase
      .from("card_reviews")
      .update({ suspended: data.suspended })
      .eq("user_id", userId)
      .eq("card_id", data.cardId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function forecastFrom(rows: { due_at: string; state: string }[], days = 30) {
  const out: { day: string; cards: number }[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const buckets = new Map<string, number>();
  for (const r of rows) {
    if (r.state === "new") continue;
    const d = new Date(r.due_at);
    const key = (d.getTime() < start.getTime() ? start : d).toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, cards: buckets.get(key) ?? 0 });
  }
  return out;
}

/** Header / workspace summary: due count, streak, forecast, true retention. */
export const studyOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ cardIds: z.array(z.string().max(120)).max(4000).default([]) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<Overview> => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    const { streakFrom } = await import("@/lib/review.server");

    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

    const [{ data: rows }, { data: prefRow }, { data: days }, { data: events }] = await Promise.all([
      supabase.from("card_reviews").select("card_id, due_at, state, suspended").eq("user_id", userId),
      supabase
        .from("study_prefs")
        .select("daily_goal, retention, new_per_day, review_cap")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("study_days")
        .select("day, cards, correct, ms, goal_met, frozen")
        .eq("user_id", userId)
        .order("day", { ascending: false })
        .limit(400),
      supabase
        .from("review_events")
        .select("grade, elapsed_days")
        .eq("user_id", userId)
        .gte("created_at", since),
    ]);

    const prefs = readPrefs(prefRow);
    const live = data.cardIds.length ? new Set(data.cardIds) : null;
    const now = Date.now();
    const visible = (rows ?? []).filter(
      (r: any) => !r.suspended && (!live || live.has(r.card_id)),
    );
    const due = visible.filter(
      (r: any) => r.state !== "new" && new Date(r.due_at).getTime() <= now,
    ).length;
    const fresh = visible.filter((r: any) => r.state === "new").length;

    // True retention: of the cards that had actually gone to sleep (a day or
    // more since the last look), how many came back?
    const mature = (events ?? []).filter((e: any) => Number(e.elapsed_days ?? 0) >= 1);
    const recalled = mature.filter((e: any) => e.grade >= 1).length;

    const day = todayKey();
    const today = (days ?? []).find((d: any) => d.day === day);
    const week = (days ?? [])
      .slice(0, 7)
      .map((d: any) => ({ day: d.day, cards: d.cards, goal_met: d.goal_met }))
      .reverse();

    return {
      due,
      new: fresh,
      streak: streakFrom(days ?? []),
      goal: prefs.daily_goal,
      today: {
        cards: today?.cards ?? 0,
        correct: today?.correct ?? 0,
        minutes: Math.round((today?.ms ?? 0) / 60000),
        goal_met: today?.goal_met ?? false,
      },
      week,
      forecast: forecastFrom(visible as any),
      retention: {
        recalled,
        total: mature.length,
        percent: mature.length ? Math.round((recalled / mature.length) * 100) : 0,
      },
      prefs,
    };
  });

export const setStudyPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        goal: z.number().int().min(5).max(300).optional(),
        retention: z.number().min(0.8).max(0.97).optional(),
        newPerDay: z.number().int().min(0).max(200).optional(),
        reviewCap: z.number().int().min(10).max(999).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    const patch: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
    if (data.goal !== undefined) patch["daily_goal"] = data.goal;
    if (data.retention !== undefined) patch["retention"] = data.retention;
    if (data.newPerDay !== undefined) patch["new_per_day"] = data.newPerDay;
    if (data.reviewCap !== undefined) patch["review_cap"] = data.reviewCap;
    const { error } = await supabase.from("study_prefs").upsert(patch, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Kept for older call sites. */
export const setDailyGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ goal: z.number().int().min(5).max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    const { error } = await supabase
      .from("study_prefs")
      .upsert(
        { user_id: userId, daily_goal: data.goal, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type Dashboard = {
  totals: {
    new: number;
    learning: number;
    mastered: number;
    hard: number;
    wrong: number;
    total: number;
  };
  grades: {
    again: number;
    hard: number;
    good: number;
    easy: number;
    total: number;
  };
  stats: {
    avgEase: number;
    totalReviews: number;
    totalMinutes: number;
    totalHours: string;
    goalMetDays: number;
    totalActiveDays: number;
  };
  subjects: { subject: string; reviews: number; accuracy: number; mastered: number }[];
  daily: { day: string; cards: number; correct: number; minutes: number }[];
  heat: { day: string; cards: number }[];
  forecast: { day: string; cards: number }[];
  retention: { recalled: number; total: number; percent: number };
  streak: number;
  goal: number;
};

/** Everything the progress page draws, aggregated server-side. */
export const studyDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Dashboard> => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    const { streakFrom } = await import("@/lib/review.server");

    const since = new Date(Date.now() - 120 * 24 * 3600_000).toISOString();

    const [{ data: rows }, { data: events }, { data: days }, { data: prefRow }] = await Promise.all([
      supabase
        .from("card_reviews")
        .select("subject, state, due_at, suspended, ease, lapses, leech, reps, interval_days")
        .eq("user_id", userId),
      supabase
        .from("review_events")
        .select("subject, grade, elapsed_days, created_at")
        .eq("user_id", userId)
        .gte("created_at", since),
      supabase
        .from("study_days")
        .select("day, cards, correct, ms, goal_met, frozen")
        .eq("user_id", userId)
        .order("day", { ascending: false })
        .limit(400),
      supabase.from("study_prefs").select("daily_goal").eq("user_id", userId).maybeSingle(),
    ]);

    const totals = { new: 0, learning: 0, mastered: 0, hard: 0, wrong: 0, total: 0 };
    const masteredBySubject = new Map<string, number>();
    let totalEaseSum = 0;
    let easeCount = 0;

    for (const r of rows ?? []) {
      totals.total += 1;
      const isMastered = r.state === "mastered" || Number(r.interval_days ?? 0) >= 21;
      const isWrong = Number(r.lapses ?? 0) >= 2 || !!r.leech;
      const isHard = Number(r.lapses ?? 0) === 1 || (Number(r.ease ?? 2.5) < 2.3 && r.state !== "new");

      if (isWrong) totals.wrong += 1;
      if (isHard) totals.hard += 1;

      if (isMastered) {
        totals.mastered += 1;
        masteredBySubject.set(r.subject, (masteredBySubject.get(r.subject) ?? 0) + 1);
      } else if (r.state === "new") {
        totals.new += 1;
      } else {
        totals.learning += 1;
      }

      if (r.state !== "new" && typeof r.ease === "number" && r.ease > 0) {
        totalEaseSum += r.ease;
        easeCount += 1;
      }
    }

    // Grade breakdown from review events: Again (0), Hard (1), Good (2), Easy (3)
    const grades = { again: 0, hard: 0, good: 0, easy: 0, total: 0 };
    const bySubject = new Map<string, { reviews: number; right: number }>();

    for (const e of events ?? []) {
      grades.total += 1;
      if (e.grade === 0) grades.again += 1;
      else if (e.grade === 1) grades.hard += 1;
      else if (e.grade === 2) grades.good += 1;
      else if (e.grade === 3) grades.easy += 1;

      const key = e.subject || "Unsorted";
      const cur = bySubject.get(key) ?? { reviews: 0, right: 0 };
      cur.reviews += 1;
      if (e.grade >= 2) cur.right += 1;
      bySubject.set(key, cur);
    }

    const subjects = [...bySubject.entries()]
      .map(([subject, v]) => ({
        subject,
        reviews: v.reviews,
        accuracy: v.reviews ? Math.round((v.right / v.reviews) * 100) : 0,
        mastered: masteredBySubject.get(subject) ?? 0,
      }))
      .sort((a, b) => b.reviews - a.reviews);

    const daily = (days ?? [])
      .slice(0, 30)
      .map((d: any) => ({
        day: d.day,
        cards: d.cards,
        correct: d.correct,
        minutes: Math.round(d.ms / 60000),
      }))
      .reverse();

    const heat = (days ?? []).map((d: any) => ({ day: d.day, cards: d.cards }));

    const mature = (events ?? []).filter((e: any) => Number(e.elapsed_days ?? 0) >= 1);
    const recalled = mature.filter((e: any) => e.grade >= 1).length;

    const totalMinutes = (days ?? []).reduce((acc: number, d: any) => acc + Math.round((d.ms || 0) / 60000), 0);
    const goalMetDays = (days ?? []).filter((d: any) => d.goal_met).length;

    const stats = {
      avgEase: easeCount ? Number((totalEaseSum / easeCount).toFixed(2)) : 2.5,
      totalReviews: grades.total,
      totalMinutes,
      totalHours: (totalMinutes / 60).toFixed(1),
      goalMetDays,
      totalActiveDays: (days ?? []).length,
    };

    return {
      totals,
      grades,
      stats,
      subjects,
      daily,
      heat,
      forecast: forecastFrom(((rows ?? []) as any[]).filter((r) => !r.suspended)),
      retention: {
        recalled,
        total: mature.length,
        percent: mature.length ? Math.round((recalled / mature.length) * 100) : 0,
      },
      streak: streakFrom(days ?? []),
      goal: prefRow?.daily_goal ?? 20,
    };
  });
