import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

export type MemoryPair = {
  id: string;
  left: string;
  right: string;
  hint?: string;
  group?: string;
  misses: number;
};

export function memoryKey(subject: string, subtopic: string) {
  const slug = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "-");
  return `rita_mem_${slug(subject)}_${slug(subtopic)}`;
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* Tiny store so pair counts anywhere on the page stay in sync. */
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function usePairsVersion() {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
}

export function readPairs(subject: string, subtopic: string): MemoryPair[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(memoryKey(subject, subtopic));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as MemoryPair[]).map((p) => ({ ...p, misses: p.misses ?? 0 }));
  } catch {
    return [];
  }
}

export function countPairs(subject: string, subtopic: string) {
  return readPairs(subject, subtopic).length;
}

/** Every pair under one subject, in sub-topic order. */
export function collectPairs(subject: string, subtopics: string[]): MemoryPair[] {
  return subtopics.flatMap((s) => readPairs(subject, s));
}

/** Records a miss on a pair wherever it lives, so weak pairs come back sooner. */
export function bumpMisses(subject: string, subtopics: string[], ids: string[]) {
  if (typeof window === "undefined" || ids.length === 0) return;
  const wanted = new Set(ids);
  for (const sub of subtopics) {
    const list = readPairs(subject, sub);
    if (!list.some((p) => wanted.has(p.id))) continue;
    const next = list.map((p) => (wanted.has(p.id) ? { ...p, misses: (p.misses ?? 0) + 1 } : p));
    try {
      window.localStorage.setItem(memoryKey(subject, sub), JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }
  emit();
}

/** Parse a pasted list: one pair per line, "left | right" or "left - right". */
export function parsePairList(text: string): { left: string; right: string }[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s*\|\s*|\s+—\s+|\s+–\s+|\s+-\s+|\s*=\s*/);
      const left = (parts[0] ?? "").trim();
      const right = parts.slice(1).join(" - ").trim();
      return { left, right };
    })
    .filter((p) => p.left && p.right);
}

/** Memory pairs for one sub-subject topic, persisted in the browser. */
export function useMemoryPairs(subject: string, subtopic: string) {
  const key = memoryKey(subject, subtopic);
  const [pairs, setPairs] = useState<MemoryPair[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(false);
    setPairs(readPairs(subject, subtopic));
    setHydrated(true);
  }, [subject, subtopic]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(pairs));
      emit();
    } catch {
      /* ignore */
    }
  }, [pairs, hydrated, key]);

  const addPair = useCallback((left: string, right: string, hint?: string, group?: string) => {
    setPairs((p) => [...p, { id: newId(), left, right, hint, group, misses: 0 }]);
  }, []);

  const addMany = useCallback((rows: { left: string; right: string }[], group?: string) => {
    setPairs((p) => [
      ...p,
      ...rows.map((r) => ({ id: newId(), left: r.left, right: r.right, group, misses: 0 })),
    ]);
  }, []);

  const updatePair = useCallback((id: string, patch: Partial<Omit<MemoryPair, "id">>) => {
    setPairs((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, []);

  const deletePair = useCallback((id: string) => {
    setPairs((p) => p.filter((x) => x.id !== id));
  }, []);

  return { pairs, addPair, addMany, updatePair, deletePair };
}
