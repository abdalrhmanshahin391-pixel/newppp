import assert from "node:assert/strict";
import test from "node:test";
import { anchorOffset, groundedStep, confirmsBoardStep } from "./whiteboard.ts";
import { strokesFor } from "../../components/rita-study/pen-strokes.ts";

test("board examples must come from the selected text", () => {
  const quote =
    "One verb is irregular: have → has. She studies at night and watches a film on Fridays.";
  const step = (source: string) => ({
    title: "Verbs",
    narration: "Notice the verb.",
    finished: true,
    rows: [{ source, explanation: "verb form" }],
  });
  for (const [source, passage] of [
    ["watch", "watch"],
    ["يقرأ", "هو يقرأ كتابًا."],
    ["liest", "Sie liest heute."],
    ["She studies", "She\nstudies"],
    ["الفعل", "الفعل have يتغير مع she."],
    ["studies at night", quote],
  ])
    assert.ok(groundedStep(step(source), passage));
  assert.equal(groundedStep(step("watches a film"), "She studies"), null);
  assert.equal(groundedStep(step("He walks"), quote), null);
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

test("marks address the chosen occurrence including suffixes and mixed directions", () => {
  const source = "قال has ثم has ثم watches";
  assert.equal(anchorOffset(source, { text: "has", occurrence: 2 }), source.lastIndexOf("has"));
  assert.equal(anchorOffset(source, { text: "es", occurrence: 1 }), source.length - 2);
  assert.equal(anchorOffset(source, { text: "has", occurrence: 3 }), -1);
  const result = groundedStep(
    {
      title: "فعل",
      narration: "شرح",
      finished: true,
      rows: [
        {
          source,
          explanation: "صيغة الفعل",
          marks: [{ kind: "circle", target: { text: "missing" } }],
        },
      ],
    },
    source,
  );
  assert.equal(result, null);
});
