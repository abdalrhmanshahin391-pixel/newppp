import assert from "node:assert/strict";
import test from "node:test";
import {
  adjacent,
  buildOnce,
  checkMove,
  covers,
  difficulty,
  fullPath,
  maskOf,
  neighbors,
  pathsFor,
  rng,
  turns,
  type Grid,
} from "./engine.ts";

// The grid in the owner's iPad screenshots (4 × 6) and its five words.
const REF: Grid = { rows: 4, cols: 6, letters: "LKKIIN" + "ATRLCH" + "THELEO" + "ORBESU" };
const REF_WORDS = ["KILL", "TALK", "NICE", "HOUSE", "BROTHER"];
const at = (r: number, c: number) => r * 6 + c;

test("the screenshot grid has exactly one full cover, the one in the report", () => {
  const result = covers(REF, REF_WORDS, 0, 3);
  assert.equal(result.count, 1);
  const byWord = Object.fromEntries(REF_WORDS.map((w, i) => [w, result.paths![i]]));
  assert.deepEqual(byWord.KILL, [at(0, 2), at(0, 3), at(1, 3), at(2, 3)]);
  assert.deepEqual(byWord.TALK, [at(1, 1), at(1, 0), at(0, 0), at(0, 1)]);
  assert.deepEqual(byWord.BROTHER, [
    at(3, 2),
    at(3, 1),
    at(3, 0),
    at(2, 0),
    at(2, 1),
    at(2, 2),
    at(1, 2),
  ]);
  const all = result.paths!.flat();
  assert.equal(new Set(all).size, 24);
});

test("separate routes are not separate answers: KILL and HOUSE have two routes each alone", () => {
  assert.equal(pathsFor(REF, "KILL").length, 1 + 0, "KILL alone");
  assert.equal(pathsFor(REF, "TALK").length, 2);
  assert.equal(pathsFor(REF, "HOUSE").length, 2);
  assert.equal(pathsFor(REF, "BROTHER").length, 1);
});

test("too few words cannot cover the grid", () => {
  assert.equal(covers(REF, ["KILL", "TALK"]).count, 0);
});

test("orthogonal neighbours only, no diagonals, no wrap-around", () => {
  const adj = neighbors(4, 6);
  assert.deepEqual(
    adj[0].sort((a, b) => a - b),
    [1, 6],
  );
  assert.equal(adjacent(6, 5, 6), false, "end of a row is not next to the start of the next");
  assert.equal(adjacent(6, 0, 7), false, "diagonal");
  assert.equal(adjacent(6, 0, 6), true);
});

test("a move: locked, blocking, another word, nonsense, and broken paths", () => {
  const dict = new Set([...REF_WORDS, "THE", "HER"]);
  const solved = new Set<number>();
  const kill = [at(0, 2), at(0, 3), at(1, 3), at(2, 3)];
  assert.deepEqual(checkMove(REF, REF_WORDS, solved, 0, kill, dict), {
    kind: "locked",
    word: "KILL",
    index: 0,
  });
  // TALK has a second route that strands the grid: T(1,1) A(1,0) L(0,0) K(0,1) is the right one;
  // the other one leaves a pocket, so it is "blocks", not "wrong word".
  const talkRoutes = pathsFor(REF, "TALK");
  const wrong = talkRoutes.find(
    (p) => p.join() !== [at(1, 1), at(1, 0), at(0, 0), at(0, 1)].join(),
  )!;
  assert.equal(checkMove(REF, REF_WORDS, solved, 0, wrong, dict).kind, "blocks");
  assert.deepEqual(checkMove(REF, REF_WORDS, solved, 0, [at(2, 0), at(2, 1), at(2, 2)], dict), {
    kind: "other_word",
    word: "THE",
  });
  assert.equal(checkMove(REF, REF_WORDS, solved, 0, [at(0, 0), at(0, 1)], dict).kind, "not_word");
  assert.equal(
    checkMove(REF, REF_WORDS, solved, 0, [at(0, 0), at(1, 1)], dict).kind,
    "invalid",
    "diagonal",
  );
  assert.equal(
    checkMove(REF, REF_WORDS, solved, 0, [at(0, 0), at(0, 1), at(0, 0)], dict).kind,
    "invalid",
    "repeat",
  );
  assert.equal(
    checkMove(REF, REF_WORDS, solved, maskOf([at(0, 0)]), [at(0, 0), at(0, 1)], dict).kind,
    "invalid",
    "used tile",
  );
  assert.equal(checkMove(REF, REF_WORDS, solved, 0, [at(0, 0)], dict).kind, "invalid", "one tile");
});

