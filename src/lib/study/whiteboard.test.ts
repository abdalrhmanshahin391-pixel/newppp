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
