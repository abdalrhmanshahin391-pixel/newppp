// A part of Rita's own answer the learner selected (the left column). Pure, tested with node: the
// selected text must really be inside that answer, short enough, and the answer is cut around it
// to the same size as a guide context.
import { MAX_SELECTION_CHARS } from "./study-limits.ts";

export const MAX_REPLY_CONTEXT = 2400;

const LETTER = /\p{L}/u;

/** Spaces folded; the sheet's marks (** | #) left out, as the page shows the sheet without them. */
export function looseText(text: string): string {
  return text.replace(/[*|#]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

export type ReplyQuoteCheck =
  { ok: true; quote: string; context: string } | { ok: false; message: string };

export function checkReplyQuote(quote: string, reply: string): ReplyQuoteCheck {
  const clean = quote.replace(/\s+/g, " ").trim();
  if (!clean || !LETTER.test(clean)) return { ok: false, message: "حدّد كلمة أو جملة من رد ريتا." };
  if (clean.length > MAX_SELECTION_CHARS) return { ok: false, message: "حدّد جزء أصغر من الرد." };
  const answer = reply.replace(/[ \t]+/g, " ").trim();
  const at = looseText(answer).indexOf(looseText(clean));
  if (at < 0) return { ok: false, message: "ما لقيت هاد الجزء برد ريتا. حدّده مرة ثانية." };
  if (answer.length <= MAX_REPLY_CONTEXT) return { ok: true, quote: clean, context: answer };
  // `at` is a position in the loose text; close enough to centre the window on the quote.
  const start = Math.max(
    0,
    Math.min(at - MAX_REPLY_CONTEXT / 3, answer.length - MAX_REPLY_CONTEXT),
  );
  return { ok: true, quote: clean, context: answer.slice(start, start + MAX_REPLY_CONTEXT) };
}
