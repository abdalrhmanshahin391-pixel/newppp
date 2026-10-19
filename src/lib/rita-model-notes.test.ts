import assert from "node:assert/strict";
import test from "node:test";
import { stripModelNotes } from "./rita-model-notes.ts";

test("a leaked note is removed and the rest is kept", () => {
  assert.equal(
    stripModelNotes("ممتاز!User wants continue.إذا حبيتي تقولي ثاني قوليه."),
    "ممتاز!إذا حبيتي تقولي ثاني قوليه.",
  );
  assert.equal(
    stripModelNotes("تمام. User wants continue. جربي مرة ثانية."),
    "تمام. جربي مرة ثانية.",
  );
});

test("ordinary sentences are untouched", () => {
  for (const text of [
    "The bathroom is called Toilette.",
    "We should practise this again, okay?",
    "Ich muss auf die Toilette.",
    "هو صباح الخير بالألماني Guten Morgen.",
    "User interface is a noun.",
  ]) {
    assert.equal(stripModelNotes(text), text);
  }
});

test("text without Latin letters is returned as is", () => {
  const text = "أهلين! كيف الحال؟";
  assert.equal(stripModelNotes(text), text);
});

test("page-oriented markdown is removed from live speech text", () => {
  assert.equal(stripModelNotes("## جواب\n- **Guten Morgen**"), "جواب\nGuten Morgen");
  assert.equal(stripModelNotes("`مرحبا`"), "مرحبا");
});
