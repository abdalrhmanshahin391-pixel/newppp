import assert from "node:assert/strict";
import test from "node:test";
import {
  VoiceAttempt,
  guardVoiceCallbacks,
  voiceErrorMessage,
  voiceStateWord,
} from "./rita-voice-connection.ts";

test("a pipeline error cannot be followed by a late ready or transcript event", () => {
  const attempt = new VoiceAttempt();
  let phase = "connecting";
  const messages: string[] = [];
  const callbacks = guardVoiceCallbacks(
    {
      ready: () => {
        phase = "ready";
      },
      error: () => {
        attempt.close();
        phase = "failed";
      },
      transcript: (text: string) => {
        messages.push(text);
      },
    },
    () => attempt.current,
  );
  callbacks.error();
  callbacks.ready();
  callbacks.transcript("late text");
  assert.equal(phase, "failed");
  assert.deepEqual(messages, []);
});

test("retry accepts only callbacks belonging to the new session", () => {
  const oldAttempt = new VoiceAttempt();
  let current = oldAttempt;
  const seen: string[] = [];
  const old = guardVoiceCallbacks(
    { ready: () => seen.push("old"), error: () => seen.push("old error") },
    () => oldAttempt.current && current === oldAttempt,
  );
  oldAttempt.close();
  const next = new VoiceAttempt();
  current = next;
  const fresh = guardVoiceCallbacks(
    { ready: () => seen.push("new") },
    () => next.current && current === next,
  );
  old.ready();
  fresh.ready();
  old.error();
  assert.deepEqual(seen, ["new"]);
});

test("waiting, failure and idle never announce that Rita is listening", () => {
  for (const phase of ["waiting", "failed", "connecting", "idle", "ended"] as const) {
    assert.doesNotMatch(voiceStateWord(phase, "listening", false), /بسمعك|جاهزة/);
  }
  assert.equal(voiceStateWord("ready", "listening", false), "بسمعك…");
  assert.equal(voiceStateWord("ready", "listening", true), "المايك مسكّر");
});

test("provider errors become actionable copy without exposing raw URLs or credentials", () => {
  const raw = new Error(
    "Unknown error occurred: timed out during opening handshake wss://example.invalid?api_key=private",
  );
  assert.match(voiceErrorMessage(raw, true), /إعادة الاتصال/);
  assert.match(voiceErrorMessage(raw, false), /Reconnect/);
  assert.doesNotMatch(voiceErrorMessage(raw, true), /private|wss:|legacy/);
  assert.match(voiceErrorMessage(new Error("401 unauthorized"), true), /إعدادات/);
  assert.match(voiceErrorMessage(new Error("Microphone permission denied"), true), /ميكروفون/);
});
