// How much a learner may ask on the study page. Generous on purpose: a normal learner never meets
// these; they only stop abuse. The same numbers live in the database function
// rita_study_take_quota (a test keeps the two equal). Admins and previews are never limited.

export const QUOTA_GROUPS = ["explain", "practice", "cards", "report"] as const;
export type QuotaGroup = (typeof QUOTA_GROUPS)[number];

export const STUDY_LIMITS: Record<QuotaGroup, { perMinute: number; perDay: number }> = {
  explain: { perMinute: 20, perDay: 400 },
  practice: { perMinute: 4, perDay: 40 },
  cards: { perMinute: 6, perDay: 60 },
  report: { perMinute: 5, perDay: 30 },
};

export const MAX_SELECTION_CHARS = 600;
export const MAX_NOTE_CHARS = 1000;

/** The kind words a learner sees at a limit: never an error, and reading keeps working. */
export function limitMessage(scope: "minute" | "day"): string {
  return scope === "minute"
    ? "اشتغلت كثير هالدقيقة 👏 ريتا بترجعلك بعد دقيقة. القراءة والصوت العادي شغّالين."
    : "اشتغلت كثير اليوم 👏 هالإجراء بيرجع بكرا. القراءة والصوت العادي شغّالين.";
}
