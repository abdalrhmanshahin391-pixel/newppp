// How one study request moves on (see useStudyRequests): what Rita's acknowledgements and her
// speaking state do to it. Pure, so the rules are tested with node: an answer about another request
// is ignored, a late one never lands on a newer request, and a call that ends stops a live request.
import type { RitaAction } from "./study-actions.ts";

export type RequestState = "resolving" | "sent" | "started" | "done" | "failed" | "cancelled";

export type ActiveRequest = {
  id: string;
  action: RitaAction;
  quote: string;
  channel: "voice" | "text";
  state: RequestState;
  message?: string;
};

/** Waits for Rita's "started" before saying she is late; then for her first words. */
export const ACK_MS = 3_000;
export const FIRST_AUDIO_MS = 8_000;

export const LATE_MESSAGE = "تأخرت ريتا بالرد. جرّب مرة ثانية.";
export const REFUSED_MESSAGE = "ريتا ما قدرت تجاوب على هالطلب. جرّب مرة ثانية.";

export function isLive(state: RequestState): boolean {
  return state === "resolving" || state === "sent" || state === "started";
}

/** What to do: the new state (and message), and what happens to the waiting timer. */
export type RequestStep = {
  state: RequestState;
  message?: string;
  timer: "clear" | "first_audio" | "keep";
};

/** Rita's "rita-study-ack" about a request. Null when it is not about the current request. */
export function ackStep(
  current: ActiveRequest | null,
  message: Record<string, unknown>,
): RequestStep | null {
  if (message.type !== "rita-study-ack" || !current) return null;
  if (String(message.request_id ?? "") !== current.id) return null;
  if (!isLive(current.state)) return null; // already finished: a late ack changes nothing
  if (message.state === "started") return { state: "started", timer: "first_audio" };
  if (message.state === "failed")
    return { state: "failed", message: REFUSED_MESSAGE, timer: "clear" };
  if (message.state === "cancelled") return { state: "cancelled", timer: "clear" };
  return null;
}

/** Rita's speaking state from the call. Null when it changes nothing. */
export function ritaEventStep(
  current: ActiveRequest | null,
  event: "ready" | "ended" | "speaking" | "quiet",
): RequestStep | null {
  if (!current || current.channel !== "voice") return null;
  if (event === "speaking" && current.state === "started")
    return { state: "started", timer: "clear" };
  if (event === "quiet" && current.state === "started") return { state: "done", timer: "clear" };
  if (event === "ended" && isLive(current.state)) return { state: "cancelled", timer: "clear" };
  return null;
}

/** The learner pressed "Stop", or started a new request: the live one is cancelled. */
export function stopStep(current: ActiveRequest | null): RequestStep | null {
  if (!current || !isLive(current.state)) return null;
  return { state: "cancelled", timer: "clear" };
}
