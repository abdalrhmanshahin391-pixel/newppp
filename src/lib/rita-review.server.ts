/**
 * The review job: finds the turns of finished conversations that have no review yet, sends each one
 * (with the conversation so far and the voice system's turn record) to OpenAI, and stores the
 * answer in rita_turn_reviews. The pure rules live in rita-review.ts.
 *
 * It never runs during a call. A single switch (rita_review_settings.enabled) stops all of it.
 */
import { getServerRuntimeSecret } from "@/lib/config.server";
import { resolveRitaOpenAiKey } from "@/lib/rita-voice.server";
import {
  REVIEW_JSON_SCHEMA,
  REVIEW_SYSTEM_PROMPT,
  parseReview,
  pickCandidates,
  reviewPrompt,
  type Review,
} from "@/lib/rita-review";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ReviewDb = { from: (table: string) => any };

const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4.1-mini";
/** Tries for a turn whose answer could not be read; sign-in and rate problems do not count. */
const MAX_ATTEMPTS = 3;
const STALE_PENDING_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 90_000;
const PARALLEL = 4;

export class ReviewError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Is the review switched on? (Off when the table does not exist yet.) */
export async function reviewEnabled(db: ReviewDb): Promise<boolean> {
  const { data, error } = await db
    .from("rita_review_settings")
    .select("enabled")
    .eq("id", true)
    .maybeSingle();
  return !error && data?.enabled === true;
}

async function openAiKey() {
  const fromEnv = await getServerRuntimeSecret("OPENAI_API_KEY");
  if (fromEnv.length > 20) return fromEnv;
  const saved = await resolveRitaOpenAiKey();
  if (saved) return saved;
  throw new ReviewError(
    503,
    "No OpenAI key found: save one on the AI keys page or add OPENAI_API_KEY to the server secrets.",
  );
}

export async function reviewModel() {
  return (await getServerRuntimeSecret("RITA_REVIEW_MODEL")) || DEFAULT_MODEL;
}

