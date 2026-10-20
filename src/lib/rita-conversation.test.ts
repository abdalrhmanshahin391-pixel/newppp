import assert from "node:assert/strict";
import test from "node:test";
import {
  boundedRitaHistory,
  ritaConversationDiagnostic,
  ritaConversationMarkdown,
  ritaConversationPrintHtml,
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

test("print document keeps both speakers, in order, with a role label for each", () => {
  const html = ritaConversationPrintHtml(conversation, messages);
  assert.ok(html.indexOf('class="m user"') < html.indexOf('class="m rita"'));
  assert.match(html, /<p class="who">You /);
  assert.match(html, /<p class="who">Rita /);
  assert.match(html, /كيف أحكي بدي أروح على الحمام/);
  assert.match(html, /I need to go to the bathroom/);
  assert.match(html, /<title>rita-Bathroom-English-12345678<\/title>/);
});

test("print document sets dir=auto per message, marks roles by border, hides its button when printing", () => {
  const html = ritaConversationPrintHtml(conversation, messages);
  assert.equal((html.match(/class="text" dir="auto"/g) ?? []).length, 2);
  assert.match(html, /\.m \{[^}]*border-left: 4px solid/);
  assert.doesNotMatch(html, /\.m(\.user)? \{[^}]*background/);
  assert.match(html, /@media print \{ \.bar \{ display: none; \}/);
});

test("print document escapes message text and the title", () => {
  const html = ritaConversationPrintHtml(
    { ...conversation, title: "<img src=x onerror=alert(1)>" },
    [{ ...messages[0], content: "<script>alert('x')</script> & \"quoted\"" }],
  );
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;script&gt;alert\(&#39;x&#39;\)&lt;\/script&gt; &amp; &quot;quoted&quot;/);
});

test("print document flags interrupted turns and shows what the learner heard", () => {
  const html = ritaConversationPrintHtml(conversation, [
    {
      ...messages[1],
      content: "Full answer that was cut off.",
      spoken_content: "Full answer",
      delivery_status: "interrupted",
    },
  ]);
  assert.match(html, /interrupted/);
  assert.match(html, /Heard by the learner: Full answer/);
});

test("print document starts a new section per voice session and handles an empty chat", () => {
  const second = { ...messages[1], session_id: "20000000-0000-4000-8000-000000000002" };
  const html = ritaConversationPrintHtml(conversation, [messages[0], second]);
  assert.match(html, /<h2>Session 1<\/h2>[\s\S]*<h2>Session 2<\/h2>/);
  assert.match(ritaConversationPrintHtml(conversation, []), /No messages were saved/);
});
