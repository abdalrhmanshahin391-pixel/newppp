import assert from "node:assert/strict";
import test from "node:test";
import {
  ISSUE_CATEGORIES,
  ISSUE_NOTE_LIMIT,
  isIssueCategory,
  issueReportRow,
  ritaRepairFile,
  ritaRepairFileName,
} from "./rita-issue-report.ts";

test("the seven categories are the ones the database accepts", () => {
  assert.deepEqual(
    ISSUE_CATEGORIES.map((c) => c.id),
    ["interrupted", "misunderstood", "forgot", "wrong_answer", "weak_explanation", "lost", "other"],
  );
  assert.equal(isIssueCategory("interrupted"), true);
  assert.equal(isIssueCategory("rude"), false);
});

test("a report row carries the reply, the turn reference and the build from the turn record", () => {
  const row = issueReportRow({
    userId: "u1",
    conversationId: "c1",
    sessionId: "s1",
    replyMessageId: "r1",
    category: "interrupted",
    note: "  she did it twice  ",
    ledger: { turn_ref: "s1-t-4", build: "95bfb0416ff1", stop: "period" },
  });
  assert.ok(row);
  assert.equal(row.turn_ref, "s1-t-4");
  assert.equal(row.build, "95bfb0416ff1");
  assert.equal(row.note, "she did it twice");
  assert.equal(row.reply_message_id, "r1");
  assert.deepEqual(row.ledger, { turn_ref: "s1-t-4", build: "95bfb0416ff1", stop: "period" });
});

test("a report is still valid when the turn record has not arrived yet", () => {
  const row = issueReportRow({ userId: "u1", replyMessageId: "r1", category: "other" });
  assert.ok(row);
  assert.equal(row.turn_ref, null);
  assert.equal(row.build, null);
  assert.equal(row.note, null);
  assert.equal(row.conversation_id, null);
  assert.deepEqual(row.ledger, {});
});

test("an invalid report is refused, and a long note is cut to the limit", () => {
  assert.equal(issueReportRow({ userId: "u1", replyMessageId: "", category: "other" }), null);
  assert.equal(issueReportRow({ userId: "", replyMessageId: "r", category: "other" }), null);
  assert.equal(
    issueReportRow({ userId: "u", replyMessageId: "r", category: "nope" as never }),
    null,
  );
  const row = issueReportRow({
    userId: "u",
    replyMessageId: "r",
    category: "other",
    note: "x".repeat(2000),
  });
  assert.equal(row?.note?.length, ISSUE_NOTE_LIMIT);
});

const conversation = {
  id: "c1abcdef-0000",
  title: "Hunger في ألمانيا",
  created_at: "2026-10-24T09:00:00Z",
};
const message = (id: string, role: string, text: string) => ({
  client_message_id: id,
  session_id: "s1",
  role,
  content: text,
  generated_content: null,
  spoken_content: null,
  source: "voice",
  delivery_status: "completed",
  created_at: "2026-10-24T09:01:00Z",
});

test("the repair file puts each turn record and report next to its messages", () => {
  const file = ritaRepairFile({
    conversation,
    messages: [message("u1", "user", "hello"), message("r1", "assistant", "hi")],
    sessions: [
      { id: "s1", status: "ended", started_at: "2026-10-24T09:00:00Z", model_proof: { llm: "m" } },
    ],
    events: [
      {
        session_id: "s1",
        event_name: "turn_ledger",
        value_ms: null,
        created_at: "2026-10-24T09:01:05Z",
        metadata: {
          turn_ref: "s1-t-1",
          build: "abc",
          interrupted: true,
          userMessageId: "u1",
          replyMessageId: "r1",
        },
      },
      { session_id: "s1", event_name: "llm_start", value_ms: 1, metadata: {}, created_at: "x" },
    ],
    reports: [
      {
        id: "p1",
        reply_message_id: "r1",
        turn_ref: "s1-t-1",
        category: "interrupted",
        note: "twice",
        build: "abc",
        ledger: {},
        created_at: "2026-10-24T09:02:00Z",
      },
    ],
  });
  assert.equal(file.messages.length, 2);
  assert.equal((file.messages[1].turnRecord as Record<string, unknown>).turn_ref, "s1-t-1");
  assert.equal(file.messages[0].turnRecord !== null, true, "the learner message is matched too");
  assert.equal(file.messages[1].reports[0].category, "interrupted");
  assert.equal(file.summary.turnRecords, 1);
  assert.equal(file.summary.interruptedReplies, 1);
  assert.deepEqual(file.summary.reportsByCategory, { interrupted: 1 });
  assert.deepEqual(file.builds, ["abc"]);
  assert.equal(file.unmatchedTurnRecords.length, 0);
  assert.equal(file.unmatchedReports.length, 0);
});

