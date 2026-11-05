import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPreview, previewReducer, previewResult } from "./question-preview";

describe("temporary question preview", () => {
  it("chooses three distinct questions with four distinct options and one valid answer", () => {
    for (const random of [() => 0, () => 0.5, () => 0.999]) {
      const s = createPreview(random);
      assert.equal(new Set(s.questions.map((q) => q.id)).size, 3);
      for (const q of s.questions) {
        assert.equal(new Set(q.options).size, 4);
        assert.ok(q.options[q.answer]);
      }
      assert.equal(previewResult(s).accuracy, null);
    }
  });
  it("requires a choice, locks submitted answers and does not count twice", () => {
    let s = createPreview(() => 0);
    assert.equal(previewReducer(s, { type: "submit" }), s);
    s = previewReducer(s, { type: "choose", choice: s.questions[0].answer });
    s = previewReducer(s, { type: "submit" });
    assert.equal(previewReducer(s, { type: "submit" }), s);
    assert.equal(previewReducer(s, { type: "choose", choice: (s.questions[0].answer + 1) % 4 }), s);
    assert.deepEqual(previewResult(s), { answered: 1, correct: 1, accuracy: 100, total: 3 });
  });
  it("preserves answers and flags across navigation and derives an honest score", () => {
    let s = createPreview(() => 0.5);
    for (let i = 0; i < 3; i++) {
      s = previewReducer(s, { type: "go", index: i });
      s = previewReducer(s, {
        type: "choose",
        choice: (s.questions[i].answer + (i === 1 ? 1 : 0)) % 4,
      });
      s = previewReducer(s, { type: "submit" });
    }
    s = previewReducer(s, { type: "go", index: 0 });
    s = previewReducer(s, { type: "flag" });
    assert.equal(s.attempts[0].flagged, true);
    assert.equal(s.attempts[0].submitted, true);
    assert.deepEqual(previewResult(s), { answered: 3, correct: 2, accuracy: 67, total: 3 });
    assert.equal(previewReducer(s, { type: "go", index: 3 }), s);
    assert.equal(previewReducer(s, { type: "go", index: -1 }), s);
  });
});
