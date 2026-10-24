import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { ProHeader } from "@/components/home/procreate/ProHeader";
import { ExampleCard } from "@/components/rita-quality/ExampleCard";
import { ReplaySection } from "@/components/rita-quality/ReplaySection";
import { useAuth } from "@/hooks/useAuth";
import { useRitaQuality } from "@/hooks/useRitaQuality";
import { guardRedirect } from "@/lib/guard-redirect";
import { supabase } from "@/integrations/supabase/client";
import { latestRuns, type ReplayRun } from "@/lib/rita-replay";
import { saveFile } from "@/lib/save-file";
import {
  FIX_WHERE_LABEL,
  STATUS_LABEL,
  buildIssueRows,
  fixFileName,
  healthByBuild,
  issueByBuild,
  issueFixFile,
  type FixFileExample,
} from "@/lib/rita-quality";

export const Route = createFileRoute("/admin/rita-quality/$issueId")({
  head: () => ({
    meta: [{ title: "Rita problem — Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: IssuePage,
});

type FullReview = {
  id: string;
  conversation_id: string;
  reply_message_id: string | null;
  build: string | null;
  verdict: string | null;
  severity: number | null;
  category: string | null;
  cause: string | null;
  explanation: string | null;
  evidence: string | null;
  fix: unknown;
  reference_reply: string | null;
  winner: string | null;
  scores: unknown;
  facts: unknown;
  dialect: unknown;
  timing: unknown;
  reviewed_at: string | null;
};
type MessageRow = {
  conversation_id: string;
  client_message_id: string;
  role: string;
  content: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

function IssuePage() {
  const { issueId } = Route.useParams();
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const data = useRitaQuality(Boolean(user) && isAdmin);
  const [examples, setExamples] = useState<FixFileExample[]>([]);
  const [examplesState, setExamplesState] = useState<"loading" | "ready" | "error">("loading");
  const [ratings, setRatings] = useState<Record<string, boolean>>({});
  const [shown, setShown] = useState(10);
  const [panel, setPanel] = useState<"" | "fixed" | "merge">("");
  const [prUrl, setPrUrl] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [fullRun, setFullRun] = useState<ReplayRun | null>(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState("");

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) guardRedirect(navigate);
  }, [isAdmin, loading, navigate, user]);

  const loadExamples = useCallback(async () => {
    const { data: reviews, error } = await db()
      .from("rita_turn_reviews")
      .select(
        "id,conversation_id,reply_message_id,build,verdict,severity,category,cause,explanation,evidence,fix,reference_reply,winner,scores,facts,dialect,timing,reviewed_at",
      )
      .eq("issue_id", issueId)
      .eq("status", "done")
      .order("reviewed_at", { ascending: false })
      .limit(50);
    if (error) {
      setExamplesState("error");
      return;
    }
    const full = (reviews ?? []) as FullReview[];
    const conversationIds = [...new Set(full.map((review) => review.conversation_id))];
    const { data: messageData } = conversationIds.length
      ? await db()
          .from("rita_free_conversation_messages")
          .select("conversation_id,client_message_id,role,content,created_at,id")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
      : { data: [] };
    const byConversation = new Map<string, MessageRow[]>();
    for (const row of (messageData ?? []) as MessageRow[]) {
      byConversation.set(row.conversation_id, [
        ...(byConversation.get(row.conversation_id) ?? []),
        row,
      ]);
    }
    setExamples(
      full.map((review) => {
        const list = byConversation.get(review.conversation_id) ?? [];
        const index = list.findIndex((row) => row.client_message_id === review.reply_message_id);
        return {
          reviewId: review.id,
          conversationId: review.conversation_id,
          build: review.build,
          verdict: review.verdict,
          severity: review.severity,
          category: review.category,
          cause: review.cause,
          explanation: review.explanation,
          evidence: review.evidence,
          fix: review.fix,
          ritaReply: index >= 0 ? list[index].content : null,
          referenceReply: review.reference_reply,
          contextBefore:
            index > 0
              ? list
                  .slice(Math.max(0, index - 3), index)
                  .map((row) => ({ role: row.role, text: row.content }))
              : [],
          winner: review.winner,
          scores: review.scores,
          facts: review.facts,
          dialect: review.dialect,
          timing: review.timing,
          reviewedAt: review.reviewed_at,
          ownerAgrees: null,
          ownerNote: null,
        };
      }),
    );
    setExamplesState("ready");
  }, [issueId]);

  useEffect(() => {
    if (user && isAdmin) void loadExamples();
  }, [isAdmin, loadExamples, user]);

  useEffect(() => {
    setRatings(Object.fromEntries(data.feedback.map((item) => [item.review_id, item.agree])));
  }, [data.feedback]);

  const replays = useMemo(() => latestRuns(data.runs), [data.runs]);
  const latestRunId = replays.get(issueId)?.id;

  useEffect(() => {
    if (!latestRunId) {
      setFullRun(null);
      return;
    }
    let cancelled = false;
    void db()
      .from("rita_replay_runs")
      .select("*")
      .eq("id", latestRunId)
      .maybeSingle()
      .then(({ data: run }: { data: ReplayRun | null }) => {
        if (!cancelled) setFullRun(run);
      });
    return () => {
      cancelled = true;
    };
  }, [latestRunId]);

  async function testNow() {
    setTesting(true);
    setTestError("");
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Please sign in again.");
      const response = await fetch("/api/rita-v3/replay", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ issueId }),
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) {
        setTestError(result.error ?? "The test could not run. Try again in a minute.");
      }
      await data.reload();
    } catch (error) {
      setTestError(error instanceof Error ? error.message : "The test could not run.");
    } finally {
      setTesting(false);
    }
  }

  const rows = useMemo(
    () => buildIssueRows(data.issues, data.reviews, Date.now(), replays),
    [data.issues, data.reviews, replays],
  );
  const row = rows.find((item) => item.issue.id === issueId);
  const builds = useMemo(() => healthByBuild(data.reviews), [data.reviews]);
  const byBuild = useMemo(
    () => (row ? issueByBuild(row.reviews, data.reviews) : []),
    [row, data.reviews],
  );
  const others = rows.filter(
    (item) => item.issue.id !== issueId && ["open", "fixing"].includes(item.issue.status),
  );
  const suggested = row?.issue.suggested_merge_into
    ? rows.find((item) => item.issue.id === row.issue.suggested_merge_into)
    : undefined;

  async function run(label: string, work: () => Promise<{ error?: { message?: string } | null }>) {
    setBusy(label);
    setMessage("");
    const { error } = await work();
    if (error) setMessage(`Could not save: ${error.message ?? "unknown error"}`);
    else {
      setPanel("");
      await data.reload();
    }
    setBusy("");
  }

  const update = (patch: Record<string, unknown>) =>
    db()
      .from("rita_issues")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", issueId);

  async function rate(reviewId: string, agree: boolean) {
    if (!user) return;
    const previous = ratings[reviewId];
    setRatings((current) => ({ ...current, [reviewId]: agree }));
    const { error } = await db()
      .from("rita_review_feedback")
      .upsert({ review_id: reviewId, user_id: user.id, agree }, { onConflict: "review_id" });
    if (error) {
      setRatings((current) => {
        const next = { ...current };
        if (previous === undefined) delete next[reviewId];
        else next[reviewId] = previous;
        return next;
      });
      setMessage(`Could not save your answer: ${error.message}`);
    } else {
      void data.reload();
    }
  }

  async function download() {
    if (!row) return;
    setBusy("download");
    try {
      const file = issueFixFile({
        issue: row.issue,
        derived: row.derived,
        byBuild,
        replay: fullRun,
        examples: examples.map((example) => ({
          ...example,
          ownerAgrees: ratings[example.reviewId] ?? null,
        })),
      });
      await saveFile(
        fixFileName(row.issue.title, row.issue.id),
        `${JSON.stringify(file, null, 2)}\n`,
        "application/json;charset=utf-8",
      );
    } finally {
      setBusy("");
    }
  }

  const issue = row?.issue;
  const derived = row?.derived;

  return (
    <main className="edith-premium min-h-screen bg-white text-[var(--pp-ink)]">
      <div className="rita-cream edith-light edith-premium">
        <ProHeader variant="solid" tone="light" />
      </div>
      <section className="mx-auto w-full max-w-4xl px-5 pb-24 pt-8 sm:px-8 sm:pt-12">
        <Link
          to="/admin/rita-quality"
          className="inline-flex min-h-[44px] items-center gap-2 text-[15px] font-semibold text-[var(--pp-muted)] hover:text-[var(--pp-ink)]"
        >
          <ArrowLeft size={17} /> Rita quality
        </Link>

        {data.state === "loading" ? (
          <div className="grid min-h-56 place-items-center" role="status" aria-label="Loading">
            <Loader2 className="animate-spin text-[var(--pp-muted)]" />
          </div>
        ) : null}

        {data.state === "missing" || data.state === "error" ? (
          <p role="alert" className="mt-6 rounded-2xl bg-[var(--pp-grey)] p-5 text-[16px]">
            This page needs the database migrations from the Rita quality page. Open that page for
            the list.
          </p>
        ) : null}

        {data.state === "ready" && !row ? (
          <p className="mt-6 rounded-2xl bg-[var(--pp-grey)] p-5 text-[16px]">
            This problem does not exist (it may have been merged).
          </p>
        ) : null}

        {issue && derived ? (
          <>
            <h1 dir="auto" className="mt-2 text-[32px] leading-[1.2] sm:text-[42px]">
              {issue.title}
            </h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-[var(--pp-muted)]">
              <span className="font-semibold text-[var(--pp-ink)]">
                {STATUS_LABEL[derived.status]}
                {derived.status === "watching"
                  ? ` (${derived.checked} of ${derived.needed} replies checked)`
                  : ""}
              </span>
              <span>
                {row?.reviews.length ?? 0} {row?.reviews.length === 1 ? "example" : "examples"}
              </span>
              <span>Fix in: {FIX_WHERE_LABEL[issue.fix_where] ?? issue.fix_where}</span>
            </p>
            {issue.description ? (
              <p dir="auto" className="mt-4 max-w-2xl text-[17px] leading-[1.6]">
                {issue.description}
              </p>
            ) : null}
            {derived.status === "regressed" ? (
              <p
                role="status"
                className="mt-4 rounded-xl bg-[var(--pp-accent-soft)] px-4 py-3 text-[15px]"
              >
                This came back: {derived.newProblems} new{" "}
                {derived.newProblems === 1 ? "example" : "examples"} since the fix.
              </p>
            ) : null}
            {derived.status === "failing" ? (
              <p
                role="status"
                className="mt-4 rounded-xl bg-[var(--pp-accent-soft)] px-4 py-3 text-[15px]"
              >
                The last test on a newer version still fails on some turns. See the test results
                below.
              </p>
            ) : null}
            {derived.status === "resolved" ? (
              <p
                role="status"
                className="mt-4 rounded-xl bg-[var(--pp-grey)] px-4 py-3 text-[15px]"
              >
                {derived.checked} replies were reviewed after the fix and none had this problem.
              </p>
            ) : null}
            {suggested ? (
              <div className="mt-4 rounded-xl bg-[var(--pp-grey)] px-4 py-3 text-[15px]">
                <p dir="auto">Maybe the same problem as: {suggested.issue.title}</p>
                <button
                  type="button"
                  className="rita-btn rita-btn-secondary rita-btn-sm mt-2"
                  onClick={() => {
                    setMergeTarget(suggested.issue.id);
                    setPanel("merge");
                  }}
                >
                  Review the merge
                </button>
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void download()}
                disabled={examplesState !== "ready" || busy === "download"}
                className="rita-btn rita-btn-primary gap-2 disabled:opacity-60"
              >
                {busy === "download" ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Download size={18} />
                )}
                Download fix file
              </button>
              {issue.status === "open" ? (
                <button
                  type="button"
                  onClick={() => setPanel(panel === "fixed" ? "" : "fixed")}
                  className="rita-btn rita-btn-secondary"
                >
                  I fixed this
                </button>
              ) : null}
              {issue.status === "fixing" ? (
                <button
                  type="button"
                  disabled={busy === "reopen"}
                  onClick={() =>
                    void run("reopen", () =>
                      update({ status: "open", fix_marked_at: null, fix_baseline_build: null }),
                    )
                  }
                  className="rita-btn rita-btn-secondary"
                >
                  Reopen
                </button>
              ) : null}
              {issue.status === "not_an_issue" ? (
                <button
                  type="button"
                  disabled={busy === "reopen"}
                  onClick={() => void run("reopen", () => update({ status: "open" }))}
                  className="rita-btn rita-btn-secondary"
                >
                  Reopen
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy === "dismiss"}
                  onClick={() => void run("dismiss", () => update({ status: "not_an_issue" }))}
                  className="rita-btn rita-btn-secondary"
                >
                  Not a problem
                </button>
              )}
              {others.length ? (
                <button
                  type="button"
                  onClick={() => setPanel(panel === "merge" ? "" : "merge")}
                  className="rita-btn rita-btn-secondary"
                >
                  Merge into another
                </button>
              ) : null}
            </div>

            {panel === "fixed" ? (
              <div className="mt-4 max-w-xl rounded-2xl bg-[var(--pp-grey)] p-4">
                <label
                  htmlFor="pr-url"
                  className="block text-[14px] font-semibold text-[var(--pp-muted)]"
                >
                  Link to the fix (optional)
                </label>
                <input
                  id="pr-url"
                  value={prUrl}
                  onChange={(event) => setPrUrl(event.target.value)}
                  inputMode="url"
                  className="mt-1 w-full rounded-lg border border-[var(--pp-line)] bg-white px-3 py-2 text-[16px]"
                />
                <p className="mt-2 text-[14px] text-[var(--pp-muted)]">
                  From now on, replies reviewed on a newer build count as checks of this fix.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={busy === "fixed"}
                    onClick={() =>
                      void run("fixed", () =>
                        update({
                          status: "fixing",
                          fix_marked_at: new Date().toISOString(),
                          fix_baseline_build:
                            builds.at(-1)?.build === "unknown"
                              ? null
                              : (builds.at(-1)?.build ?? null),
                          pr_url: prUrl.trim() || null,
                        }),
                      )
                    }
                    className="rita-btn rita-btn-primary rita-btn-sm gap-2"
                  >
                    {busy === "fixed" ? <Loader2 size={16} className="animate-spin" /> : null}
                    Mark as fixed
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanel("")}
                    className="rita-btn rita-btn-secondary rita-btn-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {panel === "merge" ? (
              <div className="mt-4 max-w-xl rounded-2xl bg-[var(--pp-grey)] p-4">
                <label
                  htmlFor="merge-target"
                  className="block text-[14px] font-semibold text-[var(--pp-muted)]"
                >
                  Merge this problem into
                </label>
                <select
                  id="merge-target"
                  value={mergeTarget}
                  onChange={(event) => setMergeTarget(event.target.value)}
                  dir="auto"
                  className="rita-select mt-1 w-full"
                >
                  <option value="">Choose a problem</option>
                  {others.map((item) => (
                    <option key={item.issue.id} value={item.issue.id}>
                      {item.issue.title}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-[14px] text-[var(--pp-muted)]">
                  All {row?.reviews.length ?? 0} examples move to that problem. This cannot be
                  undone.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={!mergeTarget || busy === "merge"}
                    onClick={() =>
                      void run("merge", async () => {
                        const moved = await db()
                          .from("rita_turn_reviews")
                          .update({ issue_id: mergeTarget })
                          .eq("issue_id", issueId);
                        if (moved.error) return moved;
                        await db()
                          .from("rita_issues")
                          .update({ suggested_merge_into: null })
                          .eq("suggested_merge_into", issueId);
                        const done = await update({
                          status: "merged",
                          merged_into: mergeTarget,
                          suggested_merge_into: null,
                        });
                        if (!done.error)
                          void navigate({
                            to: "/admin/rita-quality/$issueId",
                            params: { issueId: mergeTarget },
                          });
                        return done;
                      })
                    }
                    className="rita-btn rita-btn-primary rita-btn-sm gap-2 disabled:opacity-60"
                  >
                    {busy === "merge" ? <Loader2 size={16} className="animate-spin" /> : null}
                    Merge
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanel("")}
                    className="rita-btn rita-btn-secondary rita-btn-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {message ? (
              <p
                role="alert"
                className="mt-4 text-[15px] font-semibold text-[var(--pp-accent-text)]"
              >
                {message}
              </p>
            ) : null}

            {byBuild.length > 1 ? (
              <section aria-labelledby="by-build" className="mt-10">
                <h2 id="by-build" className="text-[22px] font-semibold">
                  Problems per build
                </h2>
                <ul className="mt-3 grid gap-2">
                  {[...byBuild].reverse().map((entry) => (
                    <li
                      key={entry.build}
                      className="flex items-baseline justify-between gap-3 border-t border-[var(--pp-line)] py-2 text-[15px]"
                    >
                      <span className="font-mono text-[14px]">{entry.build.slice(0, 7)}</span>
                      <span>
                        {entry.problems} of {entry.reviewed} replies
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <ReplaySection
              run={fullRun}
              busy={testing}
              error={testError}
              canTest={examples.length > 0}
              onTest={() => void testNow()}
            />

            <section aria-labelledby="examples-title" className="mt-10">
              <h2 id="examples-title" className="text-[22px] font-semibold">
                Examples
              </h2>
              {examplesState === "loading" ? (
                <div
                  className="grid min-h-24 place-items-center"
                  role="status"
                  aria-label="Loading examples"
                >
                  <Loader2 className="animate-spin text-[var(--pp-muted)]" />
                </div>
              ) : null}
              {examplesState === "error" ? (
                <p role="alert" className="mt-3 text-[15px]">
                  Could not load the examples.
                </p>
              ) : null}
              {examplesState === "ready" && examples.length === 0 ? (
                <p className="mt-3 rounded-2xl bg-[var(--pp-grey)] p-5 text-[16px]">
                  No examples are attached to this problem.
                </p>
              ) : null}
              <ul className="mt-4 grid gap-4">
                {examples.slice(0, shown).map((example) => (
                  <ExampleCard
                    key={example.reviewId}
                    example={example}
                    agree={ratings[example.reviewId] ?? null}
                    onRate={(agree) => void rate(example.reviewId, agree)}
                  />
                ))}
              </ul>
              {examples.length > shown ? (
                <button
                  type="button"
                  onClick={() => setShown((n) => n + 10)}
                  className="rita-btn rita-btn-secondary rita-btn-sm mt-4"
                >
                  Show 10 more
                </button>
              ) : null}
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}
