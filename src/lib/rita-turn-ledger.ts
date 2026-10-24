/**
 * The worker sends one small "turn ledger" record when Rita's answer ends or is cut off: who decided
 * the learner had finished, how long it waited, what was read from the turn, how she answered. The
 * page keeps it next to the conversation (as a `turn_ledger` event) so a complaint can be traced to
 * a decision and a build. Only known, short, plain fields are kept, so nothing unexpected (and
 * never what anybody said) is stored from this channel.
 */

export const TURN_LEDGER_TYPE = "rita-turn-ledger";

const NUMBER_FIELDS = [
  "v",
  "turn",
  "wait_ms",
  "resumed",
  "words",
  "cut_after_ms",
  "chars",
  "commit_ms",
  "stt_final_ms",
  "llm_first_ms",
  "tts_bytes_ms",
  "first_audio_ms",
] as const;

const TEXT_FIELDS = [
  "turn_ref",
  "build",
  "stop",
  "lang",
  "lang_src",
  "explain_lang",
  "learn_lang",
  "act",
  "resp",
  "task",
  "route",
  "finish",
  "prompt",
] as const;

const BOOLEAN_FIELDS = ["answered", "interrupted", "how_to_say"] as const;

/** The conversation, the learner's message and Rita's reply this turn belongs to (best effort). */
export type TurnLinks = {
  conversationId?: string | null;
  userMessageId?: string | null;
  replyMessageId?: string | null;
};

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().slice(0, max);
  return text || null;
}

/** The metadata to store for a ledger message, or null when the message is not a ledger. */
export function ledgerMetadata(
  message: unknown,
  links: TurnLinks = {},
): Record<string, unknown> | null {
  if (!message || typeof message !== "object") return null;
  const raw = message as Record<string, unknown>;
  if (raw.type !== TURN_LEDGER_TYPE) return null;
  const turnRef = cleanText(raw.turn_ref, 80);
  if (!turnRef) return null;
  const out: Record<string, unknown> = { turn_ref: turnRef };
  for (const key of NUMBER_FIELDS) {
    const value = raw[key];
    if (typeof value === "number" && Number.isFinite(value)) out[key] = Math.round(value);
  }
  for (const key of TEXT_FIELDS) {
    if (key === "turn_ref") continue;
    const value = cleanText(raw[key], key === "task" ? 80 : 48);
    if (value) out[key] = value;
  }
  for (const key of BOOLEAN_FIELDS) {
    if (typeof raw[key] === "boolean") out[key] = raw[key];
  }
  for (const [key, value] of [
    ["conversationId", links.conversationId],
    ["userMessageId", links.userMessageId],
    ["replyMessageId", links.replyMessageId],
  ] as const) {
    const text = cleanText(value, 64);
    if (text) out[key] = text;
  }
  return out;
}
