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

export function parseRitaReplyLine(line: string): RitaReplyPart | null {
  const value = line.trim();
  if (!value) return null;
  if (value.startsWith("DE:")) {
    const [text = "", meaning = "", rawBreakdown = ""] = value.slice(3).split("||");
    const breakdown = rawBreakdown
      .split(";")
      .map((entry) => entry.split("=").map(clean))
      .filter((entry) => entry[0] && entry[1])
      .filter(([german, itemMeaning]) => german.toLowerCase() !== "german" && itemMeaning.toLowerCase() !== "arabic")
      .map(([german, itemMeaning]) => ({ german, meaning: itemMeaning }));
    if (!clean(text)) return null;
    return { type: "german", text: clean(text), meaning: clean(meaning), breakdown };
  }
  if (value.startsWith("NOTE:")) return { type: "note", text: clean(value.slice(5)) };
  if (value.startsWith("AR:")) return { type: "speech", text: clean(value.slice(3)) };
  return { type: "speech", text: clean(value) };
}

export function parseRitaReply(value: string) {
  return value.split(/\n+/).map(parseRitaReplyLine).filter((part): part is RitaReplyPart => Boolean(part));
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
  return part.type === "note" ? null : { text: part.text, voiceRole: part.type === "german" ? "german" as const : "arabic" as const };
}