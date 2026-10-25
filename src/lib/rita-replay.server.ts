/**
 * Replay tests, the network side: asks the current worker to answer the turns behind an issue
 * again, then has the review models judge the new replies against the reference replies. The rules
 * (which turns, when a reply counts as fixed) are in rita-replay.ts.
 */
import { getServerRuntimeSecret } from "@/lib/config.server";
import {
  createAsk,
  isServiceProblem,
  reviewEnabled,
  ReviewError,
  type Ask,
  type ReviewDb,
} from "@/lib/rita-review.server";
import {
  DIALECT_SCHEMA,
  DIALECT_SYSTEM,
  FACTS_SCHEMA,
  FACTS_SYSTEM,
  JUDGE_SCHEMA,
  JUDGE_SYSTEM,
  dialectPrompt,
  factsPrompt,
  judgePrompt,
  mergeJudgements,
  parseDialect,
  parseFacts,
  parseJudgement,
  type Ledger,
} from "@/lib/rita-review";
import {
  MAX_REPLAY_CASES,
  RECHECK_SCHEMA,
  RECHECK_SYSTEM,
  REPLAY_SAMPLES,
  caseOutcome,
  conversationWithReply,
  parseRecheck,
  recheckPrompt,
  replayCase,
  sampleResult,
  summarizeRun,
  type ReplayCaseResult,
  type ReplayMessage,
  type ReplayRequestCase,
} from "@/lib/rita-replay";

const DEFAULT_REPLAY_URL = "https://abdalrhmanshahin391--ritajet-voice-replay-turns.modal.run";
const WORKER_TIMEOUT_MS = 200_000;
/** Judging a reply takes several model calls; this many run at once so a run does not hit rate limits. */
const JUDGE_PARALLEL = 8;

async function replayUrl() {
  const explicit = await getServerRuntimeSecret("MODAL_REPLAY_URL");
  if (explicit) return explicit;
  const start = await getServerRuntimeSecret("MODAL_START_URL");
  return start && start.includes("start-session")
    ? start.replace("start-session", "replay-turns")
    : DEFAULT_REPLAY_URL;
}

type WorkerSample = { reply?: string; error?: string; watch?: string[] };
type WorkerAnswer = {
  build?: string;
  error?: string;
  cases: {
    id: string;
    samples: WorkerSample[];
    promptHash?: string;
    promptChanged?: boolean | null;
  }[];
};

/** Ask the worker. Zero cases only asks which build is deployed. */
export async function askWorker(
  cases: ReplayRequestCase[],
  samples = REPLAY_SAMPLES,
): Promise<WorkerAnswer> {
  const token = await getServerRuntimeSecret("MODAL_START_TOKEN");
  if (!token) throw new ReviewError(503, "MODAL_START_TOKEN is missing from the server secrets.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WORKER_TIMEOUT_MS);
  try {
    const response = await fetch(await replayUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, cases, samples }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new ReviewError(
        response.status === 401 ? 401 : 502,
        `The voice worker answered ${response.status}.`,
      );
    }
    const answer = (await response.json()) as WorkerAnswer;
    if (answer.error)
      throw new ReviewError(503, `The voice worker could not replay: ${answer.error}.`);
    return { ...answer, cases: Array.isArray(answer.cases) ? answer.cases : [] };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ReviewError(504, "The voice worker took too long to replay.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function pool<T>(tasks: (() => Promise<T>)[], size: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, tasks.length) }, async () => {
      while (next < tasks.length) {
        const index = next;
        next += 1;
        results[index] = await tasks[index]();
      }
    }),
  );
  return results;
}

type ReviewRow = {
  id: string;
  conversation_id: string;
  reply_message_id: string | null;
  turn_ref: string | null;
  reference_reply: string | null;
};
type IssueRow = { id: string; title: string; description: string };

/** The six judgements of one fresh reply, as a pass or a fail with reasons. */
async function judgeSample(
  ask: Ask,
  issue: IssueRow,
  request: ReplayRequestCase,
  ledger: Ledger | undefined,
  reference: string,
  sample: WorkerSample,
) {
  const reply = sample.reply as string;
  const messages = conversationWithReply(request, reply);
  const replyIndex = messages.length - 1;
  const [facts, dialect, recheck, ritaFirst, ritaSecond] = await Promise.all([
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
    ask({
      name: "rita_issue_recheck",
      system: RECHECK_SYSTEM,
      user: recheckPrompt({
        title: issue.title,
        description: issue.description,
        messages: messages.slice(0, replyIndex),
        reply,
      }),
      schema: RECHECK_SCHEMA,
      parse: parseRecheck,
    }),
    ask({
      name: "rita_reply_comparison",
      system: JUDGE_SYSTEM,
      user: judgePrompt({ messages, replyIndex, ledger, a: reply, b: reference }),
      schema: JUDGE_SCHEMA,
      parse: parseJudgement,
    }),
    ask({
      name: "rita_reply_comparison",
      system: JUDGE_SYSTEM,
      user: judgePrompt({ messages, replyIndex, ledger, a: reference, b: reply }),
      schema: JUDGE_SCHEMA,
      parse: parseJudgement,
    }),
  ]);
  const merged = mergeJudgements([
    { ritaIs: "a", result: ritaFirst },
    { ritaIs: "b", result: ritaSecond },
  ]);
  return sampleResult({
    facts,
    dialect,
    stillHasProblem: recheck.stillHasProblem,
    stillWhy: recheck.why,
    winner: merged?.winner ?? "tie",
    watch: sample.watch ?? [],
  });
}

