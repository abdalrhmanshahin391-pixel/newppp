// Which experience a lesson really opens with. The admin chooses "classic" (the current lesson) or
// "study" (the guide on the right, Rita on the left), but a study lesson only opens as one when its
// guide is ready for learners and the feature switch is on. Anything else falls back to the current
// lesson, which every lesson still has, so a learner never meets a broken page.
// Pure: decided on the server, tested with node.

export const EXPERIENCES = ["classic", "study"] as const;
export type Experience = (typeof EXPERIENCES)[number];

/** The feature switch in rita_feature_flags. */
export const STUDY_FLAG = "rita_study";

export type StudyGuideState = {
  status: string;
  /** The final copy printed for learners; null until the admin links the guide. */
  learner_path: string | null;
};

export type ExperienceInput = {
  /** The admin's choice, as stored (unknown values count as classic). */
  experience: unknown;
  /** The linked guide, or null when none is linked or it cannot be read. */
  guide: StudyGuideState | null;
  switchOn: boolean;
  /** An admin opening "preview as a learner" sees the study page while the switch is off. */
  adminPreview?: boolean;
};

export function isExperience(value: unknown): value is Experience {
  return value === "classic" || value === "study";
}

export function guideReadyForLearners(guide: StudyGuideState | null): boolean {
  return Boolean(guide && guide.status === "ready" && guide.learner_path);
}

export function effectiveExperience(input: ExperienceInput): Experience {
  if (input.experience !== "study") return "classic";
  if (!guideReadyForLearners(input.guide)) return "classic";
  if (!input.switchOn && !input.adminPreview) return "classic";
  return "study";
}

/** Why a study lesson opens as classic, for the admin panel. Empty when it opens as study. */
export function studyBlocker(input: ExperienceInput): "" | "not_study" | "no_guide" | "switch_off" {
  if (input.experience !== "study") return "not_study";
  if (!guideReadyForLearners(input.guide)) return "no_guide";
  if (!input.switchOn) return "switch_off";
  return "";
}
