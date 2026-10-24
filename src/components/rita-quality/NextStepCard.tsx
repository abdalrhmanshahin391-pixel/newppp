import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { NextStep } from "@/lib/rita-quality-next";

/**
 * The one thing to do now, in a sentence and (at most) one button. The page's answer to "what do I
 * do?" so the admin never has to read six sections to find out.
 */
export function NextStepCard({ step, onTrust }: { step: NextStep; onTrust: () => void }) {
  return (
    <section
      aria-labelledby="next-step-title"
      className="rounded-2xl bg-[var(--pp-accent-soft)] p-5 sm:p-6"
    >
      <p className="text-[14px] font-semibold text-[var(--pp-accent-text)]">Next step</p>
      <h2 id="next-step-title" className="mt-1 text-[22px] font-semibold leading-[1.25]">
        {step.title}
      </h2>
      {step.kind === "issue" ? (
        // The problem's title can be Arabic: it sits in its own box so it never looks misaligned.
        <p
          dir="auto"
          className="mt-3 w-fit max-w-full rounded-xl bg-white px-4 py-2 text-[16px] font-semibold leading-[1.5]"
        >
          {step.body}
        </p>
      ) : (
        <p className="mt-2 max-w-2xl text-[16px] leading-[1.5]">{step.body}</p>
      )}
      {step.kind === "issue" ? (
        <Link
          to="/admin/rita-quality/$issueId"
          params={{ issueId: step.issueId }}
          className="rita-btn rita-btn-primary mt-4 gap-2"
        >
          {step.action} <ArrowRight size={18} aria-hidden="true" />
        </Link>
      ) : null}
      {step.kind === "trust" ? (
        <button type="button" onClick={onTrust} className="rita-btn rita-btn-primary mt-4 gap-2">
          {step.action} <ArrowRight size={18} aria-hidden="true" />
        </button>
      ) : null}
    </section>
  );
}
