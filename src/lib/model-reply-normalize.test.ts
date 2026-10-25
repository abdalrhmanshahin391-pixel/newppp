import assert from "node:assert/strict";
import test from "node:test";
import { LessonDraftSchema } from "./rita-curriculum.ts";
import { generatedContentSchema } from "./rita-lesson-content.ts";
import {
  cut,
  normalizeLessonContentReply,
  normalizeLessonDraftReply,
  slug,
} from "./model-reply-normalize.ts";

const long = (n: number) => "w".repeat(n);

const messyDraft = () => ({
  title: "Simple Present",
  topic: "Simple Present",
  source_from_page: "3",
  source_to_page: 5,
  objectives: Array.from({ length: 8 }, (_, i) => ({
    id:
      i < 2
        ? "Uses the -s ending with he, she and it in sentences about people"
        : `Objective ${i}!`,
    text: long(300),
    criteria: long(450),
    check_prompts: ["a", "b", "c", "d", "e"],
    weight: "2",
  })),
  plan: {
    phases: [
      { phase: "Warm-up", minutes: 2, steps: ["Greet."] },
      { phase: "Teaching", minutes: 12, steps: ["a", "b", "c", "d", "e", "f", "g"] },
      { phase: "free talk", minutes: 3, steps: ["Chat."] },
      { phase: "practice", minutes: 3, steps: ["Practise."] },
      { phase: "Wrap-up", minutes: 1, steps: ["Done."] },
    ],
    teacher_notes: long(1_500),
  },
  vocabulary: Array.from({ length: 40 }, () => ({
    word: "works",
    meaning_ar: "يعمل",
    example: "He works.",
  })),
});

test("a messy but sensible lesson plan is made valid without losing its content", () => {
  const fixed = normalizeLessonDraftReply(messyDraft());
  const parsed = LessonDraftSchema.parse(fixed);
  assert.equal(parsed.source_from_page, 3);
  assert.equal(parsed.objectives.length, 6);
  const ids = parsed.objectives.map((objective) => objective.id);
  assert.equal(new Set(ids).size, ids.length, "ids are unique");
  assert.ok(ids.every((id) => id.length <= 40 && /^[a-z0-9][a-z0-9-]*$/.test(id)));
  assert.ok(parsed.objectives.every((objective) => objective.check_prompts.length === 4));
  assert.deepEqual(
    parsed.plan.phases.map((phase) => phase.phase),
    ["warmup", "teach", "practice", "wrap"],
  );
  assert.ok(parsed.plan.phases.every((phase) => phase.minutes <= 10));
  assert.equal(parsed.plan.teacher_notes.length, 1_200);
  assert.equal(parsed.vocabulary.length, 30);
});

test("a lesson plan with a real problem still fails", () => {
  const draft = messyDraft() as { objectives: unknown[] };
  draft.objectives = [draft.objectives[0]]; // one objective: a lesson needs at least two
  assert.equal(LessonDraftSchema.safeParse(normalizeLessonDraftReply(draft)).success, false);
});

const item = (n: number, over: Record<string, unknown> = {}) => ({
  id: `Q${n} choose the right verb form`,
  template: "choice_fill",
  skill_tag: "present.s",
  prompt: `He ___ every day ${n}.`,
  options: ["work", "works"],
  answer: "works",
  explain_ar: long(400),
  ...over,
});
const messyContent = () => ({
  language: "EN",
  estimated_minutes: 45,
  sections: [
    {
      id: "Section 1: the -s ending",
      title: "The -s ending",
      source_pages: [3, "4"],
      explain: { rule_ar: long(700), table: [{ left: "He", right: "works" }], examples: [] },
      guided: [item(0)],
      practice: Array.from({ length: 6 }, (_, i) => item(i + 1)),
      remediation: [item(20)],
    },
  ],
  wrap: {},
});

test("messy exercises become valid: ids, schema, length of soft text", () => {
  const schema = generatedContentSchema({ from: 3, to: 5 });
  const parsed = schema.parse(normalizeLessonContentReply(messyContent()));
  assert.equal(parsed.estimated_minutes, 40);
  assert.equal(parsed.language, "en");
  assert.equal(parsed.sections[0].explain.rule_ar.length, 600);
  assert.equal(parsed.sections[0].practice[0].id, "p1-1");
});

test("exercises that are wrong are NOT repaired: the answer must be one of the options", () => {
  const schema = generatedContentSchema({ from: 3, to: 5 });
  const content = messyContent();
  content.sections[0].practice[2] = item(3, { answer: "worked" });
  assert.equal(schema.safeParse(normalizeLessonContentReply(content)).success, false);
});

test("a prompt that is too long is not cut (it could remove the gap): it fails", () => {
  const schema = generatedContentSchema({ from: 3, to: 5 });
  const content = messyContent();
  content.sections[0].practice[0] = item(1, { prompt: `${long(260)} ___ x.` });
  assert.equal(schema.safeParse(normalizeLessonContentReply(content)).success, false);
});

test("things that are not objects pass through untouched", () => {
  assert.equal(normalizeLessonDraftReply("nope"), "nope");
  assert.equal(normalizeLessonContentReply(null), null);
  assert.deepEqual(normalizeLessonContentReply([1]), [1]);
});

test("helpers: cut and slug", () => {
  assert.equal(cut("  abcdef  ", 3), "abc");
  assert.equal(cut(5, 3), 5);
  assert.equal(slug("Uses the -s ending!", 40), "uses-the-s-ending");
  assert.equal(slug("x".repeat(60), 40).length, 40);
  assert.equal(slug("مرحبا", 40), "");
});
