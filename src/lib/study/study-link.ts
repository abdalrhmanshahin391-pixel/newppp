// Whether an admin may link a PDF guide to a lesson as its study file. Pure, tested with node.
// A learner only ever sees a guide that passed these checks; the database rules add the rest.

export type LinkGuide = {
  curriculum_id: string;
  status: string;
  from_page: number;
  to_page: number;
  warnings: unknown;
  content_ok: boolean;
};

export type LinkLesson = {
  curriculum_id: string;
  source_from_page: number;
  source_to_page: number;
};

export type LinkProblem = "other_book" | "not_ready" | "bad_content" | "high_warning";

export const LINK_PROBLEM_TEXT: Record<LinkProblem, string> = {
  other_book: "هاد الدليل من كتاب ثاني.",
  not_ready: "الدليل لسا مش جاهز. استنى لحد ما يخلص الـPDF.",
  bad_content: "محتوى الدليل ما بينقرأ. اكتبه من جديد.",
  high_warning: "الفاحص لقى غلطة كبيرة بالدليل. صلّحه أو اكتبه من جديد قبل ما يوصل للطلاب.",
};

export function highWarnings(warnings: unknown): number {
  if (!Array.isArray(warnings)) return 0;
  return warnings.filter(
    (warning) =>
      warning &&
      typeof warning === "object" &&
      (warning as { severity?: unknown }).severity === "high",
  ).length;
}

export function linkProblem(guide: LinkGuide, lesson: LinkLesson): LinkProblem | null {
  if (guide.curriculum_id !== lesson.curriculum_id) return "other_book";
  if (guide.status !== "ready") return "not_ready";
  if (!guide.content_ok) return "bad_content";
  if (highWarnings(guide.warnings) > 0) return "high_warning";
  return null;
}

/** Guides worth offering for a lesson: same book and pages that overlap the lesson's pages. */
export function coversLesson(guide: Pick<LinkGuide, "from_page" | "to_page">, lesson: LinkLesson) {
  return guide.from_page <= lesson.source_to_page && guide.to_page >= lesson.source_from_page;
}

/** Where the learners' copy of a guide is kept, next to the admin's draft copy. */
export function learnerGuidePath(curriculumId: string, guideId: string, version: number): string {
  return `${curriculumId}/${guideId}-v${version}-final.pdf`;
}
