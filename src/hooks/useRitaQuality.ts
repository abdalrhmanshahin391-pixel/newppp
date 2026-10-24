import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Issue, QualityReview } from "@/lib/rita-quality";
import type { ReplayRun } from "@/lib/rita-replay";

export type QualityState = "loading" | "ready" | "missing" | "error";

export type QualityData = {
  state: QualityState;
  error: string;
  issues: Issue[];
  reviews: QualityReview[];
  feedback: { review_id: string; agree: boolean }[];
  /** Replay test runs, without their per-turn details (those load on the issue page). */
  runs: ReplayRun[];
  reload: () => Promise<void>;
};

/** The tables arrive with migrations; until then the page says which one is missing. */
function isMissingTable(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist|schema cache|Could not find the table/i.test(error.message ?? "")
  );
}

const REVIEW_LIMIT = 2000;

type RawReview = Omit<QualityReview, "scores"> & {
  ritaAverage: number | null;
  referenceAverage: number | null;
  criteria: Record<string, { rita: number; reference: number }> | null;
};

/** Everything /admin/rita-quality shows, read with the admin's own session (row-level security). */
export function useRitaQuality(enabled: boolean): QualityData {
  const [state, setState] = useState<QualityState>("loading");
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [reviews, setReviews] = useState<QualityReview[]>([]);
  const [feedback, setFeedback] = useState<{ review_id: string; agree: boolean }[]>([]);
  const [runs, setRuns] = useState<ReplayRun[]>([]);

  const reload = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const [issueResult, reviewResult, feedbackResult, runResult] = await Promise.all([
      db.from("rita_issues").select("*").order("updated_at", { ascending: false }).limit(500),
      db
        .from("rita_turn_reviews")
        .select(
          "id,build,status,verdict,severity,category,cause,winner,issue_id,reviewed_at,timing,ritaAverage:scores->ritaAverage,referenceAverage:scores->referenceAverage,criteria:scores->criteria",
        )
        .eq("status", "done")
        .order("reviewed_at", { ascending: false })
        .limit(REVIEW_LIMIT),
      db.from("rita_review_feedback").select("review_id,agree"),
      // Arrives with a later migration: the page works without it.
      db
        .from("rita_replay_runs")
        .select(
          "id,issue_id,trigger,worker_build,prompt_changed,status,total,passed,flaky,failed,error,started_at,finished_at",
        )
        .order("started_at", { ascending: false })
        .limit(300),
    ]);
    const failed = [issueResult, reviewResult, feedbackResult].find((result) => result.error);
    if (failed) {
      setState(isMissingTable(failed.error) ? "missing" : "error");
      setError(String(failed.error?.message ?? "Could not load."));
      return;
    }
    setIssues((issueResult.data ?? []) as Issue[]);
    setReviews(
      ((reviewResult.data ?? []) as RawReview[]).map(
        ({ ritaAverage, referenceAverage, criteria, ...row }) => ({
          ...row,
          scores:
            ritaAverage === null && referenceAverage === null
              ? null
              : {
                  ritaAverage: ritaAverage ?? undefined,
                  referenceAverage: referenceAverage ?? undefined,
                  criteria: criteria ?? undefined,
                },
        }),
      ),
    );
    setFeedback((feedbackResult.data ?? []) as { review_id: string; agree: boolean }[]);
    setRuns(
      runResult.error
        ? []
        : ((runResult.data ?? []) as Omit<ReplayRun, "cases">[]).map((run) => ({
            ...run,
            cases: [],
          })),
    );
    setError("");
    setState("ready");
  }, []);

  useEffect(() => {
    if (enabled) void reload();
  }, [enabled, reload]);

  return { state, error, issues, reviews, feedback, runs, reload };
}
