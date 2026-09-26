import test from "node:test";
import assert from "node:assert/strict";
import { nextLessonState, lessonStateInstruction, soundsLike, EMPTY_LESSON_STATE } from "../src/lib/rita-lesson-state.ts";
test("arabic transcription matches german target", () => {
  assert.ok(soundsLike("اي كوفين", "einkaufen") || soundsLike("إن كوفين", "einkaufen"));
});
test("attempts count and stop correcting", () => {
  let s = nextLessonState(EMPTY_LESSON_STATE, "شو معنى einkaufen", "");
  assert.equal(s.targetPhrase, "einkaufen");
  s = nextLessonState(s, "einkaufen", "");
  s = nextLessonState(s, "einkaufen", "");
  assert.ok(s.attemptCount >= 2);
  assert.match(lessonStateInstruction(s, "x"), /Stop correcting/);
});
test("understood resets", () => {
  const s = nextLessonState({ ...EMPTY_LESSON_STATE, targetPhrase: "x", attemptCount: 2 }, "خلص فهمت", "");
  assert.equal(s.userSaidUnderstood, true);
  assert.match(lessonStateInstruction(s, ""), /understood/);
});
test("frustration disables teasing", () => {
  const s = nextLessonState(EMPTY_LESSON_STATE, "زهقت مش قادر احفظ", "");
  assert.match(lessonStateInstruction(s, ""), /No teasing/);
});
