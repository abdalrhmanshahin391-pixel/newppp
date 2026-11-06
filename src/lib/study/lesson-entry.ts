import { getStudyLesson, type StudyPageResult } from "./study.functions";

/**
 * Opening a study lesson faster: the lesson starts loading the moment the learner taps it (or opens
 * its card), before the lesson page exists, and the page picks up that same request instead of
 * starting its own after sign-in has settled. A lesson opened once stays in memory for a few minutes,
 * so going back into it is instant; an admin's preview is kept only briefly because it is being
 * edited. What the lessons list already knows (the title) is remembered too, so the lesson intro can
 * show it together with the UZYRA word from the first moment. Nothing here runs on a timer: every
 * request starts from a tap or from the lesson page itself.
 */

export type KnownLesson = { title: string; titleAr: string };

const KEEP_MS = 5 * 60_000;
const KEEP_PREVIEW_MS = 15_000;

const known = new Map<string, KnownLesson>();
const loads = new Map<string, { promise: Promise<StudyPageResult>; at: number }>();

const keyOf = (lessonId: string, preview: boolean) => `${lessonId}:${preview ? 1 : 0}`;

/** What the lessons list knows about a lesson, for the intro. */
export function rememberLesson(lessonId: string, info: KnownLesson): void {
  if (info.title || info.titleAr) known.set(lessonId, info);
}

export function knownLesson(lessonId: string): KnownLesson | null {
  return known.get(lessonId) ?? null;
}

/** The lesson's study page data: the request already under way, a recent result, or a new one. */
export function loadLesson(lessonId: string, preview = false): Promise<StudyPageResult> {
  const key = keyOf(lessonId, preview);
  const hit = loads.get(key);
  if (hit && Date.now() - hit.at < (preview ? KEEP_PREVIEW_MS : KEEP_MS)) return hit.promise;
  const promise = getStudyLesson({ data: { lessonId, preview } });
  loads.set(key, { promise, at: Date.now() });
  // A failed request is never kept: the next try asks again.
  promise.catch(() => {
    if (loads.get(key)?.promise === promise) loads.delete(key);
  });
  return promise;
}

/** Starts loading without waiting for it (a tap on the lesson, or its card opening). */
export function prefetchLesson(lessonId: string, preview = false): void {
  void loadLesson(lessonId, preview).catch(() => undefined);
}

/** Drops a kept request, so "try again" really asks again. */
export function forgetLesson(lessonId: string, preview = false): void {
  loads.delete(keyOf(lessonId, preview));
}