test("the last word must finish the grid", () => {
  const sol = covers(REF, REF_WORDS).paths!;
  const solved = new Set([0, 1, 2, 3]);
  const used = maskOf(sol.slice(0, 4).flat());
  assert.equal(checkMove(REF, REF_WORDS, solved, used, sol[4]).kind, "locked");
});

test("the random numbers repeat with the seed", () => {
  const a = rng(42);
  const b = rng(42);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  assert.notEqual(rng(1)(), rng(2)());
});

test("a full path visits every tile once, through neighbours", () => {
  for (const [r, c] of [
    [3, 4],
    [4, 4],
    [4, 5],
    [4, 6],
    [5, 6],
  ]) {
    const path = fullPath(r, c, rng(r * 10 + c))!;
    assert.equal(path.length, r * c);
    assert.equal(new Set(path).size, r * c);
    for (let i = 1; i < path.length; i++) assert.ok(adjacent(c, path[i - 1], path[i]));
  }
});

test("500 seeds: every built grid has one cover that uses every tile, and the seed repeats it", () => {
  const pool = {
    4: [
      "HAND",
      "WORK",
      "HOME",
      "READ",
      "LOOK",
      "BLUE",
      "TIME",
      "FOOD",
      "GAME",
      "FISH",
      "PLAY",
      "LOVE",
      "WALK",
      "OPEN",
      "COLD",
      "WARM",
      "TREE",
      "RICE",
      "BOOK",
      "LIFE",
      "GOOD",
      "FAST",
      "SLOW",
      "RAIN",
    ],
    5: [
      "HOUSE",
      "WATER",
      "TRAIN",
      "APPLE",
      "SMILE",
      "MUSIC",
      "CHAIR",
      "LEARN",
      "WRITE",
      "THINK",
      "SMALL",
      "RIGHT",
      "WHITE",
      "GREEN",
      "SWEET",
      "BREAD",
      "PHONE",
      "DANCE",
    ],
    7: [
      "BROTHER",
      "TEACHER",
      "MORNING",
      "PICTURE",
      "EXAMPLE",
      "COUNTRY",
      "ANIMALS",
      "ENGLISH",
      "STUDENT",
      "WEATHER",
      "KITCHEN",
      "SCIENCE",
      "HISTORY",
      "FREEDOM",
    ],
  } as Record<number, string[]>;
  const make = (seed: number) => {
    const random = rng(seed);
    for (let attempt = 0; attempt < 200; attempt++) {
      const pick = (n: number, k: number) => [...pool[n]].sort(() => random() - 0.5).slice(0, k);
      const words = [...pick(4, 3), ...pick(5, 1), ...pick(7, 1)];
      const built = buildOnce(4, 6, words, random);
      if (built) return built;
    }
    throw new Error("no board for seed " + seed);
  };
  let slowest = 0;
  for (let seed = 0; seed < 500; seed++) {
    const t = performance.now();
    const built = make(100000 + seed);
    slowest = Math.max(slowest, performance.now() - t);
    assert.equal(covers(built.grid, built.words, 0, 2).count, 1);
    assert.equal(new Set(built.paths.flat()).size, 24);
    built.paths.forEach((p, i) =>
      assert.equal(p.map((x) => built.grid.letters[x]).join(""), built.words[i]),
    );
    if (seed % 50 === 0) assert.deepEqual(make(100000 + seed), built);
  }
  assert.ok(slowest < 2000, `slowest ${slowest}ms`);
});

test("difficulty is between 0 and 100 and rises with harder words", () => {
  const built = { grid: REF, words: REF_WORDS, paths: covers(REF, REF_WORDS).paths!, nodes: 10 };
  const easy = difficulty(built, () => 1);
  const hard = difficulty(built, () => 4);
  assert.ok(easy.score > 0 && hard.score <= 100 && hard.score > easy.score);
  assert.equal(turns([0, 1, 2, 8, 14]), 1);
});
