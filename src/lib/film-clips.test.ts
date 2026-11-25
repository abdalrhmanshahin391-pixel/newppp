import assert from "node:assert/strict";
import test from "node:test";
import {
  checkTrim,
  choiceOptions,
  cleanClipIds,
  clipCredit,
  clipExercises,
  clipFromRow,
  clipMatches,
  clipProblems,
  CLIP_FILE_PATH,
  clipFilePath,
  formatSeconds,
  isGiphyUrl,
  mixedOrder,
  moveEntry,
  normalizeSearch,
  orderPuzzle,
  parseGiphySearch,
  sessionSteps,
  videoExtension,
} from "./film-clips.ts";

// A fixed sequence so shuffles are repeatable.
function seeded(seed = 7) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

const clip = (en: string, ar: string, target = "", target_ar = "") => ({
  en,
  ar,
  target,
  target_ar,
});

test("search finds English and Arabic words from their start, marks and hamza ignored", () => {
  const thanks = clip("Thank you.", "شكرًا لك.", "Thank", "شكرًا");
  assert.equal(clipMatches(thanks, "than"), true);
  assert.equal(clipMatches(thanks, "شكرا"), true, "tanween is ignored");
  assert.equal(clipMatches(thanks, "you thank"), true, "any word order");
  assert.equal(clipMatches(thanks, "ank"), false, "words match from their start");
  assert.equal(clipMatches(thanks, ""), true);
  const past = clip("You're lucky.", "أنت محظوظ", "lucky", "محظوظ");
  assert.equal(clipMatches(past, "youre"), true, "apostrophes are ignored");
  assert.equal(clipMatches(past, "انت"), true, "أ and ا are the same");
  assert.equal(normalizeSearch("  Hello,   WORLD! "), "hello world");
});

test("a clip needs two words, a meaning and a target word inside the sentence", () => {
  assert.deepEqual(
    clipProblems(clip("I'm searching for someone.", "أبحث", "searching", "أبحث")),
    [],
  );
  assert.deepEqual(clipProblems(clip("Hi", "مرحبا", "Hi", "مرحبا")), [
    "الجملة لازم تكون كلمتين أو أكثر عشان تمرين الترتيب.",
  ]);
  assert.deepEqual(clipProblems(clip("Good morning", "صباح الخير", "night", "ليل")), [
    "الكلمة المستهدفة لازم تكون موجودة بالجملة الإنجليزية.",
  ]);
  assert.equal(clipProblems(clip("Good morning", "", "", "")).length, 3);
  assert.deepEqual(
    clipProblems(clip("Good Morning", "صباح الخير", "morning", "صباح")),
    [],
    "the target is found whatever its case",
  );
});

test("the order puzzle starts at the target and keeps at least four words to order", () => {
  assert.deepEqual(orderPuzzle("This blade has a dark past.", "past"), {
    prefix: "This blade",
    words: ["has", "a", "dark", "past."],
  });
  assert.deepEqual(orderPuzzle("Thank you.", "Thank"), { prefix: "", words: ["Thank", "you."] });
  assert.deepEqual(
    orderPuzzle("You're a fool for traveling alone, so completely unprepared.", "alone"),
    { prefix: "You're a fool for traveling", words: ["alone,", "so", "completely", "unprepared."] },
  );
  assert.deepEqual(
    orderPuzzle("Good night my friend", "missing").prefix,
    "",
    "no target: all words",
  );
});

test("mixed order is never the right order", () => {
  for (let seed = 1; seed < 60; seed += 1) {
    const order = mixedOrder(2, seeded(seed));
    assert.notDeepEqual(order, [0, 1]);
    assert.deepEqual([...order].sort(), [0, 1]);
  }
  assert.deepEqual(mixedOrder(1), [0]);
});

test("choices hold the right answer and two different others", () => {
  const options = choiceOptions(
    "شكرًا لك.",
    ["شكرا لك", "أبحث عن شخص", "أنت محظوظ", "أنت محظوظ"],
    seeded(),
  );
  assert.equal(options.length, 3);
  assert.ok(options.includes("شكرًا لك."));
  assert.ok(!options.includes("شكرا لك"), "the same text without marks is not a second choice");
  assert.equal(new Set(options).size, 3);
  assert.deepEqual(choiceOptions("one", [], seeded()), ["one"], "a lone clip still works");
});

