/**
 * The review job: finds the turns of finished conversations that have no current review, runs the
 * six questions of rita-review.ts on each (reference reply, fact check, dialect check, the judge in
 * both orders, the diagnosis) through OpenAI, and stores the result in rita_turn_reviews. When a
 * conversation has no turns left to review it also writes one review of the whole conversation.
 *
 * It never runs during a call. A single switch (rita_review_settings.enabled) stops all of it.
 * Nothing here limits cost or tokens: quality is the point.
 */
import { getServerRuntimeSecret } from "@/lib/config.server";
import { resolveRitaOpenAiKey } from "@/lib/rita-voice.server";
import {
  ASSIGN_SCHEMA,
  ASSIGN_SYSTEM,
  CONVERSATION_SCHEMA,
  CONVERSATION_SYSTEM,
  DIAGNOSE_SCHEMA,
  DUPLICATES_SCHEMA,
  DUPLICATES_SYSTEM,
  DIAGNOSE_SYSTEM,
  DIALECT_SCHEMA,
  DIALECT_SYSTEM,
  FACTS_SCHEMA,
  FACTS_SYSTEM,
  JUDGE_SCHEMA,
  JUDGE_SYSTEM,
  REFERENCE_SCHEMA,
  REFERENCE_SYSTEM,
  assignPrompt,
  conversationPrompt,
  conversationStats,
  diagnosePrompt,
  duplicatesPrompt,
  dialectPrompt,
  factsPrompt,
  finalizeReview,
  judgePrompt,
  mergeJudgements,
  parseAssignment,
  parseConversationReview,
  parseDiagnosis,
  parseDialect,
  parseDuplicates,
  parseFacts,
  parseJudgement,
  parseReference,
  pickCandidates,
  referencePrompt,
  timingFromLedger,
  type Ledger,
  type OpenIssue,
  type ReviewMessage,
} from "@/lib/rita-review";
import { RUBRIC_VERSION } from "@/lib/rita-tutor-contract";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ReviewDb = { from: (table: string) => any };

const CHAT_URL = "https://api.openai.com/v1/chat/completions";
/** The strongest model first; the next one is used only when the account has no access to it. */
const MODEL_PREFERENCE = ["gpt-5", "gpt-4.1"];
/** Tries for a turn whose answers could not be read; sign-in and rate problems do not count. */
const MAX_ATTEMPTS = 3;
/** A review claimed this long ago and never finished (the run died) is taken again. */
const STALE_PENDING_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;
const PARALLEL_TURNS = 4;

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

async function modelCandidates() {
  const configured = await getServerRuntimeSecret("RITA_REVIEW_MODEL");
  return [...new Set([configured, ...MODEL_PREFERENCE].filter(Boolean))];
}

let resolvedModel: string | null = null;

/** The model that answered the last question (null before the first one). */
export function usedModel() {
  return resolvedModel;
}

/** The account has no such model (not found, or no access): try the next one. */
function modelUnavailable(error: unknown) {
  if (!(error instanceof ReviewError)) return false;
  if (error.status === 404) return true;
  return (
    [400, 403].includes(error.status) &&
    /model/i.test(error.message) &&
    /(does not exist|not found|do(es)? not have access|no access|not supported)/i.test(
      error.message,
    )
  );
}

const isReasoningModel = (model: string) => /^(gpt-5|o\d)/.test(model);

async function post(
  key: string,
  model: string,
  system: string,
  user: string,
  name: string,
  schema: unknown,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        store: false,
        ...(isReasoningModel(model) ? { reasoning_effort: "high" } : {}),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
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
    return JSON.parse(raw)?.choices?.[0]?.message?.content as unknown;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ReviewError(504, "OpenAI took too long to answer.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export type Ask = <T>(args: {
  name: string;
  system: string;
  user: string;
  schema: unknown;
  parse: (raw: unknown) => T | null;
}) => Promise<T>;

/** One structured question. An answer that does not parse is asked once more. */
function makeAsk(key: string): Ask {
  return async ({ name, system, user, schema, parse }) => {
    const models = resolvedModel ? [resolvedModel] : await modelCandidates();
    let lastError: unknown;
    for (const model of models) {
      try {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const value = parse(await post(key, model, system, user, name, schema));
          if (value !== null) {
            resolvedModel = model;
            return value;
          }
        }
        throw new ReviewError(422, `The ${name} answer did not match its format.`);
      } catch (error) {
        lastError = error;
        if (!modelUnavailable(error)) throw error;
      }
    }
    throw lastError;
  };
}

