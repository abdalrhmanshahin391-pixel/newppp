/**
 * "There is a problem with this reply": the report categories, the row stored for one report, and
 * the repair file of a conversation (its messages, the worker's turn records and the learner's
 * reports in one JSON file that can be handed over for fixing).
 */

export const ISSUE_CATEGORIES = [
  { id: "interrupted", label: "She cut me off before I finished" },
  { id: "misunderstood", label: "She misunderstood me" },
  { id: "forgot", label: "She forgot what we were talking about" },
  { id: "wrong_answer", label: "The answer is wrong" },
  { id: "weak_explanation", label: "The explanation is unclear or incomplete" },
  { id: "lost", label: "The voice or text disappeared" },
  { id: "other", label: "Something else" },
] as const;

export type IssueCategory = (typeof ISSUE_CATEGORIES)[number]["id"];

export const ISSUE_NOTE_LIMIT = 500;

export function isIssueCategory(value: unknown): value is IssueCategory {
  return ISSUE_CATEGORIES.some((category) => category.id === value);
}

/** The turn record the page keeps for a reply (see rita-turn-ledger.ts). */
export type TurnLedgerMetadata = Record<string, unknown>;

export type IssueReportInput = {
  userId: string;
  conversationId?: string | null;
  sessionId?: string | null;
  replyMessageId: string;
  category: IssueCategory;
  note?: string;
  ledger?: TurnLedgerMetadata | null;
};

/** The row to insert, or null when the report is not valid (unknown category, no reply). */
export function issueReportRow(input: IssueReportInput) {
  if (!isIssueCategory(input.category) || !input.replyMessageId || !input.userId) return null;
  const ledger = input.ledger ?? {};
  const note = (input.note ?? "").trim().slice(0, ISSUE_NOTE_LIMIT);
  return {
    user_id: input.userId,
    conversation_id: input.conversationId || null,
    session_id: input.sessionId || null,
    reply_message_id: input.replyMessageId,
    turn_ref: typeof ledger.turn_ref === "string" ? ledger.turn_ref : null,
    build: typeof ledger.build === "string" ? ledger.build : null,
    category: input.category,
    note: note || null,
    ledger,
  };
}

