export type RitaReplyPart =
  | { type: "speech"; text: string }
  | {
      type: "german";
      text: string;
      meaning: string;
      breakdown: Array<{ german: string; meaning: string }>;
    }
  | { type: "note"; text: string };

function clean(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

const ARABIC_RE = /[\u0600-\u06FF]/;
const LATIN_RE = /[A-Za-zÄÖÜäöüß]/;

function parseBreakdown(value: string) {
  return value
    .split(/[;؛،,]/)
    .map((entry) => {
      const at = entry.indexOf("=");
      return at < 0 ? ["", ""] : [clean(entry.slice(0, at)), clean(entry.slice(at + 1))];
    })
    .filter((entry) => entry[0] && entry[1])
    .filter(([german, itemMeaning]) => german.toLowerCase() !== "german" && itemMeaning.toLowerCase() !== "arabic")
    .map(([german, itemMeaning]) => ({ german, meaning: itemMeaning }));
}

/** Keeps only the German words, so Emma never reads Arabic meanings or the written breakdown. */
export function germanSpeechText(value: string) {
  return clean(
    value
      .split(/\|/)[0]
      .replace(/[^\s=;]+=[^;|]*;?/g, " ")
      .replace(/[\u0600-\u06FF]+/g, " ")
      .replace(/[—–]/g, " ")
      .replace(/\s[-:]\s/g, " "),
  ).replace(/^[\s,.;:!?-]+|[\s,;:-]+$/g, "");
}

export function parseRitaReplyLine(line: string): RitaReplyPart | null {
  const value = line.trim();
  if (!value) return null;
  if (value.startsWith("DE:")) {
    const segments = value
      .slice(3)
      .split(/\|{1,2}|\s[—–]\s|\s-\s|[—–]/)
      .map(clean)
      .filter(Boolean);
    let text = "";
    const meanings: string[] = [];
    const breakdown: Array<{ german: string; meaning: string }> = [];
    for (const segment of segments) {
      if (segment.includes("=")) breakdown.push(...parseBreakdown(segment));
      else if (ARABIC_RE.test(segment)) meanings.push(segment);
      else if (LATIN_RE.test(segment) && !text) text = segment;
    }
    text = germanSpeechText(text);
    if (!text) return null;
    return { type: "german", text, meaning: clean(meanings.join(" ")), breakdown };
  }
  if (value.startsWith("NOTE:")) return { type: "note", text: clean(value.slice(5)) };
  if (value.startsWith("AR:")) return { type: "speech", text: clean(value.slice(3)) };
  return { type: "speech", text: clean(value) };
}

const QUOTED_GERMAN_RE = /["“”«»„]([A-Za-zÄÖÜäöüß' ]{3,}?)["“”«»]/g;

export function parseRitaReply(value: string) {
  const parts = value.split(/\n+/).map(parseRitaReplyLine).filter((part): part is RitaReplyPart => Boolean(part));
  const known = new Set(parts.filter((part) => part.type === "german").map((part) => part.text.toLowerCase()));
  const result: RitaReplyPart[] = [];
  for (const part of parts) {
    if (part.type !== "speech") {
      result.push(part);
      continue;
    }
    const lifted: RitaReplyPart[] = [];
    const text = part.text.replace(QUOTED_GERMAN_RE, (match, phrase: string) => {
      const german = clean(phrase);
      if (german.split(" ").length < 2) return match;
      if (!known.has(german.toLowerCase())) {
        known.add(german.toLowerCase());
        lifted.push({ type: "german", text: german, meaning: "", breakdown: [] });
      }
      return "";
    });
    const rest = clean(text).replace(/\s+([،,.؟?!])/g, "$1").replace(/^[،,.\s]+/, "");
    if (rest && /[\p{L}]/u.test(rest)) result.push({ type: "speech", text: rest });
    result.push(...lifted);
  }
  return result;
}

export function serializeRitaReplyPart(part: RitaReplyPart) {
  if (part.type === "speech") return `AR:${part.text}`;
  if (part.type === "note") return `NOTE:${part.text}`;
  const breakdown = part.breakdown.map((item) => `${item.german}=${item.meaning}`).join(";");
  return `DE:${part.text}||${part.meaning}||${breakdown}`;
}

export function plainRitaReply(value: string) {
  return parseRitaReply(value)
    .map((part) =>
      part.type === "german"
        ? `${part.text}${part.meaning ? ` — ${part.meaning}` : ""}`
        : part.text,
    )
    .join("\n");
}

export function speechForRitaPart(part: RitaReplyPart) {
  if (part.type === "note") return null;
  if (part.type === "german") {
    const text = germanSpeechText(part.text);
    return text ? { text, voiceRole: "german" as const } : null;
  }
  return { text: part.text, voiceRole: "arabic" as const };
}