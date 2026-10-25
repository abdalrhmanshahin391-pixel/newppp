import assert from "node:assert/strict";
import test from "node:test";
import { interpretTranscript } from "./page-transcript.ts";

test("normal text is kept as written", () => {
  assert.deepEqual(interpretTranscript("Unit 1\nI am a student.", "stop"), {
    kind: "text",
    text: "Unit 1\nI am a student.",
  });
});

test("an empty reply, NO_TEXT and an empty JSON text all mean a blank page", () => {
  const replies = [
    "",
    "   ",
    null,
    undefined,
    "NO_TEXT",
    " no text. ",
    '{"text":""}',
    "```\nNO_TEXT\n```",
  ];
  for (const raw of replies) {
    assert.equal(interpretTranscript(raw, "stop").kind, "blank", String(raw));
  }
});

test("the old JSON answer still works", () => {
  assert.deepEqual(interpretTranscript('{"text":"Hello"}', "stop"), {
    kind: "text",
    text: "Hello",
  });
});

test("a refusal field, a safety filter or an apology is a refusal, not page text", () => {
  assert.equal(interpretTranscript("", "stop", "I can't help with that").kind, "refused");
  assert.equal(interpretTranscript("", "content_filter").kind, "refused");
  assert.equal(interpretTranscript("I'm sorry, I can't read this image.", "stop").kind, "refused");
  assert.equal(interpretTranscript("Sorry, but I cannot transcribe it.", "stop").kind, "refused");
});

test("a long page that starts with 'Sorry' is still page text", () => {
  assert.equal(interpretTranscript(`Sorry ${"word ".repeat(100)}`, "stop").kind, "text");
});

test("a reply cut at the limit keeps its text", () => {
  assert.deepEqual(interpretTranscript("Part one of a long page", "length"), {
    kind: "cut",
    text: "Part one of a long page",
  });
});
