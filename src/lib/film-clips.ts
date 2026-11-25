// The clips library: short video or GIF clips, each with one English sentence, its Arabic meaning
// and one target word. Exercises are made from these fields alone. Pure: types, the Sintel
// rows, search, the exercise pieces, trim checks and reading GIPHY's search reply.

export type ClipKind = "video" | "gif";

export type FilmClip = {
  id: string;
  kind: ClipKind;
  en: string;
  ar: string;
  target: string;
  target_ar: string;
  context_ar: string;
  video_url: string | null;
  poster_url: string | null;
  start_s: number | null;
  end_s: number | null;
  gif_id: string | null;
  gif_mp4: string | null;
  gif_still: string | null;
  gif_page: string | null;
  source: string;
  credit: string;
  credit_url: string | null;
  legacy_id: number | null;
};

/** What a distractor needs: another clip's sentence and meaning. */
export type ClipPoolEntry = { en: string; ar: string };

export const CLIPS_BUCKET = "rita-film-clips";
export const MAX_CLIP_BYTES = 25 * 1024 * 1024;
export const MAX_CLIP_SECONDS = 30;
export const MAX_STOP_CLIPS = 40;
export const CLIP_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;

/** A database row (numeric columns may come back as strings) as a clip. */
export function clipFromRow(row: Record<string, unknown>): FilmClip {
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const nullable = (value: unknown) => (typeof value === "string" && value ? value : null);
  const seconds = (value: unknown) => {
    if (value == null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  return {
    id: text(row.id),
    kind: row.kind === "gif" ? "gif" : "video",
    en: text(row.en),
    ar: text(row.ar),
    target: text(row.target),
    target_ar: text(row.target_ar),
    context_ar: text(row.context_ar),
    video_url: nullable(row.video_url),
    poster_url: nullable(row.poster_url),
    start_s: seconds(row.start_s),
    end_s: seconds(row.end_s),
    gif_id: nullable(row.gif_id),
    gif_mp4: nullable(row.gif_mp4),
    gif_still: nullable(row.gif_still),
    gif_page: nullable(row.gif_page),
    source: text(row.source),
    credit: text(row.credit),
    credit_url: nullable(row.credit_url),
    legacy_id: row.legacy_id == null ? null : Number(row.legacy_id),
  };
}

/** Lower case, no Arabic marks or tatweel, no apostrophes, single spaces. */
export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ـ/g, "")
    .replace(/[’‘']/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Every word of the query starts a word of the clip (English or Arabic). */
export function clipMatches(
  clip: Pick<FilmClip, "en" | "ar" | "target" | "target_ar">,
  query: string,
): boolean {
  const needle = normalizeSearch(query);
  if (!needle) return true;
  const tokens = normalizeSearch([clip.en, clip.ar, clip.target, clip.target_ar].join(" ")).split(
    " ",
  );
  return needle.split(" ").every((word) => tokens.some((token) => token.startsWith(word)));
}

/** Where the target sits in the sentence (case-insensitive), or -1. */
export function targetIndex(text: string, word: string): number {
  if (!word) return -1;
  return text.toLowerCase().indexOf(word.toLowerCase());
}

/** The admin's mistakes in a clip's text, in Arabic. Empty when the clip can be saved. */
export function clipProblems(clip: Pick<FilmClip, "en" | "ar" | "target" | "target_ar">): string[] {
  const problems: string[] = [];
  const words = clip.en.trim().split(/\s+/).filter(Boolean);
  if (!clip.en.trim()) problems.push("اكتب الجملة الإنجليزية.");
  else if (words.length < 2) problems.push("الجملة لازم تكون كلمتين أو أكثر عشان تمرين الترتيب.");
  if (!clip.ar.trim()) problems.push("اكتب المعنى بالعربي.");
  if (!clip.target.trim()) problems.push("اختار الكلمة المستهدفة.");
  else if (targetIndex(clip.en, clip.target.trim()) < 0)
    problems.push("الكلمة المستهدفة لازم تكون موجودة بالجملة الإنجليزية.");
  if (!clip.target_ar.trim()) problems.push("اكتب معنى الكلمة المستهدفة.");
  return problems;
}

/**
 * The word-order puzzle: the learner orders the last words (from the target on, at least 4 when the
 * sentence has them); the words before are shown as given.
 */
export function orderPuzzle(en: string, target: string): { prefix: string; words: string[] } {
  const phrase = en.trim().split(/\s+/).filter(Boolean);
  const lower = target.toLowerCase();
  const at = phrase.findIndex((word) => word.toLowerCase().includes(lower));
  const prefixLength = Math.max(0, Math.min(phrase.length - 4, at));
  return { prefix: phrase.slice(0, prefixLength).join(" "), words: phrase.slice(prefixLength) };
}

/** A shuffled copy. `random` is injectable for tests. */
export function shuffled<T>(values: T[], random: () => number = Math.random): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Word indexes in a mixed order that is never the right order (when there are 2+ words). */
export function mixedOrder(count: number, random: () => number = Math.random): number[] {
  const mixed = shuffled(
    Array.from({ length: count }, (_, i) => i),
    random,
  );
  if (count > 1 && mixed.every((value, i) => value === i)) mixed.push(mixed.shift()!);
  return mixed;
}

/**
 * Up to three choices with the right one among them: the right text plus two different texts from
 * the pool (same text counts once, compared after normalising).
 */
export function choiceOptions(
  right: string,
  pool: string[],
  random: () => number = Math.random,
): string[] {
  const seen = new Set([normalizeSearch(right)]);
  const others: string[] = [];
  for (const text of shuffled(pool, random)) {
    const key = normalizeSearch(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    others.push(text);
    if (others.length === 2) break;
  }
  return shuffled([right, ...others], random);
}

/**
 * The exercises a clip makes, after the intro. A video has sound: meaning, word order, speaking. A
 * GIF is silent: pick the sentence that fits the GIF, then word order.
 */
export type ClipExercise = "meaning" | "sentence" | "order" | "speak";
export function clipExercises(kind: ClipKind): ClipExercise[] {
  return kind === "gif" ? ["sentence", "order"] : ["meaning", "order", "speak"];
}

export type SessionStep =
  | { type: "intro"; clip: number }
  | { type: "exercise"; clip: number; exercise: ClipExercise };

/** First each clip is shown once, then each clip's exercises in turn. */
export function sessionSteps(clips: Pick<FilmClip, "kind">[]): SessionStep[] {
  return [
    ...clips.map((_, clip) => ({ type: "intro" as const, clip })),
    ...clips.flatMap((item, clip) =>
      clipExercises(item.kind).map((exercise) => ({ type: "exercise" as const, clip, exercise })),
    ),
  ];
}

/** A trim range, rounded to 0.1 s. Problems in Arabic; null start/end mean the whole clip. */
export function checkTrim(
  start: number | null,
  end: number | null,
  duration: number | null,
): { start: number | null; end: number | null; problem: string } {
  const round = (value: number) => Math.round(value * 10) / 10;
  let s = start == null || !Number.isFinite(start) ? null : Math.max(0, round(start));
  let e = end == null || !Number.isFinite(end) ? null : round(end);
  if (duration != null && Number.isFinite(duration) && duration > 0) {
    if (s != null && s >= duration) s = null;
    if (e != null && e >= duration) e = null;
  }
  if (s === 0) s = null;
  const from = s ?? 0;
  const to = e ?? duration ?? null;
  if (e != null && e <= from)
    return { start: s, end: e, problem: "النهاية لازم تكون بعد البداية." };
  if (to != null && to - from > MAX_CLIP_SECONDS)
    return {
      start: s,
      end: e,
      problem: `المقطع أطول من ${MAX_CLIP_SECONDS} ثانية. قصّه لجملة وحدة.`,
    };
  if (to != null && to - from < 0.5) return { start: s, end: e, problem: "المقطع قصير كتير." };
  return { start: s, end: e, problem: "" };
}

/** Seconds as m:ss.s for the trim fields. */
export function formatSeconds(value: number | null): string {
  if (value == null) return "";
  const minutes = Math.floor(value / 60);
  const seconds = value - minutes * 60;
  return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
}

/** Where the admin's browser uploads a clip file (the server checks this shape). */
export function clipFilePath(fileId: string, ext: "mp4" | "webm" | "mov" | "jpg"): string {
  return `clips/${fileId}.${ext}`;
}
export const CLIP_FILE_PATH = /^clips\/[0-9a-f-]{36}\.(mp4|webm|mov|jpg)$/i;

export function videoExtension(type: string, name: string): "mp4" | "webm" | "mov" | null {
  if (type === "video/mp4" || /\.mp4$/i.test(name)) return "mp4";
  if (type === "video/webm" || /\.webm$/i.test(name)) return "webm";
  if (type === "video/quicktime" || /\.mov$/i.test(name)) return "mov";
  return null;
}

/** GIPHY media are used from GIPHY's own hosts only (never copied to ours). */
export function isGiphyUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /(^|\.)giphy\.com$/i.test(url.hostname);
  } catch {
    return false;
  }
}

export type GiphyResult = {
  id: string;
  title: string;
  page: string;
  mp4: string;
  still: string;
  preview: string;
  width: number;
  height: number;
};

/** The usable GIFs of a GIPHY search reply (each needs an mp4 and a still on GIPHY's hosts). */
export function parseGiphySearch(json: unknown): { results: GiphyResult[]; total: number } {
  const body = (json ?? {}) as {
    data?: unknown[];
    pagination?: { total_count?: number };
  };
  const results: GiphyResult[] = [];
  for (const raw of Array.isArray(body.data) ? body.data : []) {
    const gif = raw as {
      id?: unknown;
      title?: unknown;
      url?: unknown;
      images?: Record<string, Record<string, unknown> | undefined>;
    };
    const images = gif.images ?? {};
    const pick = (...values: unknown[]) =>
      values.find((value): value is string => typeof value === "string" && isGiphyUrl(value)) ?? "";
    const mp4 = pick(images.original?.mp4, images.downsized_small?.mp4, images.fixed_height?.mp4);
    const preview = pick(images.fixed_height?.mp4, mp4);
    const still = pick(images.original_still?.url, images.fixed_height_still?.url);
    if (typeof gif.id !== "string" || !mp4 || !still) continue;
    results.push({
      id: gif.id,
      title: typeof gif.title === "string" ? gif.title : "",
      page: typeof gif.url === "string" && isGiphyUrl(gif.url) ? gif.url : "",
      mp4,
      still,
      preview,
      width: Number(images.fixed_height?.width) || 0,
      height: Number(images.fixed_height?.height) || 0,
    });
  }
  return { results, total: Number(body.pagination?.total_count) || results.length };
}

/** The credit line under a clip. */
export function clipCredit(clip: Pick<FilmClip, "kind" | "credit" | "source">): string {
  if (clip.kind === "gif") return clip.credit ? `${clip.credit} · via GIPHY` : "via GIPHY";
  return clip.credit || clip.source;
}

/** Saves the order: ids with duplicates and unknown ids left out, at most MAX_STOP_CLIPS. */
export function cleanClipIds(ids: string[], known: Set<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!known.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length === MAX_STOP_CLIPS) break;
  }
  return out;
}

