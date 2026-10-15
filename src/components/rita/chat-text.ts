// Display helpers for the chat: which way a message reads, and how its text is
// split into plain words, bold words and foreign-language words. Pure functions,
// no React, so the rules can be tested on their own.

export type TextDirection = "rtl" | "ltr";
export type ChatSegment =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  // A word or phrase in another script inside an Arabic sentence (e.g. German).
  | { kind: "foreign"; value: string };

const ARABIC_LETTER = /[ؠ-يٮ-ۓەۺ-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-ﻼ]/g;
const LATIN_LETTER = /[A-Za-zÀ-ɏ]/g;

const LATIN_WORD = "[A-Za-z\\u00C0-\\u024F][A-Za-z\\u00C0-\\u024F0-9'\\u2019-]*";
// Words separated by single spaces form one phrase: "Good morning, again" is
// two phrases split at the comma, "Guten Morgen" is one.
const LATIN_PHRASE = new RegExp(`${LATIN_WORD}(?: ${LATIN_WORD})*`, "g");

function count(text: string, pattern: RegExp) {
  return text.match(pattern)?.length ?? 0;
}

/** Reads right-to-left when Arabic letters are at least as common as Latin ones. */
export function textDirection(text: string): TextDirection {
  const arabic = count(text, ARABIC_LETTER);
  if (arabic === 0) return "ltr";
  return arabic >= count(text, LATIN_LETTER) ? "rtl" : "ltr";
}

/** Splits on blank or single line breaks; empty lines are dropped. */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitForeign(value: string, direction: TextDirection): ChatSegment[] {
  if (direction !== "rtl") return value ? [{ kind: "text", value }] : [];
  const out: ChatSegment[] = [];
  let last = 0;
  for (const match of value.matchAll(LATIN_PHRASE)) {
    const index = match.index ?? 0;
    if (index > last) out.push({ kind: "text", value: value.slice(last, index) });
    out.push({ kind: "foreign", value: match[0] });
    last = index + match[0].length;
  }
  if (last < value.length) out.push({ kind: "text", value: value.slice(last) });
  return out;
}

/**
 * Turns one paragraph into segments. `**bold**` becomes bold (the asterisks
 * never show, even when unbalanced), and inside a right-to-left paragraph every
 * Latin-script phrase becomes a "foreign" segment so it can be set apart.
 */
export function parseParagraph(paragraph: string, direction: TextDirection): ChatSegment[] {
  const out: ChatSegment[] = [];
  const parts = paragraph.split("**");
  // An odd number of "**" leaves the last bold unclosed: treat it as plain text.
  const balanced = parts.length % 2 === 1;
  parts.forEach((part, index) => {
    if (!part) return;
    const bold = index % 2 === 1 && (balanced || index < parts.length - 1);
    if (!bold) {
      out.push(...splitForeign(part, direction));
    } else if (
      direction === "rtl" &&
      count(part, LATIN_LETTER) > 0 &&
      count(part, ARABIC_LETTER) === 0
    ) {
      out.push({ kind: "foreign", value: part.trim() });
    } else {
      out.push({ kind: "bold", value: part });
    }
  });
  return dropQuotesAroundChips(out);
}

const OPEN_QUOTE = /[\u201C"\u00AB]$/;
const CLOSE_QUOTE = /^[\u201D"\u00BB]/;

/** Quote marks hugging a foreign chip are dropped: the chip already frames the word. */
function dropQuotesAroundChips(segments: ChatSegment[]): ChatSegment[] {
  const out = segments.map((segment) => ({ ...segment }));
  out.forEach((segment, index) => {
    if (segment.kind !== "foreign") return;
    const before = out[index - 1];
    const after = out[index + 1];
    if (before?.kind !== "text" || after?.kind !== "text") return;
    if (!OPEN_QUOTE.test(before.value) || !CLOSE_QUOTE.test(after.value)) return;
    before.value = before.value.replace(OPEN_QUOTE, "");
    after.value = after.value.replace(CLOSE_QUOTE, "");
  });
  return out.filter((segment) => segment.value !== "");
}

/** The live transcript is only shown while it is not already a chat message. */
export function showCaption(caption: string, lastYouText: string | undefined) {
  const clean = caption.trim();
  if (!clean) return false;
  return clean !== (lastYouText ?? "").trim();
}