/** One structured-question function with the account's key (for the replay judges). */
export async function createAsk(): Promise<Ask> {
  return makeAsk(await openAiKey());
}

/** A problem that is the account's or the service's, not the turn's: stop and keep the turn for later. */
export function isServiceProblem(error: unknown) {
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
  rubric_version: number | null;
};

export type ReviewSummary = {
  reviewed: number;
  problems: number;
  failed: number;
  noText: number;
  /** Turns that were due but not reached before the deadline. */
  waiting: number;
  conversationReviewed: boolean;
  /** Problems filed under an issue (new or existing) in this run. */
  grouped: number;
  stopped?: string;
};

const empty = (): ReviewSummary => ({
  reviewed: 0,
  problems: 0,
  failed: 0,
  noText: 0,
  waiting: 0,
  conversationReviewed: false,
  grouped: 0,
});

type TurnInput = {
  messages: ReviewMessage[];
  replyIndex: number;
  ledger: Ledger | undefined;
  report: { category: string; note: string | null } | undefined;
};

/** The six questions for one turn, and the finished review. */
export async function reviewTurn(ask: Ask, input: TurnInput) {
  const { messages, replyIndex, ledger, report } = input;
  const reply = messages[replyIndex].content;
  const [reference, facts, dialect] = await Promise.all([
    ask({
      name: "rita_reference_reply",
      system: REFERENCE_SYSTEM,
      user: referencePrompt({ messages, replyIndex, ledger }),
      schema: REFERENCE_SCHEMA,
      parse: parseReference,
    }),
    ask({
      name: "rita_fact_check",
      system: FACTS_SYSTEM,
      user: factsPrompt({ messages, replyIndex }),
      schema: FACTS_SCHEMA,
      parse: parseFacts,
    }),
    ask({
      name: "rita_dialect_check",
      system: DIALECT_SYSTEM,
      user: dialectPrompt({ messages, replyIndex, ledger }),
      schema: DIALECT_SCHEMA,
      parse: parseDialect,
    }),
  ]);
  const judge = (a: string, b: string) =>
    ask({
      name: "rita_reply_comparison",
      system: JUDGE_SYSTEM,
      user: judgePrompt({ messages, replyIndex, ledger, a, b }),
      schema: JUDGE_SCHEMA,
      parse: parseJudgement,
    });
  // Both orders, so the model's pull towards the first reply cancels out.
  const [ritaFirst, ritaSecond] = await Promise.all([
    judge(reply, reference.reply),
    judge(reference.reply, reply),
  ]);
  const merged = mergeJudgements([
    { ritaIs: "a", result: ritaFirst },
    { ritaIs: "b", result: ritaSecond },
  ]);
  const timing = timingFromLedger(ledger);
  const diagnosis = await ask({
    name: "rita_diagnosis",
    system: DIAGNOSE_SYSTEM,
    user: diagnosePrompt({
      messages,
      replyIndex,
      ledger,
      reference,
      merged,
      facts,
      dialect,
      timing,
      report,
    }),
    schema: DIAGNOSE_SCHEMA,
    parse: parseDiagnosis,
  });
  const final = finalizeReview({ diagnosis, merged, facts, dialect, timing });
  return { reference, facts, dialect, merged, timing, final };
}

