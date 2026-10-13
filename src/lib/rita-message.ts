/**
 * Rich text for the live lesson.
 *
 * The voice model sometimes returns markdown (`**word**`, numbered points on one
 * line). The page must never show those marks, and it must keep Arabic and
 * German in the right visual order. This module turns a raw reply into blocks
 * of display segments. Every foreign-script phrase becomes one isolated
 * left-to-right segment, so punctuation and numbering stay with the phrase
 * they belong to. The spoken text is the same content with all markup removed.
 */

export type Direction = "rtl" | "ltr";
export type TextLang = "ar" | "de" | "en" | "other";

export type TextPart = { text: string; emphasis: boolean };
export type DisplaySegment = {
  text: string;
  lang: TextLang;
  dir: Direction;
  /** The same text split where emphasis starts or stops. */
  parts: TextPart[];
};
export type RichLine = { dir: Direction; segments: DisplaySegment[] };
export type RichBlock =
  | ({ type: "paragraph" } & RichLine)
  | { type: "list"; ordered: boolean; dir: Direction; items: RichLine[] };

export type ParsedRitaText = {
  blocks: RichBlock[];
  /** Clean text with no markup, safe for speech and for storing as the message text. */
  plain: string;
  dir: Direction;
};

const ARABIC_LETTER = /\p{Script=Arabic}/u;
const LATIN_LETTER = /\p{Script=Latin}/u;
const OPENERS = new Set(["(", "[", '"', "“", "«", "‘"]);
const CLOSERS = new Set([")", "]", '"', "”", "»", "’"]);
const SENTENCE_END = new Set([".", "!", "?", "…"]);

const GERMAN_WORDS = new Set([
  "ich",
  "du",
  "er",
  "sie",
  "es",
  "wir",
  "ihr",
  "der",
  "die",
  "das",
  "ein",
  "eine",
  "einen",
  "nicht",
  "bitte",
  "danke",
  "guten",
  "morgen",
  "tag",
  "abend",
  "wie",
  "geht",
  "dir",
  "ihnen",
  "mir",
  "ist",
  "bin",
  "hallo",
  "und",
  "oder",
  "möchte",
  "will",
  "habe",
  "hast",
  "heißt",
  "ja",
  "nein",
  "wo",
  "was",
  "wer",
  "mit",
  "für",
  "auf",
  "zu",
  "gut",
  "sehr",
  "aber",
  "kein",
  "keine",
]);
const ENGLISH_WORDS = new Set([
  "the",
  "is",
  "are",
  "you",
  "i",
  "my",
  "your",
  "what",
  "how",
  "a",
  "an",
  "and",
  "to",
  "of",
  "in",
  "it",
  "this",
  "that",
  "please",
  "thank",
  "thanks",
  "hello",
  "good",
  "morning",
  "not",
  "do",
  "does",
  "can",
  "have",
  "like",
  "want",
  "would",
  "am",
]);

/**
 * Which side the line starts on, like HTML's `dir="auto"`: the first letter decides.
 * An Arabic sentence that carries a long German phrase stays right-to-left.
 */
export function inferDirection(text: string, fallback: Direction = "rtl"): Direction {
  for (const char of text) {
    if (ARABIC_LETTER.test(char)) return "rtl";
    if (LATIN_LETTER.test(char)) return "ltr";
  }
  return fallback;
}

/** German or English for a Latin-script phrase. Used for the `lang` attribute only. */
export function detectLatinLang(text: string, fallback: "de" | "en" = "de"): "de" | "en" {
  if (/[äöüßÄÖÜ]/u.test(text)) return "de";
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  let de = 0;
  let en = 0;
  for (const word of words) {
    if (GERMAN_WORDS.has(word)) de += 1;
    if (ENGLISH_WORDS.has(word)) en += 1;
  }
  if (de > en) return "de";
  if (en > de) return "en";
  return fallback;
}

type Masked = { plain: string; mask: boolean[] };