async function askModel(key: string, model: string, prompt: string): Promise<Review | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        store: false,
        messages: [
          { role: "system", content: REVIEW_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "rita_turn_review", strict: true, schema: REVIEW_JSON_SCHEMA },
        },
      }),
      signal: controller.signal,
    });
    const raw = await response.text();
    if (!response.ok) {
      let message = raw.slice(0, 300);
      try {
        message = JSON.parse(raw)?.error?.message ?? message;
      } catch {
        /* keep the raw text */
      }
      throw new ReviewError(response.status, `OpenAI ${response.status}: ${message}`);
    }
    const content = JSON.parse(raw)?.choices?.[0]?.message?.content;
    return parseReview(content);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ReviewError(504, "OpenAI took too long to answer.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** A problem that is the account's or the service's, not the turn's: stop and keep the turn for later. */
function isServiceProblem(error: unknown) {
  return error instanceof ReviewError && [401, 403, 429, 500, 502, 503, 504].includes(error.status);
}

type MessageRow = {
  client_message_id: string;
  session_id: string | null;
  role: string;
  content: string;
};
type ReviewRow = {
  id: string;
  turn_key: string;
  status: string;
  attempts: number;
  created_at: string;
};

export type ReviewSummary = {
  reviewed: number;
  problems: number;
  failed: number;
  noText: number;
  /** Turns that were due but not reached before the deadline. */
  waiting: number;
  stopped?: string;
};

const empty = (): ReviewSummary => ({ reviewed: 0, problems: 0, failed: 0, noText: 0, waiting: 0 });

/** Reviews the turns of one conversation that have no review yet. */
export async function reviewConversation(
  db: ReviewDb,
  args: {
    conversationId: string;
    all?: boolean;
    reportsOnly?: boolean;
    deadlineAt: number;
  },
): Promise<ReviewSummary> {
  const summary = empty();
  const { data: conversation } = await db
    .from("rita_free_conversations")
    .select("id,user_id")
    .eq("id", args.conversationId)
    .maybeSingle();
  if (!conversation) return summary;

  const { data: messageData } = await db
    .from("rita_free_conversation_messages")
    .select("client_message_id,session_id,role,content,created_at,id")
    .eq("conversation_id", args.conversationId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  const messages = (messageData ?? []) as MessageRow[];
  if (!messages.length) return summary;

  const { data: sessionData } = await db
    .from("rita_v3_sessions")
    .select("id")
    .eq("conversation_id", args.conversationId);
  const sessionIds = ((sessionData ?? []) as { id: string }[]).map((row) => row.id);
  const ledgers: Record<string, unknown>[] = [];
  if (sessionIds.length) {
    const { data: eventData } = await db
      .from("rita_v3_events")
      .select("session_id,metadata")
      .in("session_id", sessionIds)
      .eq("event_name", "turn_ledger")
      .order("created_at", { ascending: true });
    for (const event of (eventData ?? []) as {
      session_id: string;
      metadata: Record<string, unknown> | null;
    }[]) {
      if (event.metadata) ledgers.push({ ...event.metadata, sessionId: event.session_id });
    }
  }
  const { data: reportData } = await db
    .from("rita_issue_reports")
    .select("reply_message_id,category,note")
    .eq("conversation_id", args.conversationId);
  const reports = (
    (reportData ?? []) as {
      reply_message_id: string | null;
      category: string;
      note: string | null;
    }[]
  )
    .filter((report) => report.reply_message_id)
    .map((report) => ({
      replyMessageId: report.reply_message_id as string,
      category: report.category,
      note: report.note,
    }));

  const { data: reviewData } = await db
    .from("rita_turn_reviews")
    .select("id,turn_key,status,attempts,created_at")
    .eq("conversation_id", args.conversationId);
  const blocked = new Set<string>();
  const retryable = new Map<string, ReviewRow>();
  for (const row of (reviewData ?? []) as ReviewRow[]) {
    const stale = Date.now() - new Date(row.created_at).getTime() > STALE_PENDING_MS;
    if (row.status === "done" || row.status === "no_text") blocked.add(row.turn_key);
    else if (row.status === "failed" && row.attempts >= MAX_ATTEMPTS) blocked.add(row.turn_key);
    else if (row.status === "pending" && !stale) blocked.add(row.turn_key);
    else retryable.set(row.turn_key, row);
  }

  const due = pickCandidates({
    ledgers,
    reports,
    existing: blocked,
    all: args.all ?? true,
    reportsOnly: args.reportsOnly,
  });
  if (!due.length) return summary;

  const key = await openAiKey();
  const model = await reviewModel();
  const queue = [...due];
  let stop: string | undefined;

  const handle = async (candidate: (typeof due)[number]) => {
    const now = new Date().toISOString();
    let rowId: string | null = null;
    const retry = retryable.get(candidate.turnKey);
    if (retry) {
      const { data } = await db
        .from("rita_turn_reviews")
        .update({ status: "pending", created_at: now })
        .eq("id", retry.id)
        .eq("status", retry.status)
        .select("id");
      rowId = data?.[0]?.id ?? null;
    } else {
      const ledger = ledgers.find((item) => item.replyMessageId === candidate.replyMessageId) as
        Record<string, unknown> | undefined;
      const { data, error } = await db
        .from("rita_turn_reviews")
        .insert({
          turn_key: candidate.turnKey,
          conversation_id: args.conversationId,
          user_id: conversation.user_id,
          session_id: typeof ledger?.sessionId === "string" ? ledger.sessionId : null,
          turn_ref: typeof ledger?.turn_ref === "string" ? ledger.turn_ref : null,
          reply_message_id: candidate.replyMessageId,
          trigger: candidate.trigger,
          reasons: candidate.reasons,
          build: typeof ledger?.build === "string" ? ledger.build : null,
          status: "pending",
        })
        .select("id");
      // A second run claimed the same turn first (unique turn_key): leave it to that run.
      if (!error) rowId = data?.[0]?.id ?? null;
    }
    if (!rowId) return;

    const replyIndex = messages.findIndex(
      (message) => message.client_message_id === candidate.replyMessageId,
    );
    if (replyIndex < 0 || !messages[replyIndex].content.trim()) {
      await db
        .from("rita_turn_reviews")
        .update({ status: "no_text", reviewed_at: new Date().toISOString() })
        .eq("id", rowId);
      summary.noText += 1;
      return;
    }
    const ledger = ledgers.find((item) => item.replyMessageId === candidate.replyMessageId);
    const report = reports.find((item) => item.replyMessageId === candidate.replyMessageId);
    try {
      const review = await askModel(
        key,
        model,
        reviewPrompt({
          messages,
          replyIndex,
          ledger,
          report,
          reasons: candidate.reasons,
        }),
      );
      if (!review) throw new ReviewError(422, "The answer did not match the review format.");
      await db
        .from("rita_turn_reviews")
        .update({
          status: "done",
          model,
          verdict: review.verdict,
          severity: review.severity,
          category: review.category,
          cause: review.cause,
          evidence: review.evidence,
          suggestion: review.suggestion,
          confidence: review.confidence,
          error: null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", rowId);
      summary.reviewed += 1;
      if (review.verdict === "problem") summary.problems += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const service = isServiceProblem(error);
      await db
        .from("rita_turn_reviews")
        .update({
          status: "failed",
          error: message.slice(0, 300),
          attempts: (retry?.attempts ?? 0) + (service ? 0 : 1),
        })
        .eq("id", rowId);
      summary.failed += 1;
      if (service) stop = message;
    }
  };

  const worker = async () => {
    while (queue.length && !stop && Date.now() < args.deadlineAt) {
      const next = queue.shift();
      if (next) await handle(next);
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  summary.waiting = queue.length;
  if (stop) summary.stopped = stop;
  return summary;
}

/** The scheduled run: recent finished conversations, newest first, until the time is used. */
export async function runScheduledReview(db: ReviewDb, budgetMs = 45_000) {
  if (!(await reviewEnabled(db))) return { enabled: false as const };
  const deadlineAt = Date.now() + budgetMs;
  const now = Date.now();
  const { data } = await db
    .from("rita_free_conversations")
    .select("id")
    .gte("last_message_at", new Date(now - 3 * 24 * 3600 * 1000).toISOString())
    .lte("last_message_at", new Date(now - 2 * 60 * 1000).toISOString())
    .order("last_message_at", { ascending: false })
    .limit(30);
  const total = empty();
  for (const row of (data ?? []) as { id: string }[]) {
    if (Date.now() >= deadlineAt || total.stopped) break;
    const summary = await reviewConversation(db, { conversationId: row.id, deadlineAt });
    total.reviewed += summary.reviewed;
    total.problems += summary.problems;
    total.failed += summary.failed;
    total.noText += summary.noText;
    total.waiting += summary.waiting;
    if (summary.stopped) total.stopped = summary.stopped;
  }
  return { enabled: true as const, ...total };
}
