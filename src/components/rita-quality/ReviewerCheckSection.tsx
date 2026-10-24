import { Loader2 } from "lucide-react";
import { checkHeadline, type ReviewerCheck } from "@/lib/rita-golden";
import { RUBRIC_VERSION } from "@/lib/rita-tutor-contract";

const when = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(iso),
      )
    : "";

/**
 * Is the reviewer right? Two answers: how often the owner agreed with its judgements, and how it
 * did on a fixed set of replies whose right answer is known. A reviewer that misses a wrong fact or
 * flags a good reply makes every number on this page doubtful, so a failed check is shown first.
 */
export function ReviewerCheckSection({
  checks,
  agreement,
  busy,
  error,
  onRun,
}: {
  checks: ReviewerCheck[];
  agreement: { rate: number; total: number } | null;
  busy: boolean;
  error: string;
  onRun: () => void;
}) {
  const latest = checks.find((check) => ["done", "partial"].includes(check.status)) ?? null;
  const current = checks.some(
    (check) =>
      check.rubric_version === RUBRIC_VERSION && ["done", "partial"].includes(check.status),
  );
  const failures = latest?.results.filter((item) => item.pass === false) ?? [];
  return (
    <section aria-labelledby="reviewer-title" className="mt-10">
      <h2 id="reviewer-title" className="text-[22px] font-semibold">
        Is the reviewer right?
      </h2>
      <p className="mt-2 max-w-2xl text-[16px] leading-[1.5] text-[var(--pp-muted)]">
        {agreement
          ? `You agreed with ${agreement.rate}% of the ${agreement.total} judgements you rated.`
          : "Open a problem and mark a few of its examples as right or wrong. The share you agree with is shown here, and the ones you disagree with go into the fix file."}
      </p>

      {latest ? (
        <div className="mt-4 rounded-2xl bg-[var(--pp-grey)] p-4 sm:p-5">
          <p className="text-[18px] font-semibold">{checkHeadline(latest)}</p>
          <p className="mt-1 text-[14px] text-[var(--pp-muted)]">
            Fixed set of replies with known answers
            {latest.model ? ` · ${latest.model}` : ""} · rules version {latest.rubric_version}
            {latest.finished_at ? ` · ${when(latest.finished_at)}` : ""}
            {latest.trigger === "auto" ? " · ran by itself" : ""}
          </p>
          {failures.length ? (
            <details className="mt-3" open>
              <summary className="min-h-[44px] cursor-pointer py-2 text-[15px] font-semibold">
                {failures.length === 1 ? "1 check failed" : `${failures.length} checks failed`}:
                these judgements are not reliable yet
              </summary>
              <ul className="mt-2 grid gap-3">
                {failures.map((item) => (
                  <li key={item.id} className="rounded-xl bg-white p-3 text-[15px]">
                    <p className="font-semibold">{item.why}</p>
                    {item.problems.map((problem) => (
                      <p key={problem} className="mt-1 text-[14px] text-[var(--pp-muted)]">
                        {problem}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            </details>
          ) : (
            <p className="mt-2 text-[15px]">
              It found every planted mistake and left every good reply alone.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-[var(--pp-grey)] p-4 text-[15px]">
          The reviewer has not been checked yet.
        </p>
      )}

      {!current && !busy ? (
        <p role="note" className="mt-3 text-[14px] text-[var(--pp-muted)]">
          The reviewer&apos;s rules changed since the last check, or it was never checked. A check
          runs by itself soon; you can run it now.
        </p>
      ) : null}

      <button
        type="button"
        onClick={onRun}
        disabled={busy}
        aria-busy={busy}
        className="rita-btn rita-btn-secondary mt-4 gap-2 disabled:opacity-60"
      >
        {busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : null}
        {busy ? "Checking…" : "Check the reviewer"}
      </button>
      {busy ? (
        <p role="status" className="mt-2 text-[14px] text-[var(--pp-muted)]">
          This takes two to three minutes. You can leave the page open.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-[15px] font-semibold text-[var(--pp-accent-text)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
