// The learner's "words I asked about" list: pure operations plus safe browser storage.
import type { LearningItem } from "./rita-learning.ts";
import { learningKey } from "./rita-learning.ts";

export type ListEntry = LearningItem & {
  id: string;
  /** What the learner asked, so each word can be checked against its source. */
  source: string;
  addedAt: number;
};

export const MAX_LIST = 200;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function storageKey(userId: string) {
  return `rita.words.v1:${userId}`;
}

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Adds words; a word already in the list is updated in place, never duplicated. */
export function addItems(
  list: ListEntry[],
  items: LearningItem[],
  source: string,
  now = Date.now(),
): ListEntry[] {
  const next = [...list];
  for (const item of items) {
    const key = learningKey(item);
    const at = next.findIndex((entry) => learningKey(entry) === key);
    if (at >= 0) next[at] = { ...next[at], ...item, source: source || next[at].source };
    else next.push({ ...item, id: newId(), source: source.slice(0, 200), addedAt: now });
  }
  return next.slice(-MAX_LIST);
}

export function removeItem(list: ListEntry[], id: string): ListEntry[] {
  return list.filter((entry) => entry.id !== id);
}

export function removeItems(list: ListEntry[], ids: Iterable<string>): ListEntry[] {
  const gone = new Set(ids);
  return list.filter((entry) => !gone.has(entry.id));
}

/** Fixes a word's text or meaning. Empty text is refused; a clash with another word merges. */
export function editItem(
  list: ListEntry[],
  id: string,
  patch: { term?: string; meaning?: string },
): ListEntry[] {
  const current = list.find((entry) => entry.id === id);
  if (!current) return list;
  const term = (patch.term ?? current.term).replace(/\s+/g, " ").trim().slice(0, 180);
  const meaning = (patch.meaning ?? current.meaning).replace(/\s+/g, " ").trim().slice(0, 280);
  if (!term || !meaning) return list;
  const edited = { ...current, term, meaning };
  const key = learningKey(edited);
  return list
    .filter((entry) => entry.id === id || learningKey(entry) !== key)
    .map((entry) => (entry.id === id ? edited : entry));
}

function isEntry(value: unknown): value is ListEntry {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.term === "string" &&
    item.term.trim().length > 0 &&
    typeof item.meaning === "string" &&
    item.meaning.trim().length > 0 &&
    typeof item.language === "string" &&
    (item.kind === "word" || item.kind === "sentence")
  );
}

export function loadList(storage: StorageLike, userId: string): ListEntry[] {
  try {
    const parsed = JSON.parse(storage.getItem(storageKey(userId)) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isEntry)
      .map((entry) => ({
        ...entry,
        article: ["der", "die", "das"].includes(String(entry.article)) ? entry.article : null,
        plural: typeof entry.plural === "string" ? entry.plural : null,
        source: typeof entry.source === "string" ? entry.source : "",
        addedAt: typeof entry.addedAt === "number" ? entry.addedAt : 0,
      }))
      .slice(-MAX_LIST);
  } catch {
    return [];
  }
}

export function saveList(storage: StorageLike, userId: string, list: ListEntry[]) {
  try {
    if (list.length) storage.setItem(storageKey(userId), JSON.stringify(list.slice(-MAX_LIST)));
    else storage.removeItem(storageKey(userId));
  } catch {
    /* storage full or blocked: the list still works for this page */
  }
}

/** The server saves at most 25 items per request. */
export function chunks<T>(items: T[], size = 25): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size)
    out.push(items.slice(index, index + size));
  return out;
}
