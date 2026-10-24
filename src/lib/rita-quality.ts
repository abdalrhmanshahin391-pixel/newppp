/**
 * The numbers and rules behind /admin/rita-quality: how healthy Rita is on each build, which issue
 * to fix next, whether a fix worked, and the file handed over for fixing. Pure functions over the
 * rows the page reads; nothing here talks to the network.
 *
 * Statuses a person chooses are stored (open, fixing, not_an_issue, merged). "Watching",
 * "resolved" and "regressed" are never stored: they are worked out from the reviews that came after
 * the fix, so they cannot go stale.
 */
import { CRITERIA, CRITERION_IDS } from "./rita-tutor-contract.ts";

/** A build with fewer reviewed replies than this is shown with a "small sample" warning. */
export const SMALL_SAMPLE = 30;
/** Reviews after a fix needed, with no new problem of that kind, before an issue counts as solved. */
export const RESOLVE_AFTER = 30;
/** An issue's weight halves every this many days without a new example. */
export const IMPACT_HALF_LIFE_DAYS = 14;

export type StoredIssueStatus = "open" | "fixing" | "not_an_issue" | "merged";
export type IssueStatus = StoredIssueStatus | "watching" | "resolved" | "regressed";

export type CriteriaScores = Record<string, { rita: number; reference: number }>;

/** The slim review row the page reads (never the replies themselves, to keep it light). */
export type QualityReview = {
  id: string;
  build: string | null;
  status: string;
  verdict: string | null;
  severity: number | null;
  category: string | null;
  cause: string | null;
  winner: string | null;
  issue_id: string | null;
  reviewed_at: string | null;
  scores: {
    ritaAverage?: number;
    referenceAverage?: number;
    criteria?: CriteriaScores;
  } | null;
  timing: {
    interrupted?: boolean | null;
    firstAudioMs?: number | null;
    waitMs?: number | null;
  } | null;
};

export type Issue = {
  id: string;
  title: string;
  description: string;
  fix_where: string;
  category: string | null;
  cause: string | null;
  status: StoredIssueStatus;
  merged_into: string | null;
  suggested_merge_into: string | null;
  pr_url: string | null;
  fix_marked_at: string | null;
  fix_baseline_build: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

const done = (rows: QualityReview[]) => rows.filter((row) => row.status === "done");

const round1 = (n: number) => Math.round(n * 10) / 10;
const mean = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

/** p in 0..1 over unsorted numbers; null when empty. */
export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[index];
}

export type BuildHealth = {
  build: string;
  firstSeen: string | null;
  lastSeen: string | null;
  reviewed: number;
  problemRate: number;
  /** Rita's average score as a share of the reference reply's (100 = as good as the reference). */
  quality: number | null;
  referenceWon: number;
  ritaWon: number;
  /** Replies cut off by the voice system, as a share of replies with a turn record. */
  cutOffRate: number | null;
  firstAudioP50: number | null;
  firstAudioP95: number | null;
  criteria: Record<string, { rita: number; reference: number }>;
  weakest: string | null;
  smallSample: boolean;
};

