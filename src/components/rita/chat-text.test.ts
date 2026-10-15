import assert from "node:assert/strict";
import test from "node:test";
import {
  groupTurns,
  parseParagraph,
  showCaption,
  splitParagraphs,
  textDirection,
} from "./chat-text.ts";

test("Arabic with a German word reads right to left", () => {
  assert.equal(textDirection('إيه، بدي أسألك شو معنى "صباح الخير" بالألماني؟ Guten Morgen'), "rtl");
  assert.equal(textDirection("Hi, I'm Rita. What would you like to practise?"), "ltr");
  assert.equal(textDirection("Good morning, يا صديقي and welcome to the lesson today"), "ltr");
  assert.equal(textDirection("12345 ?!"), "ltr");
  // An Arabic sentence around bolded English phrases is still Arabic.
  assert.equal(
    textDirection("فيك تقول **Good morning, again** أو **Good morning, once more**."),
    "rtl",
  );
  assert.equal(textDirection("Say hello (مرحبا) to Anna and everybody"), "ltr");
  assert.equal(textDirection(""), "ltr");
});

test("bold markers never show and German words are set apart in Arabic text", () => {
  const segments = parseParagraph("إذا حابب تقول صباح الخير بالألماني هو **Guten Morgen**.", "rtl");
  assert.deepEqual(
    segments.filter((s) => s.kind === "foreign").map((s) => s.value),
    ["Guten Morgen"],
  );
  assert.ok(segments.every((s) => !s.value.includes("*")));
});

test("a Latin phrase without bold is also set apart; commas split phrases", () => {
  const segments = parseParagraph("فيك تقول Good morning, again أو once more.", "rtl");
  assert.deepEqual(
    segments.filter((s) => s.kind === "foreign").map((s) => s.value),
    ["Good morning", "again", "once more"],
  );
});

test("bold Arabic stays bold and English messages get no foreign chips", () => {
  const arabic = parseParagraph("هذه **كلمة مهمة** جدًا", "rtl");
  assert.deepEqual(
    arabic.filter((s) => s.kind === "bold").map((s) => s.value),
    ["كلمة مهمة"],
  );
  const english = parseParagraph("Say **Good morning** to Anna", "ltr");
  assert.deepEqual(
    english.filter((s) => s.kind === "foreign"),
    [],
  );
  assert.deepEqual(
    english.filter((s) => s.kind === "bold").map((s) => s.value),
    ["Good morning"],
  );
});

test("unbalanced asterisks are dropped without losing text", () => {
  const joined = (text: string, dir: "rtl" | "ltr") =>
    parseParagraph(text, dir)
      .map((s) => s.value)
      .join("");
  assert.equal(joined("قل **Guten Morgen", "rtl"), "قل Guten Morgen");
  assert.equal(joined("a ** b", "ltr"), "a  b");
  assert.equal(joined("****", "ltr"), "");
});

test("paragraphs split on line breaks and drop empty lines", () => {
  assert.deepEqual(splitParagraphs("one\n\n two \nthree"), ["one", "two", "three"]);
  assert.deepEqual(splitParagraphs("  \n "), []);
});

test("the live transcript hides once it matches the last message", () => {
  assert.equal(showCaption("hello", "hello"), false);
  assert.equal(showCaption(" hello ", "hello"), false);
  assert.equal(showCaption("hello wor", "hello"), true);
  assert.equal(showCaption("", "hello"), false);
  assert.equal(showCaption("hi", undefined), true);
});

test("quotes hugging a foreign word are dropped, lone quotes stay", () => {
  const joined = (text: string) =>
    parseParagraph(text, "rtl")
      .map((s) => s.value)
      .join("");
  assert.equal(joined("وتضيف \u201Cagain\u201D أو"), "وتضيف again أو");
  assert.equal(joined("قال \u201Cصباح\u201D و again"), "قال \u201Cصباح\u201D و again");
});

test("short pieces from the learner become one turn; Rita's replies stay apart", () => {
  const turns = groupTurns([
    { id: "1", role: "you" as const, text: "طيب،" },
    { id: "2", role: "you" as const, text: "أمم..." },
    { id: "3", role: "rita" as const, text: "أهلاً" },
    { id: "4", role: "rita" as const, text: "تفضل" },
    { id: "5", role: "you" as const, text: "شكراً" },
  ]);
  assert.deepEqual(
    turns.map((t) => [t.id, t.role, t.text]),
    [
      ["1", "you", "طيب، أمم..."],
      ["3", "rita", "أهلاً"],
      ["4", "rita", "تفضل"],
      ["5", "you", "شكراً"],
    ],
  );
});
