// Repeat: which words of the sentence the learner has said so far. Pure: no DOM.
// Words are matched in order (the learner reads the sentence from the start), forgiving small
// slips of the speech recogniser: contractions ("I'm" = "I am"), numbers ("10" = "ten"),
// common homophones ("hear" = "here") and near spellings of longer words.

/** One word of the sentence as shown on the card, with the spoken forms it stands for. */
export type SentenceWord = {
  /** As written, with its punctuation ("fine,"). */
  text: string;
  /** Lower-case spoken tokens ("I'm" -> ["i", "am"]); empty for a lone punctuation mark. */
  keys: string[];
};

const CONTRACTIONS: Record<string, string[]> = {
  "i'm": ["i", "am"],
  "you're": ["you", "are"],
  "we're": ["we", "are"],
  "they're": ["they", "are"],
  "he's": ["he", "is"],
  "she's": ["she", "is"],
  "it's": ["it", "is"],
  "that's": ["that", "is"],
  "there's": ["there", "is"],
  "what's": ["what", "is"],
  "where's": ["where", "is"],
  "who's": ["who", "is"],
  "how's": ["how", "is"],
  "let's": ["let", "us"],
  "i've": ["i", "have"],
  "you've": ["you", "have"],
  "we've": ["we", "have"],
  "they've": ["they", "have"],
  "i'll": ["i", "will"],
  "you'll": ["you", "will"],
  "we'll": ["we", "will"],
  "they'll": ["they", "will"],
  "he'll": ["he", "will"],
  "she'll": ["she", "will"],
  "it'll": ["it", "will"],
  "i'd": ["i", "would"],
  "you'd": ["you", "would"],
  "we'd": ["we", "would"],
  "they'd": ["they", "would"],
  "don't": ["do", "not"],
  "doesn't": ["does", "not"],
  "didn't": ["did", "not"],
  "isn't": ["is", "not"],
  "aren't": ["are", "not"],
  "wasn't": ["was", "not"],
  "weren't": ["were", "not"],
  "can't": ["can", "not"],
  cannot: ["can", "not"],
  "couldn't": ["could", "not"],
  "won't": ["will", "not"],
  "wouldn't": ["would", "not"],
  "shouldn't": ["should", "not"],
  "haven't": ["have", "not"],
  "hasn't": ["has", "not"],
  gonna: ["going", "to"],
  wanna: ["want", "to"],
};

const NUMBERS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
];

/** Words the recogniser cannot tell apart: any one of a group counts for the others. */
const SOUND_ALIKE = [
  ["to", "too", "two"],
  ["for", "four"],
  ["here", "hear"],
  ["there", "their"],
  ["right", "write"],
  ["know", "no"],
  ["new", "knew"],
  ["see", "sea"],
  ["by", "buy", "bye"],
  ["one", "won"],
  ["eight", "ate"],
  ["hour", "our"],
  ["weak", "week"],
  ["meet", "meat"],
  ["red", "read"],
  ["son", "sun"],
  ["wait", "weight"],
  ["where", "wear"],
  ["whole", "hole"],
  ["okay", "ok"],
  ["mr", "mister"],
  ["mrs", "missus"],
];
const ALIKE = new Map<string, Set<string>>();
for (const group of SOUND_ALIKE) {
  for (const word of group) {
    const set = ALIKE.get(word) ?? new Set<string>();
    group.forEach((other) => set.add(other));
    ALIKE.set(word, set);
  }
}

/** Lower-case spoken tokens of a piece of text. */
export function spokenTokens(text: string): string[] {
  const out: string[] = [];
  const cleaned = text
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^\p{L}\p{N}'\s-]/gu, " ")
    .replace(/-/g, " ");
  for (const raw of cleaned.split(/\s+/)) {
    const word = raw.replace(/^'+|'+$/g, "");
    if (!word) continue;
    const expanded = CONTRACTIONS[word];
    if (expanded) {
      out.push(...expanded);
      continue;
    }
    if (/^\d+$/.test(word) && Number(word) <= 20) {
      out.push(NUMBERS[Number(word)]);
      continue;
    }
    if (word === "ok") {
      out.push("okay");
      continue;
    }
    // "dog's" / "James'": the recogniser often drops the possessive mark.
    out.push(word.replace(/'s$/, "s").replace(/'/g, ""));
  }
  return out;
}

/** The sentence split into the words shown on the card. */
export function sentenceWords(sentence: string): SentenceWord[] {
  return sentence
    .split(/\s+/)
    .filter(Boolean)
    .map((text) => ({ text, keys: spokenTokens(text) }));
}

function distance(a: string, b: string): number {
  if (a === b) return 0;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const kept = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = kept;
    }
  }
  return row[b.length];
}

/** Whether a heard token counts as the expected one. */
export function sameWord(expected: string, heard: string): boolean {
  if (expected === heard) return true;
  if (ALIKE.get(expected)?.has(heard)) return true;
  // Plural / -s slips ("game" for "games") on longer words.
  if (expected.length >= 4 && (expected === `${heard}s` || heard === `${expected}s`)) return true;
  // Near spellings only on longer words: short words must be exact ("I" is not "a").
  if (expected.length < 5) return false;
  return distance(expected, heard) <= (expected.length >= 8 ? 2 : 1);
}

/** How far ahead in what was heard a word may be found (skipping filler like "uh", "the"). */
const LOOK_AHEAD = 3;

/**
 * Which of the sentence's words were said, in order. A word counts once all its spoken tokens are
 * found, in order, in the heard text; a missed word does not stop later words from counting, so
 * a learner who stumbles in the middle still sees the end turn black.
 */
export function wordsSaid(words: SentenceWord[], heard: string): boolean[] {
  const tokens = spokenTokens(heard);
  let at = 0;
  return words.map((word) => {
    if (!word.keys.length) return true;
    let cursor = at;
    for (const key of word.keys) {
      let found = -1;
      for (let i = cursor; i < Math.min(tokens.length, cursor + LOOK_AHEAD + 1); i += 1) {
        if (sameWord(key, tokens[i])) {
          found = i;
          break;
        }
      }
      if (found < 0) return false;
      cursor = found + 1;
    }
    at = cursor;
    return true;
  });
}

/** Keeps every word that has turned black black: the recogniser rewrites its guesses as it goes. */
export function mergeSaid(before: boolean[], now: boolean[]): boolean[] {
  return now.map((said, i) => said || Boolean(before[i]));
}

export const allSaid = (said: boolean[]) => said.length > 0 && said.every(Boolean);