export type ReplaySummary = {
  runId: string | null;
  status: "done" | "partial" | "failed" | "none";
  total: number;
  passed: number;
  flaky: number;
  failed: number;
  workerBuild?: string;
  error?: string;
};

/** Replays the turns behind one issue on the current worker and records the run. */
export async function testIssue(
  db: ReviewDb,
  args: { issueId: string; trigger: "manual" | "auto"; deadlineAt: number },
): Promise<ReplaySummary> {
  const none = (error: string): ReplaySummary => ({
    runId: null,
    status: "none",
    total: 0,
    passed: 0,
    flaky: 0,
    failed: 0,
    error,
  });
  const { data: issue } = await db
    .from("rita_issues")
    .select("id,title,description")
    .eq("id", args.issueId)
    .maybeSingle();
  if (!issue) return none("This problem does not exist.");

  const { data: reviewData } = await db
    .from("rita_turn_reviews")
    .select("id,conversation_id,reply_message_id,turn_ref,reference_reply")
    .eq("issue_id", args.issueId)
    .eq("status", "done")
    .order("reviewed_at", { ascending: false })
    .limit(MAX_REPLAY_CASES * 3);
  const reviews = ((reviewData ?? []) as ReviewRow[]).filter((review) => review.reference_reply);
  const conversationIds = [...new Set(reviews.map((review) => review.conversation_id))];
  const [{ data: conversationData }, { data: messageData }] = await Promise.all([
    conversationIds.length
      ? db
          .from("rita_free_conversations")
          .select("id,language_preference,dialect_preference,learning_language")
          .in("id", conversationIds)
      : { data: [] },
    conversationIds.length
      ? db
          .from("rita_free_conversation_messages")
          .select("conversation_id,client_message_id,role,content,created_at,id")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
      : { data: [] },
  ]);
  const refs = reviews
    .map((review) => review.turn_ref)
    .filter((ref): ref is string => Boolean(ref));
  const { data: eventData } = refs.length
    ? await db
        .from("rita_v3_events")
        .select("metadata")
        .eq("event_name", "turn_ledger")
        .in("metadata->>turn_ref", refs)
    : { data: [] };
  const ledgerByRef = new Map<string, Ledger>();
  for (const event of (eventData ?? []) as { metadata: Ledger | null }[]) {
    if (event.metadata && typeof event.metadata.turn_ref === "string")
      ledgerByRef.set(event.metadata.turn_ref, event.metadata);
  }
  const conversations = new Map(
    ((conversationData ?? []) as { id: string }[]).map((row) => [
      row.id,
      row as Record<string, string | null>,
    ]),
  );
  const messagesBy = new Map<string, ReplayMessage[]>();
  for (const row of (messageData ?? []) as {
    conversation_id: string;
    client_message_id: string;
    role: string;
    content: string;
  }[]) {
    messagesBy.set(row.conversation_id, [
      ...(messagesBy.get(row.conversation_id) ?? []),
      { id: row.client_message_id, role: row.role, content: row.content },
    ]);
  }

  const prepared = reviews.flatMap((review) => {
    const ledger = review.turn_ref ? ledgerByRef.get(review.turn_ref) : undefined;
    const request = replayCase({
      reviewId: review.id,
      replyMessageId: review.reply_message_id,
      messages: messagesBy.get(review.conversation_id) ?? [],
      conversation: conversations.get(review.conversation_id) ?? {},
      ledger,
    });
    return request ? [{ review, request, ledger }] : [];
  });
  const cases = prepared.slice(0, MAX_REPLAY_CASES);
  if (!cases.length)
    return none(
      "None of this problem's examples can be replayed (no learner message before the reply).",
    );

  const { data: created } = await db
    .from("rita_replay_runs")
    .insert({
      issue_id: args.issueId,
      trigger: args.trigger,
      status: "running",
      total: cases.length,
    })
    .select("id");
  const runId: string | null = created?.[0]?.id ?? null;
  const finish = async (fields: Record<string, unknown>) => {
    if (runId)
      await db
        .from("rita_replay_runs")
        .update({ ...fields, finished_at: new Date().toISOString() })
        .eq("id", runId);
  };

  try {
    const ask = await createAsk();
    const answer = await askWorker(cases.map((item) => item.request));
    const byId = new Map(answer.cases.map((item) => [item.id, item]));
    let timedOut = false;
    const caseResults: ReplayCaseResult[] = [];
    const tasks = cases.flatMap(({ review, request, ledger }) => {
      const replayed = byId.get(request.id);
      const samples = replayed?.samples ?? [];
      const result: ReplayCaseResult = {
        reviewId: review.id,
        outcome: "error",
        promptChanged: replayed?.promptChanged ?? null,
        oldReply:
          messagesBy.get(review.conversation_id)?.find((m) => m.id === review.reply_message_id)
            ?.content ?? null,
        referenceReply: review.reference_reply,
        samples: samples.map((sample) => ({
          reply: sample.reply ?? null,
          ok: null,
          reasons: sample.error ? [`The worker could not answer: ${sample.error}`] : [],
        })),
      };
      caseResults.push(result);
      return samples.map((sample, index) => async () => {
        if (!sample.reply) return;
        if (Date.now() > args.deadlineAt) {
          timedOut = true;
          return;
        }
        const outcome = await judgeSample(
          ask,
          issue as IssueRow,
          request,
          ledger,
          review.reference_reply as string,
          sample,
        );
        result.samples[index].ok = outcome.ok;
        result.samples[index].reasons = outcome.reasons;
      });
    });
    await pool(tasks.flat(), JUDGE_PARALLEL);
    for (const item of caseResults) item.outcome = caseOutcome(item.samples);
    const summary = summarizeRun(caseResults);
    const allErrors = caseResults.every((item) => item.outcome === "error");
    const status = allErrors ? "failed" : timedOut ? "partial" : "done";
    await finish({
      status,
      worker_build: answer.build ?? null,
      prompt_changed: caseResults.some((item) => item.promptChanged === true)
        ? true
        : caseResults.every((item) => item.promptChanged === false)
          ? false
          : null,
      cases: caseResults,
      total: summary.total,
      passed: summary.passed,
      flaky: summary.flaky,
      failed: summary.failed,
      error: allErrors ? "No reply could be produced or judged." : null,
    });
    return { runId, status, ...summary, workerBuild: answer.build };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finish({ status: "failed", error: message.slice(0, 300) });
    if (isServiceProblem(error) || error instanceof ReviewError) {
      return { ...none(message), runId, status: "failed" };
    }
    throw error;
  }
}

