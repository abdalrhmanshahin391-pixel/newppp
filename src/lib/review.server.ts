/**
 * Server-side SuperMemo SM-2 Spaced Repetition Scheduler.
 *
 * Grades: 0 Again · 1 Hard · 2 Good · 3 Easy
 *
 * SM-2 Quality Score (q):
 *  - Grade 0 (Again): q = 1 (failure / lapse)
 *  - Grade 1 (Hard):  q = 3 (passed with difficulty)
 *  - Grade 2 (Good):  q = 4 (passed with standard recall)
 *  - Grade 3 (Easy):  q = 5 (effortless, instant recall)
 *
 * Easiness Factor (EF):
 *  EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
 *  Bound: 1.3 <= EF' <= 3.0 (default 2.5)
 *
 * Interval (days):
 *  - If q < 3 (Again):
 *      reps = 0, interval = 10 min (10 / 1440 days)
 *  - If q >= 3:
 *      reps = reps + 1
 *      reps == 1 -> Hard: 1d, Good: 1d, Easy: 4d
 *      reps == 2 -> Hard: 3d, Good: 6d, Easy: 8d
 *      reps > 2  ->
 *        Hard: max(prev + 1, round(prev * 1.2))
 *        Good: max(prev + 1, round(prev * EF))
 *        Easy: max(prev + 2, round(prev * EF * 1.3))
 */

export const DAY = 24 * 60 * 60_000;
export const MIN_MINUTES = 1 / 1440;
export const TEN_MINUTES = 10 / 1440;

/** Same-session steps for a brand-new card, in days. */
export const LEARN_STEPS = [MIN_MINUTES, TEN_MINUTES];
/** Steps a lapsed card walks back through. */
export const RELEARN_STEPS = [TEN_MINUTES];

export const MAX_INTERVAL = 365 * 3;
export const DEFAULT_RETENTION = 0.9;

/** Miss a card this many times and it stops being worth drilling as-is. */
export const LEECH_THRESHOLD = 6;

export type ReviewState = {
  ease: number;
  difficulty: number;
  stability: number;
  interval_days: number;
  reps: number;
  lapses: number;
  step: number;
  state: string;
  due_at: string;
  last_review_at: string;
};

export type PrevState = {
  ease?: number | null;
  difficulty?: number | null;
  stability?: number | null;
  interval_days?: number | null;
  reps?: number | null;
  lapses?: number | null;
  step?: number | null;
  state?: string | null;
  last_review_at?: string | null;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number, p = 4) => Number(v.toFixed(p));

/** ±5% jitter so cards don't all land on the exact same future day. */
function fuzz(days: number, seed: string) {
  if (days < 2.5) return days;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 100000;
  const spread = ((h / 100000) * 2 - 1) * 0.05;
  return days * (1 + spread);
}

export type ScheduleOpts = {
  flagged?: boolean;
  retention?: number;
  now?: number;
  /** Only used for jitter, so the same card always jitters the same way. */
  seed?: string;
};

/**
 * Standard SuperMemo SM-2 Easiness Factor update.
 * EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
 */
export function calculateNextEase(currentEase: number, q: number): number {
  const delta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  return clamp(round(currentEase + delta, 3), 1.3, 3.0);
}

/**
 * Calculate the next review schedule using the SuperMemo SM-2 algorithm.
 */