/** Reviews the turns of one conversation that have no current review, then the conversation. */
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
  const ledgers: Ledger[] = [];
  if (sessionIds.length) {
    const { data: eventData } = await db
      .from("rita_v3_events")
      .select("session_id,metadata")
      .in("session_id", sessionIds)
      .eq("event_name", "turn_ledger")
      .order("created_at", { ascending: true });
    for (const event of (eventData ?? []) as { session_id: string; metadata: Ledger | null }[]) {
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
    .select("id,turn_key,status,attempts,created_at,rubric_version")
    .eq("conversation_id", args.conversationId);
  const blocked = new Set<string>();
  const retryable = new Map<string, ReviewRow>();
  for (const row of (reviewData ?? []) as ReviewRow[]) {
    const stale = Date.now() - new Date(row.created_at).getTime() > STALE_PENDING_MS;
    const current = (row.rubric_version ?? 1) === RUBRIC_VERSION;
    if (row.status === "no_text") blocked.add(row.turn_key);
    else if (row.status === "done" && current) blocked.add(row.turn_key);
    else if (row.status === "failed" && row.attempts >= MAX_ATTEMPTS && current)
      blocked.add(row.turn_key);
    else if (row.status === "pending" && !stale && current) blocked.add(row.turn_key);
    else retryable.set(row.turn_key, row);
  }

  const due = pickCandidates({
    ledgers,
    reports,
    existing: blocked,
    all: args.all ?? true,
    reportsOnly: args.reportsOnly,
  });

  let ask: Ask | null = null;
  const prepare = async () => {
    if (!ask) ask = makeAsk(await openAiKey());
    return ask;
  };

  const queue = [...due];
  let stop: string | undefined;

  const handle = async (candidate: (typeof due)[number]) => {
    const now = new Date().toISOString();
    let rowId: string | null = null;
    let attempts = 0;
    const retry = retryable.get(candidate.turnKey);
    if (retry) {
      attempts = (retry.rubric_version ?? 1) === RUBRIC_VERSION ? retry.attempts : 0;
      const { data } = await db
        .from("rita_turn_reviews")
        .update({ status: "pending", created_at: now, attempts, rubric_version: RUBRIC_VERSION })
        .eq("id", retry.id)
        .eq("status", retry.status)
        .select("id");
      rowId = data?.[0]?.id ?? null;
    } else {
      const ledger = ledgers.find((item) => item.replyMessageId === candidate.replyMessageId);
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
          rubric_version: RUBRIC_VERSION,
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
      const turnAsk = await prepare();
      const result = await reviewTurn(turnAsk, { messages, replyIndex, ledger, report });
      await db
        .from("rita_turn_reviews")
        .update({
          status: "done",
          model: resolvedModel,
          rubric_version: RUBRIC_VERSION,
          verdict: result.final.verdict,
          severity: result.final.severity,
          category: result.final.category,
          cause: result.final.cause,
          evidence: result.final.evidence,
          suggestion: result.final.fix.change,
          explanation: result.final.explanation,
          fix: result.final.fix,
          reference_reply: result.reference.reply,
          reference_why: result.reference.why,
          winner: result.merged?.winner ?? null,
          scores: result.merged
            ? {
                criteria: result.merged.criteria,
                ritaAverage: result.merged.ritaAverage,
                referenceAverage: result.merged.referenceAverage,
                bothOrdersAgree: result.merged.agree,
                comparison: result.merged.comparison,
              }
            : null,
          facts: result.facts,
          dialect: result.dialect,
          timing: result.timing,
          error: null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", rowId);
      summary.reviewed += 1;
      if (result.final.verdict === "problem") summary.problems += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const service = isServiceProblem(error);
      await db
        .from("rita_turn_reviews")
        .update({
          status: "failed",
          error: message.slice(0, 300),
          attempts: attempts + (service ? 0 : 1),
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
  await Promise.all(Array.from({ length: PARALLEL_TURNS }, worker));
  summary.waiting = queue.length;
  if (stop) summary.stopped = stop;

  if (!stop) {
    try {
      summary.grouped = await assignProblems(db, {
        conversationId: args.conversationId,
        messages,
        prepare,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isServiceProblem(error)) {
        summary.stopped = message;
        stop = message;
      }
      console.error("Rita issue grouping failed", error);
    }
  }

  if (!stop && !queue.length) {
    try {
      summary.conversationReviewed = await reviewWholeConversation(db, {
        conversationId: args.conversationId,
        userId: conversation.user_id,
        messages,
        prepare,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isServiceProblem(error)) summary.stopped = message;
      console.error("Rita conversation review failed", error);
    }
  }
  return summary;
}

/** One review of the whole conversation, once all its turns have a current review. */
async function reviewWholeConversation(
  db: ReviewDb,
  args: {
    conversationId: string;
    userId: string;
    messages: MessageRow[];
    prepare: () => Promise<Ask>;
  },
) {
  const { data: rows } = await db
    .from("rita_turn_reviews")
    .select(
      "turn_key,status,rubric_version,reply_message_id,winner,severity,category,explanation,reviewed_at",
    )
    .eq("conversation_id", args.conversationId);
  const done = (
    (rows ?? []) as {
      status: string;
      rubric_version: number | null;
      reply_message_id: string | null;
      winner: string | null;
      severity: number | null;
      category: string | null;
      explanation: string | null;
    }[]
  ).filter((row) => row.status === "done" && (row.rubric_version ?? 1) === RUBRIC_VERSION);
  if (!done.length) return false;

  const { data: existing } = await db
    .from("rita_conversation_reviews")
    .select("conversation_id,status,rubric_version,turns_reviewed")
    .eq("conversation_id", args.conversationId)
    .maybeSingle();
  if (
    existing?.status === "done" &&
    existing.rubric_version === RUBRIC_VERSION &&
    existing.turns_reviewed === done.length
  ) {
    return false;
  }

  const stats = conversationStats(args.messages);
  const turns = done.map((row) => ({
    index: args.messages.findIndex((message) => message.client_message_id === row.reply_message_id),
    winner: row.winner,
    severity: row.severity,
    category: row.category,
    explanation: row.explanation,
  }));
  const ask = await args.prepare();
  const review = await ask({
    name: "rita_conversation_review",
    system: CONVERSATION_SYSTEM,
    user: conversationPrompt({ messages: args.messages, stats, turns }),
    schema: CONVERSATION_SCHEMA,
    parse: parseConversationReview,
  });
  const row = {
    conversation_id: args.conversationId,
    user_id: args.userId,
    status: "done",
    rubric_version: RUBRIC_VERSION,
    turns_reviewed: done.length,
    model: resolvedModel,
    stats,
    data: review,
    error: null,
    reviewed_at: new Date().toISOString(),
  };
  if (existing) {
    await db
      .from("rita_conversation_reviews")
      .update(row)
      .eq("conversation_id", args.conversationId);
  } else {
    await db.from("rita_conversation_reviews").insert(row);
  }
  return true;
}

const LOCK_MS = 3 * 60 * 1000;

/** Only one run at a time decides which issue a problem belongs to. */
async function takeAssignLock(db: ReviewDb) {
  const { data } = await db
    .from("rita_review_settings")
    .select("assign_lock_until")
    .eq("id", true)
    .maybeSingle();
  const current: string | null = data?.assign_lock_until ?? null;
  if (current && new Date(current).getTime() > Date.now()) return false;
  const query = db
    .from("rita_review_settings")
    .update({ assign_lock_until: new Date(Date.now() + LOCK_MS).toISOString() })
    .eq("id", true);
  const { data: got } = await (
    current ? query.eq("assign_lock_until", current) : query.is("assign_lock_until", null)
  ).select("id");
  return Boolean(got?.length);
}

async function releaseAssignLock(db: ReviewDb) {
  await db.from("rita_review_settings").update({ assign_lock_until: null }).eq("id", true);
}

async function openIssues(db: ReviewDb): Promise<OpenIssue[]> {
  // "Fixing" issues stay in the list: a problem that comes back belongs to the card of its fix.
  const { data } = await db
    .from("rita_issues")
    .select("id,title,description,fix_where")
    .in("status", ["open", "fixing"])
    .order("created_at", { ascending: true })
    .limit(300);
  return (
    (data ?? []) as { id: string; title: string; description: string; fix_where: string }[]
  ).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    fixWhere: row.fix_where,
  }));
}

/** Files each problem of a conversation that has no issue yet under an existing or a new issue. */
async function assignProblems(
  db: ReviewDb,
  args: { conversationId: string; messages: MessageRow[]; prepare: () => Promise<Ask> },
) {
  const { data } = await db
    .from("rita_turn_reviews")
    .select("id,reply_message_id,category,cause,explanation,evidence,fix,facts,dialect,timing")
    .eq("conversation_id", args.conversationId)
    .eq("status", "done")
    .eq("verdict", "problem")
    .is("issue_id", null)
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as {
    id: string;
    reply_message_id: string | null;
    category: string | null;
    cause: string | null;
    explanation: string | null;
    evidence: string | null;
    fix: unknown;
    facts: unknown;
    dialect: unknown;
    timing: unknown;
  }[];
  if (!rows.length) return 0;
  if (!(await takeAssignLock(db))) return 0;
  let grouped = 0;
  try {
    const ask = await args.prepare();
    for (const row of rows) {
      try {
        const open = await openIssues(db);
        const ids = new Set(open.map((issue) => issue.id));
        const reply =
          args.messages.find((message) => message.client_message_id === row.reply_message_id)
            ?.content ?? "";
        const assignment = await ask({
          name: "rita_issue_assignment",
          system: ASSIGN_SYSTEM,
          user: assignPrompt({
            open,
            problem: {
              category: row.category,
              cause: row.cause,
              explanation: row.explanation,
              evidence: row.evidence,
              fix: row.fix,
              ritaReply: reply,
              facts: row.facts,
              dialect: row.dialect,
              timing: row.timing,
            },
          }),
          schema: ASSIGN_SCHEMA,
          parse: (raw) => parseAssignment(raw, ids),
        });
        let issueId = assignment.issueId;
        if (!issueId) {
          const { data: created } = await db
            .from("rita_issues")
            .insert({
              title: assignment.title,
              description: assignment.description,
              fix_where: assignment.fixWhere,
              category: row.category,
              cause: row.cause,
            })
            .select("id");
          issueId = created?.[0]?.id ?? null;
        } else {
          await db
            .from("rita_issues")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", issueId);
        }
        if (!issueId) continue;
        await db.from("rita_turn_reviews").update({ issue_id: issueId }).eq("id", row.id);
        grouped += 1;
      } catch (error) {
        // A service problem stops the run; one unreadable answer only leaves this problem for later.
        if (isServiceProblem(error)) throw error;
        console.error("Rita issue grouping skipped a problem", error);
      }
    }
  } finally {
    await releaseAssignLock(db);
  }
  return grouped;
}

const MERGE_PASS_EVERY_MS = 24 * 60 * 60 * 1000;

/** Once a day: propose merges for open issues that are really the same problem. */
export async function proposeMerges(db: ReviewDb) {
  const { data: settings } = await db
    .from("rita_review_settings")
    .select("last_merge_pass_at")
    .eq("id", true)
    .maybeSingle();
  const last = settings?.last_merge_pass_at ? new Date(settings.last_merge_pass_at).getTime() : 0;
  if (Date.now() - last < MERGE_PASS_EVERY_MS) return 0;
  const open = await openIssues(db);
  const stamp = () =>
    db
      .from("rita_review_settings")
      .update({ last_merge_pass_at: new Date().toISOString() })
      .eq("id", true);
  if (open.length < 2) {
    await stamp();
    return 0;
  }
  if (!(await takeAssignLock(db))) return 0;
  try {
    const ask = makeAsk(await openAiKey());
    const { data: counted } = await db
      .from("rita_turn_reviews")
      .select("issue_id")
      .not("issue_id", "is", null);
    const counts = new Map<string, number>();
    for (const row of (counted ?? []) as { issue_id: string }[]) {
      counts.set(row.issue_id, (counts.get(row.issue_id) ?? 0) + 1);
    }
    const ids = new Set(open.map((issue) => issue.id));
    const groups = await ask({
      name: "rita_duplicate_issues",
      system: DUPLICATES_SYSTEM,
      user: duplicatesPrompt(
        open.map((issue) => ({ ...issue, examples: counts.get(issue.id) ?? 0 })),
      ),
      schema: DUPLICATES_SCHEMA,
      parse: (raw) => parseDuplicates(raw, ids),
    });
    await db
      .from("rita_issues")
      .update({ suggested_merge_into: null })
      .in("id", [...ids]);
    for (const group of groups) {
      await db
        .from("rita_issues")
        .update({ suggested_merge_into: group.keepId })
        .in("id", group.mergeIds);
    }
    await stamp();
    return groups.length;
  } finally {
    await releaseAssignLock(db);
  }
}

/** The scheduled run: recent finished conversations, newest first, until the time is used. */
export async function runScheduledReview(db: ReviewDb, budgetMs = 75_000) {
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
    total.grouped += summary.grouped;
    if (summary.conversationReviewed) total.conversationReviewed = true;
    if (summary.stopped) total.stopped = summary.stopped;
  }
  if (!total.stopped) {
    try {
      await proposeMerges(db);
    } catch (error) {
      console.error("Rita merge proposals failed", error);
    }
  }
  return { enabled: true as const, ...total };
}
