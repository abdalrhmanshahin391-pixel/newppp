/** What the learner has left of this month's Emith (Groq) requests (groq_request_status()). */
export type GroqRequestStatus = {
  unlimited: boolean;
  /** The plan the allowance comes from ("admin" for admins). */
  plan?: string;
  used: number | null;
  /** null: no cap. */
  limit: number | null;
  left: number | null;
  /** "YYYY-MM", Amman time. */
  period: string;
  resetsAt: string | null;
};

/** Below this share of the month's requests the number turns to a warning. */
export const GROQ_LOW_SHARE = 0.1;

export function groqRequestLevel(status: GroqRequestStatus | undefined): "ok" | "low" | "out" {
  if (!status || status.unlimited || status.limit === null || status.left === null) return "ok";
  if (status.left <= 0) return "out";
  return status.left / Math.max(1, status.limit) <= GROQ_LOW_SHARE ? "low" : "ok";
}