export function schedule(prev: PrevState, grade: number, opts?: ScheduleOpts): ReviewState {
  const now = opts?.now ?? Date.now();
  const clampedGrade = clamp(Math.round(grade), 0, 3);

  // Map 4 UI grades to SM-2 quality scores (0..5):
  // 0: Again -> 1 (Complete failure / lapse)
  // 1: Hard  -> 3 (Pass with serious effort)
  // 2: Good  -> 4 (Pass with normal effort)
  // 3: Easy  -> 5 (Effortless recall)
  const q = clampedGrade === 0 ? 1 : clampedGrade === 1 ? 3 : clampedGrade === 2 ? 4 : 5;

  const stateIn = prev.state ?? "new";
  let reps = prev.reps ?? 0;
  let lapses = prev.lapses ?? 0;
  let step = prev.step ?? 0;
  const prevEase = clamp(Number(prev.ease ?? 2.5), 1.3, 3.0);
  const prevInterval = Math.max(0, Number(prev.interval_days ?? 0));

  const wasInReview = stateIn === "review" || stateIn === "mastered";

  // Calculate new EF
  const nextEase = calculateNextEase(prevEase, q);

  let interval: number;
  let state: string;

  if (q < 3) {
    // Failure / Again: reset repetitions, mark lapse, and set for immediate review (~10 min)
    if (wasInReview) lapses += 1;
    reps = 0;
    step = 0;
    state = "relearning";
    interval = TEN_MINUTES;
  } else {
    // Success: increment repetition count
    reps += 1;
    step = 0;

    if (reps === 1) {
      // First successful repetition
      interval = clampedGrade === 1 ? 1 : clampedGrade === 2 ? 1 : 4;
    } else if (reps === 2) {
      // Second successful repetition
      interval = clampedGrade === 1 ? 3 : clampedGrade === 2 ? 6 : 8;
    } else {
      // Subsequent repetitions: interval multiplied by EF
      const baseInterval = Math.max(1, prevInterval);
      if (clampedGrade === 1) {
        // Hard: conservative interval growth (1.2x)
        interval = Math.max(baseInterval + 1, round(baseInterval * 1.2, 2));
      } else if (clampedGrade === 2) {
        // Good: standard SM-2 formula (interval * EF)
        interval = Math.max(baseInterval + 1, round(baseInterval * nextEase, 2));
      } else {
        // Easy: boosted interval (interval * EF * 1.3)
        interval = Math.max(baseInterval + 2, round(baseInterval * nextEase * 1.3, 2));
      }
    }

    state = interval >= 21 ? "mastered" : "review";
  }

  // Modifiers for active review states
  if (state === "review" || state === "mastered") {
    // Deterministic jitter for intervals >= 2.5 days
    interval = fuzz(interval, opts?.seed ?? "seed");

    // Flagged cards return twice as often
    if (opts?.flagged) {
      interval = Math.max(1, interval * 0.5);
    }

    // Leech protection: if card failed >= 6 times, cap interval to 7 days
    if (lapses >= LEECH_THRESHOLD && interval > 7) {
      interval = 7;
    }

    interval = clamp(interval, 1, MAX_INTERVAL);
  } else {
    interval = clamp(interval, TEN_MINUTES, MAX_INTERVAL);
  }

  // Derive stability & difficulty metrics for UI bars
  const stability = round(interval, 3);
  const difficulty = round(clamp(10 - (nextEase - 1.3) * (9 / 1.7), 1, 10), 2);

  const dueMs = now + interval * DAY;

  return {
    ease: nextEase,
    difficulty,
    stability,
    interval_days: round(interval, 4),
    reps,
    lapses,
    step,
    state,
    due_at: new Date(dueMs).toISOString(),
    last_review_at: new Date(now).toISOString(),
  };
}

/**
 * Preview intervals for each grade button: [Again, Hard, Good, Easy].
 */
export function previewIntervals(prev: PrevState, opts?: ScheduleOpts) {
  return [0, 1, 2, 3].map((g) => schedule(prev, g, opts).interval_days);
}

/** Plain-language memory strength for the card's badge. */
export function memoryLabel(stabilityOrDays?: number | null) {
  const d = Number(stabilityOrDays ?? 0);
  if (!d || d <= 0) return "brand new";
  if (d < 0.05) return "fragile — 10 min";
  if (d < 1) return "fragile — hours";
  if (d < 7) return `about ${Math.round(d)} day${Math.round(d) === 1 ? "" : "s"}`;
  if (d < 60) return `about ${Math.round(d / 7)} week${Math.round(d / 7) === 1 ? "" : "s"}`;
  if (d < 365) return `about ${Math.round(d / 30)} months`;
  return `over a year`;
}

/** 0..100 memory depth bar. */
export function memoryStrength(stabilityOrDays?: number | null) {
  const d = Number(stabilityOrDays ?? 0);
  if (!d || d <= 0) return 0;
  return clamp(Math.round((Math.log(1 + d) / Math.log(1 + 120)) * 100), 0, 100);
}

/** Compatibility helper. */
export function intervalFor(stability: number, _retention = DEFAULT_RETENTION) {
  return stability;
}

/** Longest run of goal-met (or frozen) days ending today or yesterday. */
export function streakFrom(days: { day: string; goal_met: boolean; frozen: boolean }[]) {
  const met = new Set(days.filter((d) => d.goal_met || d.frozen).map((d) => d.day));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  const cursor = new Date(today);
  if (!met.has(iso(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (met.has(iso(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
