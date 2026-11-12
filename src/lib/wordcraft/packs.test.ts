// Every published Wordcraft puzzle passes the research report's gates, and packs.json is exactly
// what the generator makes (run `node scripts/wordcraft-generate.ts` after changing words).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { adjacent, covers } from "./engine.ts";
import { clueKey, DICTIONARY, gateFailures, generateAll, type PackFile } from "./generate.ts";
import { BY_WORD, LEXICON } from "./lexicon.ts";

const packs: PackFile = JSON.parse(readFileSync(new URL("./packs.json", import.meta.url), "utf8"));

test("packs.json is what the generator makes (same versions, same seeds)", () => {
  assert.deepEqual(generateAll(), packs);
});

test("seventy puzzles in four packs, in order of difficulty inside each", () => {
  const count = (id: string) => packs.puzzles.filter((p) => p.pack === id).length;
  assert.deepEqual(
    [count("intro"), count("easy"), count("medium"), count("hard")],
    [10, 20, 25, 15],
  );
  for (const id of ["intro", "easy", "medium", "hard"]) {
    const scores = packs.puzzles.filter((p) => p.pack === id).map((p) => p.difficulty);
    assert.deepEqual(
      scores,
      [...scores].sort((a, b) => a - b),
      id,
    );
  }
  assert.equal(new Set(packs.puzzles.map((p) => p.id)).size, packs.puzzles.length);
});

test("gate 1: each puzzle has exactly one cover, and its stored answer is that cover", () => {
  for (const p of packs.puzzles) {
    const grid = { rows: p.rows, cols: p.cols, letters: p.letters };
    const result = covers(grid, p.words, 0, 2);
    assert.equal(result.count, 1, p.id);
    assert.deepEqual(result.paths, p.paths, p.id);
    assert.equal(new Set(p.paths.flat()).size, p.rows * p.cols, p.id);
    p.paths.forEach((path, i) => {
      assert.equal(path.map((t) => p.letters[t]).join(""), p.words[i], p.id);
      for (let k = 1; k < path.length; k++) assert.ok(adjacent(p.cols, path[k - 1], path[k]));
    });
  }
});

test("gates 2–4: clear clues, few decoys, no repeats or plurals", () => {
  for (const p of packs.puzzles) {
    const built = {
      grid: { rows: p.rows, cols: p.cols, letters: p.letters },
      words: p.words,
      paths: p.paths,
      nodes: 0,
    };
    assert.deepEqual(gateFailures(built), [], p.id);
  }
});

test("every puzzle word has its meaning, an example and its translation", () => {
  for (const p of packs.puzzles)
    for (const w of p.words) {
      const e = BY_WORD.get(w);
      assert.ok(e, w);
      assert.ok(e.ar && e.example && e.exampleAr, w);
      assert.match(
        e.example,
        new RegExp(`\\b${w.slice(0, 3)}`, "i"),
        `${w}: the example uses the word`,
      );
    }
});

test("the word list: unique words and meanings, letters only, no clue fits two words", () => {
  const words = LEXICON.map((e) => e.word);
  assert.equal(new Set(words).size, words.length);
  assert.equal(new Set(LEXICON.map((e) => e.ar)).size, LEXICON.length);
  for (const e of LEXICON) assert.match(e.word, /^[A-Z]{3,7}$/);
  assert.ok(LEXICON.length >= 250, `${LEXICON.length} words`);
  assert.ok(DICTIONARY.has("THE") && DICTIONARY.has("HOUSE"));
  assert.equal(clueKey("صغير جداً"), "صغير");
  // Words left out on purpose stay out.
  for (const banned of ["KILL", "GUN", "WAR", "DEAD"]) assert.equal(BY_WORD.has(banned), false);
});

test("the vocabulary is spread: no word in more than four puzzles", () => {
  const uses = new Map<string, number>();
  for (const p of packs.puzzles) for (const w of p.words) uses.set(w, (uses.get(w) ?? 0) + 1);
  const most = Math.max(...uses.values());
  assert.ok(most <= 4, `most used ${most}`);
  assert.ok(uses.size >= 150, `${uses.size} different words`);
});
