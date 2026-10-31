// Pure rules for the learning home (/learn): the lesson count shown beside the
// lessons card. Kept free of React and alias imports so node can test it.

export type LessonLite = {
  id: string;
  title: string;
  title_ar: string;
  state: "done" | "current" | "locked";
  in_progress: boolean;
};

export function lessonsDone(lessons: LessonLite[] | null): { done: number; total: number } {
  const list = lessons ?? [];
  return { done: list.filter((lesson) => lesson.state === "done").length, total: list.length };
}
