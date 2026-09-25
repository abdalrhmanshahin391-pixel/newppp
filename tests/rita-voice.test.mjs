import assert from "node:assert/strict";
import { test } from "node:test";

import { explicitRitaAccent, stableRitaDialect } from "../src/lib/rita-voice-style.ts";
import { playRitaSpeechResponse } from "../src/lib/rita-speech-stream.client.ts";
import { RitaReplySanitizer, stripRitaOpeningFiller } from "../src/lib/rita-clause-chunker.ts";
import {
  isLikelyRitaEcho,
  isRitaStopCommand,
  selectRitaDeepgramLanguage,
} from "../src/lib/rita-economic.client.ts";
import { createRitaTurnTimeline, markRitaTurn } from "../src/lib/rita-turn-telemetry.ts";

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

test("spoken filler is removed only from the opening", () => {
  assert.equal(stripRitaOpeningFiller("ممم، الجواب هو أربعة."), "الجواب هو أربعة.");
  assert.equal(stripRitaOpeningFiller("Okay so, the answer is four."), "the answer is four.");
  assert.equal(stripRitaOpeningFiller("Das Wort verstehe ich."), "Das Wort verstehe ich.");
});

test("stream sanitizer keeps text and speech on the same clean reply", () => {
  const sanitizer = new RitaReplySanitizer();
  const output = [sanitizer.push("فهمت "), sanitizer.push("عليك… الجواب هو أربعة."), sanitizer.flush()].join("");
  assert.equal(output, "الجواب هو أربعة.");
});

test("Rita echo is ignored while explicit stop commands remain valid", () => {
  assert.equal(isLikelyRitaEcho("الجواب هو أربعة", "الجواب هو أربعة، لأن اثنين زائد اثنين"), true);
  assert.equal(isLikelyRitaEcho("عندي سؤال جديد", "الجواب هو أربعة، لأن اثنين زائد اثنين"), false);
  assert.equal(isRitaStopCommand("وقف"), true);
  assert.equal(isRitaStopCommand("لا"), true);
});

test("Rita opens one stable Deepgram language instead of an Arabic/multi probe", () => {
  assert.equal(selectRitaDeepgramLanguage("ar-SA", "en-US"), "ar-SA");
  assert.equal(selectRitaDeepgramLanguage("", "ar-JO"), "ar-JO");
  assert.equal(selectRitaDeepgramLanguage("", "en-US"), "ar-JO");
  assert.equal(selectRitaDeepgramLanguage("de", "ar-JO"), "de");
});

test("quiet-speech pickup timing starts at the first signal rather than the transcript", () => {
  const timeline = createRitaTurnTimeline(1_000, "signalStart");
  markRitaTurn(timeline, "speechStart", 1_075);
  markRitaTurn(timeline, "transcriptFinal", 2_200);
  assert.equal(timeline.marks.signalStart, 0);
  assert.equal(timeline.marks.speechStart, 75);
  assert.equal(timeline.marks.transcriptFinal, 1_200);
});
