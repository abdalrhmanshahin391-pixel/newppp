import { useCallback, useEffect, useRef, useState } from "react";
import { SAMPLE_SUBJECTS, type SampleSubject } from "@/lib/study-sample-data";
import { ensureSampleFlashcards } from "@/lib/demo-seed";
import { isSampleLanguage, useActiveLanguage } from "@/lib/language-scope";
import { scopedKey } from "@/lib/learning-language";

export const FLASHCARD_SUBJECTS_KEY = "rita_study_subjects";

/** Fired on `window` when one copy of a board saves, so other copies on the page read it again. */
const BOARD_CHANGED_EVENT = "rita-board-changed";
let nextInstance = 0;
export const QUESTION_SUBJECTS_KEY = "rita_question_subjects";

export type Selection =
  | { kind: "subject"; si: number }
  | { kind: "sub"; si: number; sj: number }
  | null;

/** `baseKey` is the kit's key; the copy for `language` (when one is chosen) is what is read. */
function load(baseKey: string, language: string | null): SampleSubject[] {
  if (typeof window === "undefined") return [];
  const storageKey = scopedKey(baseKey, language);
  // The cardiology sample belongs to the learner's first space only.
  const sample = baseKey === FLASHCARD_SUBJECTS_KEY && isSampleLanguage();
  try {
    let raw = window.localStorage.getItem(storageKey);
    if (!raw && sample) {
      ensureSampleFlashcards();
      raw = window.localStorage.getItem(storageKey);
    }
    if (!raw) return sample ? SAMPLE_SUBJECTS : [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return (parsed as SampleSubject[]).map((s) => ({
        name: s.name,
        subs: (s.subs ?? []).map((x) => ({ name: x.name })),
      }));
    }
    if (sample) {
      ensureSampleFlashcards();
      return SAMPLE_SUBJECTS;
    }
  } catch {
    /* ignore */
  }
  return sample ? SAMPLE_SUBJECTS : [];
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function useStudySubjects(baseKey: string = FLASHCARD_SUBJECTS_KEY) {
  // Each language has its own copy of the board; switching language swaps which one is shown.
  const language = useActiveLanguage();
  const storageKey = scopedKey(baseKey, language);
  const [subjects, setSubjects] = useState<SampleSubject[]>([]);
  // The key the current `subjects` were read from. Nothing is written until it matches the key in
  // use, so a language switch can never save one language's board under another's key.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  // Several parts of a page can hold the same board (the word tray beside a lesson, the save panel
  // in its window). Each one re-reads it when another saves, so none writes over the other's change.
  const instance = useRef(0);
  if (!instance.current) instance.current = ++nextInstance;
  const fromOutside = useRef(false);

  useEffect(() => {
    setSubjects(load(baseKey, language));
    setLoadedKey(storageKey);
  }, [baseKey, language, storageKey]);

  useEffect(() => {
    // A board just read again from storage is not saved back (that would echo forever).
    if (fromOutside.current) {
      fromOutside.current = false;
      return;
    }
    if (loadedKey !== storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(subjects));
      window.dispatchEvent(
        new CustomEvent(BOARD_CHANGED_EVENT, {
          detail: { key: storageKey, from: instance.current },
        }),
      );
    } catch {
      /* ignore */
    }
  }, [subjects, loadedKey, storageKey]);

  useEffect(() => {
    const reload = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string; from: number }>).detail;
      if (!detail || detail.key !== storageKey || detail.from === instance.current) return;
      fromOutside.current = true;
      setSubjects(load(baseKey, language));
    };
    window.addEventListener(BOARD_CHANGED_EVENT, reload);
    return () => window.removeEventListener(BOARD_CHANGED_EVENT, reload);
  }, [baseKey, language, storageKey]);

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
