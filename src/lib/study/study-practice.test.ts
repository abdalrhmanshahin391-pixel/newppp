import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanCards,
  cleanMcqs,
  looseText,
  maxCards,
  mcqCount,
  readJson,
  shuffleOptions,
} from "./study-practice.ts";
import { ACTION_INFO, availableActions } from "./study-actions.ts";
import {
  languageFromId,
  languageItems,
  replyRingItems,
  ringItems,
} from "../../components/rita-study/radial-items.ts";

const LESSON = "Guten Morgen! Wie geht's? | She studies at night and watches a film on Fridays.";

test("cards keep only fronts that are in the lesson", () => {
  const cards = cleanCards(
    {
      cards: [
        { front: "Guten Morgen", back: "صباح الخير", note: "" },
        { front: "Gute Nacht", back: "تصبح على خير" },
        { front: "She studies at night", back: "هي بتدرس بالليل", note: "study → studies" },
      ],
    },
    LESSON,
    12,
  );
  assert.deepEqual(
    cards.map((card) => card.front),
    ["Guten Morgen", "She studies at night"],
  );
});

test("cards drop repeats, empty meanings, a meaning equal to the front and too long text", () => {
  const cards = cleanCards(
    {
      cards: [
        { front: "Guten Morgen", back: "صباح الخير" },
        { front: "guten  morgen!", back: "صباح الخير" },
        { front: "Wie geht's", back: "" },
        { front: "Wie geht's", back: "Wie geht's" },
        { front: "She studies at night", back: "x".repeat(400) },
      ],
    },
    LESSON,
    12,
  );
  assert.equal(cards.length, 1);
});

test("cards: a rule with nothing to learn gives none, and the limit holds", () => {
  assert.deepEqual(cleanCards({ cards: [] }, LESSON, 5), []);
  assert.deepEqual(cleanCards(null, LESSON, 5), []);
  const many = cleanCards(
    { cards: ["Guten", "Morgen", "She", "night"].map((front) => ({ front, back: "معنى" })) },
    LESSON,
    2,
  );
  assert.equal(many.length, 2);
  assert.equal(maxCards("one"), 1);
  assert.equal(maxCards(Array(60).fill("w").join(" ")), 12);
});

const GOOD = {
  question: "شو الصح؟",
  options: ["She study", "She studies", "She studys", "She studying"],
  answer: 1,
  why: "مع she بنزيد -es بعد ما y تصير i.",
};

test("a question needs exactly four different options and a right answer among them", () => {
  const out = cleanMcqs(
    {
      questions: [
        GOOD,
        { ...GOOD, question: "ثلاث خيارات", options: GOOD.options.slice(0, 3) },
        { ...GOOD, question: "مكرر", options: ["a", "a", "b", "c"] },
        { ...GOOD, question: "جواب برّا", answer: 4 },
        { ...GOOD, question: "خيار فاضي", options: ["a", "", "b", "c"] },
        { ...GOOD, question: "" },
        GOOD,
      ],
    },
    5,
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].options.length, 4);
  assert.equal(out[0].options[out[0].answer], "She studies");
});

test("the right answer's place is shuffled and stays right", () => {
  const places = new Set<number>();
  for (let seed = 0; seed < 40; seed += 1) {
    let value = seed / 40;
    const random = () => (value = (value * 9301 + 0.4927) % 1);
    const { options, answer } = shuffleOptions(GOOD.options, GOOD.answer, random);
    assert.equal(options[answer], "She studies");
    assert.equal(new Set(options).size, 4);
    places.add(answer);
  }
  assert.ok(places.size > 1);
});

test("question count follows the size of the selection", () => {
  assert.equal(mcqCount("studies"), 1);
  assert.equal(mcqCount("She studies at night and watches a film"), 2);
  assert.equal(mcqCount(Array(80).fill("w").join(" ")), 5);
});

test("model replies are read with or without a code fence", () => {
  assert.deepEqual(readJson('```json\n{"cards":[]}\n```'), { cards: [] });
  assert.equal(readJson("no json"), null);
  assert.equal(looseText("Grüße, Straße!"), "grusse strasse");
});

test("the ring shows flashcards, questions and the language", () => {
  for (const kind of ["word", "phrase", "sentence", "rule", "table_cells", "arabic_only"] as const)
    assert.deepEqual(
      ringItems({ actions: availableActions(kind) }).map((item) => item.id),
      ["make_cards", "make_mcq", "lang", "window-demo"],
    );
  // Without a usable selection only the language is offered.
  assert.deepEqual(
    ringItems({ actions: availableActions("too_long") }).map((item) => item.id),
    ["lang", "window-demo"],
  );
  assert.equal(ACTION_INFO.make_cards.group, "cards");
  assert.equal(ACTION_INFO.make_mcq.group, "practice");
});

test("the language ring offers the three choices with the current one ticked, and back", () => {
  const items = languageItems("en");
  assert.deepEqual(
    items.map((item) => item.id),
    ["lang:ar", "lang:en", "lang:automatic", "lang:back"],
  );
  assert.deepEqual(
    items.filter((item) => item.checked).map((item) => item.id),
    ["lang:en"],
  );
  assert.equal(languageFromId("lang:ar"), "ar");
  assert.equal(languageFromId("lang:automatic"), "automatic");
  assert.equal(languageFromId("lang:back"), null);
  assert.equal(languageFromId("make_mcq"), null);
});

test("a selection in Rita's answers offers only the simple explanation (and the language)", () => {
  const items = replyRingItems();
  assert.deepEqual(
    items.map((item) => item.id),
    ["explain_reply", "lang"],
  );
  assert.equal(items[0]!.tone, "reply");
  assert.equal(items[0]!.label, "اشرحلي ببساطة");
  // Never offered for a piece of the guide.
  for (const kind of ["word", "sentence", "rule", "table_cells"] as const)
    assert.ok(!availableActions(kind).includes("explain_reply"));
});
