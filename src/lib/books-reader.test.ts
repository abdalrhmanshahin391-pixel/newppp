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

test("picture sizes live beside the original, each in its folder", async () => {
  const { tierPath } = await import("./books-reader.ts");
  assert.equal(tierPath("b", 3, "std", "webp"), "b/3.webp");
  assert.equal(tierPath("b", 3, "thumb", "webp"), "b/t/3.webp");
  assert.equal(tierPath("b", 3, "mid", "jpeg"), "b/m/3.jpg");
  assert.equal(tierPath("b", 3, "zoom", "webp"), "b/z/3.webp");
});

test("the manifest stores each page in a few bytes and reads back", async () => {
  const { manifestEntry, readManifest } = await import("./books-reader.ts");
  const entry = manifestEntry({
    width: 1400,
    height: 1812,
    has_text: true,
    image_path: "b/1.webp",
    thumb_path: "b/t/1.webp",
    mid_path: "b/m/1.webp",
    zoom_path: null,
    thumbhash: "AbC=",
    color: "#fafafa",
  });
  assert.deepEqual(entry, [1400, 1812, 7, "w", "AbC=", "#fafafa"]);
  const old = manifestEntry({ width: 1400, height: 788, has_text: false, image_path: "b/2.jpg" });
  assert.deepEqual(old, [1400, 788, 0, "j", null, null]);
  const pages = readManifest([entry, old, "broken", [0, 0, 0, "w"]]);
  assert.equal(pages.length, 2);
  assert.deepEqual(pages[0].tiers, ["std", "thumb", "mid"]);
  assert.equal(pages[1].type, "jpeg");
  assert.equal(pages[1].page, 2);
  assert.equal(pages[0].color, "#fafafa");
});

test("the size shown is the smallest that is sharp enough", async () => {
  const { pickTier } = await import("./books-reader.ts");
  const all = ["std", "mid", "zoom"] as const;
  assert.equal(pickTier(374 * 3, [...all]), "std", "a phone at 3x needs ~1122 px");
  assert.equal(pickTier(390 * 2, [...all]), "mid", "a phone at 2x is fine with 900");
  assert.equal(pickTier(600 * 2, [...all]), "std", "an iPad pane at 2x");
  assert.equal(pickTier(600 * 2 * 2, [...all]), "zoom", "zoomed in on an iPad");
  assert.equal(pickTier(5000, ["std"]), "std", "an old book has only the original");
  assert.equal(pickTier(500, ["std", "zoom"]), "std");
});

test("colours, base64 and the preparing rate", async () => {
  const { hexColor, bytesToBase64, base64ToBytes, prepareRate } = await import("./books-reader.ts");
  assert.equal(hexColor(250, 250, 250), "#fafafa");
  assert.equal(hexColor(1, 0.5, 0), "#ff8000");
  const bytes = new Uint8Array([1, 2, 250, 255]);
  assert.deepEqual([...base64ToBytes(bytesToBase64(bytes))], [...bytes]);
  assert.equal(prepareRate([1000], 10), null);
  const rate = prepareRate([0, 500, 1000, 1500, 2000], 100);
  assert.equal(rate?.perSecond, 2);
  assert.equal(rate?.secondsLeft, 50);
});

test("the outline keeps titles and pages inside the book", async () => {
  const { cleanOutline } = await import("./books-reader.ts");
  assert.deepEqual(
    cleanOutline(
      [
        { title: "  Chapter   One ", page: 1, level: 0 },
        { title: "Lost", page: null, level: 0 },
        { title: "Too far", page: 99, level: 1 },
        { title: "Deep", page: 2, level: 9 },
        { title: "   ", page: 2, level: 0 },
      ],
      10,
    ),
    [
      ["Chapter One", 1, 0],
      ["Deep", 2, 5],
    ],
  );
});

test("the scrubber maps the line to pages, by the book's direction", async () => {
  const { scrubPage, scrubSpot, chapterAt, scrubWindow } = await import("./books-reader.ts");
  assert.equal(scrubPage(0, 900, 900, false), 1);
  assert.equal(scrubPage(450, 900, 900, false), 450);
  assert.equal(scrubPage(900, 900, 900, false), 900);
  assert.equal(scrubPage(2000, 900, 900, false), 900);
  assert.equal(scrubPage(-5, 900, 900, false), 1);
  assert.equal(scrubPage(0, 900, 900, true), 900);
  assert.equal(scrubPage(900, 900, 900, true), 1);
  assert.equal(scrubPage(300, 300, 5000, false), 5000);
  assert.equal(scrubPage(10, 0, 50, false), 1);
  assert.equal(scrubSpot(450, 900, false), 0.5);
  assert.equal(scrubSpot(900, 900, true), 0);
  const outline: [string, number, number][] = [
    ["Part One", 1, 0],
    ["Chapter 1", 3, 1],
    ["Chapter 2", 40, 1],
    ["Part Two", 100, 0],
  ];
  assert.equal(chapterAt(outline, 2), "Part One");
  assert.equal(chapterAt(outline, 39), "Chapter 1");
  assert.equal(chapterAt(outline, 40), "Chapter 2");
  assert.equal(chapterAt(outline, 500), "Part Two");
  assert.equal(chapterAt([], 5), null);
  assert.equal(chapterAt([["Late", 10, 0]], 5), null);
  assert.deepEqual(scrubWindow(2, 5, 2), [1, 2, 3, 4]);
  assert.equal(scrubWindow(500, 900).length, 41);
});
