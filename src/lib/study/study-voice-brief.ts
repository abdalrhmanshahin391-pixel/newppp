// What Rita's voice worker is told about a study lesson when the call starts: the guide's outline
// (headings and taught terms) and the lesson goals, never the guide's text. The guide is on the
// learner's screen; Rita gets the text of a part only when the learner asks about it. Pure.
import { guideOutline } from "../guides/guide-blocks.ts";
import type { StudyLessonData } from "./study-types.ts";

export type StudyVoiceBrief = {
  lessonId: string;
  title: string;
  sections: { id: string; heading: string; terms: string[] }[];
  objectives: string[];
  preview?: true;
};

export function studyVoiceBrief(data: StudyLessonData): StudyVoiceBrief {
  const outline = guideOutline(data.guide.content);
  return {
    lessonId: data.lesson.id,
    title: data.lesson.title || outline.title,
    sections: outline.sections,
    objectives: data.lesson.objectives
      .map((objective) => objective.text || objective.text_ar)
      .filter(Boolean)
      .slice(0, 8),
    ...(data.preview ? { preview: true as const } : {}),
  };
}
