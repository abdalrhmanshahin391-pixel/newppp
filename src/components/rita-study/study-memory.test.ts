import assert from "node:assert/strict";
import test from "node:test";
import { readStudyMemory, writeStudyMemory } from "./study-memory.ts";

function withStorage(storage: Partial<Storage> | "blocked", run: () => void) {
  const previous = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window =
    storage === "blocked"
      ? {
          get localStorage(): Storage {
            throw new Error("blocked");
          },
        }
      : { localStorage: storage };
  try {
    run();
  } finally {
    (globalThis as { window?: unknown }).window = previous;
  }
}

function memoryStorage(): Partial<Storage> & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

test("the page remembers the intro, the section and the circle per lesson", () => {
  const storage = memoryStorage();
  withStorage(storage, () => {
    assert.deepEqual(readStudyMemory("a"), {});
    writeStudyMemory("a", { introduced: true });
    writeStudyMemory("a", { section: "s2", orb: { x: 0.2, y: 0.8 } });
    assert.deepEqual(readStudyMemory("a"), {
      introduced: true,
      section: "s2",
      orb: { x: 0.2, y: 0.8 },
    });
    assert.deepEqual(readStudyMemory("b"), {}, "another lesson keeps its own memory");
  });
});

test("bad or foreign saved values are dropped, never trusted", () => {
  const storage = memoryStorage();
  storage.data.set(
    "uzyra-study:a",
    JSON.stringify({ introduced: "yes", section: "<img>", orb: { x: 9, y: -3 } }),
  );
  storage.data.set("uzyra-study:b", "{not json");
  storage.data.set("uzyra-study:c", JSON.stringify({ orb: { x: "1", y: Number.NaN } }));
  withStorage(storage, () => {
    assert.deepEqual(readStudyMemory("a"), {
      introduced: false,
      section: undefined,
      orb: { x: 1, y: 0 },
    });
    assert.deepEqual(readStudyMemory("b"), {});
    assert.equal(readStudyMemory("c").orb, undefined);
  });
});

test("blocked storage (private window) never breaks the page", () => {
  withStorage("blocked", () => {
    assert.deepEqual(readStudyMemory("a"), {});
    assert.doesNotThrow(() => writeStudyMemory("a", { introduced: true }));
  });
});
