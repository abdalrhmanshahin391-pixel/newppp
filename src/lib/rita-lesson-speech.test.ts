import assert from "node:assert/strict";
import test from "node:test";
import { findItem } from "./rita-lesson-content.ts";
import {
  initialState,
  reduce,
  stepOf,
  type LessonEvent,
  type RunState,
} from "./rita-lesson-engine.ts";
import { gradeItem } from "./rita-lesson-grader.ts";
import { SAMPLE_PROPERTY, SAMPLE_TO_BE } from "./rita-lesson-samples.ts";
import { feedbackLine, questionLine, silenceLine, stepMessage } from "./rita-lesson-speech.ts";

const C = SAMPLE_TO_BE;

function go(state: RunState, event: LessonEvent): RunState {
  const result = reduce(C, state, event, state.revision);
  assert.ok(result.ok, event.type);
  return result.state;
}

function answer(state: RunState, value: string): RunState {
  const id = stepOf(C, state).item!.id;
  const grade = gradeItem(findItem(C, id)!.item, { kind: "choice", value }, state.seed);
  return go(state, { type: "graded", item_id: id, grade });
}

function practice(): RunState {
  let state = initialState(C, "s");
  state = go(state, { type: "ready" });
  state = go(state, { type: "no_question" });
  return answer(state, "is"); // guided
}

const GENDERED = /\b(جاهزة|جاهز\b|خدي|خد\b|حابب|حابة)|(اضغطي|اضغط\b|جربي|جرّبي|رتّبي|رتبي)/;

test("the intro and each new part are taught by the model", () => {
  const intro = initialState(C, "s");
  assert.equal(stepMessage(null, stepOf(C, intro), "ar")!.action, "model");
  const explain = go(intro, { type: "ready" });
  const message = stepMessage(stepOf(C, intro), stepOf(C, explain), "ar")!;
  assert.equal(message.action, "model");
  assert.equal(message.say, "");
  assert.equal(message.explain?.table.length, 3);
});

test("a question in the explanation changes nothing Rita must say", () => {
  const explain = go(initialState(C, "s"), { type: "ready" });
  const asked = go(explain, { type: "question" });
  assert.equal(stepMessage(stepOf(C, explain), stepOf(C, asked), "ar"), null);
});

test("moving on says the result of the last answer, then reads the next question", () => {
  let state = initialState(C, "s");
  state = go(state, { type: "ready" });
  state = go(state, { type: "no_question" });
  const before = stepOf(C, state);
  const guided = stepMessage(stepOf(C, go(initialState(C, "s"), { type: "ready" })), before, "ar")!;
  assert.match(guided.say, /^مثال مع مساعدة\. She … a teacher\. am، is، ولا are؟$/);
  state = answer(state, "is");
  const message = stepMessage(before, stepOf(C, state), "ar")!;
  assert.match(message.say, /صح|تمام|حلو|بالزبط/);
  assert.match(message.say, /She مفردة، فنقول is\./);
  assert.match(message.say, /سؤال 1 من 5\. I … tired today\. am، is، ولا are؟$/);
  assert.equal(message.action, "");
});

test("a wrong try says the hint and does not read the question again", () => {
  const state = practice();
  const wrong = answer(state, "is");
  const message = stepMessage(stepOf(C, state), stepOf(C, wrong), "ar")!;
  assert.match(message.say, /^مش هيك\. شو بنقول مع I؟ خلّينا نجرّب كمان مرة\.$/);
});

test("the second wrong try says the right answer, then the next question", () => {
  const state = answer(practice(), "is");
  const revealed = answer(state, "are");
  const message = stepMessage(stepOf(C, state), stepOf(C, revealed), "ar")!;
  assert.match(message.say, /^الجواب الصحيح: am\. مع I دايماً am\. سؤال 2 من 5\./);
});

test("misheard speech is asked again without assuming the learner's gender", () => {
  const state = practice();
  const id = stepOf(C, state).item!.id;
  const grade = gradeItem(findItem(C, id)!.item, { kind: "spoken", text: "his" }, state.seed);
  const next = go(state, { type: "graded", item_id: id, grade });
  const message = stepMessage(stepOf(C, state), stepOf(C, next), "ar")!;
  assert.match(message.say, /ما سمعتها منيح/);
  assert.doesNotMatch(message.say, GENDERED);
});

