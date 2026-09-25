import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

export type StudyOption = {
  letter: string;
  body: string;
  is_correct: boolean;
  wrong_reason: string;
};

export type StudyQuestion = {
  id: string;
  stem: string;
  options: StudyOption[];
  correct_explanation: string;
  reference_note: string;
};

export function questionKey(subject: string, subtopic: string) {
  const slug = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "-");
  return `rita_q_${slug(subject)}_${slug(subtopic)}`;
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

let version = 0;
const listeners = new Set<() => void>();

function emitChanged() {
  version += 1;
  listeners.forEach((l) => l());
}

export function useQuestionsVersion() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
    () => 0,
  );
}

export function readQuestions(subject: string, subtopic: string): StudyQuestion[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(questionKey(subject, subtopic));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StudyQuestion[]) : [];
  } catch {
    return [];
  }
}

export function countQuestions(subject: string, subtopic: string) {
  return readQuestions(subject, subtopic).length;
}

export function collectQuestions(subject: string, subtopics: string[]): StudyQuestion[] {
  return subtopics.flatMap((s) => readQuestions(subject, s));
}

/** Append freshly generated questions to a topic. Returns how many were added. */
export function appendQuestions(
  subject: string,
  subtopic: string,
  items: Omit<StudyQuestion, "id">[],
): number {
  if (typeof window === "undefined") return 0;
  const existing = readQuestions(subject, subtopic);
  const next = [...existing, ...items.map((q) => ({ ...q, id: newId() }))];
  try {
    window.localStorage.setItem(questionKey(subject, subtopic), JSON.stringify(next));
    emitChanged();
  } catch {
    /* ignore */
  }
  return items.length;
}

/** Questions for one sub-subject, persisted in the browser. */
export function useStudyQuestions(subject: string, subtopic: string) {
  const key = questionKey(subject, subtopic);
  const [questions, setQuestions] = useState<StudyQuestion[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const v = useQuestionsVersion();

  useEffect(() => {
    setHydrated(false);
    setQuestions(readQuestions(subject, subtopic));
    setHydrated(true);
  }, [subject, subtopic, v]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const current = window.localStorage.getItem(key);
      const next = JSON.stringify(questions);
      if (current !== next) {
        window.localStorage.setItem(key, next);
        emitChanged();
      }
    } catch {
      /* ignore */
    }
  }, [questions, hydrated, key]);

  const updateQuestion = useCallback((id: string, patch: Partial<Omit<StudyQuestion, "id">>) => {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }, []);

  const deleteQuestion = useCallback((id: string) => {
    setQuestions((qs) => qs.filter((q) => q.id !== id));
  }, []);

  const clearAll = useCallback(() => setQuestions([]), []);

  return { questions, updateQuestion, deleteQuestion, clearAll };
}
