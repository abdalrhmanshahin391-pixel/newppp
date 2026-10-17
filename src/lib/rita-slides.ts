// Pure rules for lesson slides and for picking the next lesson's topic.
// No server or browser imports so the rules can be unit tested with node.
import { z } from "zod";
import { VocabularyItemSchema } from "./rita-curriculum.ts";

export const SLIDE_KINDS = [
  "title",
  "point",
  "example",
  "vocabulary",
  "practice",
  "recap",
] as const;
export type SlideKind = (typeof SLIDE_KINDS)[number];

/** A lesson is 5-10 spoken minutes, so a deck stays short. */
export const MAX_SLIDES = 12;
export const MIN_GENERATED_SLIDES = 3;

const text = (max: number) => z.string().trim().max(max);

const slideId = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9-]{0,39}$/, "slide id must be lowercase letters, digits and dashes");

const slideFields = {
  kind: z.enum(SLIDE_KINDS),
  heading: text(120).min(1),
  heading_ar: text(120).default(""),
  bullets: z.array(text(240).min(1)).max(6).default([]),
  example: text(240).default(""),
  vocabulary: z.array(VocabularyItemSchema).max(8).default([]),
  source_page: z.number().int().min(1).max(5_000).nullable().default(null),
  speaker_note: text(400).default(""),
};

/** A slide as the model returns it: ids are added afterwards. */
export const SlideDraftSchema = z.object({ ...slideFields });
export const SlideSchema = z.object({ id: slideId, ...slideFields });
export type Slide = z.infer<typeof SlideSchema>;

export const GeneratedDeckSchema = z.object({
  slides: z.array(SlideDraftSchema).min(MIN_GENERATED_SLIDES).max(MAX_SLIDES),
});

export const SlideDeckSchema = z
  .array(SlideSchema)
  .min(1)
  .max(MAX_SLIDES)
  .superRefine((deck, ctx) => {
    const seen = new Set<string>();
    deck.forEach((slide, index) => {
      if (seen.has(slide.id)) {
        ctx.addIssue({ code: "custom", path: [index, "id"], message: "duplicate slide id" });
      }
      seen.add(slide.id);
    });
  });

/**
 * Turns the model's slides into a saved deck: numbers the ids, keeps source
 * pages inside the lesson's pages, and puts a title slide first and a recap
 * last when the model forgot them (the order a learner expects).
 */
export function finalizeSlides(
  drafts: z.infer<typeof SlideDraftSchema>[],
  range: { from: number; to: number },
): Slide[] {
  const clamp = (page: number | null) =>
    page === null ? null : Math.max(range.from, Math.min(page, range.to));
  const slides = drafts.slice(0, MAX_SLIDES).map((draft, index) => ({
    ...draft,
    id: `s${index + 1}`,
    source_page: clamp(draft.source_page),
  }));
  const firstTitle = slides.findIndex((slide) => slide.kind === "title");
  if (firstTitle > 0) {
    const [title] = slides.splice(firstTitle, 1);
    slides.unshift(title);
  }
  const lastRecap = slides.map((slide) => slide.kind).lastIndexOf("recap");
  if (lastRecap >= 0 && lastRecap < slides.length - 1) {
    const [recap] = slides.splice(lastRecap, 1);
    slides.push(recap);
  }
  return slides.map((slide, index) => ({ ...slide, id: `s${index + 1}` }));
}

function nextSlideId(slides: Slide[]): string {
  const used = new Set(slides.map((slide) => slide.id));
  for (let n = slides.length + 1; n < slides.length + 200; n += 1) {
    if (!used.has(`s${n}`)) return `s${n}`;
  }
  return `s${Date.now().toString(36)}`;
}

export function blankSlide(slides: Slide[], kind: SlideKind = "point"): Slide {
  return {
    id: nextSlideId(slides),
    kind,
    heading: "",
    heading_ar: "",
    bullets: [],
    example: "",
    vocabulary: [],
    source_page: null,
    speaker_note: "",
  };
}

