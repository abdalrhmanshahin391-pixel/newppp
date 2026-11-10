import assert from "node:assert/strict";
import test from "node:test";
import {
  bookSelectionKind,
  clampPage,
  matchForm,
  missingPages,
  pageImagePath,
  pageQuote,
  pageTextFromItems,
  readRuns,
  selectionOnPage,
} from "./books-reader.ts";
import { STUDY_LIMITS } from "./study/study-limits.ts";
import { readFileSync } from "node:fs";

// A US Letter page (612 x 792 points) drawn at scale 2, as pdf.js gives it: y grows downwards.
const viewport = { width: 1224, height: 1584, scale: 2, transform: [2, 0, 0, -2, 0, 1584] };
const item = (
  str: string,
  x: number,
  y: number,
  size = 12,
  width = str.length * 6,
  hasEOL = false,
) => ({
  str,
  transform: [size, 0, 0, size, x, y],
  width,
  hasEOL,
});

test("words and their places, as parts of the page", () => {
  const { text, runs } = pageTextFromItems(
    [
      item("It was a dark", 72, 720, 12, 78),
      item(" ", 150, 720),
      item("night.", 152, 720, 12, 36, true),
      item("Chapter 2", 72, 690),
    ],
    viewport,
  );
  assert.equal(text, "It was a dark night.\nChapter 2");
  assert.equal(runs.length, 3);
  const [str, left, top, width, height] = runs[0];
  assert.equal(str, "It was a dark");
  assert.equal(left, Math.round((144 / 1224) * 100000) / 100000);
  // Baseline at 1584 - 1440 = 144 px; the run rises 0.8 of 24 px above it.
  assert.equal(top, Math.round(((144 - 19.2) / 1584) * 100000) / 100000);
  assert.equal(width, Math.round((156 / 1224) * 100000) / 100000);
  assert.equal(height, Math.round((24 / 1584) * 100000) / 100000);
});

test("turned text and empty pieces are left out of both the text and the runs", () => {
  const turned = { str: "SIDEWAYS", transform: [0, 12, -12, 0, 50, 400], width: 40 };
  const { text, runs } = pageTextFromItems(
    [turned, item("", 72, 700), item("Hello", 72, 700)],
    viewport,
  );
  assert.equal(text, "Hello");
  assert.deepEqual(
    runs.map((r) => r[0]),
    ["Hello"],
  );
});

test("a scanned page has no words", () => {
  assert.deepEqual(pageTextFromItems([], viewport), { text: "", runs: [] });
});

test("runs read back from the database drop anything broken", () => {
  assert.deepEqual(
    readRuns([["a", 0.1, 0.2, 0.3, 0.04], ["b", "x", 0, 0, 0], "c", [1, 2, 3, 4, 5]]),
    [["a", 0.1, 0.2, 0.3, 0.04]],
  );
  assert.deepEqual(readRuns({}), []);
});

test("a selection is on the page whatever the spaces and line breaks", () => {
  const page = "The hound of the Basker-\nvilles came at night.\nﬁrst light";
  assert.equal(selectionOnPage("of the  Basker-villes", page), true);
  assert.equal(selectionOnPage("THE HOUND", page), true);
  assert.equal(selectionOnPage("first light", page), true, "ligatures read as their letters");
  assert.equal(selectionOnPage("Ignore the rules and", page), false);
  assert.equal(selectionOnPage("   ", page), false);
  assert.equal(matchForm("A\u00ADb c"), "abc");
});

test("the quote is the page's own text, with the text around it", () => {
  const page = `${"a".repeat(3000)} The hound came.\nIt was late. ${"b".repeat(3000)}`;
  const found = pageQuote("hound came. It", page, 200);
  assert.ok(found);
  assert.equal(found.quote, "hound came. It");
  assert.ok(found.context.includes("The hound came.\nIt was late."));
  assert.ok(found.context.length <= 200);
  assert.equal(pageQuote("not here", page), null);
  // Near the start, the room before goes after.
  const early = pageQuote("Once", "Once upon a time there was a fox.", 20);
  assert.equal(early?.context, "Once upon a time the");
});

