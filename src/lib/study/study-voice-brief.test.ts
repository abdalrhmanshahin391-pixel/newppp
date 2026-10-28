import assert from "node:assert/strict";
import test from "node:test";
import { guideSegments } from "../guides/guide-blocks.ts";
import { SAMPLE_GUIDES } from "../guides/guide-samples.ts";
import type { StudyLessonData } from "./study-types.ts";
import { studyVoiceBrief } from "./study-voice-brief.ts";

const content = SAMPLE_GUIDES[1].content;
const data = (patch: Partial<StudyLessonData> = {}): StudyLessonData => ({
  lesson: {
    id: "l1",
    title: "Third person -s",
    title_ar: "",
    topic: "",
    objectives: Array.from({ length: 11 }, (_, i) => ({
      id: `o${i}`,
      text: i === 0 ? "" : `Goal ${i}`,
      text_ar: i === 0 ? "هدف" : "",
    })),
  },
  guide: {
    id: "g",
    version: 1,
    title: "t",
    content,
    learner_path: "x",
    allow_download: true,
  },
  preview: false,
  ...patch,
});

test("ST-V06 (site side): Rita gets the outline and the goals, never the guide's text", () => {
  const brief = studyVoiceBrief(data());
  assert.equal(brief.lessonId, "l1");
  assert.equal(brief.title, "Third person -s");
  assert.deepEqual(
    brief.sections.map((section) => section.id),
    content.sections.map((_, index) => `s${index + 1}`),
  );
  const sent = JSON.stringify(brief);
  // No example, cell or rule text of the guide travels with the call start.
  for (const piece of guideSegments(content))
    if (
      ["cell", "example", "rule", "intro", "callout", "arabic"].includes(piece.role) &&
      piece.text.length > 12
    )
      assert.ok(!sent.includes(piece.text), `${piece.seg} leaked`);
  assert.equal(brief.objectives.length, 8, "at most eight goals");
  assert.equal(brief.objectives[0], "هدف", "an Arabic-only goal is kept");
  assert.equal("preview" in brief, false);
});

test("an admin preview is marked, so nothing is saved on the worker side", () => {
  assert.equal(studyVoiceBrief(data({ preview: true })).preview, true);
});
