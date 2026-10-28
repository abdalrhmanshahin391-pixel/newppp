// Shapes shared by the study page and its server functions (no server code here).
import type { GuideContent } from "@/lib/guides/guide-content";

export type StudyLessonData = {
  lesson: {
    id: string;
    title: string;
    title_ar: string;
    topic: string;
    objectives: { id: string; text: string; text_ar: string }[];
  };
  guide: {
    id: string;
    version: number;
    title: string;
    content: GuideContent;
    learner_path: string;
    allow_download: boolean;
  };
  preview: boolean;
};
