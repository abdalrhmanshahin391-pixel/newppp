import assert from "node:assert/strict";
import test from "node:test";
import {
  insertRef,
  layoutOrders,
  mergePath,
  swapRefs,
  type PathItem,
  type PathRef,
} from "./rita-path-layout.ts";

const L = (id: string): PathRef => ({ type: "lesson", id });
const I = (id: string): PathRef => ({ type: "item", id });
const item = (id: string, path_order: number): PathItem => ({
  id,
  kind: "exercises",
  title: id,
  path_order,
  resource_count: 0,
});

test("merge puts items between lessons by order, unordered lessons last", () => {
  const merged = mergePath(
    [
      { id: "a", path_order: 1 },
      { id: "x", path_order: null },
      { id: "b", path_order: 2 },
    ],
    [item("i", 1.5), item("j", 0.5)],
  );
  assert.deepEqual(
    merged.map((node) => (node.type === "lesson" ? node.lesson.id : node.item.id)),
    ["j", "a", "i", "b", "x"],
  );
});

test("swap and insert", () => {
  const list = [L("a"), I("i"), L("b")];
  assert.deepEqual(swapRefs(list, "a", "b"), [L("b"), I("i"), L("a")]);
  assert.deepEqual(swapRefs(list, "a", "missing"), list);
  assert.deepEqual(insertRef(list, 1, I("n")), [L("a"), I("n"), I("i"), L("b")]);
  assert.deepEqual(insertRef(list, 99, I("n")), [L("a"), I("i"), L("b"), I("n")]);
});

test("lessons keep their slots; items sit between them", () => {
  const out = layoutOrders([L("b"), I("i"), I("j"), L("a"), I("k")], { a: 3, b: 7 });
  assert.deepEqual(out.lessons, [
    { id: "b", path_order: 3 },
    { id: "a", path_order: 7 },
  ]);
  const at = Object.fromEntries(out.items.map((entry) => [entry.id, entry.path_order]));
  assert.ok(at.i > 3 && at.i < at.j && at.j < 7);
  assert.ok(at.k > 7 && at.k < 8);
});

test("items before the first lesson and with no lessons at all", () => {
  const first = layoutOrders([I("i"), L("a")], { a: 5 });
  assert.ok(first.items[0].path_order > 4 && first.items[0].path_order < 5);
  const none = layoutOrders([I("i"), I("j")], {});
  assert.ok(none.items[0].path_order < none.items[1].path_order);
});

test("merging the saved layout gives the same order back", () => {
  const list = [I("x"), L("b"), I("i"), L("a"), I("k"), I("m")];
  const out = layoutOrders(list, { a: 2, b: 9 });
  const merged = mergePath(
    out.lessons.map((lesson) => ({ id: lesson.id, path_order: lesson.path_order })),
    out.items.map((entry) => item(entry.id, entry.path_order)),
  );
  assert.deepEqual(
    merged.map((node) => (node.type === "lesson" ? node.lesson.id : node.item.id)),
    list.map((ref) => ref.id),
  );
});