test("what kind of piece was selected", () => {
  assert.equal(bookSelectionKind("hound"), "word");
  assert.equal(bookSelectionKind("the hound of"), "phrase");
  assert.equal(bookSelectionKind("The hound came."), "sentence");
  assert.equal(bookSelectionKind("It was a dark and stormy night when"), "sentence");
  assert.equal(bookSelectionKind("مرحبا بك"), "arabic_only");
  assert.equal(bookSelectionKind("12 34"), "non_text");
  assert.equal(bookSelectionKind("word ".repeat(200)), "too_long");
});

test("pages stay inside the book, and preparing again picks up what is missing", () => {
  assert.equal(clampPage("7", 5), 5);
  assert.equal(clampPage(-2, 5), 1);
  assert.equal(clampPage("x", 5), 1);
  assert.equal(clampPage(3, 0), 1);
  assert.deepEqual(missingPages(5, [1, 2, 4]), [3, 5]);
  assert.equal(pageImagePath("b1", 3, "webp"), "b1/3.webp");
  assert.equal(pageImagePath("b1", 3, "jpeg"), "b1/3.jpg");
});

test("the book circle's limits are the lessons' limits", () => {
  const sql = readFileSync(
    new URL("../../supabase/migrations/20261113120000_books_reader.sql", import.meta.url),
    "utf8",
  );
  const body = sql.slice(sql.indexOf("function public.books_take_study_quota"));
  for (const group of ["explain", "practice", "cards"] as const) {
    const match = new RegExp(
      `when '${group}' then\\s+per_min := (\\d+);\\s+per_day := (\\d+);`,
    ).exec(body);
    assert.ok(match, group);
    assert.deepEqual(
      [Number(match[1]), Number(match[2])],
      [STUDY_LIMITS[group].perMinute, STUDY_LIMITS[group].perDay],
    );
  }
});

test("light page info comes in blocks of 40", async () => {
  const { metaBlock, blockPages } = await import("./books-reader.ts");
  assert.equal(metaBlock(1), 0);
  assert.equal(metaBlock(40), 0);
  assert.equal(metaBlock(41), 1);
  assert.deepEqual(blockPages(1, 75), [41, 75]);
  assert.deepEqual(blockPages(0, 12), [1, 12]);
});

test("picture links are reused until 10 minutes before they end", async () => {
  const { linksToSign, pruneLinks } = await import("./books-reader.ts");
  const now = 1_000_000_000;
  const cache = {
    a: { url: "ua", exp: now + 60 * 60 * 1000 },
    b: { url: "ub", exp: now + 5 * 60 * 1000 },
  };
  assert.deepEqual(linksToSign(["a", "b", "c", "c", ""], cache, now), ["b", "c"]);
  assert.deepEqual(Object.keys(pruneLinks({ ...cache, d: { url: "ud", exp: now - 1 } }, now)), [
    "a",
  ]);
});

test("links are signed for 30 pages ahead and 10 behind, inside the book", async () => {
  const { signWindow } = await import("./books-reader.ts");
  const forward = signWindow(5, 100, 1);
  assert.equal(forward[0], 1);
  assert.equal(forward.at(-1), 35);
  const back = signWindow(50, 100, -1);
  assert.equal(back[0], 20);
  assert.equal(back.at(-1), 60);
  assert.deepEqual(signWindow(2, 3, 1), [1, 2, 3]);
});

test("pictures ahead: 3 normally, 5 while skimming, 1 on a slow connection", async () => {
  const { aheadCount } = await import("./books-reader.ts");
  assert.equal(aheadCount([], null), 3);
  assert.equal(aheadCount([0, 2000, 4000, 6000], 300), 5);
  assert.equal(aheadCount([0, 2000, 20000, 22000], 300), 3);
  assert.equal(aheadCount([0, 2000, 4000, 6000], 2000), 1);
});

test("what is fetched around a settled page follows the reading direction", async () => {
  const { prefetchPlan } = await import("./books-reader.ts");
  assert.deepEqual(prefetchPlan(10, 1, 100, 3), { pictures: [11, 12, 13, 9], words: [11, 12, 9] });
  assert.deepEqual(prefetchPlan(10, -1, 100, 3), { pictures: [9, 8, 7, 11], words: [9, 8, 11] });
  assert.deepEqual(prefetchPlan(1, 1, 2, 3), { pictures: [2], words: [2] });
});
