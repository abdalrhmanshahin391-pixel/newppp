import assert from "node:assert/strict";
import test from "node:test";
import {
  boundedRitaHistory,
  ritaConversationDiagnostic,
  ritaConversationMarkdown,
  type RitaConversation,
  type RitaConversationMessage,
} from "./rita-conversation.ts";

const conversation: RitaConversation = {
  id: "12345678-0000-4000-8000-000000000000",
  title: "Bathroom English",
  language_preference: "automatic",
  dialect_preference: "ar-JO",
  message_count: 2,
  last_message_at: "2026-10-19T10:00:02.000Z",
  archived_at: null,
  created_at: "2026-10-19T10:00:00.000Z",
  updated_at: "2026-10-19T10:00:02.000Z",
};

const messages: RitaConversationMessage[] = [
  {
    id: 1,
    client_message_id: "10000000-0000-4000-8000-000000000001",
    conversation_id: conversation.id,
    session_id: "20000000-0000-4000-8000-000000000001",
    role: "user",
    content: "كيف أحكي بدي أروح على الحمام؟",
    generated_content: null,
    spoken_content: null,
    source: "voice",
    delivery_status: "completed",
    created_at: "2026-10-19T10:00:01.000Z",
  },
  {
    id: 2,
    client_message_id: "10000000-0000-4000-8000-000000000002",
    conversation_id: conversation.id,
    session_id: "20000000-0000-4000-8000-000000000001",
    role: "assistant",
    content: "بتقدر تقول: I need to go to the bathroom.",
    generated_content: "بتقدر تقول: I need to go to the bathroom.",
    spoken_content: "بتقدر تقول: I need to go to the bathroom.",
    source: "voice",
    delivery_status: "completed",
    created_at: "2026-10-19T10:00:02.000Z",
  },
];

test("markdown preserves user/Rita order and readable labels", () => {
  const markdown = ritaConversationMarkdown(conversation, messages);
  assert.ok(markdown.indexOf("### User") < markdown.indexOf("### Rita"));
  assert.match(markdown, /كيف أحكي/);
  assert.match(markdown, /I need to go to the bathroom/);
});

test("diagnostic export explicitly excludes raw audio, credentials and reasoning", () => {
  const diagnostic = ritaConversationDiagnostic(conversation, messages);
  assert.deepEqual(diagnostic.privacy, {
    rawAudioIncluded: false,
    credentialsIncluded: false,
    chainOfThoughtIncluded: false,
  });
  assert.equal(diagnostic.messages.length, 2);
  assert.doesNotMatch(JSON.stringify(diagnostic), /api[_-]?key|token/i);
});

test("resume history is bounded and ignores incomplete assistant drafts", () => {
  const history = boundedRitaHistory(
    [
      ...messages,
      { ...messages[1], content: "unfinished", delivery_status: "incomplete" },
      { ...messages[0], content: "x".repeat(100), delivery_status: "completed" },
    ],
    2,
    30,
  );
  assert.equal(history.length, 1);
  assert.equal(history[0].role, "user");
  assert.equal(history[0].content.length, 30);
});

test("resume history uses only the spoken part of an interrupted Rita reply", () => {
  const history = boundedRitaHistory([
    messages[0],
    {
      ...messages[1],
      content: "الجزء المسموع. الجزء الذي لم يسمعه المستخدم.",
      generated_content: "الجزء المسموع. الجزء الذي لم يسمعه المستخدم.",
      spoken_content: "الجزء المسموع.",
      delivery_status: "interrupted",
    },
  ]);
  assert.equal(history.at(-1)?.content, "الجزء المسموع.");
});
