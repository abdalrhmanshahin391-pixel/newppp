// Tells the page when a turn is too short or too "thinking" to deserve a filler sound.
// A filler such as "مم…" right after "خلص" or "أمم…" would be the wrong human reaction.

const SHORT_WORDS = new Set([
  "خلص",
  "خلاص",
  "وقف",
  "وقفي",
  "كفاية",
  "ستوب",
  "استنى",
  "استني",
  "لحظة",
  "أمم",
  "امم",
  "اممم",
  "يعني",
  "إيه",
  "ايه",
  "آه",
  "اه",
  "أها",
  "اها",
  "نعم",
  "لا",
  "نوب",
  "ناه",
  "تمام",
  "طيب",
  "ماشي",
  "أوكي",
  "stop",
  "enough",
  "wait",
  "um",
  "uh",
  "hmm",
  "yes",
  "yeah",
  "yep",
  "no",
  "nope",
  "ok",
  "okay",
  "ja",
  "nein",
  "äh",
  "ähm",
]);

function words(text: string): string[] {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ً-ٟـ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** True when the learner's last turn is a command, a thinking sound or a very short answer. */
export function skipsFiller(text: string): boolean {
  const parts = words(text);
  if (parts.length === 0) return true;
  if (parts.length >= 4) return false;
  return parts.every((part) => SHORT_WORDS.has(part)) || parts.length < 2;
}
