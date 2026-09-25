/** Shared, client-safe helpers for the German Lab (Article Lab + Pronunciation Lab). */
import { ttsHeaders } from "@/lib/tts-auth";


export type Article = "der" | "die" | "das";

export const ARTICLES: Article[] = ["der", "die", "das"];

/** One colour system used everywhere: der = blue, die = red, das = green. */
export const ARTICLE_COLORS: Record<Article, { bg: string; ink: string; soft: string; border: string }> = {
  der: { bg: "#2f6fd0", ink: "#12315e", soft: "#dceafb", border: "#9cc2f0" },
  die: { bg: "#d94a4a", ink: "#6d1d1d", soft: "#fbdcdc", border: "#f0a0a0" },
  das: { bg: "#2f9e63", ink: "#14522f", soft: "#d9f2e3", border: "#96d8b4" },
};

export type DeItem = {
  id: string;
  subtopic_id: string;
  kind: "noun" | "word" | "sentence";
  german: string;
  article: Article | null;
  plural: string | null;
  english: string | null;
  position: number;
  is_sample: boolean;
  flagged?: boolean;
};

export type DeSubtopic = {
  id: string;
  subject_id: string;
  name: string;
  position: number;
  is_sample: boolean;
  items: number;
  flags: number;
  /** How many of the items each lab can actually play. */
  nouns?: number;
  buildable?: number;
};

export type DeSubject = {
  id: string;
  name: string;
  mode: "articles" | "speaking";
  color: string;
  position: number;
  is_sample: boolean;
  subtopics: DeSubtopic[];
  items: number;
  flags: number;
  nouns?: number;
  buildable?: number;
};

/* ------------------------------------------------------------------ *
 * Parsing pasted lines
 * ------------------------------------------------------------------ */

export type ParsedLine = {
  kind: "noun" | "word" | "sentence";
  german: string;
  article: Article | null;
  plural: string | null;
  english: string | null;
};

function leadingArticle(text: string): { article: Article | null; rest: string } {
  const m = text.match(/^\s*(der|die|das)\s+(.+)$/i);
  if (!m) return { article: null, rest: text.trim() };
  return { article: m[1].toLowerCase() as Article, rest: m[2].trim() };
}

/**
 * Accepts a wide range of shapes, one item per line:
 *   die Bank, die Banken = bench
 *   Bank = bench
 *   der Tisch
 *   Ich hätte gern einen Kaffee. = I would like a coffee.
 */
export function parseLine(raw: string, _mode?: "articles" | "speaking"): ParsedLine | null {
  const line = raw.replace(/\s+/g, " ").trim();
  if (!line) return null;

  const [leftRaw, ...rightParts] = line.split(/\s*(?:=|—|–|\||\t|:{1}\s)\s*/);
  const english = rightParts.join(" ").trim() || null;
  let left = (leftRaw ?? "").trim();
  if (!left) return null;

  // "die Bank, die Banken" → german + plural
  let plural: string | null = null;
  const comma = left.split(/\s*,\s*/);
  if (comma.length > 1) {
    left = comma[0].trim();
    plural = comma.slice(1).join(", ").trim() || null;
  }

  const { article, rest } = leadingArticle(left);
  const words = rest.split(" ").filter(Boolean).length;
  const looksLikeSentence = words > 2 || /[.?!]$/.test(rest);

  // One shape for the whole shelf: the article is always kept in its own field,
  // so every lab can use the same item in its own way.
  return {
    kind: looksLikeSentence ? "sentence" : article ? "noun" : "word",
    german: rest,
    article: looksLikeSentence ? null : article,
    plural,
    english,
  };
}

