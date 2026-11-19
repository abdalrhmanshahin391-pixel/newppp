// What a PDF guide is made of, as data. The AI writes this shape (and nothing else), the code
// checks it, and the page templates turn it into HTML. Content never carries layout or colour
// choices beyond a small named tone, so the design can change without rewriting any guide.
// Pure: no server or browser imports, so it is tested with node.
import { z } from "zod";

export const GUIDE_VERSION = 1;

export const TONES = ["neutral", "positive", "negative", "question", "blue", "green"] as const;
export type Tone = (typeof TONES)[number];

/** Soft text: no angle brackets, no control characters, one line unless a limit says otherwise. */
const text = (max: number) =>
  z
    .string()
    .max(max)
    // eslint-disable-next-line no-control-regex
    .refine((value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/.test(value), "no markup");

const cell = text(90);
const label = text(32);

const ToneSchema = z.enum(TONES);

const ColumnSchema = z.object({ label, tone: ToneSchema.default("neutral") });

const TableSection = z
  .object({
    kind: z.literal("table"),
    heading: text(40),
    columns: z.array(ColumnSchema).min(2).max(5),
    /** The first column names the row (bold, left aligned) instead of holding a form. */
    row_headers: z.boolean().default(false),
    rows: z.array(z.array(cell).min(2).max(5)).min(1).max(8),
  })
  .refine((section) => section.rows.every((row) => row.length === section.columns.length), {
    message: "every row needs one cell for each column",
  });

const MatrixSection = z
  .object({
    kind: z.literal("matrix"),
    heading: text(40),
    /** Column names, shown as blue pills. */
    columns: z.array(label).min(2).max(5),
    /** Row names (green pills) with one cell for each column. */
    rows: z
      .array(z.object({ label, cells: z.array(cell) }))
      .min(1)
      .max(6),
  })
  .refine((section) => section.rows.every((row) => row.cells.length === section.columns.length), {
    message: "every row needs one cell for each column",
  });

const UsageSection = z.object({
  kind: z.literal("usage"),
  /** The card title, for example "Usage" or "Watch out". */
  heading: text(40),
  items: z
    .array(z.object({ label: text(40).default(""), example: text(160) }))
    .min(1)
    .max(6),
});

const RulesSection = z.object({
  kind: z.literal("rules"),
  heading: text(40),
  items: z
    .array(z.object({ rule: text(160), examples: z.array(text(120)).min(1).max(3) }))
    .min(1)
    .max(6),
});

export const SectionSchema = z.discriminatedUnion("kind", [
  TableSection,
  MatrixSection,
  UsageSection,
  RulesSection,
]);
export type Section = z.infer<typeof SectionSchema>;

const hasArabic = (value: string) => /[؀-ۿ]/.test(value);

/** The most slides one guide may have, and the most sections one slide may hold (one page). */
export const MAX_SLIDES = 6;
export const MAX_SECTIONS_PER_SLIDE = 4;

/** One slide: its title and how many of the guide's sections (in order) it shows. */
const SlideSchema = z.object({
  title: text(60).min(1),
  count: z.number().int().min(1).max(MAX_SECTIONS_PER_SLIDE),
});
export type Slide = z.infer<typeof SlideSchema>;

export const GuideContentSchema = z
  .object({
    version: z.literal(GUIDE_VERSION).default(GUIDE_VERSION),
    /** The page title. Shown in capitals, so keep it short. */
    title: text(60).min(1),
    /** One or two sentences. Markup marks the term being taught. */
    intro: text(280).min(1),
    /** Every section of every slide, in order (a guide of one page has no `slides`). */
    sections: z
      .array(SectionSchema)
      .min(1)
      .max(MAX_SLIDES * MAX_SECTIONS_PER_SLIDE),
    /**
     * How the sections are split into slides, like the pages of a book: slide 1 takes the first
     * `count` sections, slide 2 the next ones... Empty: one page holding every section (the first
     * guides were made like this, at most 4 sections).
     */
    slides: z.array(SlideSchema).max(MAX_SLIDES).optional(),
    /** A closing reminder in a grey box. */
    callout: text(240).default(""),
    /** A short note for Arabic readers. Empty or it must really be Arabic. */
    arabic_note: text(320)
      .default("")
      .refine((value) => value === "" || hasArabic(value), "the Arabic note must be Arabic"),
    source: z
      .object({ from_page: z.number().int().min(1), to_page: z.number().int().min(1) })
      .optional(),
  })
  .refine(
    (guide) =>
      guide.slides?.length
        ? guide.slides.reduce((sum, slide) => sum + slide.count, 0) === guide.sections.length
        : guide.sections.length <= MAX_SECTIONS_PER_SLIDE,
    { message: "the slides must share out every section, at most 4 on one page" },
  );
export type GuideContent = z.infer<typeof GuideContentSchema>;

// ---------------------------------------------------------------------------------------------
// Inline markup. The writer may mark text with three small tags; everything else is plain text and
// is escaped when the page is made, so a guide can never carry HTML.
//   [[term]]   the term being taught: blue, bold, italic
//   {{part}}   a part to stress (a verb, an ending): bold
//   //phrase// an example: italic
// ---------------------------------------------------------------------------------------------

export type Run = { text: string; term: boolean; strong: boolean; italic: boolean };

const MARKERS = ["[[", "]]", "{{", "}}", "//"] as const;

/** A marker pair with an odd number of tags is dropped, so a broken tag never swallows the rest. */
function balanced(input: string): string {
  let out = input;
  const drop = (marks: string[]) => {
    for (const mark of marks) out = out.split(mark).join("");
  };
  const count = (mark: string) => out.split(mark).length - 1;
  if (count("[[") !== count("]]")) drop(["[[", "]]"]);
  if (count("{{") !== count("}}")) drop(["{{", "}}"]);
  if (count("//") % 2 === 1) drop(["//"]);
  return out;
}

export function parseMarkup(input: string): Run[] {
  const source = balanced(input);
  const runs: Run[] = [];
  let term = false;
  let strong = false;
  let italic = false;
  let buffer = "";
  const flush = () => {
    if (buffer) runs.push({ text: buffer, term, strong, italic });
    buffer = "";
  };
  for (let i = 0; i < source.length;) {
    const mark = MARKERS.find((candidate) => source.startsWith(candidate, i));
    if (!mark) {
      buffer += source[i];
      i += 1;
      continue;
    }
    flush();
    if (mark === "[[") term = true;
    else if (mark === "]]") term = false;
    else if (mark === "{{") strong = true;
    else if (mark === "}}") strong = false;
    else italic = !italic;
    i += mark.length;
  }
  flush();
  return runs;
}

/** The text without its tags, for search, alt text and length checks. */
export function plainText(input: string): string {
  return parseMarkup(input)
    .map((run) => run.text)
    .join("");
}

// ---------------------------------------------------------------------------------------------
// Tidying the model's reply before it is checked: cosmetic limits only (stray tags, control
// characters, doubled spaces, a note a little too long). What a rule or an example says is never
// touched, so a real mistake still reaches the checker and the reviewer.
// ---------------------------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function tidy(value: unknown, max: number): unknown {
  if (typeof value !== "string") return value;
  const clean = value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).trim();
}

