import assert from "node:assert/strict";
import test from "node:test";
import {
  askPracticeModel,
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

test("the ring retains practice beside the five help services, disabled for unusable selections", () => {
  const expected = [
    "explain",
    "meaning",
    "word_by_word",
    "why_form",
    "common_mistake",
    "make_cards",
    "make_mcq",
  ];
  for (const kind of [
    "word",
    "phrase",
    "sentence",
    "rule",
    "table_cells",
    "arabic_only",
    "too_long",
    "non_text",
  ] as const) {
    const items = ringItems({ actions: availableActions(kind) });
    assert.deepEqual(
      items.map((item) => item.id),
      expected,
    );
    for (const id of ["make_cards", "make_mcq"]) {
      const item = items.find((item) => item.id === id)!;
      assert.equal(item.disabled, kind === "too_long" || kind === "non_text");
      assert.ok(item.disabledReason);
    }
  }
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

test("model replies are read with prose or a stray brace before the JSON, or as a bare list", () => {
  assert.deepEqual(readJson('Here you go: {"cards":[]}'), { cards: [] });
  assert.deepEqual(readJson('Use {curly} words. {"cards":[{"front":"a","back":"b"}]}'), {
    cards: [{ front: "a", back: "b" }],
  });
  assert.deepEqual(readJson('[{"front":"a","back":"b"}]'), [{ front: "a", back: "b" }]);
  assert.equal(readJson("no json at all"), null);
});

test("cards: a close key or a bare list is accepted; a slightly long meaning is shortened", () => {
  const long = "معنى ".repeat(48).trim(); // about 240 characters
  const cards = cleanCards(
    { flashcards: [{ front: "Guten Morgen", back: long, note: "" }] },
    LESSON,
    5,
  );
  assert.equal(cards.length, 1);
  assert.ok(cards[0].back.length <= 200 && cards[0].back.endsWith("…"));
  assert.equal(cleanCards([{ front: "Wie geht's", back: "كيفك؟" }], LESSON, 5).length, 1);
});

type Call = { body: Record<string, unknown> };
function fakeFetch(responses: (Response | Error)[]) {
  const calls: Call[] = [];
  const fn = (async (_url: unknown, init?: RequestInit) => {
    calls.push({ body: JSON.parse(String(init?.body)) });
    const next = responses.shift();
    if (!next) throw new Error("no more responses");
    if (next instanceof Error) throw next;
    return next;
  }) as typeof fetch;
  return { fn, calls };
}
const answer = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }] }));
const base = {
  key: "k",
  system: "s",
  user: "u",
  maxTokens: 100,
  wait: async () => undefined,
  log: () => undefined,
};

test("practice model: no JSON mode, low reasoning, the JSON read from the answer", async () => {
  const { fn, calls } = fakeFetch([answer('Sure! {"cards":[]}')]);
  const result = await askPracticeModel({ ...base, fetch: fn });
  assert.deepEqual(result, { ok: true, reply: { cards: [] } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.response_format, undefined);
  assert.equal(calls[0].body.reasoning_effort, "low");
});

test("practice model: a busy service or an answer without JSON is tried once more", async () => {
  const waits: number[] = [];
  const busy = fakeFetch([new Response("slow down", { status: 429 }), answer('{"questions":[]}')]);
  const ok = await askPracticeModel({
    ...base,
    fetch: busy.fn,
    wait: async (ms) => void waits.push(ms),
  });
  assert.equal(ok.ok, true);
  assert.deepEqual(waits, [1500]);
  const empty = fakeFetch([answer(""), answer("still nothing")]);
  assert.deepEqual(await askPracticeModel({ ...base, fetch: empty.fn }), {
    ok: false,
    reason: "failed",
  });
  assert.equal(empty.calls.length, 2);
});

test("practice model: a refused request retries without the reasoning option; no key or a bad key stops", async () => {
  const refused = fakeFetch([new Response("bad", { status: 400 }), answer('{"cards":[]}')]);
  assert.equal((await askPracticeModel({ ...base, fetch: refused.fn })).ok, true);
  assert.equal(refused.calls[1].body.reasoning_effort, undefined);
  const denied = fakeFetch([new Response("no", { status: 401 })]);
  assert.deepEqual(await askPracticeModel({ ...base, fetch: denied.fn }), {
    ok: false,
    reason: "failed",
  });
  assert.equal(denied.calls.length, 1);
  const none = fakeFetch([]);
  assert.deepEqual(await askPracticeModel({ ...base, key: null, fetch: none.fn }), {
    ok: false,
    reason: "no_key",
  });
  assert.equal(none.calls.length, 0);
});

test("practice model: a timeout says slow, and no second try once the budget is spent", async () => {
  const timeout = Object.assign(new Error("The operation timed out."), { name: "TimeoutError" });
  let clock = 0;
  const slow = fakeFetch([timeout, answer('{"cards":[]}')]);
  const result = await askPracticeModel({
    ...base,
    fetch: slow.fn,
    budgetMs: 25_000,
    now: () => clock,
    wait: async () => {
      clock = 20_000;
    },
  });
  assert.deepEqual(result, { ok: false, reason: "slow" });
  assert.equal(slow.calls.length, 1);
});
