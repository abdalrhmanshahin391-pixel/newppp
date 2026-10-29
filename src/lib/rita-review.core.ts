/**
 * The review engine, shared by the app's server (rita-review.server.ts, the admin's "review now"
 * steps) and the rita-review Edge Function (the scheduled run, which needs the service key the
 * published site does not have). It only imports its own folder, so the Edge Function uses a byte
 * for byte copy (scripts/sync-lesson-edge.mjs). Keys come from setReviewDeps.
 *
 * The review job: finds the turns of finished conversations that have no current review, runs the
 * six questions of rita-review.ts on each (reference reply, fact check, dialect check, the judge in
 * both orders, the diagnosis) through OpenAI, and stores the result in rita_turn_reviews. When a
 * conversation has no turns left to review it also writes one review of the whole conversation.
 *
 * It never runs during a call. A single switch (rita_review_settings.enabled) stops all of it.
 * Nothing here limits cost or tokens: quality is the point.
 */
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
  nextStage,
  parsePartial,
  planTurns,
  storePartial,
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
  type TurnPartial,
} from "./rita-review.ts";
import { RUBRIC_VERSION } from "./rita-tutor-contract.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ReviewDb = { from: (table: string) => any };

const CHAT_URL = "https://api.openai.com/v1/chat/completions";
/** The strongest model first; the next one is used only when the account has no access to it. */
const MODEL_PREFERENCE = ["gpt-5", "gpt-4.1"];
/** Tries for a turn whose answers could not be read; sign-in and rate problems do not count. */
const MAX_ATTEMPTS = 3;
/** A review claimed this long ago and never finished (the run died) is taken again. */
const STALE_PENDING_MS = 6 * 60 * 1000;
/** One question may think for this long; a stage that runs past the run's time is saved for the next run. */
const REQUEST_TIMEOUT_MS = 110 * 1000;
/** Two replies side by side: each reply is still asked about on its own, this only limits load. */
const PARALLEL_TURNS = 2;

/** The run reached its time limit in the middle of a question: the stage is kept for the next run. */
export class TimeUp extends Error {
  constructor() {
    super("The run's time was up.");
  }
}

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

/** Where the engine gets its key and an optional model name (the app and the Edge Function differ). */
export type ReviewDeps = {
  openAiKey: () => Promise<string | null>;
  modelOverride: () => Promise<string>;
};

let deps: ReviewDeps | null = null;

export function setReviewDeps(value: ReviewDeps) {
  deps = value;
}

async function openAiKey() {
  const key = deps ? await deps.openAiKey() : null;
  if (key && key.length > 20) return key;
  throw new ReviewError(
    503,
    "No OpenAI key found: save one on the AI keys page or add OPENAI_API_KEY to the server secrets.",
  );
}

