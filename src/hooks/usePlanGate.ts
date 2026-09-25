import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { myPlanUsage, type PlanUsage } from "@/lib/plans.functions";

export type GateKind = keyof PlanUsage["usage"];
export type GateFeature =
  | "feature_lecture_qgen"
  | "feature_archive_qgen"
  | "feature_all_in_one";

export type GateBlock = {
  reason: "feature" | "quota";
  title: string;
  message: string;
};

const LABEL: Record<GateKind, string> = {
  summaries: "summaries",
  ai_questions: "AI questions",
  flashcards: "flashcards",
  todo_tasks: "to-do tasks",
  calendar_items: "calendar entries",
  all_in_one_lectures: "All-in-One lectures",
  all_in_one_questions: "All-in-One questions",
  archive_questions: "Archive questions",
  groups: "classrooms",
};

const FEATURE_LABEL: Record<GateFeature, string> = {
  feature_lecture_qgen: "Lecture questions",
  feature_archive_qgen: "Archive questions",
  feature_all_in_one: "All-in-One",
};

const CAP: Record<GateKind, string> = {
  summaries: "max_summaries",
  ai_questions: "max_ai_questions",
  flashcards: "max_flashcards",
  todo_tasks: "max_todo_tasks",
  calendar_items: "max_calendar_items",
  all_in_one_lectures: "max_all_in_one_lectures",
  all_in_one_questions: "max_all_in_one_questions",
  archive_questions: "max_archive_questions",
  groups: "max_groups",
};

/**
 * The same rules the server enforces, read once in the browser so a student
 * is never allowed to hand over a PDF that would be refused anyway (and
 * never burns AI credit that is not theirs to spend).
 */
export function usePlanGate() {
  const fetchUsage = useServerFn(myPlanUsage);
  const [block, setBlock] = useState<GateBlock | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["plan-usage"],
    queryFn: () => fetchUsage() as Promise<PlanUsage>,
    staleTime: 60_000,
    retry: false,
  });

  function remaining(kind: GateKind): number | null {
    if (!data || data.is_admin) return null;
    const cap = (data.plan as any)?.[CAP[kind]];
    if (cap === null || cap === undefined) return null;
    const used = Number(data.usage?.[kind] ?? 0);
    const extra = Number(data.grants?.[kind] ?? 0);
    return Math.max(0, Number(cap) + extra - used);
  }

  /** Returns true when the student may go ahead; otherwise opens the wall. */
  function check(opts: { kind?: GateKind; feature?: GateFeature; need?: number }): boolean {
    if (isLoading) return true;
    if (data?.is_admin) return true;

    if (!data || !data.plan) {
      setBlock({
        reason: "feature",
        title: "Upgrade to use All-in-One AI Studio",
        message:
          "Turn entire lecture PDFs into study guides, flashcards, summaries, and exam questions. " +
          "Upgrade your plan to unlock.",
      });
      return false;
    }

    const need = opts.need ?? 1;

    if (opts.feature && (data.plan as any)?.[opts.feature] !== true) {
      setBlock({
        reason: "feature",
        title: `${FEATURE_LABEL[opts.feature] || "This feature"} is not in your plan`,
        message:
          `Your ${data.plan?.name ?? "current"} plan does not include ${FEATURE_LABEL[opts.feature] || "this feature"}. ` +
          `Upgrade once and it unlocks straight away — nothing you have made is lost.`,
      });
      return false;
    }

    if (opts.kind) {
      const left = remaining(opts.kind);
      if (left !== null && left < need) {
        setBlock({
          reason: "quota",
          title: `You've used all your ${LABEL[opts.kind]}`,
          message:
            left === 0
              ? `Your ${data.plan?.name ?? "current"} plan has no ${LABEL[opts.kind]} left. ` +
                `Upgrade or add a pack to keep going — your existing work stays exactly where it is.`
              : `Only ${left} ${LABEL[opts.kind]} left, and this needs ${need}. ` +
                `Upgrade or add a pack to finish this one.`,
        });
        return false;
      }
    }
    return true;
  }

  return {
    usage: data,
    loading: isLoading,
    check,
    remaining,
    block,
    openBlock: (b: GateBlock) => setBlock(b),
    closeBlock: () => setBlock(null),
  };
}