/** One health summary per worker build, oldest build first. */
export function healthByBuild(rows: QualityReview[]): BuildHealth[] {
  const groups = new Map<string, QualityReview[]>();
  for (const row of done(rows)) {
    const key = row.build || "unknown";
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const out: BuildHealth[] = [];
  for (const [build, list] of groups) {
    const times = list
      .map((row) => row.reviewed_at)
      .filter((time): time is string => Boolean(time));
    times.sort();
    const problems = list.filter((row) => row.verdict === "problem").length;
    const rita = list
      .map((row) => row.scores?.ritaAverage)
      .filter((n): n is number => typeof n === "number");
    const reference = list
      .map((row) => row.scores?.referenceAverage)
      .filter((n): n is number => typeof n === "number");
    const ritaMean = mean(rita);
    const referenceMean = mean(reference);
    const timed = list.filter((row) => row.timing && typeof row.timing.interrupted === "boolean");
    const audio = list
      .map((row) => row.timing?.firstAudioMs)
      .filter((n): n is number => typeof n === "number");
    const criteria: BuildHealth["criteria"] = {};
    for (const id of CRITERION_IDS) {
      const ritaScores = list
        .map((row) => row.scores?.criteria?.[id]?.rita)
        .filter((n): n is number => typeof n === "number");
      const referenceScores = list
        .map((row) => row.scores?.criteria?.[id]?.reference)
        .filter((n): n is number => typeof n === "number");
      const ritaAverage = mean(ritaScores);
      const referenceAverage = mean(referenceScores);
      if (ritaAverage !== null && referenceAverage !== null) {
        criteria[id] = { rita: round1(ritaAverage), reference: round1(referenceAverage) };
      }
    }
    const weakest =
      Object.entries(criteria).sort(
        (a, b) => a[1].rita - a[1].reference - (b[1].rita - b[1].reference),
      )[0]?.[0] ?? null;
    out.push({
      build,
      firstSeen: times[0] ?? null,
      lastSeen: times.at(-1) ?? null,
      reviewed: list.length,
      problemRate: list.length ? round1((problems / list.length) * 100) : 0,
      quality: ritaMean !== null && referenceMean ? round1((ritaMean / referenceMean) * 100) : null,
      referenceWon: list.filter((row) => row.winner === "reference").length,
      ritaWon: list.filter((row) => row.winner === "rita").length,
      cutOffRate: timed.length
        ? round1(
            (timed.filter((row) => row.timing?.interrupted === true).length / timed.length) * 100,
          )
        : null,
      firstAudioP50: percentile(audio, 0.5),
      firstAudioP95: percentile(audio, 0.95),
      criteria,
      weakest,
      smallSample: list.length < SMALL_SAMPLE,
    });
  }
  return out.sort((a, b) => (a.firstSeen ?? "").localeCompare(b.firstSeen ?? ""));
}

export function criterionText(id: string) {
  return CRITERIA.find((criterion) => criterion.id === id)?.text ?? id;
}

/** A change between two numbers, with whether it is good news (`lowerIsBetter` flips the sign). */
export function change(current: number | null, previous: number | null, lowerIsBetter = false) {
  if (current === null || previous === null) return null;
  const delta = round1(current - previous);
  return { delta, better: delta === 0 ? null : lowerIsBetter ? delta < 0 : delta > 0 };
}

// --------------------------------------------------------------------------------- issues

/** How much an issue matters now: how often, how bad, how recent. Higher goes first. */
export function issueImpact(reviews: QualityReview[], now = Date.now()) {
  let total = 0;
  for (const review of reviews) {
    const age = review.reviewed_at ? Math.max(0, now - new Date(review.reviewed_at).getTime()) : 0;
    const days = age / 86_400_000;
    const recency = Math.pow(0.5, days / IMPACT_HALF_LIFE_DAYS);
    total += Math.max(1, review.severity ?? 1) * recency;
  }
  return round1(total);
}

export type DerivedStatus = {
  status: IssueStatus;
  /** Reviews on newer builds since the fix, and how many are needed to call it solved. */
  checked: number;
  needed: number;
  /** Problems of this kind seen since the fix. */
  newProblems: number;
};

/**
 * Where an issue really stands. `allReviews` is every review (so the number of replies checked
 * after the fix does not depend on the issue's own examples), `issueReviews` is the issue's.
 */
export function deriveIssueStatus(
  issue: Pick<Issue, "status" | "fix_marked_at" | "fix_baseline_build">,
  allReviews: QualityReview[],
  issueReviews: QualityReview[],
): DerivedStatus {
  const base = { checked: 0, needed: RESOLVE_AFTER, newProblems: 0 };
  if (issue.status !== "fixing" || !issue.fix_marked_at) return { status: issue.status, ...base };
  const since = new Date(issue.fix_marked_at).getTime();
  const after = (review: QualityReview) =>
    Boolean(review.reviewed_at) &&
    new Date(review.reviewed_at as string).getTime() > since &&
    (!issue.fix_baseline_build || !review.build || review.build !== issue.fix_baseline_build);
  const checked = done(allReviews).filter(after).length;
  const newProblems = done(issueReviews).filter(
    (review) => review.verdict === "problem" && after(review),
  ).length;
  if (newProblems > 0) return { status: "regressed", checked, needed: RESOLVE_AFTER, newProblems };
  if (checked === 0) return { status: "fixing", checked, needed: RESOLVE_AFTER, newProblems };
  if (checked >= RESOLVE_AFTER)
    return { status: "resolved", checked, needed: RESOLVE_AFTER, newProblems };
  return { status: "watching", checked, needed: RESOLVE_AFTER, newProblems };
}

/** Where a developer should change something, in plain words. */
export const FIX_WHERE_LABEL: Record<string, string> = {
  prompt: "Prompt",
  dialect_list: "Dialect list",
  memory: "Memory",
  turn_taking: "Turn-taking",
  stt: "Listening",
  tts: "Voice",
  content: "Content",
  code: "Code",
  none: "No change",
};

export const STATUS_LABEL: Record<IssueStatus, string> = {
  open: "Open",
  fixing: "Fix on its way",
  watching: "Watching",
  resolved: "Solved",
  regressed: "Came back",
  not_an_issue: "Not a problem",
  merged: "Merged",
};

/** Order for the "Fix next" list: came back, then open, then fix on its way, then the rest. */
const STATUS_ORDER: Record<IssueStatus, number> = {
  regressed: 0,
  open: 1,
  fixing: 2,
  watching: 3,
  resolved: 4,
  not_an_issue: 5,
  merged: 6,
};

export type IssueRow = {
  issue: Issue;
  derived: DerivedStatus;
  reviews: QualityReview[];
  impact: number;
  firstSeen: string | null;
  lastSeen: string | null;
};

export function buildIssueRows(
  issues: Issue[],
  reviews: QualityReview[],
  now = Date.now(),
): IssueRow[] {
  const byIssue = new Map<string, QualityReview[]>();
  for (const review of done(reviews)) {
    if (review.issue_id)
      byIssue.set(review.issue_id, [...(byIssue.get(review.issue_id) ?? []), review]);
  }
  return issues
    .map((issue) => {
      const own = byIssue.get(issue.id) ?? [];
      const times = own
        .map((row) => row.reviewed_at)
        .filter((t): t is string => Boolean(t))
        .sort();
      return {
        issue,
        derived: deriveIssueStatus(issue, reviews, own),
        reviews: own,
        impact: issueImpact(own, now),
        firstSeen: times[0] ?? null,
        lastSeen: times.at(-1) ?? null,
      };
    })
    .sort(
      (a, b) =>
        STATUS_ORDER[a.derived.status] - STATUS_ORDER[b.derived.status] || b.impact - a.impact,
    );
}

/** Problem counts per build for one issue, oldest build first (to see a fix working). */
export function issueByBuild(reviews: QualityReview[], allReviews: QualityReview[]) {
  const health = healthByBuild(allReviews);
  return health.map((entry) => ({
    build: entry.build,
    reviewed: entry.reviewed,
    problems: reviews.filter(
      (row) => (row.build || "unknown") === entry.build && row.verdict === "problem",
    ).length,
    firstSeen: entry.firstSeen,
  }));
}

// ----------------------------------------------------------------------------------- file

export type FixFileExample = {
  reviewId: string;
  conversationId: string;
  build: string | null;
  verdict: string | null;
  severity: number | null;
  category: string | null;
  cause: string | null;
  explanation: string | null;
  evidence: string | null;
  fix: unknown;
  ritaReply: string | null;
  referenceReply: string | null;
  contextBefore: { role: string; text: string }[];
  winner: string | null;
  scores: unknown;
  facts: unknown;
  dialect: unknown;
  timing: unknown;
  reviewedAt: string | null;
  ownerAgrees: boolean | null;
  ownerNote: string | null;
};

/** The file handed over for fixing one issue. */
export function issueFixFile(args: {
  issue: Issue;
  derived: DerivedStatus;
  examples: FixFileExample[];
  byBuild: ReturnType<typeof issueByBuild>;
  replay?: unknown;
  generatedAt?: string;
}) {
  const { issue, derived, examples } = args;
  const disagreed = examples.filter((example) => example.ownerAgrees === false);
  return {
    schemaVersion: 1,
    purpose: "Rita issue fix file",
    privacy: { rawAudioIncluded: false, credentialsIncluded: false },
    generatedAt: args.generatedAt ?? new Date().toISOString(),
    issue: {
      id: issue.id,
      title: issue.title,
      description: issue.description,
      fixWhere: issue.fix_where,
      category: issue.category,
      cause: issue.cause,
      status: derived.status,
      prUrl: issue.pr_url,
      note: issue.note,
      createdAt: issue.created_at,
    },
    howToUse:
      "Each example has Rita's reply and the reference reply an excellent tutor would give. Fix the cause so Rita answers like the reference, then mark the issue fixed on the page; later reviews decide whether it worked.",
    numbers: {
      examples: examples.length,
      byBuild: args.byBuild,
      afterFix: {
        checked: derived.checked,
        needed: derived.needed,
        newProblems: derived.newProblems,
      },
    },
    // Reviews the owner disagreed with: the reviewer may be wrong on these.
    ownerDisagreedWith: disagreed.map((example) => example.reviewId),
    replay: args.replay ?? null,
    examples,
  };
}

export function fixFileName(title: string, id: string) {
  const slug =
    title
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "issue";
  return `rita-issue-${slug}-${id.slice(0, 8)}.json`;
}

/** Share of the owner's thumbs that agree with the reviewer (null with no thumbs yet). */
export function agreementRate(feedback: { agree: boolean }[]) {
  if (!feedback.length) return null;
  return {
    rate: round1((feedback.filter((item) => item.agree).length / feedback.length) * 100),
    total: feedback.length,
  };
}
