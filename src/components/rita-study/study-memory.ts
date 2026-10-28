// What this browser remembers about a study lesson: whether Rita already explained how the page
// works, and the section the learner was reading. A per-viewer convenience only: it can be empty
// (private window, cleared data) and the page works the same.

import type { OrbPosition } from "./orb-position";

export type StudyMemory = { introduced?: boolean; section?: string; orb?: OrbPosition };

const key = (lessonId: string) => `uzyra-study:${lessonId}`;

export function readStudyMemory(lessonId: string): StudyMemory {
  try {
    const raw = window.localStorage.getItem(key(lessonId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!parsed || typeof parsed !== "object") return {};
    const value = parsed as Record<string, unknown>;
    return {
      introduced: value.introduced === true,
      section:
        typeof value.section === "string" && /^s\d{1,2}$/.test(value.section)
          ? value.section
          : undefined,
      orb: readOrb(value.orb),
    };
  } catch {
    return {};
  }
}

function readOrb(value: unknown): OrbPosition | undefined {
  if (!value || typeof value !== "object") return undefined;
  const { x, y } = value as Record<string, unknown>;
  if (typeof x !== "number" || typeof y !== "number") return undefined;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
}

export function writeStudyMemory(lessonId: string, patch: StudyMemory): void {
  try {
    window.localStorage.setItem(
      key(lessonId),
      JSON.stringify({ ...readStudyMemory(lessonId), ...patch }),
    );
  } catch {
    /* storage can be blocked; nothing depends on it */
  }
}