test("videos have meaning, order and speaking; silent GIFs have sentence and order", () => {
  assert.deepEqual(clipExercises("video"), ["meaning", "order", "speak"]);
  assert.deepEqual(clipExercises("gif"), ["sentence", "order"]);
  const steps = sessionSteps([{ kind: "video" }, { kind: "gif" }]);
  assert.equal(steps.length, 2 + 3 + 2);
  assert.deepEqual(steps.slice(0, 3), [
    { type: "intro", clip: 0 },
    { type: "intro", clip: 1 },
    { type: "exercise", clip: 0, exercise: "meaning" },
  ]);
  assert.deepEqual(steps.at(-1), { type: "exercise", clip: 1, exercise: "order" });
});

test("trim ranges", () => {
  assert.deepEqual(checkTrim(null, null, 12), { start: null, end: null, problem: "" });
  assert.deepEqual(checkTrim(1.234, 4.06, 12), { start: 1.2, end: 4.1, problem: "" });
  assert.equal(checkTrim(5, 4, 12).problem, "النهاية لازم تكون بعد البداية.");
  assert.match(checkTrim(null, null, 95).problem, /أطول من 30/);
  assert.deepEqual(checkTrim(10, 38, 95).problem, "", "a 28 s cut of a long video is fine");
  assert.deepEqual(checkTrim(0, 12, 12), { start: null, end: null, problem: "" }, "whole clip");
  assert.equal(checkTrim(2, 2.2, 12).problem, "المقطع قصير كتير.");
  assert.equal(formatSeconds(75.25), "1:15.3");
  assert.equal(formatSeconds(3), "0:03.0");
  assert.equal(formatSeconds(null), "");
});

test("upload paths and video types", () => {
  const id = "a7bdca95-d049-4647-96b4-b3ec749894ee";
  assert.equal(clipFilePath(id, "mp4"), `clips/${id}.mp4`);
  assert.ok(CLIP_FILE_PATH.test(clipFilePath(id, "jpg")));
  assert.ok(!CLIP_FILE_PATH.test(`clips/../${id}.mp4`));
  assert.ok(!CLIP_FILE_PATH.test(`other/${id}.mp4`));
  assert.equal(videoExtension("video/mp4", "a.bin"), "mp4");
  assert.equal(videoExtension("", "Clip.MOV"), "mov");
  assert.equal(videoExtension("image/gif", "a.gif"), null);
});

test("GIPHY: only GIFs with an mp4 and a still on GIPHY's hosts are kept", () => {
  assert.ok(isGiphyUrl("https://media2.giphy.com/media/x/giphy.mp4?cid=1"));
  assert.ok(isGiphyUrl("https://giphy.com/gifs/hello-x"));
  assert.ok(!isGiphyUrl("http://media.giphy.com/x.mp4"), "https only");
  assert.ok(!isGiphyUrl("https://giphy.com.evil.example/x.mp4"));
  assert.ok(!isGiphyUrl("not a url"));
  const reply = {
    data: [
      {
        id: "abc",
        title: "Hello GIF",
        url: "https://giphy.com/gifs/hello-abc",
        images: {
          original: { mp4: "https://media1.giphy.com/media/abc/giphy.mp4" },
          original_still: { url: "https://media1.giphy.com/media/abc/giphy_s.gif" },
          fixed_height: {
            mp4: "https://media1.giphy.com/media/abc/200.mp4",
            width: "356",
            height: "200",
          },
        },
      },
      { id: "no-media", images: {} },
      {
        id: "elsewhere",
        images: {
          original: { mp4: "https://evil.example/x.mp4" },
          original_still: { url: "https://evil.example/x.gif" },
        },
      },
    ],
    pagination: { total_count: 120 },
  };
  const parsed = parseGiphySearch(reply);
  assert.equal(parsed.total, 120);
  assert.deepEqual(parsed.results, [
    {
      id: "abc",
      title: "Hello GIF",
      page: "https://giphy.com/gifs/hello-abc",
      mp4: "https://media1.giphy.com/media/abc/giphy.mp4",
      still: "https://media1.giphy.com/media/abc/giphy_s.gif",
      preview: "https://media1.giphy.com/media/abc/200.mp4",
      width: 356,
      height: 200,
    },
  ]);
  assert.deepEqual(parseGiphySearch(null), { results: [], total: 0 });
});

