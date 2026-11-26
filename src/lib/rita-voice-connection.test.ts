import assert from "node:assert/strict";
import test from "node:test";
import {
  VoiceAttempt,
  guardVoiceCallbacks,
  failureCode,
  isRecoverableVoiceError,
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

test("waiting, failure and idle never announce that Uzyra is listening", () => {
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

test("the start route's refusal codes name the real reason", () => {
  const says = (raw: string) => voiceErrorMessage(new Error(raw), true);
  assert.match(
    says("voice_not_available_for_language: Uzyra's voice is not available"),
    /مش متاح لهاي اللغة/,
  );
  assert.match(
    says(
      "rita_daily_limit: Uzyra voice is unavailable because its usage safety limit has been reached.",
    ),
    /حد الاستخدام/,
  );
  assert.match(says("unauthorized: Unauthorized"), /سجّل دخول/);
  // The daily voice budget: used up, or another call still open.
  assert.match(
    says("free_talk_exhausted: Voice time is unavailable. Check your remaining time."),
    /لليوم/,
  );
  assert.match(says("free_talk_already_active: Voice time is unavailable."), /مكالمة ثانية/);
  assert.match(says("session_storage_failed: Uzyra session storage is not ready."), /مش جاهزة/);
  assert.match(
    says("conversation_unavailable: This conversation is not available."),
    /محادثة جديدة/,
  );
  // A refusal that is a network failure keeps the network wording.
  assert.match(
    says("modal_network_error: The Uzyra website could not reach the Modal voice worker."),
    /تعذّر الاتصال/,
  );
});

test("only an error marked fatal: false is survived", () => {
  assert.equal(isRecoverableVoiceError({ error: "TTS hiccup", fatal: false }), true);
  assert.equal(isRecoverableVoiceError({ error: "pipeline stopped", fatal: true }), false);
  assert.equal(isRecoverableVoiceError({ message: "no flag" }), false);
  assert.equal(isRecoverableVoiceError(undefined), false);
});

test("diagnostics keep the refusal code or a coarse kind, never the text", () => {
  assert.equal(
    failureCode(new Error("voice_not_available_for_language: not for German")),
    "voice_not_available_for_language",
  );
  assert.equal(failureCode(new Error("Voice readiness timeout")), "timeout");
  assert.equal(failureCode(new Error("Something odd with private details")), "other");
});
