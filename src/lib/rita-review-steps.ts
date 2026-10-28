// The admin's "review now" on the conversations page runs in small steps (see
// /api/rita-v3/review): each answer says how far the review got. These rules decide whether to ask
// again, and what the card says. Pure, so they are unit tested with node.

export type StepAnswer = {
  ok?: boolean;
  enabled?: boolean;
  reviewed?: number;
  failed?: number;
  waiting?: number;
  turns?: number;
  finished?: number;
  finalPending?: boolean;
  conversationReviewed?: boolean;
  stopped?: string;
  error?: string;
};

export type StepDecision =
  { next: "again" } | { next: "done" } | { next: "off" } | { next: "stopped"; reason: string };

/** At most this many calls for one conversation in one visit (a long conversation is 40+ replies). */
export const MAX_STEPS = 40;

export function decideStep(answer: StepAnswer | null): StepDecision {
  if (!answer) return { next: "stopped", reason: "No answer from the server." };
  if (answer.enabled === false) return { next: "off" };
  if (answer.stopped) return { next: "stopped", reason: answer.stopped };
  if (answer.ok === false || answer.error) {
    return { next: "stopped", reason: answer.error ?? "The review failed." };
  }
  // Replies were reviewed and the closing work is still to do, or replies are left.
  if (answer.finalPending || (answer.waiting ?? 0) > 0) return { next: "again" };
  // A step that reviewed or retried something may leave a failed reply to try once more.
  if ((answer.reviewed ?? 0) > 0 || (answer.failed ?? 0) > 0) return { next: "again" };
  return { next: "done" };
}

export type ReviewProgress = {
  state: "running" | "done" | "stopped" | "off";
  turns: number;
  finished: number;
  message?: string;
};

/** The line on the conversation card. */
export function progressText(progress: ReviewProgress): string {
  const counted = progress.turns > 0 ? `${progress.finished} of ${progress.turns} replies` : "";
  switch (progress.state) {
    case "running":
      return counted ? `AI review: ${counted} checked…` : "AI review: starting…";
    case "done":
      return counted ? `AI review finished: ${counted}.` : "AI review finished.";
    case "off":
      return "The AI review is switched off (AI analysis switch above).";
    case "stopped":
      return `AI review stopped${counted ? ` at ${counted}` : ""}: ${progress.message ?? "unknown reason"}.`;
  }
}
