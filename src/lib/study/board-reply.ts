import { z } from "zod";
import type { BoardCommand, BoardStep } from "./whiteboard";

// Coordinates for annotations belong to the renderer. The tutor names the terms
// in a relationship, in reading order, and can supply a separate freehand sketch.
const label = z.string().trim().min(1).max(48);
const row = z.object({
  text: label,
  result: label.optional().catch(undefined),
  circle: z.enum(["text", "result"]).optional().catch(undefined),
});
const point = z.tuple([z.number().min(0).max(100), z.number().min(0).max(100)]);
const sketch = z.array(point).min(2).max(32);
const reply = z.object({
  title: z.string().trim().min(1).catch(""),
  narration: z.string().trim().min(1).max(4000),
  rows: z.array(z.unknown()).catch([]),
  sketch: sketch.optional().catch(undefined),
});

// Accept a complete prose explanation when the model omits its drawing object.
// A truncated object or code block must still go through the normal repair path.
export function plainBoardReply(text: string) {
  if (
    text.length > 4000 ||
    /[{}[\]`<>]/.test(text) ||
    !/\p{L}/u.test(text) ||
    text.split(/\s+/).length < 3
  )
    return null;
  return { narration: text };
}

export function readBoardReply(raw: unknown, defaultTitle: string): BoardStep | null {
  const parsed = reply.safeParse(raw);
  if (!parsed.success) return null;
  const { title, narration, rows, sketch: drawing } = parsed.data;
  const heading = (title || defaultTitle).slice(0, 72);
  const commands: BoardCommand[] = [];
  const valid = rows
    .flatMap((item) => {
      const parsedRow = row.safeParse(typeof item === "string" ? { text: item } : item);
      return parsedRow.success ? [parsedRow.data] : [];
    })
    .slice(0, 3);
  // Even when the optional diagram is malformed, keep the actual tutor's answer.
  if (!valid.length) {
    const excerpt = narration.slice(0, 48);
    const cut = excerpt.lastIndexOf(" ");
    valid.push({
      text:
        narration.length <= 48
          ? narration
          : (cut > 0 ? excerpt.slice(0, cut) : excerpt.slice(0, 47)) + "…",
    });
  }
  for (const [i, item] of valid.entries()) {
    const y = 22 + i * 68;
    const rtl = /^[^\p{L}]*\p{Script=Arabic}/u.test(item.text);
    const addLabel = (text: string, center: number, paired: boolean, circled: boolean) => {
      const width = Math.min(
        paired ? 200 : 530,
        Array.from(text).length * (/[\u0600-\u06ff]/.test(text) ? 12 : 17),
      );
      const x = center - width / 2;
      commands.push({
        op: "write",
        at: [x, y],
        text,
        width,
        circled,
        ink: paired ? "indigo" : "ink",
      });
      return { left: x, right: x + width };
    };
    const start = addLabel(
      item.text,
      item.result ? (rtl ? 450 : 150) : 300,
      !!item.result,
      item.circle === "text",
    );
    if (item.result) {
      const end = addLabel(item.result, rtl ? 150 : 450, true, item.circle === "result");
      commands.push({
        op: "arrow",
        at: [rtl ? start.left - 16 : start.right + 16, y + 15],
        to: [rtl ? end.right + 16 : end.left - 16, y + 15],
        ink: "teal",
      });
    }
  }
  if (drawing) {
    const points: [number, number][] = drawing.map(([x, y]) => [264 + 0.72 * x, 218 + 0.72 * y]);
    commands.push({ op: "path", at: points[0], points: points.slice(1), ink: "teal" });
  }
  return { title: heading, narration, commands };
}
