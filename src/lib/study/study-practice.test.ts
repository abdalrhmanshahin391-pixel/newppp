import assert from "node:assert/strict";
import test from "node:test";
import {
  askPracticeModel,
  cleanCards,
  cleanMcqs,
  looseText,
  maxCards,
  mcqCount,
  NO_CARDS_TEXT,
  PRACTICE_FAILURE_TEXT,
  practiceFailureView,
  readJson,
  shuffleOptions,
  quizScore,
  retryWrong,
  questionForUzyra,
  practiceTitle,
  PRACTICE_NOTE,
} from "./study-practice.ts";
import { ACTION_INFO, availableActions } from "./study-actions.ts";
import {
  languageFromId,
  languageItems,
  replyRingItems,
  RULE_NO_CARDS,
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
  assert.equal(maxCards(Array(60).fill("w").join(" ")), 8);
  assert.equal(maxCards(Array(60).fill("w").join(" "), "terms"), 8);
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

test("each wrong option keeps its own reason when the options are shuffled", () => {
  const whyNot = ["", "studys: y بتصير ies", "study: مع she بنزيد ending", "studyes: بنشيل y أول"];
  for (let seed = 0; seed < 20; seed += 1) {
    let value = seed / 20;
    const random = () => (value = (value * 9301 + 0.4927) % 1);
    const [q] = cleanMcqs(
      { questions: [{ ...GOOD, why_not: [...whyNot.slice(1, 2), "", ...whyNot.slice(2)] }] },
      1,
      random,
    );
    assert.ok(q.whyNot);
    assert.equal(q.whyNot![q.answer], "");
    q.options.forEach((option, index) => {
      if (index === q.answer) return;
      // The reason travelled with its option.
      const original = GOOD.options.indexOf(option);
      const given = [whyNot[1], "", whyNot[2], whyNot[3]][original];
      assert.equal(q.whyNot![index], given);
    });
  }
  // No reasons, or the wrong number of them: four empty lines, the question is still kept.
  const [plain] = cleanMcqs({ questions: [{ ...GOOD, why_not: ["only one"] }] }, 1);
  assert.deepEqual(plain.whyNot, ["", "", "", ""]);
});

test("the score, trying the wrong ones again, and the words sent to Uzyra", () => {
  const questions = [{ answer: 0 }, { answer: 2 }, { answer: 1 }];
  assert.deepEqual(quizScore(questions, { 0: 0, 1: 1 }), {
    answered: 2,
    right: 1,
    total: 3,
    done: false,
  });
  assert.deepEqual(quizScore(questions, { 0: 0, 1: 1, 2: 1 }).done, true);
  assert.deepEqual(retryWrong(questions, { 0: 0, 1: 1, 2: 1 }), {
    answers: { 0: 0, 2: 1 },
    first: 1,
  });
  const q = {
    ...GOOD,
    options: GOOD.options as [string, string, string, string],
    whyNot: ["", "x", "y", "z"] as [string, string, string, string],
  };
  const asked = questionForUzyra(q, 0);
  assert.ok(asked.reply.includes(asked.exact));
  assert.ok(asked.reply.includes(`الجواب الصح: ${GOOD.options[GOOD.answer]}`));
  assert.ok(asked.reply.includes(`أنا اخترت: ${GOOD.options[0]}`));
  assert.ok(asked.exact.length <= 600);
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

test("the wheel keeps its eight slices in fixed places, practice disabled for unusable selections", () => {
  // Clockwise from the top; the same in the lessons and the books.
  const expected = [
    "explain",
    "meaning",
    "make_cards",
    "make_mcq",
    "compare_arabic",
    "why_form",
    "word_by_word",
    "common_mistake",
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
    const unusable = kind === "too_long" || kind === "non_text";
    const mcq = items.find((item) => item.id === "make_mcq")!;
    assert.equal(mcq.disabled, unusable);
    assert.ok(mcq.disabledReason);
    // A rule or an Arabic explanation makes no flashcards (questions still test it).
    const cards = items.find((item) => item.id === "make_cards")!;
    assert.equal(cards.disabled, unusable || kind === "rule" || kind === "arabic_only");
    assert.ok(cards.disabledReason);
  }
  const rule = ringItems({ actions: availableActions("rule"), kind: "rule" });
  assert.equal(rule.find((item) => item.id === "make_cards")!.disabledReason, RULE_NO_CARDS);
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

test("a selection in Uzyra's answers keeps the wheel: the explain slice explains simply, the rest dim", () => {
  const items = replyRingItems();
  assert.equal(items.length, 8);
  assert.equal(items[0]!.id, "explain_reply");
  assert.equal(items[0]!.tone, "reply");
  assert.equal(items[0]!.label, "اشرحلي ببساطة");
  assert.ok(items.slice(1).every((item) => item.disabled && item.disabledReason));
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

test("a failed practice request says its real reason and offers the right next step", () => {
  // Not set up: no retry, and the words say it is a setting, not "try again in a bit".
  const noKey = practiceFailureView("no_key", "anything the server said");
  assert.equal(noKey.message, PRACTICE_FAILURE_TEXT.no_key);
  assert.equal(noKey.retry, false);
  assert.equal(noKey.alternative, null);
  assert.ok(!/كمان شوي/.test(noKey.message));
  // No cards from a rule: questions are offered instead, retrying the same cards is not.
  const noCards = practiceFailureView("no_cards", "x");
  assert.equal(noCards.message, NO_CARDS_TEXT);
  assert.equal(noCards.retry, false);
  assert.equal(noCards.alternative, "make_mcq");
  // This month's Groq requests are used up: the server's words, and no retry.
  const usedUp = practiceFailureView("groq_requests_used", "خلصت طلبات Groq");
  assert.equal(usedUp.message, "خلصت طلبات Groq");
  assert.equal(usedUp.retry, false);
  // Everything else keeps the server's own words and a retry.
  for (const code of ["busy", "slow", "failed", "no_questions", "rate_limited", undefined]) {
    const view = practiceFailureView(code, "نص السيرفر");
    assert.equal(view.message, "نص السيرفر");
    assert.equal(view.retry, true);
    assert.equal(view.alternative, null);
  }
});

test("a practice is named by what it makes, with one line on where it came from", () => {
  assert.equal(practiceTitle({ action: "make_cards" }), "فلاش كاردز");
  assert.equal(practiceTitle({ action: "make_mcq" }), "تمارين اختيار");
  assert.match(PRACTICE_NOTE, /الجزء اللي حدّدته/);
});

test("card styles: a short selection is one card, a paragraph starts with its important words", async () => {
  const { cardStylesFor, cardStyleLabel } = await import("./study-practice.ts");
  assert.deepEqual(cardStylesFor("on the bench"), ["terms"]);
  assert.deepEqual(cardStylesFor("Some people were sitting on the bench outside the door."), [
    "terms",
    "sentences",
  ]);
  assert.equal(cardStyleLabel("terms"), "كلمات مهمة");
  assert.equal(cardStyleLabel("sentences"), "جمل كاملة");
});

test("word cards hold a word or a short expression from the text; sentence cards may be long", async () => {
  const { cleanCards, cardsSystemPrompt, maxCards } = await import("./study-practice.ts");
  const text =
    "Some people were sitting on the bench outside the door, and they looked at me with pity because I was going to the castle of the Count.";
  const reply = {
    cards: [
      { front: "bench", back: "مقعد طويل", note: "sitting on the bench" },
      { front: "outside the door", back: "برا الباب", note: "" },
      { front: "looked at me with pity because I was going", back: "طلعوا فيّ بشفقة", note: "" },
      { front: "castle", back: "قلعة", note: "" },
      { front: "dragon", back: "تنين", note: "" },
    ],
  };
  assert.deepEqual(
    cleanCards(reply, text, 12, "terms").map((c) => c.front),
    ["bench", "outside the door", "castle"],
    "a sentence-long front and a word that is not in the text are dropped",
  );
  const sentence = {
    cards: [{ front: text, back: "ناس كانوا قاعدين على المقعد برا الباب…", note: "" }],
  };
  assert.equal(cleanCards(sentence, text, 8, "sentences").length, 1, "a long sentence is kept");
  assert.equal(
    cleanCards(sentence, text, 8).length,
    0,
    "the original limits still apply without a style",
  );
  assert.match(cardsSystemPrompt(6, "terms"), /IMPORTANT WORDS AND EXPRESSIONS/);
  assert.match(cardsSystemPrompt(6, "sentences"), /whole sentences/);
  assert.equal(maxCards("One. Two three. Four five six.", "sentences"), 3);
});

// A paragraph as a PDF page gives it: words broken at line ends, with a hyphen and a space.
const BOOK =
  "In this chapter the author dis- cusses why politi- cians often put the truth in a subordinate place, and how they pick it up again when it suits them. Knowledge for its own sake, he says, takes this into account.";

test("word cards: broken PDF words, other forms and split expressions are found in the text", async () => {
  const reply = {
    cards: [
      { front: "discusses", back: "بيناقش (discuss)", note: "the author dis- cusses why" },
      { front: "politi- cians", back: "السياسيين (politician)", note: "" },
      { front: "subordinate place", back: "مكانة ثانوية", note: "" },
      { front: "pick up", back: "يرجع يتبنّاها", note: "pick it up again" },
      { front: "for its own sake", back: "لذاتها", note: "" },
      { front: "take into account", back: "ياخد بعين الاعتبار", note: "" },
      { front: "election", back: "انتخابات", note: "" },
      { front: "truthful", back: "صادق", note: "" },
      { front: "discuss", back: "يناقش", note: "" },
    ],
  };
  const { joinBrokenWords } = await import("./study-practice.ts");
  assert.equal(
    joinBrokenWords("dis\u00ADcusses politi-\ncians a well-known Anglo- Saxon"),
    "discusses politicians a well-known Anglo- Saxon",
    "a soft hyphen or a hyphen at a line end joins; a real hyphen and a capital stay",
  );
  const cards = cleanCards(reply, BOOK, 8, "terms");
  assert.deepEqual(
    cards.map((card) => card.front),
    [
      "discusses",
      "politicians",
      "subordinate place",
      "pick up",
      "for its own sake",
      "take into account",
    ],
    "a broken word counts whole, a word not in the text is dropped, the same word again too",
  );
  assert.equal(cards[0].note, "the author discusses why", "the note is shown with the word whole");
  assert.deepEqual(
    cleanCards({ cards: [{ front: "discuss", back: "يناقش" }] }, BOOK, 8, "terms").map(
      (card) => card.front,
    ),
    ["discuss"],
    "the dictionary form of a word in the text is kept",
  );
  const german = "Die Kinder spielen im Garten, und der Hund schläft unter dem Tisch.";
  assert.deepEqual(
    cleanCards(
      {
        cards: [
          { front: "Kind", back: "ولد" },
          { front: "spielt", back: "بيلعب" },
          { front: "die Katze", back: "القطة" },
        ],
      },
      german,
      8,
      "terms",
    ).map((card) => card.front),
    ["Kind", "spielt"],
  );
  const words = "a b c d e f g h i j k l".split(" ").map((w) => `${w}${w}${w}ing`);
  const many = cleanCards(
    { cards: words.map((front) => ({ front, back: "معنى" })) },
    words.join(" "),
    8,
    "terms",
  );
  assert.equal(many.length, 8, "the limit of eight holds");
});

test("sentence cards still copy the text exactly; the prompts ask for every useful item", async () => {
  const { cardsSystemPrompt } = await import("./study-practice.ts");
  const sentence =
    "In this chapter the author discusses why politicians often put the truth in a subordinate place, and how they pick it up again when it suits them.";
  assert.equal(
    cleanCards({ cards: [{ front: sentence, back: "معنى الجملة" }] }, BOOK, 8, "sentences").length,
    1,
    "a sentence with broken words is found once they are joined",
  );
  assert.equal(
    cleanCards(
      { cards: [{ front: sentence.replace("discusses", "discuss"), back: "معنى الجملة" }] },
      BOOK,
      8,
      "sentences",
    ).length,
    0,
    "a changed sentence is not in the text",
  );
  for (const style of ["terms", "sentences"] as const) {
    const prompt = cardsSystemPrompt(8, style);
    assert.doesNotMatch(prompt, /fewer is better/);
    assert.match(prompt, /Up to 8 cards|up to 8 cards/);
    assert.match(prompt, /dis- cusses/);
  }
  assert.match(cardsSystemPrompt(8, "terms"), /phrasal verbs/);
});
