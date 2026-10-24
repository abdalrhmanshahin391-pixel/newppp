import { Check, X } from "lucide-react";
import type { FixFileExample } from "@/lib/rita-quality";

const WINNER: Record<string, string> = {
  reference: "The reference reply was better",
  rita: "Rita's reply was better",
  tie: "About equal",
};

/**
 * One reply behind an issue: what the learner said, what Rita said and what an excellent tutor
 * would have said, why it is a problem and the fix. The two buttons record whether the reviewer got
 * it right; the answers feed the "Is the reviewer right?" number and the fix file.
 */
export function ExampleCard({
  example,
  agree,
  onRate,
}: {
  example: FixFileExample;
  agree: boolean | null;
  onRate: (agree: boolean) => void;
}) {
  const lastLearner = [...example.contextBefore]
    .reverse()
    .find((message) => message.role === "user");
  const fix = (example.fix ?? null) as { where?: string; change?: string } | null;
  return (
    <li className="rounded-2xl border border-[var(--pp-line)] p-4 sm:p-5">
      {lastLearner ? (
        <p dir="auto" className="text-[14px] text-[var(--pp-muted)]">
          Learner: {lastLearner.text}
        </p>
      ) : null}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-[var(--pp-grey)] p-4">
          <p className="text-[13px] font-semibold text-[var(--pp-muted)]">Rita said</p>
          <p dir="auto" className="mt-1 text-[16px] leading-[1.55]">
            {example.ritaReply ?? "—"}
          </p>
        </div>
        <div className="rounded-xl bg-[var(--pp-accent-soft)] p-4">
          <p className="text-[13px] font-semibold text-[var(--pp-accent-text)]">
            An excellent tutor would say
          </p>
          <p dir="auto" className="mt-1 text-[16px] leading-[1.55]">
            {example.referenceReply ?? "—"}
          </p>
        </div>
      </div>
      {example.explanation ? (
        <p dir="auto" className="mt-3 text-[16px] leading-[1.5]">
          {example.explanation}
        </p>
      ) : null}
      {fix?.change ? (
        <p dir="auto" className="mt-2 text-[15px] leading-[1.5] text-[var(--pp-muted)]">
          <span className="font-semibold text-[var(--pp-ink)]">
            Fix{fix.where ? ` (${fix.where.replace("_", " ")})` : ""}:{" "}
          </span>
          {fix.change}
        </p>
      ) : null}
      <p className="mt-2 text-[13px] text-[var(--pp-muted)]">
        {example.winner ? (WINNER[example.winner] ?? example.winner) : "No comparison"}
        {example.build ? ` · build ${example.build.slice(0, 7)}` : ""}
      </p>
      <div
        role="group"
        aria-label="Is the reviewer right about this reply?"
        className="mt-3 flex flex-wrap gap-2"
      >
        <button
          type="button"
          aria-pressed={agree === true}
          onClick={() => onRate(true)}
          className={`rita-btn rita-btn-sm gap-2 ${agree === true ? "rita-btn-primary" : "rita-btn-secondary"}`}
        >
          <Check size={16} aria-hidden="true" /> Reviewer is right
        </button>
        <button
          type="button"
          aria-pressed={agree === false}
          onClick={() => onRate(false)}
          className={`rita-btn rita-btn-sm gap-2 ${agree === false ? "rita-btn-primary" : "rita-btn-secondary"}`}
        >
          <X size={16} aria-hidden="true" /> Reviewer is wrong
        </button>
      </div>
    </li>
  );
}