test("an off-topic turn that only changes the offer does not repeat the last line", () => {
  const state = answer(practice(), "is");
  const off = go(go(state, { type: "off_topic" }), { type: "off_topic" });
  const message = stepMessage(stepOf(C, state), stepOf(C, off), "ar");
  assert.equal(message?.say ?? "", "");
});

test("pause and resume: a short line, then the same question again", () => {
  const state = practice();
  const paused = go(state, { type: "pause" });
  const pausedMessage = stepMessage(stepOf(C, state), stepOf(C, paused), "ar")!;
  assert.match(pausedMessage.say, /وقّفنا التمرين/);
  assert.equal(pausedMessage.paused, true);
  const resumed = go(paused, { type: "resume" });
  const resumedMessage = stepMessage(stepOf(C, paused), stepOf(C, resumed), "ar")!;
  assert.match(resumedMessage.say, /^سؤال 1 من 5\./);
});

test("a call that starts in the middle of an exercise reads the open question", () => {
  const message = stepMessage(null, stepOf(C, practice()), "ar")!;
  assert.match(message.say, /^سؤال 1 من 5\./);
});

test("the end of a part says the score and asks to go on", () => {
  let state = practice();
  for (const value of ["am", "are", "is", "are", "is"]) state = answer(state, value);
  const before = stepOf(C, answer(practice(), "am"));
  const message = stepMessage(before, stepOf(C, state), "ar")!;
  assert.match(message.say, /5 من 5 صح من أول مرة\. ممتاز، خلصنا هالجزء\. نكمل للجزء الجاي؟$/);
});

test("the worker never receives an answer key or an explanation of an open item", () => {
  const step = stepOf(C, practice());
  const message = stepMessage(null, step, "ar")!;
  const json = JSON.stringify(message);
  assert.ok(!json.includes('"answer"'));
  assert.ok(!json.includes("explain_ar"));
  assert.ok(!json.includes("hint_ar"));
});

test("English explanations use the English lines", () => {
  const state = practice();
  const wrong = answer(state, "is");
  const message = stepMessage(stepOf(C, state), stepOf(C, wrong), "en")!;
  assert.match(message.say, /^Not quite\./);
  assert.equal(
    questionLine(stepOf(C, state), "en"),
    "Question 1 of 5. I … tired today. am, is, or are?",
  );
});

test("spelling never says the word to build", () => {
  let state = initialState(SAMPLE_PROPERTY, "s");
  const P = SAMPLE_PROPERTY;
  const step = (s: RunState) => stepOf(P, s);
  const send = (s: RunState, e: LessonEvent) => {
    const r = reduce(P, s, e, s.revision);
    assert.ok(r.ok);
    return r.state;
  };
  state = send(state, { type: "ready" });
  state = send(state, { type: "no_question" });
  while (state.phase === "practice") {
    const id = step(state).item!.id;
    const item = findItem(P, id)!.item;
    const value =
      item.template === "meaning_choice" || item.template === "choice_fill" ? item.answer : "";
    state = send(state, {
      type: "graded",
      item_id: id,
      grade: gradeItem(item, { kind: "choice", value }, state.seed),
    });
  }
  state = send(state, { type: "ready" });
  state = send(state, { type: "no_question" });
  const line = questionLine(step(state), "ar");
  assert.match(line, /المطلوب تركيب الكلمة من القطع، ومعناها ملكية، عقار\./);
  assert.doesNotMatch(line, /property/);
});

test("fixed lines never use a gendered command", () => {
  const lines = [
    silenceLine(1, "ar"),
    silenceLine(2, "ar"),
    feedbackLine(
      {
        item_id: "x",
        status: "unclear",
        given: "",
        settled: false,
        answer: "",
        explain_ar: "",
        explain_en: "",
        hint_ar: "",
        hint_en: "",
        unclear_reason: "not_an_option",
      },
      "ar",
    ),
    feedbackLine(
      {
        item_id: "x",
        status: "hint",
        given: "",
        settled: false,
        answer: "",
        explain_ar: "",
        explain_en: "",
        hint_ar: "",
        hint_en: "",
        unclear_reason: "",
      },
      "ar",
    ),
    stepMessage(stepOf(C, practice()), stepOf(C, go(practice(), { type: "pause" })), "ar")!.say,
  ];
  for (const line of lines) assert.doesNotMatch(line, GENDERED, line);
});