async function modelCandidates() {
  const configured = deps ? await deps.modelOverride() : "";
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

export type Effort = "high" | "medium" | "low";

async function post(
  key: string,
  model: string,
  system: string,
  user: string,
  name: string,
  schema: unknown,
  effort: Effort,
  stopSignal?: AbortSignal,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onStop = () => controller.abort();
  if (stopSignal?.aborted) controller.abort();
  stopSignal?.addEventListener("abort", onStop);
  try {
    const response = await fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        store: false,
        ...(isReasoningModel(model) ? { reasoning_effort: effort } : {}),
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
      if (stopSignal?.aborted) throw new TimeUp();
      throw new ReviewError(504, "OpenAI took too long to answer.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
    stopSignal?.removeEventListener("abort", onStop);
  }
}

export type Ask = <T>(args: {
  name: string;
  system: string;
  user: string;
  schema: unknown;
  parse: (raw: unknown) => T | null;
  /** How long the model may think. High by default; checks with a narrow task use medium. */
  effort?: Effort;
}) => Promise<T>;

/** One structured question. An answer that does not parse is asked once more. */
function makeAsk(key: string, stopSignal?: AbortSignal): Ask {
  return async ({ name, system, user, schema, parse, effort = "high" }) => {
    const models = resolvedModel ? [resolvedModel] : await modelCandidates();
    let lastError: unknown;
    for (const model of models) {
      try {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const value = parse(
            await post(key, model, system, user, name, schema, effort, stopSignal),
          );
          if (value !== null) {
            resolvedModel = model;
            return value;
          }
        }
        throw new ReviewError(422, `The ${name} answer did not match its format.`);
      } catch (error) {
        lastError = error;
        if (error instanceof TimeUp || !modelUnavailable(error)) throw error;
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
  reply_message_id: string | null;
  partial: unknown;
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
  /** Reviewable turns in the conversation, and how many of them are finished (for a progress bar). */
  turns: number;
  finished: number;
  /** Replies part-way through their stages (saved; the next run carries on). */
  staged: number;
  /** Step mode only: turns were reviewed in this call, so the grouping and the whole-conversation
   * review are left for the next call. */
  finalPending: boolean;
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
  turns: 0,
  finished: 0,
  staged: 0,
  finalPending: false,
});

type TurnInput = {
  messages: ReviewMessage[];
  replyIndex: number;
  ledger: Ledger | undefined;
  report: { category: string; note: string | null } | undefined;
};

/**
 * One stage of one reply's review (see TurnPartial in rita-review.ts). Every question is asked at
 * the highest effort and about this one reply only, with the conversation up to it as context.
 */
export async function reviewStage(
  ask: Ask,
  input: TurnInput,
  partial: TurnPartial,
): Promise<{ partial: TurnPartial; result?: TurnResult }> {
  const { messages, replyIndex, ledger, report } = input;
  const reply = messages[replyIndex].content;
  const stage = nextStage(partial);
  if (stage === 1) {
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
    return { partial: { reference, facts, dialect } };
  }
  const reference = partial.reference!;
  if (stage === 2) {
    const judge = (a: string, b: string) =>
      ask({
        name: "rita_reply_comparison",
        system: JUDGE_SYSTEM,
        user: judgePrompt({ messages, replyIndex, ledger, a, b }),
        schema: JUDGE_SCHEMA,
        parse: parseJudgement,
      });
    // Both orders, so the model's pull towards the first reply cancels out.
    const judges = await Promise.all([
      judge(reply, reference.reply),
      judge(reference.reply, reply),
    ]);
    return { partial: { ...partial, judges: [judges[0], judges[1]] } };
  }
  const facts = partial.facts!;
  const dialect = partial.dialect!;
  const [ritaFirst, ritaSecond] = partial.judges!;
  const merged = mergeJudgements([
    { ritaIs: "a", result: ritaFirst },
    { ritaIs: "b", result: ritaSecond },
  ]);
  const timing = timingFromLedger(ledger);
  // Every reply gets the diagnosis, also the ones every check passed.
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
  return { partial, result: { reference, facts, dialect, merged, timing, final } };
}

type TurnResult = {
  reference: NonNullable<TurnPartial["reference"]>;
  facts: NonNullable<TurnPartial["facts"]>;
  dialect: NonNullable<TurnPartial["dialect"]>;
  merged: ReturnType<typeof mergeJudgements>;
  timing: ReturnType<typeof timingFromLedger>;
  final: ReturnType<typeof finalizeReview>;
};

/** All three stages of one reply in one go (the golden check). */
export async function reviewTurn(ask: Ask, input: TurnInput): Promise<TurnResult> {
  let partial: TurnPartial = {};
  for (;;) {
    const step = await reviewStage(ask, input, partial);
    if (step.result) return step.result;
    partial = step.partial;
  }
}

/** Reviews the turns of one conversation that have no current review, then the conversation. */
export async function reviewConversation(
  db: ReviewDb,
  args: {
    conversationId: string;
    all?: boolean;
    reportsOnly?: boolean;
    deadlineAt: number;
    /**
     * The admin's "review now" steps: at most this many turns per call, and the closing work
     * (grouping, the whole-conversation review) in a call of its own, so no call runs long.
     */
    maxTurns?: number;
    /** Aborts the questions in flight when the run's time is up (the stage is kept for later). */
    signal?: AbortSignal;
  },
): Promise<ReviewSummary> {
  const stepped = args.maxTurns !== undefined;
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
    .select("id,turn_key,reply_message_id,partial,status,attempts,created_at,rubric_version")
    .eq("conversation_id", args.conversationId);
  const rows = (reviewData ?? []) as ReviewRow[];
  const blocked = new Set<string>();
  const retryable = new Map<string, ReviewRow>();
  const keyByReply = new Map<string, string>();
  for (const row of rows) {
    if (row.reply_message_id) keyByReply.set(row.reply_message_id, row.turn_key);
    const stale = Date.now() - new Date(row.created_at).getTime() > STALE_PENDING_MS;
    const current = (row.rubric_version ?? 1) === RUBRIC_VERSION;
    if (row.status === "no_text") blocked.add(row.turn_key);
    else if (row.status === "done" && current) blocked.add(row.turn_key);
    else if (row.status === "failed" && row.attempts >= MAX_ATTEMPTS && current)
      blocked.add(row.turn_key);
    else if (row.status === "pending" && !stale && current) blocked.add(row.turn_key);
    else retryable.set(row.turn_key, row);
  }

  // Every reply once: turn records, reports, and Rita's replies without a record.
  const plan = (all: boolean) =>
    planTurns({
      candidates: pickCandidates({
        ledgers,
        reports,
        existing: new Set(),
        all,
        reportsOnly: args.reportsOnly,
      }),
      messages: all && !args.reportsOnly ? messages : [],
      ledgers,
      keyByReply,
    });
  const due = plan(args.all ?? true).filter((turn) => !blocked.has(turn.turnKey));

  // Progress: every reviewable reply, and the ones already finished (done, no text, or given up).
  const allTurns = plan(true);
  const finishedKeys = new Set(
    rows
      .filter(
        (row) =>
          (row.rubric_version ?? 1) === RUBRIC_VERSION &&
          (row.status === "done" ||
            row.status === "no_text" ||
            (row.status === "failed" && row.attempts >= MAX_ATTEMPTS)),
      )
      .map((row) => row.turn_key),
  );
  summary.turns = allTurns.length;
  summary.finished = allTurns.filter((turn) => finishedKeys.has(turn.turnKey)).length;

  let ask: Ask | null = null;
  const prepare = async () => {
    if (!ask) ask = makeAsk(await openAiKey(), args.signal);
    return ask;
  };

  const queue = stepped ? due.slice(0, args.maxTurns) : [...due];
  const leftForLater = stepped ? Math.max(0, due.length - queue.length) : 0;
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
        .update({
          status: "pending",
          created_at: now,
          attempts,
          rubric_version: RUBRIC_VERSION,
          // A review written for an older rubric starts over.
          ...((retry.rubric_version ?? 1) === RUBRIC_VERSION ? {} : { partial: null }),
        })
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
    let partial =
      retry && (retry.rubric_version ?? 1) === RUBRIC_VERSION ? parsePartial(retry.partial) : {};
    try {
      const turnAsk = await prepare();
      // One stage after another, each saved; a new stage starts only while the run has time.
      for (;;) {
        if (stop || Date.now() >= args.deadlineAt) {
          await db
            .from("rita_turn_reviews")
            .update({ status: "staged", partial: storePartial(partial) })
            .eq("id", rowId);
          summary.staged += 1;
          return;
        }
        const step = await reviewStage(turnAsk, { messages, replyIndex, ledger, report }, partial);
        partial = step.partial;
        if (step.result) {
          const result = step.result;
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
              partial: null,
              error: null,
              reviewed_at: new Date().toISOString(),
            })
            .eq("id", rowId);
          summary.reviewed += 1;
          if (result.final.verdict === "problem") summary.problems += 1;
          return;
        }
        await db
          .from("rita_turn_reviews")
          .update({ partial: storePartial(partial) })
          .eq("id", rowId);
      }
    } catch (error) {
      if (error instanceof TimeUp) {
        // The run ran out of time mid-question: the finished stages stay, the next run carries on.
        await db
          .from("rita_turn_reviews")
          .update({ status: "staged", partial: storePartial(partial) })
          .eq("id", rowId);
        summary.staged += 1;
        stop = stop ?? "time";
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      const service = isServiceProblem(error);
      await db
        .from("rita_turn_reviews")
        .update({
          status: "failed",
          error: message.slice(0, 300),
          attempts: attempts + (service ? 0 : 1),
          partial: storePartial(partial),
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
  summary.waiting = queue.length + leftForLater + summary.staged;
  summary.finished += summary.reviewed + summary.noText;
  // Running out of time is not a stop: the replies left are simply waiting.
  if (stop === "time") stop = undefined;
  if (stop) summary.stopped = stop;
  // Step mode: a call that reviewed turns stops here; the closing work gets a call of its own.
  if (stepped && due.length > 0) {
    summary.finalPending = !stop;
    return summary;
  }

  if (!stop) {
    try {
      summary.grouped = await assignProblems(db, {
        conversationId: args.conversationId,
        messages,
        prepare,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof TimeUp) {
        // Out of time: the closing work is done by the next run.
        summary.finalPending = true;
        stop = "time";
      } else if (isServiceProblem(error)) {
        summary.stopped = message;
        stop = message;
      }
      if (!(error instanceof TimeUp)) console.error("Rita issue grouping failed", error);
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
      if (error instanceof TimeUp) summary.finalPending = true;
      else {
        if (isServiceProblem(error)) summary.stopped = message;
        console.error("Rita conversation review failed", error);
      }
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
