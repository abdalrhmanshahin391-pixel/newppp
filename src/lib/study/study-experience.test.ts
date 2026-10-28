import assert from "node:assert/strict";
import test from "node:test";
import {
  effectiveExperience,
  guideReadyForLearners,
  isExperience,
  studyBlocker,
  type StudyGuideState,
} from "./study-experience.ts";

const ready: StudyGuideState = { status: "ready", learner_path: "c/g/v1-final.pdf" };

test("ST-U01: a study lesson opens as study only with a final guide and the switch on", () => {
  const guides: (StudyGuideState | null)[] = [
    null,
    { status: "ready", learner_path: null },
    { status: "rendering", learner_path: "x.pdf" },
    { status: "failed", learner_path: "x.pdf" },
    ready,
  ];
  for (const experience of ["classic", "study", "other", null, undefined])
    for (const guide of guides)
      for (const switchOn of [false, true])
        for (const adminPreview of [false, true]) {
          const result = effectiveExperience({ experience, guide, switchOn, adminPreview });
          const expected =
            experience === "study" && guide === ready && (switchOn || adminPreview)
              ? "study"
              : "classic";
          assert.equal(
            result,
            expected,
            JSON.stringify({ experience, guide, switchOn, adminPreview }),
          );
        }
});

test("every lesson that exists today (classic, no guide) stays classic", () => {
  assert.equal(
    effectiveExperience({ experience: "classic", guide: null, switchOn: true }),
    "classic",
  );
});

test("the blocker names the first reason a study lesson falls back", () => {
  assert.equal(studyBlocker({ experience: "classic", guide: ready, switchOn: true }), "not_study");
  assert.equal(studyBlocker({ experience: "study", guide: null, switchOn: true }), "no_guide");
  assert.equal(studyBlocker({ experience: "study", guide: ready, switchOn: false }), "switch_off");
  assert.equal(studyBlocker({ experience: "study", guide: ready, switchOn: true }), "");
});

test("helpers", () => {
  assert.equal(isExperience("study"), true);
  assert.equal(isExperience("guided"), false);
  assert.equal(guideReadyForLearners(ready), true);
  assert.equal(guideReadyForLearners(null), false);
});
