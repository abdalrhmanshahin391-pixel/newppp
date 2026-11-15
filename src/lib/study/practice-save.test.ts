import assert from "node:assert/strict";
import test from "node:test";
import {
  cardFaces,
  newCards,
  picked,
  savedLectureTitle,
  toLectureQuestions,
} from "./practice-save.ts";

const mcq = {
  question: "Which is right?",
  options: ["I is", "I am", "I are", "I be"] as [string, string, string, string],
  answer: 1,
  why: "With I we use am.",
};

test("a practice question becomes a Lecture Lab question with one right option", () => {
  const [q] = toLectureQuestions([mcq], "  I am happy  ");
  assert.equal(q.stem, "Which is right?");
  assert.deepEqual(
    q.options.map((o) => [o.letter, o.is_correct]),
    [
      ["A", false],
      ["B", true],
      ["C", false],
      ["D", false],
    ],
  );
  assert.equal(q.explanation, "With I we use am.");
  assert.equal(q.point_ref, "I am happy");
});

test("a broken question is left out instead of saved wrong", () => {
  const empty = { ...mcq, options: ["a", "", "c", "d"] as [string, string, string, string] };
  const noAnswer = { ...mcq, answer: 7 };
  assert.equal(toLectureQuestions([empty, noAnswer, mcq], "").length, 1);
  assert.equal(toLectureQuestions([mcq], "")[0].point_ref, null);
});

test("the saved lecture is named after its source and the selection", () => {
  assert.equal(savedLectureTitle("Present simple", "I am"), "Present simple · «I am»");
  assert.equal(savedLectureTitle("", ""), "درس");
  assert.ok(savedLectureTitle("x".repeat(300), "y").length <= 160);
});

test("a card keeps its note under the meaning; a card already on the board is not added twice", () => {
  assert.deepEqual(cardFaces({ front: " der Hund ", back: "الكلب", note: "Plural: die Hunde" }), {
    front: "der Hund",
    back: "الكلب\nPlural: die Hunde",
  });
  assert.equal(cardFaces({ front: "a", back: "b", note: "" }).back, "b");
  const result = newCards(
    [{ front: "Der Hund" }],
    [{ front: "der  hund" }, { front: "die Katze" }, { front: "Die Katze" }, { front: "  " }],
  );
  assert.deepEqual(
    result.add.map((c) => c.front),
    ["die Katze"],
  );
  assert.equal(result.skipped, 3);
});

test("only the ticked items are saved, in order", () => {
  assert.deepEqual(picked(["a", "b", "c"], new Set([2, 0])), ["a", "c"]);
});
