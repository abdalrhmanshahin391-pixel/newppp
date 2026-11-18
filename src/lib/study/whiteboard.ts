import { z } from "zod";

const point = z.tuple([z.number().min(0).max(600), z.number().min(0).max(300)]);
const ink = z.enum(["ink", "indigo", "teal", "coral"]).default("ink");
const mark = z.object({ at: point, ink });
const command = z.discriminatedUnion("op", [
  mark.extend({ op: z.literal("write"), text: z.string().trim().min(1).max(48) }),
  mark.extend({ op: z.literal("line"), to: point }),
  mark.extend({ op: z.literal("arrow"), to: point }),
  mark.extend({ op: z.literal("ellipse"), to: point }),
  mark.extend({ op: z.literal("path"), points: z.array(point).min(1).max(32) }),
]);

export const boardStepSchema = z.object({
  title: z.string().trim().min(1).max(72),
  narration: z.string().trim().min(1).max(440),
  commands: z.array(command).min(1).max(14),
});
export type BoardStep = z.infer<typeof boardStepSchema>;
export type BoardCommand = BoardStep["commands"][number];
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