export function parseBulk(text: string, mode?: "articles" | "speaking"): ParsedLine[] {
  const out: ParsedLine[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const p = parseLine(line, mode);
    if (!p || !p.german) continue;
    const key = `${p.article ?? ""} ${p.german}`.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * One shelf, three labs — which labs can play a given item
 * ------------------------------------------------------------------ */

/** The item exactly as it should be shown and spoken. */
export function fullGerman(item: { german: string; article?: string | null }): string {
  return (item.article ? `${item.article} ${item.german}` : item.german).trim();
}

/** True when the given lab can actually practise this item. */
export function playsIn(
  item: { german: string; article?: string | null },
  mode: "articles" | "speaking" | "build",
): boolean {
  if (!item.german?.trim()) return false;
  if (mode === "articles") return !!item.article;
  if (mode === "build") return canBuild(item);
  return true;
}

/** Why a lab has to skip this item — used for the small notes on the shelf. */
export function whyNotPlayable(mode: "articles" | "speaking" | "build"): string {
  if (mode === "articles") return "needs der/die/das";
  if (mode === "build") return "too short to build";
  return "nothing to say";
}

/** A friendly key for spotting duplicates on the shelf. */
export function itemKey(item: { german: string; article?: string | null }): string {
  return fullGerman(item).toLowerCase().replace(/[.,!?;:]/g, "").replace(/\s+/g, " ").trim();
}


/* ------------------------------------------------------------------ *
 * Ending rules used by the "Endings coach" mode
 * ------------------------------------------------------------------ */

export const ENDING_RULES: { test: RegExp; article: Article; rule: string }[] = [
  { test: /(ung|heit|keit|schaft|tion|ion|tät|ik|ei|ur)$/i, article: "die", rule: "-ung, -heit, -keit, -schaft, -tion, -tät → die" },
  { test: /(chen|lein|ment|um|ma|tum)$/i, article: "das", rule: "-chen, -lein, -ment, -um → das" },
  { test: /(er|ling|ismus|ant|or|ig)$/i, article: "der", rule: "-er, -ling, -ismus, -or → der" },
];

export function ruleFor(noun: string): { article: Article; rule: string } | null {
  for (const r of ENDING_RULES) if (r.test.test(noun)) return { article: r.article, rule: r.rule };
  return null;
}

export function shuffle<T>(list: T[]): T[] {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

/* ------------------------------------------------------------------ *
 * High-quality German audio (cached per text + speed)
 * ------------------------------------------------------------------ */

const audioCache = new Map<string, string>();
let current: HTMLAudioElement | null = null;

/** Instant fallback while the good voice is still downloading. */
function browserSpeak(text: string, rate: number) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return null;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "de-DE";
    u.rate = rate;
    const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith("de"));
    if (voice) u.voice = voice;
    synth.cancel();
    synth.speak(u);
    return u;
  } catch {
    return null;
  }
}

