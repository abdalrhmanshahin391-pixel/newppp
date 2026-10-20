// "Days in a row" for the learning home. A day counts when the learner did anything: reviewed a
// card, worked on a lesson, or talked to Rita. (The older streak counts only days the daily card
// goal was met in Smart review, which is why it stayed at 0 for most learners.)
// Days are UTC calendar days, the same convention as the study-day records.

const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" (UTC) for an ISO timestamp or a date string; null when it is not a date. */
export function dayKey(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString().slice(0, 10);
}

/** Every distinct active day from any mix of timestamps, ignoring anything unreadable. */
export function activeDays(values: Iterable<unknown>): Set<string> {
  const days = new Set<string>();
  for (const value of values) {
    const key = dayKey(value);
    if (key) days.add(key);
  }
  return days;
}

export type ActivitySummary = {
  /** Consecutive active days ending today, or ending yesterday when today is still open. */
  streak: number;
  /** Whether anything was done today. */
  activeToday: boolean;
};

export function activitySummary(days: Set<string>, now: Date = new Date()): ActivitySummary {
  const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const activeToday = days.has(iso(today));
  let cursor = activeToday ? today : today - DAY_MS;
  let streak = 0;
  while (days.has(iso(cursor))) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return { streak, activeToday };
}
