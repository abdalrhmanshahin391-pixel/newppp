import assert from "node:assert/strict";
import test from "node:test";
import {
  levelRows,
  nextLevel,
  normalizeLevel,
  statesFrom,
  type Level,
  type StopInfo,
} from "./rita-path-levels.ts";

type Stop = { id: string } & StopInfo;
const lesson = (id: string, level: Level, done = false): Stop => ({
  id,
  level,
  finishOf: null,
  done,
});
const finish = (id: string, level: Level): Stop => ({
  id,
  level: null,
  finishOf: level,
  done: false,
});
const extra = (id: string): Stop => ({ id, level: null, finishOf: null, done: false });

const shape = (stops: Stop[]) =>
  levelRows(stops, (stop) => stop).map((row) =>
    row.type === "node" ? row.node.id : `${row.type}:${row.level}`,
  );

test("normalizeLevel keeps the six levels and turns anything else into A1", () => {
  assert.equal(normalizeLevel("b1"), "B1");
  assert.equal(normalizeLevel(" C2 "), "C2");
  assert.equal(normalizeLevel("beginner"), "A1");
  assert.equal(normalizeLevel(null), "A1");
  assert.equal(nextLevel("A2"), "B1");
  assert.equal(nextLevel("C2"), null);
});

test("each level gets a banner, a finish after its last lesson and the next level is coming soon", () => {
  assert.deepEqual(shape([lesson("a", "A1"), lesson("b", "A1"), lesson("c", "A2")]), [
    "banner:A1",
    "a",
    "b",
    "finish:A1",
    "banner:A2",
    "c",
    "finish:A2",
    "soon:B1",
  ]);
});

test("an admin's finish stop replaces the drawn one, wherever it was placed", () => {
  assert.deepEqual(
    shape([lesson("a", "A1"), finish("f", "A1"), lesson("b", "A1"), lesson("c", "A2")]),
    ["banner:A1", "a", "f", "b", "banner:A2", "c", "finish:A2", "soon:B1"],
  );
});

test("a level split by the admin's order closes only after its last lesson", () => {
  assert.deepEqual(shape([lesson("a", "A1"), lesson("b", "A2"), lesson("c", "A1")]), [
    "banner:A1",
    "a",
    "banner:A2",
    "b",
    "finish:A2",
    "banner:A1",
    "c",
    "finish:A1",
    "soon:B1",
  ]);
});

test("stops placed before the first lesson stay first; counts are per level", () => {
  const rows = levelRows([extra("x"), lesson("a", "B1", true), lesson("b", "B1")], (s) => s);
  assert.equal(rows[0].type, "node");
  const banner = rows.find((row) => row.type === "banner");
  assert.deepEqual(banner?.type === "banner" ? banner.count : null, { lessons: 2, done: 1 });
  assert.equal(rows.at(-1)?.type === "soon" ? rows.at(-1)?.level : "", "B2");
});

test("no lessons: no banners at all, and C2 has nothing after it", () => {
  assert.deepEqual(shape([extra("x")]), ["x"]);
  assert.deepEqual(shape([lesson("a", "C2")]), ["banner:C2", "a", "finish:C2"]);
});

type L = { id: string; state: "done" | "current" | "locked"; level: Level };
const path: L[] = [
  { id: "a1", state: "done", level: "A1" },
  { id: "a2", state: "current", level: "A1" },
  { id: "a3", state: "locked", level: "A1" },
  { id: "b1", state: "locked", level: "A2" },
  { id: "b2", state: "locked", level: "A2" },
];

test("starting from a later level opens the earlier ones and moves the current lesson", () => {
  const states = statesFrom(path, (l) => l.level, "A2");
  assert.deepEqual(Object.fromEntries(states), {
    a1: "done",
    a2: "open",
    a3: "open",
    b1: "current",
    b2: "locked",
  });
});

test("no choice, or the first level, keeps the server's states", () => {
  const keep = { a1: "done", a2: "current", a3: "locked", b1: "locked", b2: "locked" };
  assert.deepEqual(Object.fromEntries(statesFrom(path, (l) => l.level, null)), keep);
  assert.deepEqual(Object.fromEntries(statesFrom(path, (l) => l.level, "A1")), keep);
});
