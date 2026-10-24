import { Loader2 } from "lucide-react";
import { runHeadline, type CaseOutcome, type ReplayRun } from "@/lib/rita-replay";

const OUTCOME: Record<CaseOutcome, string> = {
  passed: "Answered well now",
  flaky: "Unstable: good once, wrong once",
  failed: "Still wrong",
  error: "Could not run",
};

const when = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(iso),
      )
    : "";

/**
 * "Test on the current version": the turns behind the issue answered again by the version running
 * now, and judged against the reference replies. A turn counts only when both of its answers are
 * good, so a lucky answer is not mistaken for a fix.
 */
export function ReplaySection({
  run,
  busy,
  error,
  canTest,
  onTest,
}: {
  run: ReplayRun | null;
  busy: boolean;
  error: string;
  canTest: boolean;
  onTest: () => void;
}) {
  return (
    <section aria-labelledby="replay-title" className="mt-10">
      <h2 id="replay-title" className="text-[22px] font-semibold">
        Test on the current version
      </h2>
      <p className="mt-2 max-w-2xl text-[16px] leading-[1.5] text-[var(--pp-muted)]">
        Rita answers this problem&apos;s old turns again with the version running now, and the
        answers are judged against the reference replies. Each turn is answered twice and counts
        only if both answers are good.
      </p>
      <button
        type="button"
        onClick={onTest}
        disabled={busy || !canTest}
        aria-busy={busy}
        className="rita-btn rita-btn-secondary mt-4 gap-2 disabled:opacity-60"
      >
        {busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : null}
        {busy ? "Testing…" : "Test on current version"}
      </button>
      {busy ? (
        <p role="status" className="mt-2 text-[14px] text-[var(--pp-muted)]">
          This takes a minute or two. You can leave the page open.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-[15px] font-semibold text-[var(--pp-accent-text)]">
          {error}
        </p>
      ) : null}
      {!canTest && !busy ? (
        <p className="mt-2 text-[14px] text-[var(--pp-muted)]">
          There are no examples to replay yet.
        </p>
      ) : null}

      {run ? (
        <div className="mt-6" aria-live="polite">
          <p className="text-[18px] font-semibold">{runHeadline(run)}</p>
          <p className="mt-1 text-[14px] text-[var(--pp-muted)]">
            {run.trigger === "auto" ? "Ran automatically after a new version" : "Run by you"}
            {run.worker_build ? ` · build ${run.worker_build.slice(0, 7)}` : ""}
            {run.finished_at ? ` · ${when(run.finished_at)}` : ""}
          </p>
          {run.prompt_changed === false ? (
            <p className="mt-2 rounded-xl bg-[var(--pp-grey)] px-4 py-3 text-[14px]">
              Rita&apos;s instructions have not changed since these replies were first given, so a
              different result here is chance, not a fix.
            </p>
          ) : null}
          <ul className="mt-4 grid gap-3">
            {run.cases.map((item) => (
              <li key={item.reviewId} className="rounded-2xl border border-[var(--pp-line)] p-4">
                <p className="text-[15px] font-semibold">{OUTCOME[item.outcome]}</p>
                {item.oldReply ? (
                  <p dir="auto" className="mt-2 text-[14px] text-[var(--pp-muted)]">
                    Before: {item.oldReply}
                  </p>
                ) : null}
                {item.samples.map((sample, index) => (
                  <div key={index} className="mt-2">
                    <p dir="auto" className="text-[15px] leading-[1.5]">
                      Now ({index + 1}): {sample.reply ?? "—"}
                    </p>
                    {sample.reasons.map((reason) => (
                      <p
                        key={reason}
                        dir="auto"
                        className="ms-4 text-[14px] text-[var(--pp-muted)]"
                      >
                        {reason}
                      </p>
                    ))}
                  </div>
                ))}
                {item.referenceReply ? (
                  <p dir="auto" className="mt-2 text-[14px] text-[var(--pp-accent-text)]">
                    Reference: {item.referenceReply}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
