import assert from "node:assert/strict";
import test from "node:test";
import { findItem } from "./rita-lesson-content.ts";
import { gradeItem, matchSpokenOption, publicItem, shuffledOrder } from "./rita-lesson-grader.ts";
import { SAMPLE_PROPERTY, SAMPLE_TO_BE } from "./rita-lesson-samples.ts";

const OPTIONS = ["am", "is", "are"];

test("a spoken answer names an option by itself or by its place", () => {
  assert.equal(matchSpokenOption(OPTIONS, "is"), "is");
  assert.equal(matchSpokenOption(OPTIONS, "Is."), "is");
  assert.equal(matchSpokenOption(OPTIONS, "it is is"), "is");
  assert.equal(matchSpokenOption(OPTIONS, "the second"), "is");
  assert.equal(matchSpokenOption(OPTIONS, "الثاني"), "is");
  assert.equal(matchSpokenOption(OPTIONS, "رقم واحد"), "am");
  assert.equal(matchSpokenOption(OPTIONS, "3"), "are");
});

test("speech that names nothing or two options is not a choice", () => {
  assert.equal(matchSpokenOption(OPTIONS, "his"), null);
  assert.equal(matchSpokenOption(OPTIONS, "is or are"), null);
  assert.equal(matchSpokenOption(OPTIONS, ""), null);
  assert.equal(matchSpokenOption(OPTIONS, "the first or the second"), null);
});

test("an option is matched before a place word, so an option called one still works", () => {
  assert.equal(matchSpokenOption(["one", "two"], "two"), "two");
});

test("a tapped choice is checked against the answer", () => {
  const item = findItem(SAMPLE_TO_BE, "p_they")!.item;
  assert.equal(gradeItem(item, { kind: "choice", value: "are" }, "s").status, "correct");
  assert.equal(gradeItem(item, { kind: "choice", value: "is" }, "s").status, "wrong");
  assert.equal(gradeItem(item, { kind: "choice", value: "be" }, "s").status, "unclear");
});

test("word order accepts the right tiles and a spoken sentence; a misheard sentence is unclear", () => {
  const item = findItem(SAMPLE_TO_BE, "q_teacher")!.item;
  const shown = publicItem(item, "s").tiles;
  const order = ["Is", "she", "a", "teacher?"].map(
    (text) => shown.find((tile) => tile.text === text)!.id,
  );
  assert.equal(gradeItem(item, { kind: "tiles", order }, "s").status, "correct");
  assert.equal(
    gradeItem(item, { kind: "tiles", order: [...order].reverse() }, "s").status,
    "wrong",
  );
  assert.equal(gradeItem(item, { kind: "tiles", order: order.slice(1) }, "s").status, "unclear");
  assert.equal(
    gradeItem(item, { kind: "tiles", order: [order[0], order[0], order[1], order[2]] }, "s").status,
    "unclear",
  );
  assert.equal(
    gradeItem(item, { kind: "spoken", text: "Is she a teacher?" }, "s").status,
    "correct",
  );
  assert.equal(
    gradeItem(item, { kind: "spoken", text: "she is a teacher" }, "s").status,
    "unclear",
  );
});

test("tile ids are positions on screen and say nothing about the right order", () => {
  const item = findItem(SAMPLE_TO_BE, "q_teacher")!.item;
  const tiles = publicItem(item, "seed-x").tiles;
  assert.deepEqual(
    tiles.map((tile) => tile.id),
    ["p0", "p1", "p2", "p3"],
  );
  assert.notDeepEqual(
    tiles.map((tile) => tile.text),
    ["Is", "she", "a", "teacher?"],
  );
});

test("spelling tiles can only be answered by tapping", () => {
  const item = findItem(SAMPLE_PROPERTY, "spell_1")!.item;
  const shown = publicItem(item, "s");
  assert.equal(shown.voice, false);
  assert.equal(shown.word, "", "the word to spell is the answer and is never shown");
  assert.ok(!JSON.stringify(shown).includes("property"));
  assert.equal(shown.clue_ar, "ملكية، عقار");
  const grade = gradeItem(item, { kind: "spoken", text: "property" }, "s");
  assert.equal(grade.status, "unclear");
  const order = ["prop", "er", "ty"].map(
    (text) => shown.tiles.find((tile) => tile.text === text)!.id,
  );
  assert.equal(gradeItem(item, { kind: "tiles", order }, "s").status, "correct");
});

test("meaning options are shuffled; a fill-in can keep the book's order", () => {
  const fill = publicItem(findItem(SAMPLE_TO_BE, "p_i")!.item, "s");
  assert.deepEqual(fill.options, ["am", "is", "are"]);
  const seen = new Set<string>();
  for (const seed of ["a", "b", "c", "d", "e", "f"]) {
    seen.add(publicItem(findItem(SAMPLE_PROPERTY, "m_owner")!.item, seed).options.join());
  }
  assert.ok(seen.size > 1, "the right meaning is not always in the same place");
});

test("a shuffle is never the original order when it can avoid it", () => {
  for (const seed of ["a", "b", "c", "x", "y", "z"]) {
    const order = shuffledOrder(2, seed);
    assert.deepEqual(order, [1, 0]);
  }
  assert.deepEqual(shuffledOrder(1, "a"), [0]);
});