/** Adds a blank slide before a closing recap, or at the end. Returns the same deck when full. */
export function addSlide(slides: Slide[], kind: SlideKind = "point"): Slide[] {
  if (slides.length >= MAX_SLIDES) return slides;
  const fresh = blankSlide(slides, kind);
  const last = slides[slides.length - 1];
  if (last && last.kind === "recap" && kind !== "recap") {
    return [...slides.slice(0, -1), fresh, last];
  }
  return [...slides, fresh];
}

export function removeSlide(slides: Slide[], id: string): Slide[] {
  return slides.filter((slide) => slide.id !== id);
}

export function moveSlide(slides: Slide[], id: string, direction: "up" | "down"): Slide[] {
  const from = slides.findIndex((slide) => slide.id === id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= slides.length) return slides;
  const next = slides.slice();
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** Slides still missing a heading cannot be saved; returns the first problem or null. */
export function deckProblem(slides: Slide[]): string | null {
  const parsed = SlideDeckSchema.safeParse(slides);
  if (parsed.success) return null;
  const issue = parsed.error.issues[0];
  const index = typeof issue?.path[0] === "number" ? issue.path[0] + 1 : null;
  return index
    ? `slide ${index}: ${issue?.message ?? "invalid"}`
    : (issue?.message ?? "invalid deck");
}

/** Moves through a deck without leaving it: the index stays between the first and last slide. */
export function stepSlide(index: number, delta: number, length: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(length - 1, index + delta));
}

// ---------- next lesson ----------

export type TopicSuggestion = {
  topic: string;
  title_ar: string;
  from_page: number;
  to_page: number;
};

type LessonCoverage = {
  topic: string;
  title: string;
  source_from_page: number;
  source_to_page: number;
  status: "draft" | "published" | "archived";
};

const normalise = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Up to `limit` topics worth teaching next, from the summaries of the pages
 * already read. A topic is dropped when a lesson already uses its name or when
 * every page it covers already belongs to a lesson. Topics that start after the
 * last lesson's pages come first, in page order, then earlier gaps. A topic is
 * never longer than one lesson can read (10 pages).
 */
export function suggestNextTopics(input: {
  suggestions: TopicSuggestion[];
  lessons: LessonCoverage[];
  readCursor: number;
  limit?: number;
  maxPages?: number;
}): TopicSuggestion[] {
  const limit = input.limit ?? 3;
  const maxPages = input.maxPages ?? 10;
  const live = input.lessons.filter((lesson) => lesson.status !== "archived");
  const usedNames = new Set(
    live.flatMap((lesson) => [normalise(lesson.topic), normalise(lesson.title)]),
  );
  const coveredPages = new Set<number>();
  let lastEnd = 0;
  for (const lesson of live) {
    for (let page = lesson.source_from_page; page <= lesson.source_to_page; page += 1) {
      coveredPages.add(page);
    }
    lastEnd = Math.max(lastEnd, lesson.source_to_page);
  }

  const seen = new Set<string>();
  const candidates: TopicSuggestion[] = [];
  for (const item of input.suggestions) {
    const topic = item.topic.trim();
    if (!topic || item.from_page > input.readCursor) continue;
    const key = normalise(topic);
    if (usedNames.has(key) || seen.has(key)) continue;
    const from = Math.max(1, item.from_page);
    const to = Math.min(item.to_page, input.readCursor, from + maxPages - 1);
    if (to < from) continue;
    let allCovered = true;
    for (let page = from; page <= to; page += 1) {
      if (!coveredPages.has(page)) {
        allCovered = false;
        break;
      }
    }
    if (allCovered) continue;
    seen.add(key);
    candidates.push({ topic, title_ar: item.title_ar.trim(), from_page: from, to_page: to });
  }
  const byPage = (a: TopicSuggestion, b: TopicSuggestion) => a.from_page - b.from_page;
  const ahead = candidates.filter((item) => item.from_page > lastEnd).sort(byPage);
  const gaps = candidates.filter((item) => item.from_page <= lastEnd).sort(byPage);
  return [...ahead, ...gaps].slice(0, limit);
}