function tidyList(value: unknown, max: number, each: (item: unknown) => unknown): unknown {
  return Array.isArray(value) ? value.slice(0, max).map(each) : value;
}

/** The slides of a guide, each with the indexes of its sections (an old guide is one slide). */
export function guideSlides(
  content: Pick<GuideContent, "title" | "sections" | "slides">,
): { title: string; sections: number[] }[] {
  const slides = content.slides ?? [];
  if (!slides.length) {
    return [{ title: content.title, sections: content.sections.map((_, index) => index) }];
  }
  let next = 0;
  return slides.map((slide) => {
    const sections = Array.from({ length: slide.count }, (_, i) => next + i).filter(
      (index) => index < content.sections.length,
    );
    next += slide.count;
    return { title: slide.title, sections };
  });
}

/** The slide that holds a section (0 when the guide has one page). */
export function slideOfSection(
  content: Pick<GuideContent, "title" | "sections" | "slides">,
  section: number,
): number {
  const found = guideSlides(content).findIndex((slide) => slide.sections.includes(section));
  return Math.max(0, found);
}

/**
 * The writer answers with `slides: [{ title, sections: [...] }]`; the guide keeps one flat list of
 * sections (their names stay "s1", "s2"... across slides) and the slide split beside it.
 */
function flattenSlides(raw: Obj): Obj {
  if (
    !Array.isArray(raw.slides) ||
    !raw.slides.some((slide) => isObj(slide) && Array.isArray(slide.sections))
  ) {
    return raw;
  }
  const sections: unknown[] = [];
  const slides: Obj[] = [];
  for (const slide of raw.slides.slice(0, MAX_SLIDES)) {
    if (!isObj(slide) || !Array.isArray(slide.sections) || !slide.sections.length) continue;
    const own = slide.sections.slice(0, MAX_SECTIONS_PER_SLIDE);
    sections.push(...own);
    slides.push({ title: tidy(slide.title ?? raw.title, 60) || "Slide", count: own.length });
  }
  return { ...raw, sections, slides };
}

export function normalizeGuideReply(input: unknown): unknown {
  if (!isObj(input)) return input;
  const raw = flattenSlides(input);
  const sections = tidyList(raw.sections, MAX_SLIDES * MAX_SECTIONS_PER_SLIDE, (section) => {
    if (!isObj(section)) return section;
    const base: Obj = { ...section, heading: tidy(section.heading, 40) };
    if (section.kind === "table") {
      return {
        ...base,
        columns: tidyList(section.columns, 5, (column) =>
          isObj(column) ? { ...column, label: tidy(column.label, 32) } : column,
        ),
        rows: tidyList(section.rows, 8, (row) => tidyList(row, 5, (item) => tidy(item, 90))),
      };
    }
    if (section.kind === "matrix") {
      return {
        ...base,
        columns: tidyList(section.columns, 5, (item) => tidy(item, 32)),
        rows: tidyList(section.rows, 6, (row) =>
          isObj(row)
            ? {
                ...row,
                label: tidy(row.label, 32),
                cells: tidyList(row.cells, 5, (item) => tidy(item, 90)),
              }
            : row,
        ),
      };
    }
    if (section.kind === "usage") {
      return {
        ...base,
        items: tidyList(section.items, 6, (item) =>
          isObj(item)
            ? { ...item, label: tidy(item.label ?? "", 40), example: tidy(item.example, 160) }
            : item,
        ),
      };
    }
    if (section.kind === "rules") {
      return {
        ...base,
        items: tidyList(section.items, 6, (item) =>
          isObj(item)
            ? {
                ...item,
                rule: tidy(item.rule, 160),
                examples: tidyList(item.examples, 3, (example) => tidy(example, 120)),
              }
            : item,
        ),
      };
    }
    return base;
  });
  return {
    ...raw,
    title: tidy(raw.title, 60),
    intro: tidy(raw.intro, 280),
    sections,
    slides: Array.isArray(raw.slides) ? raw.slides : [],
    callout: tidy(raw.callout ?? "", 240),
    arabic_note: tidy(raw.arabic_note ?? "", 320),
  };
}