/** Remove markdown marks and remember which characters were emphasised. */
function parseInline(raw: string): Masked {
  let plain = "";
  const mask: boolean[] = [];
  const push = (text: string, emphasis: boolean) => {
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      // Stray marks (an unclosed `**` while the reply is still streaming) are dropped.
      if (char === "*" || char === "`") continue;
      plain += char;
      mask.push(emphasis);
    }
  };
  const pattern = /(\*\*|__)(.+?)\1|`([^`]+)`|\*([^*\s][^*]*?)\*/gs;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw))) {
    push(raw.slice(last, match.index), false);
    if (match[1]) push(match[2], true);
    else if (match[3] !== undefined) push(match[3], true);
    else push(match[4], true);
    last = match.index + match[0].length;
  }
  push(raw.slice(last), false);
  return { plain, mask };
}

function toParts(plain: string, mask: boolean[], start: number, end: number): TextPart[] {
  const parts: TextPart[] = [];
  let from = start;
  for (let index = start + 1; index <= end; index += 1) {
    if (index === end || mask[index] !== mask[from]) {
      parts.push({ text: plain.slice(from, index), emphasis: mask[from] === true });
      from = index;
    }
  }
  return parts;
}

/** Split into Arabic/neutral stretches and isolated Latin-script phrases. */
function segmentLine(masked: Masked): DisplaySegment[] {
  const { plain, mask } = masked;
  const ranges: { start: number; end: number; latin: boolean }[] = [];
  let cursor = 0;
  let index = 0;
  while (index < plain.length) {
    if (!LATIN_LETTER.test(plain[index])) {
      index += 1;
      continue;
    }
    // A Latin phrase runs until the next Arabic letter.
    let start = index;
    while (start > cursor && OPENERS.has(plain[start - 1])) start -= 1;
    let stop = index;
    let lastCore = index;
    while (stop < plain.length && !ARABIC_LETTER.test(plain[stop])) {
      if (LATIN_LETTER.test(plain[stop]) || (/\d/.test(plain[stop]) && lastCore >= index))
        lastCore = stop;
      stop += 1;
    }
    // Sentence punctuation stays with a phrase of two or more words ("Ich möchte einen Döner.").
    // After a single word ("حرف c.") it belongs to the Arabic sentence around it.
    const words = plain
      .slice(index, lastCore + 1)
      .split(/\s+/u)
      .filter((word) => LATIN_LETTER.test(word)).length;
    const opened = start < index;
    let end = lastCore + 1;
    while (end < stop) {
      const char = plain[end];
      if (CLOSERS.has(char) && opened) end += 1;
      else if (SENTENCE_END.has(char) && words >= 2) end += 1;
      else break;
    }
    if (start > cursor) ranges.push({ start: cursor, end: start, latin: false });
    ranges.push({ start, end, latin: true });
    cursor = end;
    index = end;
  }
  if (cursor < plain.length) ranges.push({ start: cursor, end: plain.length, latin: false });
  return ranges
    .filter((range) => range.end > range.start)
    .map((range) => {
      const text = plain.slice(range.start, range.end);
      const latin = range.latin;
      return {
        text,
        lang: latin ? detectLatinLang(text) : ARABIC_LETTER.test(text) ? "ar" : "other",
        dir: latin ? "ltr" : "rtl",
        parts: toParts(plain, mask, range.start, range.end),
      } satisfies DisplaySegment;
    });
}

function toLine(raw: string): RichLine | null {
  const masked = parseInline(raw.trim());
  if (!masked.plain.trim()) return null;
  return { dir: inferDirection(masked.plain), segments: segmentLine(masked) };
}

const ORDERED_LINE = /^\s*([0-9٠-٩]{1,2})[.)]\s+(.*)$/u;
const BULLET_LINE = /^\s*[-•*]\s+(.*)$/u;
const HEADING = /^\s*#{1,6}\s+/u;

/** "intro: 1. a 2. b 3. c" on one line becomes an intro and three items. */
function splitInlineNumbered(text: string): { intro: string; items: string[] } | null {
  const markers = [...text.matchAll(/(?:^|\s)([0-9٠-٩]{1,2})[.)]\s+(?=\S)/gu)];
  const digit = (value: string) =>
    Number(value.replace(/[٠-٩]/gu, (char) => String(char.charCodeAt(0) - 0x0660)));
  const run: RegExpMatchArray[] = [];
  for (const marker of markers) {
    if (digit(marker[1]) === run.length + 1) run.push(marker);
  }
  if (run.length < 2) return null;
  const items = run.map((marker, position) => {
    const from = (marker.index ?? 0) + marker[0].length;
    const to = position + 1 < run.length ? (run[position + 1].index ?? text.length) : text.length;
    return text.slice(from, to).trim();
  });
  const intro = text.slice(0, run[0].index ?? 0).trim();
  return { intro, items };
}

export function parseRitaText(raw: string): ParsedRitaText {
  const lines = String(raw ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/```/g, "")
    .split("\n");
  const blocks: RichBlock[] = [];
  const pushList = (ordered: boolean, texts: string[]) => {
    const items = texts.map(toLine).filter((line): line is RichLine => line !== null);
    if (!items.length) return;
    const last = blocks[blocks.length - 1];
    if (last?.type === "list" && last.ordered === ordered) {
      last.items.push(...items);
      return;
    }
    const arabic = items.filter((item) => item.dir === "rtl").length;
    blocks.push({ type: "list", ordered, dir: arabic >= items.length / 2 ? "rtl" : "ltr", items });
  };
  const pushParagraph = (text: string) => {
    const line = toLine(text);
    if (line) blocks.push({ type: "paragraph", ...line });
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(HEADING, "");
    if (!line.trim()) continue;
    const ordered = ORDERED_LINE.exec(line);
    if (ordered) {
      pushList(true, [ordered[2]]);
      continue;
    }
    const bullet = BULLET_LINE.exec(line);
    if (bullet) {
      pushList(false, [bullet[1]]);
      continue;
    }
    const inline = splitInlineNumbered(line);
    if (inline) {
      if (inline.intro) pushParagraph(inline.intro);
      pushList(true, inline.items);
      continue;
    }
    pushParagraph(line);
  }

  const textOf = (line: RichLine) => line.segments.map((segment) => segment.text).join("");
  const plain = blocks
    .map((block) =>
      block.type === "paragraph"
        ? textOf(block)
        : block.items
            .map((item, index) => `${block.ordered ? `${index + 1}. ` : "• "}${textOf(item)}`)
            .join("\n"),
    )
    .join("\n")
    .trim();
  return { blocks, plain, dir: inferDirection(plain) };
}

/** The text with all markup removed: what is stored and what is safe to speak. */
export function spokenTextOf(raw: string): string {
  return parseRitaText(raw).plain;
}
