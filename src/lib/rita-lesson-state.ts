// Small per-conversation lesson state. Computed in the browser, turned into a
// short instruction on the server. Browser-safe: no server imports.

export type RitaLessonState = {
  targetPhrase: string;
  attemptCount: number;
  userSaidUnderstood: boolean;
  frustration: boolean;
  lastBigMistake: string;
};

export const EMPTY_LESSON_STATE: RitaLessonState = {
  targetPhrase: "",
  attemptCount: 0,
  userSaidUnderstood: false,
  frustration: false,
  lastBigMistake: "",
};

const UNDERSTOOD = /(?:^|\s)(?:فهمت|خلص|تمام|اوكي|أوكي|ok|okay|got it|verstanden|alles klar)(?:\s|$|[.!؟?،,])/iu;
const FRUSTRATION = /(?:زهقت|طفشت|مليت|مش قادر|ما بقدر|مش فاهم ولا|تعبت|صعب كثير|i give up|frustrat|so hard)/iu;
const LATIN_PHRASE = /[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß' -]{2,40}/gu;

/** Reduce Arabic/Latin spelling to a rough sound skeleton so "اي كوفين" ≈ "einkaufen". */
const AR_MAP: Record<string, string> = {
  ا: "a", أ: "a", إ: "a", آ: "a", ى: "a", ي: "i", و: "u", ب: "b", ت: "t", ث: "s", ج: "g", ح: "h", خ: "h",
  د: "d", ذ: "z", ر: "r", ز: "z", س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z", ع: "", غ: "g",
  ف: "f", ق: "k", ك: "k", ل: "l", م: "m", ن: "n", ه: "h", ة: "a", ء: "",
};
export function soundKey(text: string) {
  const latin = [...text.toLowerCase()].map((c) => AR_MAP[c] ?? c).join("");
  return latin
    .replace(/[^a-zäöüß]/g, "")
    .replace(/ei|ai|ay|ey/g, "a")
    .replace(/au|ou|ow/g, "a")
    .replace(/[aeiouäöü]+/g, "a")
    .replace(/c/g, "k")
    .replace(/(.)\1+/g, "$1");
}

function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length]!;
}

export function soundsLike(spoken: string, target: string) {
  const a = soundKey(spoken);
  const b = soundKey(target);
  if (!a || !b) return false;
  return distance(a, b) <= Math.max(1, Math.round(b.length * 0.4));
}

function foreignPhrase(text: string) {
  const found = (text.match(LATIN_PHRASE) ?? []).map((s) => s.trim()).filter((s) => s.length >= 3);
  return found[0] ?? "";
}

/** Update the state with the learner's new utterance, before sending it. */
export function nextLessonState(
  prev: RitaLessonState,
  spoken: string,
  lastRitaReply: string,
): RitaLessonState {
  const clean = spoken.replace(/\s+/g, " ").trim();
  const understood = UNDERSTOOD.test(` ${clean} `) && clean.length < 40;
  const frustration = FRUSTRATION.test(clean);
  if (understood) return { ...EMPTY_LESSON_STATE, userSaidUnderstood: true, lastBigMistake: prev.lastBigMistake };
  // Same target again (even if transcribed in Arabic letters) = another attempt.
  if (prev.targetPhrase && clean.length < 50 && soundsLike(clean, prev.targetPhrase)) {
    return { ...prev, attemptCount: prev.attemptCount + 1, userSaidUnderstood: false, frustration };
  }
  const target = foreignPhrase(clean) || (clean.length < 50 ? foreignPhrase(lastRitaReply) : "");
  return {
    targetPhrase: target.slice(0, 60),
    attemptCount: target && soundsLike(clean, target) ? 1 : 0,
    userSaidUnderstood: false,
    frustration,
    lastBigMistake: prev.lastBigMistake,
  };
}

/** Remember a big mistake Rita reacted to (for playful callbacks later). */
export function rememberBigMistake(state: RitaLessonState, spoken: string, reply: string): RitaLessonState {
  if (!/شوو+|يا زلمة|لا لا لا/u.test(reply)) return state;
  return { ...state, lastBigMistake: spoken.slice(0, 120) };
}

function parse(value: unknown): RitaLessonState | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  return {
    targetPhrase: String(v.targetPhrase ?? "").slice(0, 60),
    attemptCount: Math.min(10, Math.max(0, Number(v.attemptCount) || 0)),
    userSaidUnderstood: v.userSaidUnderstood === true,
    frustration: v.frustration === true,
    lastBigMistake: String(v.lastBigMistake ?? "").slice(0, 120),
  };
}

/** Server side: turn the state into a short, strict instruction line block. */
export function lessonStateInstruction(value: unknown, lastReply: string) {
  const s = parse(value);
  const lines: string[] = ["Lesson state for this turn:"];
  if (s?.userSaidUnderstood) lines.push("- The learner just said they understood. Do not correct anything. Move forward with something new.");
  if (s?.frustration) lines.push("- The learner sounds frustrated. No teasing at all this turn. Be calm and supportive.");
  if (s?.targetPhrase && s.attemptCount >= 1) {
    if (s.attemptCount >= 2)
      lines.push(`- This is attempt ${s.attemptCount + 1} on "${s.targetPhrase}". Stop correcting it. Accept it, say the idea arrived, and use it in a new sentence or question.`);
    else
      lines.push(`- Second attempt on "${s.targetPhrase}". Give at most one new hint that differs from before, or accept it if the meaning is clear.`);
  }
  if (s?.lastBigMistake) lines.push(`- Earlier big mistake you may playfully recall only if it happens again: "${s.lastBigMistake}".`);
  if (lastReply) lines.push(`- Your previous reply was: "${lastReply.slice(0, 220)}". Do not repeat it or its correction.`);
  return lines.length > 1 ? lines.join("\n") : "";
}