test("records and reports that match no message are kept, not lost", () => {
  const file = ritaRepairFile({
    conversation,
    messages: [message("r9", "assistant", "hi")],
    sessions: [],
    events: [
      {
        session_id: "s1",
        event_name: "turn_ledger",
        value_ms: null,
        created_at: "t",
        metadata: { turn_ref: "s1-t-2", replyMessageId: "gone" },
      },
    ],
    reports: [
      {
        id: "p2",
        reply_message_id: "gone",
        turn_ref: "s1-t-2",
        category: "lost",
        note: null,
        build: null,
        ledger: { turn_ref: "s1-t-2" },
        created_at: "t",
      },
    ],
  });
  assert.equal(file.unmatchedTurnRecords.length, 1);
  assert.equal(file.unmatchedReports.length, 1);
  assert.equal(file.unmatchedReports[0].turnRef, "s1-t-2");
});

test("the file never carries audio or credentials and names itself safely", () => {
  const file = ritaRepairFile({
    conversation,
    messages: [],
    sessions: [],
    events: [],
    reports: [],
  });
  assert.deepEqual(file.privacy, { rawAudioIncluded: false, credentialsIncluded: false });
  const name = ritaRepairFileName(conversation.title, conversation.id);
  assert.match(name, /^rita-repair-[^/\\]+-c1abcdef\.json$/);
  assert.equal(
    ritaRepairFileName("???", "12345678-aaaa"),
    "rita-repair-conversation-12345678.json",
  );
});

test("the repair file carries each turn's review next to its reply", () => {
  const file = ritaRepairFile({
    conversation: { id: "c1", title: "T", created_at: "2026-10-24T10:00:00Z" },
    messages: [
      {
        client_message_id: "r1",
        session_id: "s1",
        role: "assistant",
        content: "Hallo",
        generated_content: null,
        spoken_content: null,
        source: "voice",
        delivery_status: "completed",
        created_at: "2026-10-24T10:00:01Z",
      },
    ],
    sessions: [],
    events: [],
    reports: [],
    reviews: [
      {
        id: "v1",
        reply_message_id: "r1",
        turn_ref: "s1-t-1",
        trigger: "flag",
        status: "done",
        verdict: "problem",
        severity: 2,
        category: "interrupted",
        cause: "turn_taking",
        evidence: "x",
        suggestion: "y",
        confidence: 0.9,
        model: "m",
        reviewed_at: "2026-10-24T10:05:00Z",
      },
      {
        id: "v2",
        reply_message_id: "gone",
        turn_ref: null,
        trigger: "report",
        status: "done",
        verdict: "ok",
        severity: 0,
        category: "ok",
        cause: "unknown",
        evidence: "",
        suggestion: "",
        confidence: 0.5,
        model: "m",
        reviewed_at: null,
      },
    ],
  });
  assert.equal(file.messages[0].review?.cause, "turn_taking");
  assert.equal(file.summary.reviewedTurns, 2);
  assert.equal(file.summary.problemsFoundByReview, 1);
  assert.equal(file.unmatchedReviews.length, 1);
});

test("the repair file puts the summary first and carries the comparison for each reply", () => {
  const file = ritaRepairFile({
    conversation: { id: "c1", title: "T", created_at: "2026-10-24T10:00:00Z" },
    messages: [
      {
        client_message_id: "r1",
        session_id: "s1",
        role: "assistant",
        content: "شو حابب نتعلم؟",
        generated_content: null,
        spoken_content: null,
        source: "voice",
        delivery_status: "completed",
        created_at: "2026-10-24T10:00:01Z",
      },
    ],
    sessions: [],
    events: [],
    reports: [],
    reviews: [
      {
        id: "v1",
        reply_message_id: "r1",
        turn_ref: "s1-t-1",
        trigger: "manual",
        status: "done",
        verdict: "problem",
        severity: 2,
        category: "wrong_dialect",
        cause: "language_choice",
        evidence: "شو حابب",
        suggestion: "use neutral wording",
        model: "gpt-5",
        reviewed_at: "2026-10-24T10:05:00Z",
        rubric_version: 2,
        explanation: "She guessed the learner's gender.",
        reference_reply: "عن شو بدنا نحكي؟",
        reference_why: "neutral",
        winner: "reference",
        scores: { ritaAverage: 2.5, referenceAverage: 4.5 },
        fix: { where: "prompt", change: "forbid شو حابب" },
      },
    ],
    conversationReview: {
      status: "done",
      rubric_version: 2,
      turns_reviewed: 1,
      model: "gpt-5",
      stats: { talkRatio: 3 },
      data: { overall: 2 },
      reviewed_at: "2026-10-24T10:06:00Z",
    },
  });
  assert.deepEqual(Object.keys(file).slice(0, 4), [
    "schemaVersion",
    "purpose",
    "privacy",
    "summary",
  ]);
  assert.equal(Object.keys(file)[4], "conversationReview");
  assert.equal(file.summary.referenceWon, 1);
  assert.equal(file.summary.averageScoreRita, 2.5);
  assert.equal(file.summary.averageScoreReference, 4.5);
  assert.deepEqual(file.summary.problemsByCategory, { wrong_dialect: 1 });
  assert.deepEqual(file.summary.problemsByCause, { language_choice: 1 });
  const review = file.messages[0].review;
  assert.equal(review?.referenceReply, "عن شو بدنا نحكي؟");
  assert.equal(review?.winner, "reference");
  assert.deepEqual(review?.fix, { where: "prompt", change: "forbid شو حابب" });
  assert.equal(file.conversationReview?.turnsReviewed, 1);
});
