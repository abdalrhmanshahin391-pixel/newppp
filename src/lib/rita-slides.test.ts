import assert from "node:assert/strict";
import test from "node:test";
import {
  GeneratedDeckSchema,
  MAX_SLIDES,
  SlideDeckSchema,
  addSlide,
  deckProblem,
  finalizeSlides,
  moveSlide,
  removeSlide,
  stepSlide,
  suggestNextTopics,
  type Slide,
} from "./rita-slides.ts";

const draft = (kind: Slide["kind"], heading: string, source_page: number | null = null) => ({
  kind,
  heading,
  heading_ar: "",
  bullets: [],
  example: "",
  vocabulary: [],
  source_page,
  speaker_note: "",
});

test("generated decks need at least three slides and at most twelve", () => {
  assert.equal(GeneratedDeckSchema.safeParse({ slides: [draft("title", "A")] }).success, false);
  const three = { slides: [draft("title", "A"), draft("point", "B"), draft("recap", "C")] };
  assert.equal(GeneratedDeckSchema.safeParse(three).success, true);
  const many = {
    slides: Array.from({ length: MAX_SLIDES + 1 }, (_, i) => draft("point", `P${i}`)),
  };
  assert.equal(GeneratedDeckSchema.safeParse(many).success, false);
});

test("finalizeSlides numbers ids, clamps pages and fixes title and recap order", () => {
  const slides = finalizeSlides(
    [
      draft("point", "Rule", 40),
      draft("recap", "Recap", 3),
      draft("title", "Lesson", 1),
      draft("example", "Example", null),
    ],
    { from: 3, to: 5 },
  );
  assert.deepEqual(
    slides.map((slide) => slide.kind),
    ["title", "point", "example", "recap"],
  );
  assert.deepEqual(
    slides.map((slide) => slide.id),
    ["s1", "s2", "s3", "s4"],
  );
  assert.deepEqual(
    slides.map((slide) => slide.source_page),
    [3, 5, null, 3],
  );
  assert.equal(SlideDeckSchema.safeParse(slides).success, true);
});

test("a deck with a duplicate id or an empty heading is rejected", () => {
  const slides = finalizeSlides([draft("title", "A"), draft("point", "B"), draft("recap", "C")], {
    from: 1,
    to: 1,
  });
  assert.equal(deckProblem(slides), null);
  assert.match(deckProblem([slides[0], { ...slides[1], id: "s1" }]) ?? "", /duplicate slide id/);
  assert.match(deckProblem([{ ...slides[0], heading: "" }]) ?? "", /slide 1/);
});

test("addSlide keeps the recap last and stops at the limit", () => {
  const base = finalizeSlides([draft("title", "A"), draft("point", "B"), draft("recap", "C")], {
    from: 1,
    to: 1,
  });
  const added = addSlide(base, "example");
  assert.deepEqual(
    added.map((slide) => slide.kind),
    ["title", "point", "example", "recap"],
  );
  assert.equal(new Set(added.map((slide) => slide.id)).size, added.length);
  let full = base;
  for (let i = 0; i < 30; i += 1) full = addSlide(full);
  assert.equal(full.length, MAX_SLIDES);
});

test("moveSlide and removeSlide change order without losing slides", () => {
  const base = finalizeSlides([draft("title", "A"), draft("point", "B"), draft("point", "C")], {
    from: 1,
    to: 1,
  });
  const down = moveSlide(base, "s2", "down");
  assert.deepEqual(
    down.map((slide) => slide.heading),
    ["A", "C", "B"],
  );
  assert.equal(moveSlide(base, "s1", "up"), base);
  assert.equal(moveSlide(base, "s3", "down"), base);
  assert.equal(removeSlide(base, "s2").length, 2);
});

const suggestion = (topic: string, from: number, to: number) => ({
  topic,
  title_ar: "",
  from_page: from,
  to_page: to,
});
const lesson = (
  topic: string,
  from: number,
  to: number,
  status: "draft" | "published" | "archived" = "draft",
) => ({
  topic,
  title: topic,
  source_from_page: from,
  source_to_page: to,
  status,
});

test("suggestNextTopics offers three topics after the last lesson, in page order", () => {
  const result = suggestNextTopics({
    suggestions: [
      suggestion("Possessives", 8, 9),
      suggestion("To be", 1, 3),
      suggestion("Articles", 5, 6),
      suggestion("Plurals", 7, 7),
    ],
    lessons: [lesson("To be", 1, 3)],
    readCursor: 10,
  });
  assert.deepEqual(
    result.map((item) => item.topic),
    ["Articles", "Plurals", "Possessives"],
  );
});

test("suggestNextTopics skips used names, covered pages, unread pages and long ranges", () => {
  const result = suggestNextTopics({
    suggestions: [
      suggestion("TO BE", 1, 3),
      suggestion("Greetings", 2, 3),
      suggestion("Colours", 12, 14),
      suggestion("Numbers", 4, 30),
      suggestion("Numbers", 4, 6),
    ],
    lessons: [lesson("To be", 1, 3), lesson("Old", 9, 9, "archived")],
    readCursor: 10,
  });
  assert.deepEqual(result, [{ topic: "Numbers", title_ar: "", from_page: 4, to_page: 10 }]);
});

test("suggestNextTopics falls back to earlier gaps after the topics ahead", () => {
  const result = suggestNextTopics({
    suggestions: [suggestion("Gap", 3, 4), suggestion("Ahead", 9, 10)],
    lessons: [lesson("One", 1, 2), lesson("Two", 5, 8)],
    readCursor: 10,
  });
  assert.deepEqual(
    result.map((item) => item.topic),
    ["Ahead", "Gap"],
  );
});

test("stepping through a deck stops at both ends", () => {
  assert.equal(stepSlide(0, -1, 5), 0);
  assert.equal(stepSlide(0, 1, 5), 1);
  assert.equal(stepSlide(4, 1, 5), 4);
  assert.equal(stepSlide(2, 1, 0), 0);
  assert.equal(stepSlide(9, 1, 3), 2);
});
