// What this browser remembers about a study lesson: whether Rita already explained how the page
// works, and the section the learner was reading. A per-viewer convenience only: it can be empty
// (private window, cleared data) and the page works the same.

export type StudyMemory = { introduced?: boolean; section?: string };

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
    };
  } catch {
    return {};
  }
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
