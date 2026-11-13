import assert from "node:assert/strict";
import test from "node:test";
import { askPracticeModel } from "../study/study-practice.ts";
import { covers, hiddenWords, rng } from "./engine.ts";
import { BY_WORD, LEXICON } from "./lexicon.ts";
import {
  buildRound,
  cleanCandidates,
  clueKey,
  DICTIONARY,
  LEVEL_IDS,
  LEVELS,
  listCandidates,
  listRound,
  roundUserMessage,
  validRound,
  type Round,
  type RoundWord,
} from "./round.ts";

function assertGoodRound(round: Round) {
  const info = LEVELS[round.level];
  assert.equal(validRound(round), true, "the round passes its own check");
  assert.deepEqual(
    round.words.map((w) => w.length).sort(),
    [...info.lengths].sort(),
    "word lengths fit the level",
  );
  assert.equal(round.rows * round.cols, round.letters.length);
  const grid = { rows: round.rows, cols: round.cols, letters: round.letters };
  assert.equal(covers(grid, round.words, 0, 2).count, 1, "exactly one answer");
  const keys = round.info.map((w) => clueKey(w.ar));
  assert.equal(new Set(keys).size, keys.length, "every Arabic meaning differs");
  assert.equal(new Set(round.words).size, round.words.length, "no word twice");
  const hidden = hiddenWords(grid, DICTIONARY, new Set(round.words));
  assert.ok(hidden.length <= Math.ceil(round.letters.length / 6), `few decoys: ${hidden}`);
  assert.ok(
    hidden.every((w) => w.length < 5),
    `no long decoy: ${hidden}`,
  );
  round.info.forEach((w, i) => assert.equal(w.word, round.words[i], "info follows the words"));
}

test("rounds from the built-in list: every level, many seeds, always one answer", () => {
  for (const level of LEVEL_IDS)
    for (let seed = 1; seed <= 25; seed++) {
      const round = listRound(level, rng(seed));
      assert.equal(round.source, "list");
      assertGoodRound(round);
    }
});

test("rounds are random: different seeds give different grids", () => {
  const grids = new Set(
    Array.from({ length: 20 }, (_, i) => listRound("medium", rng(100 + i)).letters),
  );
  assert.ok(grids.size >= 18, `${grids.size} different grids of 20`);
});

test("recently seen words are skipped when the list allows it", () => {
  const avoid = listCandidates("easy")
    .slice(0, 20)
    .map((c) => c.word);
  for (let seed = 1; seed <= 10; seed++) {
    const round = listRound("easy", rng(seed), avoid);
    assert.ok(round.words.every((w) => !avoid.includes(w)));
  }
});

const good = (word: string, ar: string): RoundWord => ({
  word,
  ar,
  example: `I like the ${word.toLowerCase()}.`,
  exampleAr: "مثال بالعربي.",
});

test("the AI's words are checked: bad ones are dropped, good ones kept", () => {
  const reply = {
    words: [
      good("lamp", "مصباح"),
      { ...good("LAMP", "سراج") }, // repeat
      good("LAMPS", "مصابيح"), // wrong length for easy anyway
      good("DOOR", "باب"),
      good("DO-R", "باب ثاني"), // not letters only
      good("KILL", "يقتل"), // blocked
      good("GATE", "باب كبير"), // same Arabic meaning as DOOR
      { word: "SHIP", ar: "ship", example: "A big ship.", exampleAr: "سفينة كبيرة." }, // no Arabic
      { word: "MOON", ar: "قمر", example: "The sky is dark.", exampleAr: "السما معتمة." }, // example lacks the word
      { word: "STAR", ar: "نجمة", example: "A bright star.", exampleAr: "نجمة لامعة." },
      null,
      "BIRD",
      { word: 12 },
    ],
  };
  const kept = cleanCandidates(reply, "easy").map((c) => c.word);
  assert.deepEqual(kept, ["LAMP", "DOOR", "STAR"]);
});

test("the AI's reply in an odd shape gives no words, never an error", () => {
  for (const reply of [null, undefined, "words", 5, {}, { words: "x" }, [[1, 2]]])
    assert.deepEqual(cleanCandidates(reply, "medium"), []);
  // A bare list is accepted too.
  assert.equal(cleanCandidates([good("LIGHT", "ضوء")], "medium").length, 1);
});

