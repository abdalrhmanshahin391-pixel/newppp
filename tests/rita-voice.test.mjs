import assert from "node:assert/strict";
import { test } from "node:test";

import { explicitRitaAccent, stableRitaDialect } from "../src/lib/rita-voice-style.ts";
import { playRitaSpeechResponse } from "../src/lib/rita-speech-stream.client.ts";

test("an explicit Jordanian request wins over an Iraqi dialect guess", () => {
  const requested = explicitRitaAccent("ممكن تحكي معي باللهجة الأردنية؟");
  assert.equal(requested, "ar-JO");
  assert.equal(
    stableRitaDialect({
      detected: "ar-IQ",
      confidence: 0.95,
      previous: "unknown",
      preference: requested,
      language: "ar",
    }),
    "ar-JO",
  );
});

test("a stable Arabic dialect is not carried into an English reply", () => {
  assert.equal(
    stableRitaDialect({
      detected: "standard",
      confidence: 0.3,
      previous: "Jordanian Arabic",
      preference: "",
      language: "en",
    }),
    "standard",
  );
});

test("buffered speech reads one stream without calling Body.blob", async () => {
  const response = new Response(new Uint8Array([1, 2, 3]), {
    headers: { "Content-Type": "audio/mpeg" },
  });
  response.blob = () => {
    throw new Error("Body is disturbed or locked");
  };
  let played = false;
  let source = "";
  const blob = await playRitaSpeechResponse({
    response,
    element: {
      play: async () => {
        played = true;
      },
    },
    signal: new AbortController().signal,
    stream: false,
    setSource: (value) => {
      source = value;
    },
    onPlaybackBlocked: () => assert.fail("Playback should not be blocked"),
  });
  assert.equal(blob.size, 3);
  assert.equal(played, true);
  assert.match(source, /^blob:/);
  URL.revokeObjectURL(source);
});