export async function speakGerman(text: string, rate = 0.92): Promise<void> {
  const clean = text.trim().slice(0, 240);
  if (!clean || typeof window === "undefined") return;
  const key = `${rate}:${clean}`;

  // Cached? Play the good voice straight away.
  const cached = audioCache.get(key);
  if (cached) {
    try {
      current?.pause();
      const audio = new Audio(cached);
      current = audio;
      await audio.play();
      return;
    } catch {
      return;
    }
  }

  // Not cached yet — speak instantly with the browser voice, fetch in parallel.
  const fallback = browserSpeak(clean, rate);
  try {
    const headers = await ttsHeaders();
    if (!headers) return; // signed out: the browser voice already covered it
    const res = await fetch("/api/german/tts", {
      method: "POST",
      headers,
      body: JSON.stringify({ text: clean, rate }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const url = URL.createObjectURL(await res.blob());
    audioCache.set(key, url);
    // Only take over if the quick voice already finished (or never started).
    const speaking = typeof window !== "undefined" && window.speechSynthesis?.speaking;
    if (!fallback || !speaking) {
      current?.pause();
      const audio = new Audio(url);
      current = audio;
      await audio.play();
    }
  } catch {
    /* audio is a bonus, never a blocker */
  }
}


/** Warm the cache so playback during a round feels instant. */
export function prefetchGerman(texts: string[], rate = 0.92) {
  void (async () => {
    const headers = await ttsHeaders();
    if (!headers) return;
    texts.slice(0, 24).forEach((t) => {
      const clean = t.trim().slice(0, 240);
      const key = `${rate}:${clean}`;
      if (!clean || audioCache.has(key)) return;
      fetch("/api/german/tts", {
        method: "POST",
        headers,
        body: JSON.stringify({ text: clean, rate }),
      })
        .then((r) => (r.ok ? r.blob() : null))
        .then((b) => {
          if (b) audioCache.set(key, URL.createObjectURL(b));
        })
        .catch(() => {});
    });
  })();
}


export type WordMark = { word: string; state: "good" | "close" | "bad" };
export type SpeakResult = { score: number; transcript: string; words: WordMark[] };

/* ------------------------------------------------------------------ *
 * Build Lab — order the words of a sentence, or the syllables of a word
 * ------------------------------------------------------------------ */

export type LabMode = "articles" | "speaking" | "build";

const NUCLEUS = /(?:au|äu|eu|ei|ai|ie|[aeiouäöüy])+/gi;
/** One sound — the whole cluster opens the next syllable: wa-schen, spre-chen, Zu-cker. */
const ONSET_CLUSTERS = ["sch", "ch", "ph", "th", "qu", "ck"];
/** Written together but spoken across the seam: Ap-fel, sin-gen, Kat-ze. */
const SEAM_CLUSTERS = ["pf", "ng", "nk", "tz"];
/** Common compound halves — a seam here beats any consonant rule. */
const COMPOUND_PARTS = [
  "haus", "zimmer", "schule", "tisch", "stuhl", "buch", "zeit", "tag", "nacht", "jahr",
  "stadt", "land", "welt", "wagen", "bahn", "hof", "garten", "arbeit", "abend", "morgen",
  "mittag", "woche", "monat", "kind", "mann", "frau", "hand", "kopf", "herz", "wasser",
  "milch", "brot", "apfel", "baum", "weg", "straße", "strasse", "tür", "fenster", "kranken",
  "spiel", "sprache", "freund", "lehrer", "schüler", "wohnung", "küche", "bad", "geld",
];

/** Peel a leading article off a noun. */
export function stripArticle(raw: string): { article: Article | null; word: string } {
  const m = raw.trim().match(/^(der|die|das)\s+(.+)$/i);
  if (!m) return { article: null, word: raw.trim() };
  return { article: m[1].toLowerCase() as Article, word: m[2].trim() };
}

/** Cut a compound at a known seam, e.g. Krankenhaus → Kranken | haus. */
export function splitCompound(raw: string): string[] {
  const word = raw.trim();
  const lower = word.toLowerCase();
  if (word.length < 8) return [word];
  for (const part of COMPOUND_PARTS) {
    const at = lower.lastIndexOf(part);
    if (at >= 3 && at + part.length === lower.length) {
      return [word.slice(0, at), word.slice(at)];
    }
  }
  return [word];
}

function syllablesOfSimpleWord(word: string): string[] {
  if (word.length < 4) return [word];
  const nuclei: { start: number; end: number }[] = [];
  NUCLEUS.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NUCLEUS.exec(word))) nuclei.push({ start: m.index, end: m.index + m[0].length });

  if (nuclei.length === 0) return [word];
  if (nuclei.length === 1) {
    // One-syllable words still split into two tappable chunks: Nacht → Na | cht
    const cut = nuclei[0].end;
    const head = word.slice(0, cut);
    const tail = word.slice(cut);
    return head.length >= 2 && tail.length >= 2 ? [head, tail] : [word];
  }

  const cuts: number[] = [];
  for (let i = 0; i < nuclei.length - 1; i++) {
    const from = nuclei[i].end;
    const to = nuclei[i + 1].start;
    const cluster = word.slice(from, to);
    const lower = cluster.toLowerCase();

    if (cluster.length <= 1) {
      cuts.push(from); // vowel gap or single consonant → onset of the next syllable
      continue;
    }
    if (ONSET_CLUSTERS.includes(lower)) {
      cuts.push(from); // wa|schen, Zu|cker
      continue;
    }
    if (SEAM_CLUSTERS.includes(lower)) {
      cuts.push(from + 1); // Ap|fel, sin|gen, Kat|ze
      continue;
    }
    const onset = ONSET_CLUSTERS.find((d) => lower.endsWith(d) && cluster.length > d.length);
    if (onset) {
      cuts.push(to - onset.length); // spre|chen, Men|schen
      continue;
    }
    cuts.push(to - 1); // last consonant opens the next syllable: Fens|ter
  }


  const parts: string[] = [];
  let prev = 0;
  for (const c of cuts) {
    if (c <= prev || c >= word.length) continue;
    parts.push(word.slice(prev, c));
    prev = c;
  }
  parts.push(word.slice(prev));

  // Never leave a one-letter crumb on its own.
  const merged: string[] = [];
  for (const p of parts.filter((x) => x.length > 0)) {
    if (merged.length && p.length < 2) merged[merged.length - 1] += p;
    else merged.push(p);
  }
  return merged.length > 1 ? merged : [word];
}

/** Last resort — cut a word near the middle so it is always playable: Nacht = Na | cht. */
function forceSplit(word: string): string[] {
  if (word.length < 3) return [word];
  const cut = Math.max(2, Math.min(word.length - 1, Math.round(word.length / 2)));
  return [word.slice(0, cut), word.slice(cut)];
}

/** Friendly German syllable split — compound seams first, then sound rules. */
export function splitSyllables(raw: string): string[] {
  const word = raw.trim();
  if (!word) return [];
  const parts = splitCompound(word).flatMap(syllablesOfSimpleWord).filter(Boolean);
  if (parts.length > 1) return parts;
  return forceSplit(word);
}

export type BuildRound = {
  id: string;
  level: "sentence" | "word";
  prompt: string;
  english: string | null;
  answer: string;
  tokens: string[];
  /** Shown above the pieces for single nouns: "der …" */
  article: Article | null;
};

const clean = (w: string) => w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");

type BuildInput = { id?: string; german: string; english?: string | null; article?: string | null };

/** Turn an item into a build round, or null when it cannot be split. */
export function buildRound(item: BuildInput, level: "mix" | "sentence" | "word" = "mix"): BuildRound | null {
  const raw = fullGerman(item);
  if (!raw) return null;

  const { article, word: body } = stripArticle(raw);
  const words = body.split(/\s+/).filter(Boolean);
  const id = item.id ?? raw;
  const english = item.english ?? null;

  // A phrase — order the words, unless the round is meant to be syllables.
  if (words.length > 1 && level !== "word") {
    return { id, level: "sentence", prompt: raw, english, answer: body, tokens: words, article: null };
  }
  if (words.length > 1 && level === "sentence") return null;
  if (words.length === 1 && level === "sentence") return null;

  // Syllables — for a phrase, cut one of its longer words (varies per round).
  const candidates = words.map(clean).filter((w) => w.length >= 3);
  if (!candidates.length) return null;
  const longest = Math.max(...candidates.map((w) => w.length));
  const pool = candidates.filter((w) => w.length >= Math.max(3, longest - 2));
  const target = pool[Math.floor(Math.random() * pool.length)] ?? candidates[0];

  const tokens = splitSyllables(target);
  if (tokens.length < 2) return null;
  return {
    id,
    level: "word",
    prompt: words.length > 1 ? target : raw,
    english: words.length > 1 ? null : english,
    answer: tokens.join(""),
    tokens,
    article: words.length > 1 ? null : article,
  };
}

export function canBuild(
  item: { german: string; article?: string | null },
  level: "mix" | "sentence" | "word" = "mix",
): boolean {
  return !!buildRound(item, level);
}