type EventRow = {
  session_id: string;
  event_name: string;
  value_ms: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type ReportRow = {
  id: string;
  reply_message_id: string | null;
  turn_ref: string | null;
  category: string;
  note: string | null;
  build: string | null;
  ledger: Record<string, unknown> | null;
  created_at: string;
};

type TurnReviewRow = {
  id: string;
  reply_message_id: string | null;
  turn_ref: string | null;
  trigger: string;
  status: string;
  verdict: string | null;
  severity: number | null;
  category: string | null;
  cause: string | null;
  evidence: string | null;
  suggestion: string | null;
  confidence: number | null;
  model: string | null;
  reviewed_at: string | null;
};

type MessageRow = {
  client_message_id: string;
  session_id: string | null;
  role: string;
  content: string;
  generated_content: string | null;
  spoken_content: string | null;
  source: string;
  delivery_status: string;
  created_at: string;
};

function reviewFields(review: TurnReviewRow) {
  return {
    trigger: review.trigger,
    verdict: review.verdict,
    severity: review.severity,
    category: review.category,
    cause: review.cause,
    evidence: review.evidence,
    suggestion: review.suggestion,
    confidence: review.confidence,
    model: review.model,
    reviewedAt: review.reviewed_at,
    turnRef: review.turn_ref,
  };
}

/**
 * One file for fixing one conversation: every message with the turn record and the reports that
 * belong to it, plus the records and reports that could not be matched to a message. No audio and
 * no credentials; the text is the learner's own conversation.
 */
export function ritaRepairFile(args: {
  conversation: {
    id: string;
    title: string;
    created_at: string;
    learning_language?: string | null;
  };
  messages: MessageRow[];
  sessions: { id: string; status: string; started_at: string; model_proof: unknown }[];
  events: EventRow[];
  reports: ReportRow[];
  /** The second model's review of each turn (only admins can read these). */
  reviews?: TurnReviewRow[];
}) {
  const reviews = args.reviews ?? [];
  const reviewByReply = new Map<string, TurnReviewRow>();
  for (const review of reviews) {
    if (review.reply_message_id && review.status === "done") {
      reviewByReply.set(review.reply_message_id, review);
    }
  }
  const usedReviews = new Set<string>();
  const ledgers = args.events
    .filter((event) => event.event_name === "turn_ledger" && event.metadata)
    .map((event) => ({ at: event.created_at, sessionId: event.session_id, ...event.metadata }));
  const byReply = new Map<string, (typeof ledgers)[number]>();
  const byUser = new Map<string, (typeof ledgers)[number]>();
  for (const ledger of ledgers) {
    const reply = (ledger as Record<string, unknown>).replyMessageId;
    const user = (ledger as Record<string, unknown>).userMessageId;
    if (typeof reply === "string") byReply.set(reply, ledger);
    if (typeof user === "string") byUser.set(user, ledger);
  }
  const reportsByReply = new Map<string, ReportRow[]>();
  for (const report of args.reports) {
    if (!report.reply_message_id) continue;
    reportsByReply.set(report.reply_message_id, [
      ...(reportsByReply.get(report.reply_message_id) ?? []),
      report,
    ]);
  }
  const usedLedgers = new Set<unknown>();
  const usedReports = new Set<string>();
  const messages = args.messages.map((message) => {
    const ledger =
      byReply.get(message.client_message_id) ?? byUser.get(message.client_message_id) ?? null;
    if (ledger) usedLedgers.add(ledger);
    const reports = reportsByReply.get(message.client_message_id) ?? [];
    for (const report of reports) usedReports.add(report.id);
    const review = reviewByReply.get(message.client_message_id) ?? null;
    if (review) usedReviews.add(review.id);
    return {
      id: message.client_message_id,
      sessionId: message.session_id,
      role: message.role,
      text: message.content,
      generatedText: message.generated_content,
      spokenText: message.spoken_content,
      source: message.source,
      deliveryStatus: message.delivery_status,
      createdAt: message.created_at,
      turnRecord: ledger,
      review: review && reviewFields(review),
      reports: reports.map((report) => ({
        id: report.id,
        category: report.category,
        note: report.note,
        build: report.build,
        createdAt: report.created_at,
      })),
    };
  });
  return {
    schemaVersion: 1,
    purpose: "Rita conversation repair file",
    privacy: { rawAudioIncluded: false, credentialsIncluded: false },
    conversation: {
      id: args.conversation.id,
      title: args.conversation.title,
      createdAt: args.conversation.created_at,
      learningLanguage: args.conversation.learning_language ?? null,
    },
    builds: [
      ...new Set(
        ledgers.map((ledger) => (ledger as Record<string, unknown>).build).filter(Boolean),
      ),
    ],
    sessions: args.sessions.map((session) => ({
      id: session.id,
      status: session.status,
      startedAt: session.started_at,
      models: session.model_proof,
    })),
    summary: {
      messages: args.messages.length,
      turnRecords: ledgers.length,
      reports: args.reports.length,
      reviewedTurns: reviews.filter((review) => review.status === "done").length,
      problemsFoundByReview: reviews.filter((review) => review.verdict === "problem").length,
      interruptedReplies: ledgers.filter(
        (ledger) => (ledger as Record<string, unknown>).interrupted === true,
      ).length,
      reportsByCategory: args.reports.reduce<Record<string, number>>((counts, report) => {
        counts[report.category] = (counts[report.category] ?? 0) + 1;
        return counts;
      }, {}),
    },
    messages,
    unmatchedReviews: reviews
      .filter((review) => review.status === "done" && !usedReviews.has(review.id))
      .map(reviewFields),
    unmatchedTurnRecords: ledgers.filter((ledger) => !usedLedgers.has(ledger)),
    unmatchedReports: args.reports
      .filter((report) => !usedReports.has(report.id))
      .map((report) => ({
        id: report.id,
        category: report.category,
        note: report.note,
        turnRef: report.turn_ref,
        build: report.build,
        ledger: report.ledger,
        createdAt: report.created_at,
      })),
  };
}

export function ritaRepairFileName(title: string, id: string) {
  const stem = title
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `rita-repair-${stem || "conversation"}-${id.slice(0, 8)}.json`;
}