test("plurals of a word already chosen are dropped", () => {
  const kept = cleanCandidates(
    { words: [good("BOOK", "كتاب"), good("BOOKS", "كتب"), good("CAKE", "كعكة")] },
    "hard",
  ).map((c) => c.word);
  // Hard has no 4-letter words, so BOOK is not kept and BOOKS stands alone.
  assert.deepEqual(kept, ["BOOKS"]);
  const medium = cleanCandidates(
    { words: [good("HOUSE", "منزل"), good("HOUSES", "منازل")] },
    "medium",
  );
  assert.deepEqual(
    medium.map((c) => c.word),
    ["HOUSE"],
  );
});

test("a round from AI words (fake reply) is built and marked as AI", () => {
  const ai = listCandidates("hard").map((c) => ({ ...c, word: c.word.toLowerCase() }));
  const round = buildRound(cleanCandidates({ words: ai }, "hard"), "hard", "ai", rng(7));
  assert.ok(round);
  assert.equal(round.source, "ai");
  assertGoodRound(round);
});

test("words whose meanings start alike never share a round", () => {
  const pool = [
    good("ROOM", "غرفة"),
    good("BEDS", "غرفة نوم"),
    ...listCandidates("easy").filter((c) => !["ROOM"].includes(c.word)),
  ];
  for (let seed = 1; seed <= 30; seed++) {
    const round = buildRound(pool, "easy", "ai", rng(seed));
    assert.ok(round);
    assert.ok(!(round.words.includes("ROOM") && round.words.includes("BEDS")));
  }
});

test("too few words of a length make no round (the server then uses the list)", () => {
  const few = listCandidates("easy").slice(0, 3);
  assert.equal(buildRound(few, "easy", "ai", rng(1)), null);
  assert.equal(buildRound([], "medium", "ai", rng(1)), null);
});

test("a changed round is refused before it is played", () => {
  const round = listRound("easy", rng(3));
  assert.equal(validRound({ ...round, letters: round.letters.slice(1) }), false);
  assert.equal(validRound({ ...round, words: [...round.words].reverse() }), false);
  const paths = round.paths.map((p) => [...p]);
  paths[0][0] = paths[1][0];
  assert.equal(validRound({ ...round, paths }), false);
  assert.equal(validRound({ ...round, level: "expert" }), false);
  assert.equal(validRound(null), false);
});

test("the request names the lengths, the topic and the words to avoid", () => {
  const message = roundUserMessage("hard", "animals", ["TIGER", "HORSE"]);
  assert.match(message, /4 words of exactly 5 letters/);
  assert.match(message, /7 words of exactly 6 letters/);
  assert.match(message, /animals/);
  assert.match(message, /TIGER, HORSE/);
});

test("the whole path with a fake Groq answer: JSON in the text becomes a round", async () => {
  const words = listCandidates("medium").slice(0, 14);
  const fakeFetch = (async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: `Here you go:\n${JSON.stringify({ words })}` } }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as typeof fetch;
  const asked = await askPracticeModel({
    fetch: fakeFetch,
    key: "test",
    system: "s",
    user: "u",
    maxTokens: 100,
    log: () => undefined,
  });
  assert.equal(asked.ok, true);
  if (!asked.ok) return;
  const round = buildRound(cleanCandidates(asked.reply, "medium"), "medium", "ai", rng(11));
  assert.ok(round);
  assertGoodRound(round);
});

// ---- the built-in list itself ----------------------------------------------------------------

test("every built-in word has a meaning and an example that uses it", () => {
  for (const e of LEXICON) {
    assert.match(e.word, /^[A-Z]{4,7}$/, e.word);
    assert.ok(e.ar && e.exampleAr, e.word);
    assert.match(e.example, new RegExp(`\\b${e.word.slice(0, 3)}`, "i"), e.word);
  }
});

test("the built-in list: no repeats, no clashing meanings, nothing blocked", () => {
  assert.equal(BY_WORD.size, LEXICON.length);
  assert.ok(LEXICON.length >= 250);
  // Full meanings differ; words whose meanings start alike (ROOM / BEDROOM) never share a round.
  assert.equal(new Set(LEXICON.map((e) => e.ar)).size, LEXICON.length, "every meaning differs");
  for (const banned of ["KILL", "GUN", "WAR", "DEAD"]) assert.equal(BY_WORD.has(banned), false);
});