const RETRY_FAILED_AFTER_MS = 60 * 60 * 1000;

/** After a deploy: replay every issue that is being fixed, once per worker build. */
export async function autoReplay(db: ReviewDb, budgetMs = 240_000) {
  if (!(await reviewEnabled(db))) return { enabled: false as const };
  const deadlineAt = Date.now() + budgetMs;
  const { data: settings } = await db
    .from("rita_review_settings")
    .select("last_replay_build")
    .eq("id", true)
    .maybeSingle();
  const worker = await askWorker([], 0);
  const build = worker.build ?? "";
  if (!build || build === "unknown") return { enabled: true as const, build, tested: 0 };
  if (settings?.last_replay_build === build) return { enabled: true as const, build, tested: 0 };

  const { data: issueData } = await db
    .from("rita_issues")
    .select("id,fix_baseline_build")
    .eq("status", "fixing")
    .not("fix_marked_at", "is", null);
  // A fix that is not deployed yet (same build as when it was marked) cannot be tested.
  const candidates = (
    (issueData ?? []) as { id: string; fix_baseline_build: string | null }[]
  ).filter((issue) => !issue.fix_baseline_build || issue.fix_baseline_build !== build);
  const { data: runData } = await db
    .from("rita_replay_runs")
    .select("issue_id,status,started_at")
    .eq("worker_build", build);
  const handled = new Set<string>();
  for (const run of (runData ?? []) as { issue_id: string; status: string; started_at: string }[]) {
    const recentFailure =
      run.status === "failed" &&
      Date.now() - new Date(run.started_at).getTime() < RETRY_FAILED_AFTER_MS;
    if (run.status === "done" || run.status === "partial" || recentFailure)
      handled.add(run.issue_id);
  }
  const pending = candidates.filter((issue) => !handled.has(issue.id));
  let tested = 0;
  for (const issue of pending) {
    if (Date.now() >= deadlineAt) break;
    const result = await testIssue(db, { issueId: issue.id, trigger: "auto", deadlineAt });
    if (
      result.status === "failed" &&
      result.error &&
      /401|MODAL_START_TOKEN|No OpenAI key/.test(result.error)
    )
      break;
    tested += 1;
  }
  if (tested >= pending.length) {
    await db.from("rita_review_settings").update({ last_replay_build: build }).eq("id", true);
  }
  return { enabled: true as const, build, tested, waiting: Math.max(0, pending.length - tested) };
}