/** Moves one entry up (-1) or down (+1). The same list at the edges. */
export function moveEntry<T>(list: T[], index: number, by: -1 | 1): T[] {
  const to = index + by;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return list;
  const next = list.slice();
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

// ---------------------------------------------------------------------------------------------
// The film & GIF page (/path-clips/$itemId): watch, understand, practise.

/** Every exercise a film & GIF stop can hold. An admin picks which ones per stop. */
export type StopExercise =
  | "meaning" // video: choose the Arabic meaning of what you hear
  | "listen" // video: hear it without subtitles, choose the sentence you heard
  | "sentence" // GIF: choose the sentence that fits
  | "blank" // the target word is missing: type it
  | "order" // build the sentence from its words
  | "speak" // video: say the sentence
  | "match"; // once at the end: match the stop's words to their meanings

export const STOP_EXERCISES: StopExercise[] = [
  "meaning",
  "listen",
  "sentence",
  "blank",
  "order",
  "speak",
  "match",
];

export const STOP_EXERCISE_LABEL: Record<StopExercise, { ar: string; en: string; hint: string }> = {
  meaning: { ar: "المعنى", en: "Meaning", hint: "فيديو: يختار معنى الجملة اللي سمعها" },
  listen: { ar: "اسمع واختار", en: "Listen", hint: "فيديو بدون ترجمة: يختار الجملة اللي سمعها" },
  sentence: {
    ar: "الجملة المناسبة",
    en: "Fitting sentence",
    hint: "GIF: يختار الجملة اللي بتناسبه",
  },
  blank: { ar: "كمّل الكلمة", en: "Fill the gap", hint: "الكلمة المهمة مخفية ويكتبها" },
  order: { ar: "رتّب الكلمات", en: "Word order", hint: "يبني الجملة من كلماتها" },
  speak: { ar: "انطق", en: "Speak", hint: "فيديو: يسجّل صوته وهو يقول الجملة" },
  match: { ar: "وصّل الكلمات", en: "Match words", hint: "بالآخر: يوصّل كلمات المحطة بمعانيها" },
};

/** The exercises a stop uses: its saved list, else all of them. Unknown values are dropped. */
export function stopExerciseList(saved: readonly string[] | null | undefined): StopExercise[] {
  if (!saved?.length) return STOP_EXERCISES;
  const list = STOP_EXERCISES.filter((exercise) => saved.includes(exercise));
  return list.length ? list : STOP_EXERCISES;
}

/** The exercises one clip makes on the page, in order, among the stop's chosen ones. */
export function pageClipExercises(
  clip: Pick<FilmClip, "kind" | "en" | "target">,
  allowed: readonly StopExercise[] = STOP_EXERCISES,
): StopExercise[] {
  const own: StopExercise[] =
    clip.kind === "gif"
      ? ["sentence", "blank", "order"]
      : ["meaning", "listen", "blank", "order", "speak"];
  return own.filter(
    (exercise) =>
      allowed.includes(exercise) && (exercise !== "blank" || !!blankParts(clip.en, clip.target)),
  );
}

export type PageStep =
  | { type: "watch"; clip: number }
  | { type: "exercise"; clip: number; exercise: Exclude<StopExercise, "match"> }
  | { type: "match" };

/** The page's three stages, in order. */
export type PageStage = "watch" | "understand" | "practise";
export function stageOf(step: PageStep): PageStage {
  if (step.type === "watch") return "watch";
  if (step.type === "match") return "practise";
  return step.exercise === "meaning" || step.exercise === "listen" || step.exercise === "sentence"
    ? "understand"
    : "practise";
}

/**
 * Watch each clip once, then the understanding exercises (meaning, listening, the fitting
 * sentence) over all clips, then the practice ones (gap, order, speaking), then the word match.
 */
export function pageSteps(
  clips: Pick<FilmClip, "kind" | "en" | "target" | "target_ar">[],
  allowed: readonly StopExercise[] = STOP_EXERCISES,
): PageStep[] {
  const steps: PageStep[] = clips.map((_, clip) => ({ type: "watch" as const, clip }));
  const own = clips.map((item) => pageClipExercises(item, allowed));
  for (const exercise of STOP_EXERCISES)
    clips.forEach((_, clip) => {
      if (exercise !== "match" && own[clip].includes(exercise))
        steps.push({ type: "exercise", clip, exercise });
    });
  if (allowed.includes("match") && matchPairs(clips).length >= 2) steps.push({ type: "match" });
  return steps;
}

/** The sentence around its target word, for the fill-the-gap exercise. Null without the word. */
export function blankParts(
  en: string,
  target: string,
): { before: string; word: string; after: string } | null {
  const word = target.trim();
  const at = targetIndex(en, word);
  if (!word || at < 0) return null;
  return {
    before: en.slice(0, at),
    word: en.slice(at, at + word.length),
    after: en.slice(at + word.length),
  };
}

/** Whether a typed word is the expected one (case, spaces, punctuation and ’ vs ' ignored). */
export function sameWord(typed: string, expected: string): boolean {
  const clean = (text: string) =>
    text
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[’‘`´]/g, "'")
      .replace(/[^\p{L}\p{N}' -]/gu, "")
      .replace(/\s+/g, " ")
      .trim();
  return clean(typed) !== "" && clean(typed) === clean(expected);
}

/** The stop's words and their meanings (each word once), at most six. */
export function matchPairs(
  clips: Pick<FilmClip, "target" | "target_ar">[],
): { en: string; ar: string }[] {
  const seen = new Set<string>();
  const pairs: { en: string; ar: string }[] = [];
  for (const clip of clips) {
    const en = clip.target.trim();
    const ar = clip.target_ar.trim();
    const key = en.toLowerCase();
    if (!en || !ar || seen.has(key)) continue;
    seen.add(key);
    pairs.push({ en, ar });
    if (pairs.length === 6) break;
  }
  return pairs;
}
