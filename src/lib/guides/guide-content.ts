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

export const GuideContentSchema = z.object({
  version: z.literal(GUIDE_VERSION).default(GUIDE_VERSION),
  /** The page title. Shown in capitals, so keep it short. */
  title: text(60).min(1),
  /** One or two sentences. Markup marks the term being taught. */
  intro: text(280).min(1),
  sections: z.array(SectionSchema).min(1).max(4),
  /** A closing reminder in a grey box. */
  callout: text(240).default(""),
  /** A short note for Arabic readers. Empty or it must really be Arabic. */
  arabic_note: text(320)
    .default("")
    .refine((value) => value === "" || hasArabic(value), "the Arabic note must be Arabic"),
  source: z
    .object({ from_page: z.number().int().min(1), to_page: z.number().int().min(1) })
    .optional(),
});
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

export function normalizeGuideReply(raw: unknown): unknown {
  if (!isObj(raw)) return raw;
  const sections = tidyList(raw.sections, 4, (section) => {
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
    callout: tidy(raw.callout ?? "", 240),
    arabic_note: tidy(raw.arabic_note ?? "", 320),
  };
}
