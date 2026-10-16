import assert from "node:assert/strict";
import test from "node:test";
import {
  addItems,
  chunks,
  editItem,
  loadList,
  removeItem,
  removeItems,
  saveList,
  storageKey,
} from "./rita-learning-list.ts";
import { matchSubject, subjectOptions } from "./rita-learning-tree.ts";

const guten = {
  term: "Guten Morgen",
  meaning: "صباح الخير",
  language: "de",
  kind: "sentence" as const,
  article: null,
  plural: null,
};
const haus = {
  ...guten,
  term: "Haus",
  meaning: "بيت",
  kind: "word" as const,
  article: "das" as const,
};

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

test("a word asked twice appears once and keeps its newest meaning", () => {
  let list = addItems([], [guten], "شو معنى Guten Morgen", 1);
  list = addItems(list, [{ ...guten, term: "guten morgen", meaning: "صباح النور" }], "again", 2);
  assert.equal(list.length, 1);
  assert.equal(list[0].meaning, "صباح النور");
});

test("words can be removed one by one or in a group", () => {
  const list = addItems([], [guten, haus], "q");
  assert.deepEqual(
    removeItem(list, list[0].id).map((e) => e.term),
    ["Haus"],
  );
  assert.deepEqual(
    removeItems(
      list,
      list.map((e) => e.id),
    ),
    [],
  );
  assert.equal(removeItem(list, "missing").length, 2);
});

test("editing fixes the text, refuses empty text and merges a clash", () => {
  const list = addItems([], [guten, haus], "q");
  const fixed = editItem(list, list[1].id, { meaning: "منزل" });
  assert.equal(fixed[1].meaning, "منزل");
  assert.equal(editItem(list, list[1].id, { term: "   " }), list);
  assert.equal(editItem(list, "missing", { term: "x" }), list);
  const merged = editItem(list, list[1].id, { term: "Guten Morgen" });
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, list[1].id);
});

test("the list survives a reload, per user, and bad data is ignored", () => {
  const storage = fakeStorage();
  const list = addItems([], [guten, haus], "q");
  saveList(storage, "user-a", list);
  assert.equal(loadList(storage, "user-a").length, 2);
  assert.equal(loadList(storage, "user-b").length, 0);
  storage.setItem(storageKey("user-c"), "not json");
  assert.deepEqual(loadList(storage, "user-c"), []);
  storage.setItem(storageKey("user-d"), JSON.stringify([{ term: "x" }, 7, null]));
  assert.deepEqual(loadList(storage, "user-d"), []);
  saveList(storage, "user-a", []);
  assert.equal(storage.data.has(storageKey("user-a")), false);
});

test("broken storage never throws", () => {
  const broken = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("full");
    },
    removeItem: () => undefined,
  };
  assert.deepEqual(loadList(broken, "u"), []);
  assert.doesNotThrow(() => saveList(broken, "u", addItems([], [guten], "q")));
});

test("saving is split into requests the server accepts", () => {
  assert.deepEqual(chunks([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.equal(chunks(Array.from({ length: 60 }, (_, i) => i)).length, 3);
  assert.deepEqual(chunks([]), []);
});

const subjects = [
  { id: "a", parent_id: null, name: "Deutsch" },
  { id: "b", parent_id: "a", name: "Begrüßung" },
  { id: "c", parent_id: null, name: "English" },
  { id: "d", parent_id: "c", name: "Begrüßung" },
  { id: "e", parent_id: "gone", name: "Orphan" },
];

test("subjects are shown with their path, children under parents", () => {
  const options = subjectOptions(subjects);
  assert.deepEqual(
    options.map((o) => o.label),
    ["Deutsch", "Deutsch / Begrüßung", "English", "English / Begrüßung", "Orphan"],
  );
  assert.deepEqual(
    options.map((o) => o.depth),
    [0, 1, 0, 1, 0],
  );
});

test("a parent cycle cannot hang the picker", () => {
  const options = subjectOptions([
    { id: "x", parent_id: "y", name: "X" },
    { id: "y", parent_id: "x", name: "Y" },
  ]);
  assert.ok(options.length <= 2);
});

test("a spoken subject name picks one subject or none", () => {
  const options = subjectOptions(subjects);
  assert.equal(matchSubject(options, "deutsch")?.id, "a");
  assert.equal(matchSubject(options, "English / Begrüßung")?.id, "d");
  assert.equal(matchSubject(options, "begrüßung"), null); // two subjects share that name
  assert.equal(matchSubject(options, "orph")?.id, "e");
  assert.equal(matchSubject(options, "nothing"), null);
  assert.equal(matchSubject(options, "  "), null);
  // The worker sends Arabic hints with unified letters and without the article.
  const arabic = [
    { id: "v", label: "الأفعال", depth: 0 },
    { id: "n", label: "الأسماء", depth: 0 },
  ];
  assert.equal(matchSubject(arabic, "الافعال")?.id, "v");
  assert.equal(matchSubject(arabic, "افعال")?.id, "v");
  assert.equal(matchSubject(arabic, "اسماء")?.id, "n");
});
