/**
 * What the quality page tells the admin to do next, and where an issue stands on the way from
 * "found" to "solved". Pure rules over the numbers the page already has.
 */
import type { IssueRow, IssueStatus } from "./rita-quality.ts";

export type NextStep =
  | { kind: "collect"; title: string; body: string }
  | { kind: "off"; title: string; body: string }
  | { kind: "issue"; title: string; body: string; issueId: string; action: string }
  | { kind: "trust"; title: string; body: string; action: string }
  | { kind: "idle"; title: string; body: string };

const biggest = (rows: IssueRow[]) => [...rows].sort((a, b) => b.impact - a.impact)[0];

/** One sentence and at most one action, chosen by what needs attention first. */
export function nextStep(args: {
  enabled: boolean;
  /** Reviewed replies in total (any build). */
  reviewed: number;
  rows: IssueRow[];
  /** The reviewer has been checked for the current version of its rules. */
  checkedCurrent: boolean;
}): NextStep {
  const { enabled, reviewed, rows } = args;
  if (!enabled && reviewed === 0) {
    return {
      kind: "off",
      title: "AI analysis is off",
      body: "Turn it on (top of the page) and every finished conversation is reviewed a few minutes after the call.",
    };
  }
  if (reviewed === 0) {
    return {
      kind: "collect",
      title: "Nothing to review yet",
      body: "Talk to Rita and end the conversation. Her replies are reviewed a few minutes later and the first problems appear here.",
    };
  }
  const worse = rows.filter(
    (row) => row.derived.status === "regressed" || row.derived.status === "failing",
  );
  if (worse.length) {
    const top = biggest(worse);
    return {
      kind: "issue",
      title:
        top.derived.status === "regressed"
          ? "A problem you fixed came back"
          : "A fix does not hold yet",
      body: top.issue.title,
      issueId: top.issue.id,
      action: "Open it",
    };
  }
  const open = rows.filter((row) => row.derived.status === "open");
  if (open.length) {
    const top = biggest(open);
    return {
      kind: "issue",
      title: open.length === 1 ? "1 problem needs work" : `${open.length} problems need work`,
      body: top.issue.title,
      issueId: top.issue.id,
      action: "Open the biggest",
    };
  }
  if (!args.checkedCurrent) {
    return {
      kind: "trust",
      title: "Check the AI reviewer",
      body: "Its rules changed since the last check (or it was never checked). A short test tells you whether to trust the numbers.",
      action: "Go to the check",
    };
  }
  const waiting = rows.filter((row) => ["fixing", "watching"].includes(row.derived.status));
  if (waiting.length) {
    const top = biggest(waiting);
    return {
      kind: "issue",
      title:
        waiting.length === 1
          ? "A fix is being checked"
          : `${waiting.length} fixes are being checked`,
      body: top.issue.title,
      issueId: top.issue.id,
      action: "See how it is going",
    };
  }
  return {
    kind: "idle",
    title: "Nothing to fix right now",
    body: "Keep talking to Rita. New problems appear here after each conversation.",
  };
}

export const STAGES = ["Found", "Fixing", "Watching", "Solved"] as const;

/** Where an issue is on the way to solved (null: it is closed without a fix) and any warning. */
export function issueStage(status: IssueStatus): {
  index: number | null;
  alert: "regressed" | "failing" | null;
} {
  switch (status) {
    case "open":
      return { index: 0, alert: null };
    case "regressed":
      return { index: 0, alert: "regressed" };
    case "fixing":
      return { index: 1, alert: null };
    case "failing":
      return { index: 1, alert: "failing" };
    case "watching":
      return { index: 2, alert: null };
    case "resolved":
      return { index: 3, alert: null };
    default:
      return { index: null, alert: null };
  }
}

/** Reviewed replies and problems per conversation, for the admin's mark on each conversation card. */
export function reviewCounts(rows: { conversation_id: string; verdict: string | null }[]) {
  const counts = new Map<string, { reviewed: number; problems: number }>();
  for (const row of rows) {
    const entry = counts.get(row.conversation_id) ?? { reviewed: 0, problems: 0 };
    entry.reviewed += 1;
    if (row.verdict === "problem") entry.problems += 1;
    counts.set(row.conversation_id, entry);
  }
  return counts;
}

export function reviewMark(counts: { reviewed: number; problems: number } | undefined) {
  if (!counts) return "Not reviewed yet";
  const replies = counts.reviewed === 1 ? "1 reply" : `${counts.reviewed} replies`;
  if (counts.problems === 0) return `${replies} reviewed · no problems`;
  return `${replies} reviewed · ${counts.problems} ${counts.problems === 1 ? "problem" : "problems"}`;
}

export type IssueFilter = "open" | "fixing" | "solved" | "all";

export const FILTERS: { id: IssueFilter; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "fixing", label: "Fixing" },
  { id: "solved", label: "Solved" },
  { id: "all", label: "All" },
];

/** open: needs work (including came back and test still fails); fixing: a fix is on its way or watched. */
export function matchesFilter(row: IssueRow, filter: IssueFilter) {
  const status = row.derived.status;
  switch (filter) {
    case "open":
      return ["open", "regressed", "failing"].includes(status);
    case "fixing":
      return ["fixing", "watching"].includes(status);
    case "solved":
      return ["resolved", "not_an_issue"].includes(status);
    default:
      return status !== "merged";
  }
}