test("rows, credits, stop order", () => {
  const row = clipFromRow({
    id: "x",
    kind: "video",
    en: "Thank you.",
    start_s: "1.50",
    end_s: null,
    legacy_id: 5,
    credit: "Sintel · © Blender Foundation · CC BY 3.0",
  });
  assert.equal(row.start_s, 1.5);
  assert.equal(row.end_s, null);
  assert.equal(row.legacy_id, 5);
  assert.equal(row.video_url, null);
  assert.equal(clipCredit(row), "Sintel · © Blender Foundation · CC BY 3.0");
  assert.equal(clipCredit({ kind: "gif", credit: "", source: "" }), "via GIPHY");
  assert.equal(clipCredit({ kind: "gif", credit: "@someone", source: "" }), "@someone · via GIPHY");
  assert.deepEqual(cleanClipIds(["a", "b", "a", "z", "c"], new Set(["a", "b", "c"])), [
    "a",
    "b",
    "c",
  ]);
  assert.deepEqual(moveEntry(["a", "b", "c"], 0, 1), ["b", "a", "c"]);
  assert.deepEqual(moveEntry(["a", "b", "c"], 0, -1), ["a", "b", "c"]);
});

test("a stop counts its library clips, or its older Sintel lines before the migration", async () => {
  const { stopClipCount } = await import("./rita-path-layout.ts");
  assert.equal(stopClipCount({ clip_ids: ["a", "b"], film_lines: [1, 2, 3] }), 2);
  assert.equal(
    stopClipCount({ clip_ids: [], film_lines: [1, 2, 3] }),
    0,
    "after the move, clip_ids wins",
  );
  assert.equal(stopClipCount({ film_lines: [1, 2, 3] }), 3);
  assert.equal(stopClipCount({}), 0);
});

test("the page's steps follow the stop's chosen exercises", async () => {
  const { pageSteps, stopExerciseList, pageClipExercises } = await import("./film-clips.ts");
  const video = {
    kind: "video" as const,
    en: "I am searching for someone.",
    target: "searching",
    target_ar: "أبحث",
  };
  const gif = {
    kind: "gif" as const,
    en: "Good night, Scales.",
    target: "night",
    target_ar: "ليلة",
  };
  assert.deepEqual(pageClipExercises(video), ["meaning", "listen", "blank", "order", "speak"]);
  assert.deepEqual(pageClipExercises(gif), ["sentence", "blank", "order"]);
  // No target in the sentence: no gap to fill.
  assert.deepEqual(pageClipExercises({ ...video, target: "dragon" }, ["blank", "order"]), [
    "order",
  ]);
  const all = pageSteps([video, gif]);
  assert.deepEqual(all.slice(0, 2), [
    { type: "watch", clip: 0 },
    { type: "watch", clip: 1 },
  ]);
  assert.deepEqual(all.at(-1), { type: "match" });
  assert.equal(all.length, 2 + 5 + 3 + 1);
  // Stages never go back: watch, then understand, then practise.
  const { stageOf } = await import("./film-clips.ts");
  const order = all.map(stageOf);
  assert.deepEqual([...new Set(order)], ["watch", "understand", "practise"]);
  assert.ok(
    order.every(
      (stage, i) =>
        i === 0 ||
        ["watch", "understand", "practise"].indexOf(stage) >=
          ["watch", "understand", "practise"].indexOf(order[i - 1]),
    ),
  );
  const some = pageSteps([video, gif], stopExerciseList(["order", "nonsense"]));
  assert.deepEqual(
    some.map((s) => s.type),
    ["watch", "watch", "exercise", "exercise"],
  );
  assert.deepEqual(stopExerciseList(null).length, 7);
  assert.deepEqual(stopExerciseList(["bad"]).length, 7);
  // One word only: nothing to match.
  assert.equal(pageSteps([video], ["match"]).length, 1);
});

test("fill the gap and match the words", async () => {
  const { blankParts, sameWord, matchPairs } = await import("./film-clips.ts");
  assert.deepEqual(blankParts("You are closer than you know.", "closer"), {
    before: "You are ",
    word: "closer",
    after: " than you know.",
  });
  assert.equal(blankParts("Thank you.", "dragon"), null);
  assert.ok(sameWord(" Closer! ", "closer"));
  assert.ok(sameWord("you’re", "you're"));
  assert.ok(!sameWord("close", "closer"));
  assert.ok(!sameWord("", ""));
  assert.deepEqual(
    matchPairs([
      { target: "night", target_ar: "ليلة" },
      { target: "Night", target_ar: "ليل" },
      { target: "lucky", target_ar: "" },
      { target: "dragon", target_ar: "تنين" },
    ]),
    [
      { en: "night", ar: "ليلة" },
      { en: "dragon", ar: "تنين" },
    ],
  );
});
