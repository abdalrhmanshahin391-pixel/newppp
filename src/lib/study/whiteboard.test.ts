import { layoutBoard } from "../../components/rita-study/board-layout.ts";
import type { BoardCommand } from "./whiteboard.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { boardStepSchema, confirmsBoardStep } from "./whiteboard.ts";
import { strokesFor } from "../../components/rita-study/pen-strokes.ts";

test("drawing instructions form a bounded geometry vocabulary", () => {
  const parse = (command: unknown) =>
    boardStepSchema.safeParse({
      title: "سنوات الدراسة",
      narration: "نرسم خط الزمن.",
      commands: [command],
    }).success;
  assert.ok(parse({ op: "arrow", at: [10, 30], to: [500, 30] }));
  assert.ok(
    parse({
      op: "path",
      at: [0, 0],
      points: [
        [1, 2],
        [4, 5],
      ],
    }),
  );
  assert.equal(parse({ op: "write", at: [600, 301], text: "outside" }), false);
  assert.equal(parse({ op: "script", at: [0, 0] }), false);
  assert.equal(parse({ op: "path", at: [0, 0], points: [] }), false);
});
test("confirmation advances once, a question containing confirmation is still a question", () => {
  for (const ok of ["تَمام، كمّلي!", "تمام", "Okay.", "فهمت"]) assert.ok(confirmsBoardStep(ok));
  for (const question of ["تمام بس ليش؟", "I don't get it", "مش تمام"])
    assert.equal(confirmsBoardStep(question), false);
});
test("D first lays down a stem, then lifts the pen to draw its bowl", () => {
  assert.deepEqual(strokesFor("D"), ["M1 1 V14 ", "M1 1 C13 0 13 15 1 14"]);
  for (const char of "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789äöüß")
    assert.ok(strokesFor(char)?.length);
});

test("a section grows to fit coincident labels and a connector goes around the middle word", () => {
  const write = (x: number, y: number, text: string): BoardCommand => ({
    op: "write",
    at: [x, y],
    text,
    ink: "ink",
  });
  const middle = write(208, 75, "since");
  const commands = [middle, ...Array.from({ length: 7 }, () => write(200, 76, "2020"))];
  const layout = layoutBoard(commands);
  assert.ok(layout.height > 300);
  const labels = [...layout.labels.values()].map((l) => l.box);
  labels.slice(1).forEach((box, i) => assert.ok(box.y >= labels[i].y + labels[i].h));
  const arrow = layout.arrow([50, 85], [550, 85]);
  assert.deepEqual(arrow[0], [50, 85]);
  assert.deepEqual(arrow.at(-1), [550, 85]);
  assert.ok(arrow.length > 2);
  for (let i = 1; i < arrow.length; i++) {
    for (let k = 0; k <= 100; k++) {
      const x = arrow[i - 1][0] + ((arrow[i][0] - arrow[i - 1][0]) * k) / 100;
      const y = arrow[i - 1][1] + ((arrow[i][1] - arrow[i - 1][1]) * k) / 100;
      assert.ok(!labels.some((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h));
    }
  }
});
