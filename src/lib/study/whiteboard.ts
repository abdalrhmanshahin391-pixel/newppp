import { z } from "zod";

const anchor = z.object({
  text: z.string().min(1).max(100),
  occurrence: z.number().int().min(1).max(180).default(1),
});
const annotation = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("circle"), target: anchor }),
  z.object({ kind: z.literal("underline"), target: anchor }),
  z.object({ kind: z.literal("arrow"), from: anchor, target: anchor }),
]);
export type BoardMark = z.infer<typeof annotation>;
export function anchorOffset(source: string, anchor: { text: string; occurrence: number }) {
  let offset = -1;
  for (let i = 0; i < anchor.occurrence; i++) {
    offset = source.indexOf(anchor.text, i ? offset + anchor.text.length : 0);
    if (offset < 0) break;
  }
  return offset;
}
export const boardStepSchema = z.object({
  title: z.string().trim().min(1).max(72),
  narration: z.string().trim().min(1).max(440),
  rows: z
    .array(
      z.object({
        source: z.string().trim().min(1).max(180),
        marks: z.array(annotation).max(4).default([]),
        explanation: z.string().trim().min(1).max(200),
      }),
    )
    .min(1)
    .max(4),
  example: z.string().trim().min(1).max(160).nullable().optional(),
  finished: z.boolean(),
});
export type BoardStep = z.infer<typeof boardStepSchema>;

export function groundedStep(value: unknown, quote: string) {
  const step = boardStepSchema.safeParse(value);
  const normalize = (s: string) => s.normalize("NFC").replace(/\s+/gu, " ").trim();
  const text = normalize(quote);
  return step.success &&
    step.data.rows.every(
      (row) =>
        text.includes(normalize(row.source)) &&
        row.marks.every(
          (mark) =>
            anchorOffset(row.source, mark.target) >= 0 &&
            (mark.kind !== "arrow" ||
              (anchorOffset(row.source, mark.from) >= 0 &&
                anchorOffset(row.source, mark.from) !== anchorOffset(row.source, mark.target))),
        ),
    )
    ? step.data
    : null;
}
export type BoardSelection = { segIds: string[]; exact: string; parts?: string[] };

export function confirmsBoardStep(text: string) {
  return /^(تمام( كملي)?|كمل[ي]?|موافق|فهمت|اوكي|okay|ok|continue|got it|next)$/i.test(
    text
      .normalize("NFKC")
      .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
      .replace(/[أإآ]/g, "ا")
      .replace(/[.,!?،؟!]/g, "")
      .trim()
      .replace(/\s+/g, " "),
  );
}
