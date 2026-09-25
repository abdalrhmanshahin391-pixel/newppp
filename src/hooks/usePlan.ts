import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { myPlanUsage, type PlanUsage } from "@/lib/plans.functions";
import { useAuth } from "@/hooks/useAuth";

export type PlanFeatures = {
  loaded: boolean;
  isAdmin: boolean;
  planName: string;
  richCards: boolean;
  todoFull: boolean;
  aiImport: boolean;
  review: boolean;
  /** Tool switches — false means the plan does not include the tool at all. */
  lectureQuestions: boolean;
  archiveQuestions: boolean;
  allInOne: boolean;
  /** Lifetime caps. `null` means unlimited. */
  maxTodoTasks: number | null;
  maxCalendarItems: number | null;
  maxGroups: number | null;
  /** How much of each allowance is left, `null` when unlimited. */
  left: (kind: keyof PlanUsage["usage"]) => number | null;
  data: PlanUsage | null;
};

const CAP: Record<string, string> = {
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
 * The signed-in student's plan, with the feature switches and lifetime
 * allowances an admin set on it. While nothing is loaded yet everything stays
 * unlocked so the UI never flickers a lock on a paying student.
 */
export function usePlan(): PlanFeatures {
  const { user } = useAuth();
  const usageFn = useServerFn(myPlanUsage);

  const { data } = useQuery({
    queryKey: ["my-plan-usage", user?.id ?? "anon"],
    queryFn: () => usageFn({}) as Promise<PlanUsage>,
    enabled: !!user,
    staleTime: 60_000,
  });

  const plan = data?.plan as (Record<string, any> | undefined);
  const grants = ((data as any)?.grants ?? {}) as Record<string, number>;
  const admin = !!data?.is_admin;
  const on = (v: boolean | undefined | null) => admin || !plan || v !== false;
  /** Plan cap plus every one-time pack the student has bought. */
  const num = (col: string): number | null => {
    if (admin || !plan) return null;
    const v = plan[col];
    if (v === null || v === undefined) return null;
    const kind = Object.keys(CAP).find((k) => CAP[k] === col);
    const extra = kind ? Number(grants[kind] ?? 0) : 0;
    return Number(v) + extra;
  };

  return {
    loaded: !!data,
    isAdmin: admin,
    planName: (plan?.name as string) ?? "Free",
    richCards: on(plan?.rich_cards),
    todoFull: on(plan?.todo_full),
    aiImport: on(plan?.feature_ai_import),
    review: on(plan?.feature_review),
    lectureQuestions: on(plan?.feature_lecture_qgen) && num("max_ai_questions") !== 0,
    archiveQuestions: on(plan?.feature_archive_qgen) && num("max_archive_questions") !== 0,
    allInOne: on(plan?.feature_all_in_one) && num("max_all_in_one_lectures") !== 0,
    maxTodoTasks: num("max_todo_tasks"),
    maxCalendarItems: num("max_calendar_items"),
    maxGroups: num("max_groups"),
    left: (kind) => {
      const cap = num(CAP[kind as string] ?? "");
      if (cap === null) return null;
      const used = Number((data?.usage as any)?.[kind] ?? 0);
      return Math.max(0, cap - used);
    },
    data: data ?? null,
  };
}
