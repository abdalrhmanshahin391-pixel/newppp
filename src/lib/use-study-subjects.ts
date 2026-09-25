import { useCallback, useEffect, useState } from "react";
import { SAMPLE_SUBJECTS, type SampleSubject } from "@/lib/study-sample-data";
import { ensureSampleFlashcards } from "@/lib/demo-seed";

export const FLASHCARD_SUBJECTS_KEY = "rita_study_subjects";
export const QUESTION_SUBJECTS_KEY = "rita_question_subjects";

export type Selection =
  | { kind: "subject"; si: number }
  | { kind: "sub"; si: number; sj: number }
  | null;

function load(storageKey: string): SampleSubject[] {
  if (typeof window === "undefined") return [];
  try {
    let raw = window.localStorage.getItem(storageKey);
    if (!raw && storageKey === FLASHCARD_SUBJECTS_KEY) {
      ensureSampleFlashcards();
      raw = window.localStorage.getItem(storageKey);
    }
    if (!raw) return storageKey === FLASHCARD_SUBJECTS_KEY ? SAMPLE_SUBJECTS : [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return (parsed as SampleSubject[]).map((s) => ({
        name: s.name,
        subs: (s.subs ?? []).map((x) => ({ name: x.name })),
      }));
    }
    if (storageKey === FLASHCARD_SUBJECTS_KEY) {
      ensureSampleFlashcards();
      return SAMPLE_SUBJECTS;
    }
  } catch {
    /* ignore */
  }
  return storageKey === FLASHCARD_SUBJECTS_KEY ? SAMPLE_SUBJECTS : [];
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function useStudySubjects(storageKey: string = FLASHCARD_SUBJECTS_KEY) {
  const [subjects, setSubjects] = useState<SampleSubject[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(false);
    setSubjects(load(storageKey));
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(subjects));
    } catch {
      /* ignore */
    }
  }, [subjects, hydrated, storageKey]);

  const addSubject = useCallback((name: string) => {
    setSubjects((s) => [...s, { name, subs: [] }]);
  }, []);

  const addSub = useCallback((si: number, name: string) => {
    setSubjects((s) => s.map((sub, i) => (i === si ? { ...sub, subs: [...sub.subs, { name }] } : sub)));
  }, []);

  const renameSubject = useCallback((si: number, name: string) => {
    setSubjects((s) => s.map((sub, i) => (i === si ? { ...sub, name } : sub)));
  }, []);

  const updateSub = useCallback((si: number, sj: number, name: string) => {
    setSubjects((s) =>
      s.map((sub, i) =>
        i === si ? { ...sub, subs: sub.subs.map((x, j) => (j === sj ? { name } : x)) } : sub,
      ),
    );
  }, []);

  const removeSubject = useCallback((si: number) => {
    setSubjects((s) => s.filter((_, i) => i !== si));
  }, []);

  const removeSub = useCallback((si: number, sj: number) => {
    setSubjects((s) =>
      s.map((sub, i) => (i === si ? { ...sub, subs: sub.subs.filter((_, j) => j !== sj) } : sub)),
    );
  }, []);

  const moveSubject = useCallback((from: number, to: number) => {
    setSubjects((s) => move(s, from, to));
  }, []);

  const moveSub = useCallback((si: number, from: number, to: number) => {
    setSubjects((s) => s.map((sub, i) => (i === si ? { ...sub, subs: move(sub.subs, from, to) } : sub)));
  }, []);

  return {
    subjects,
    addSubject,
    addSub,
    renameSubject,
    updateSub,
    removeSubject,
    removeSub,
    moveSubject,
    moveSub,
  };
}
