/**
 * Runs the golden set through the real review (the same six questions as a live reply) and records
 * how many the reviewer got right. See rita-golden.ts for the cases.
 */
import {
  createAsk,
  isServiceProblem,
  reviewEnabled,
  reviewTurn,
  usedModel,
  type ReviewDb,
} from "@/lib/rita-review.server";
import { RUBRIC_VERSION } from "@/lib/rita-tutor-contract";
import { GOLDEN_CASES, checkGolden, summarizeGolden, type GoldenResult } from "@/lib/rita-golden";

/** Cases reviewed at the same time; each one asks the model several questions. */
const PARALLEL = 8;

export type CheckSummary = {
  checkId: string | null;
  status: "done" | "partial" | "failed";
  total: number;
  passed: number;
  failed: number;
  notRun: number;
  error?: string;
};

export async function runReviewerCheck(
  db: ReviewDb,
  args: { trigger: "manual" | "auto"; deadlineAt: number },
): Promise<CheckSummary> {
  const { data: created } = await db
    .from("rita_reviewer_checks")
    .insert({
      rubric_version: RUBRIC_VERSION,
      trigger: args.trigger,
      status: "running",
      total: GOLDEN_CASES.length,
    })
    .select("id");
  const checkId: string | null = created?.[0]?.id ?? null;
  const results: GoldenResult[] = GOLDEN_CASES.map((golden) => ({
    id: golden.id,
    why: golden.why,
    pass: null,
    problems: [],
    got: null,
  }));
  let stop: string | undefined;
  const finish = async (status: CheckSummary["status"], error?: string) => {
    const summary = summarizeGolden(results);
    if (checkId) {
      await db
        .from("rita_reviewer_checks")
        .update({
          status,
          model: usedModel(),
          total: summary.total,
          passed: summary.passed,
          failed: summary.failed,
          results,
          error: error ?? null,
          finished_at: new Date().toISOString(),
        })
        .eq("id", checkId);
    }
    return { checkId, status, ...summary, error };
  };

  try {
    const ask = await createAsk();
    const queue = GOLDEN_CASES.map((golden, index) => ({ golden, index }));
    const worker = async () => {
      while (queue.length && !stop && Date.now() < args.deadlineAt) {
        const next = queue.shift();
        if (!next) break;
        const { golden, index } = next;
        try {
          const review = await reviewTurn(ask, {
            messages: golden.messages,
            replyIndex: golden.messages.length - 1,
            ledger: golden.ledger,
            report: undefined,
          });
          const got = { verdict: review.final.verdict, category: review.final.category };
          const problems = checkGolden(golden, {
            ...got,
            facts: review.facts,
            dialect: review.dialect,
          });
          results[index] = { ...results[index], pass: problems.length === 0, problems, got };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          results[index] = { ...results[index], pass: null, error: message.slice(0, 300) };
          if (isServiceProblem(error)) stop = message;
        }
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    const summary = summarizeGolden(results);
    if (summary.passed + summary.failed === 0)
      return await finish("failed", stop ?? "No case could be reviewed.");
    return await finish(summary.notRun > 0 ? "partial" : "done", stop);
  } catch (error) {
    return await finish(
      "failed",
      error instanceof Error ? error.message.slice(0, 300) : "The check failed.",
    );
  }
}

/** Once per version of the reviewer's rules: check the reviewer by itself after it changed. */
export async function autoReviewerCheck(db: ReviewDb, budgetMs = 200_000) {
  if (!(await reviewEnabled(db))) return { ran: false as const };
  const { data } = await db
    .from("rita_reviewer_checks")
    .select("id,status,started_at")
    .eq("rubric_version", RUBRIC_VERSION);
  const rows = (data ?? []) as { status: string; started_at: string }[];
  const recent = Date.now() - 60 * 60 * 1000;
  // A finished check, one still running, or a failed one tried in the last hour: do not start another.
  const handled = rows.some(
    (row) =>
      row.status === "done" ||
      row.status === "partial" ||
      row.status === "running" ||
      new Date(row.started_at).getTime() > recent,
  );
  if (handled) return { ran: false as const };
  const result = await runReviewerCheck(db, { trigger: "auto", deadlineAt: Date.now() + budgetMs });
  return { ran: true as const, ...result };
}
