/** Plan limits enforced on the server, before any AI call is made. */

export type QuotaKind =
  | "summaries"
  | "ai_questions"
  | "flashcards"
  | "todo_tasks"
  | "calendar_items"
  | "all_in_one_lectures"
  | "all_in_one_questions"
  | "archive_questions"
  | "groups";

export type PlanFeature =
  | "feature_lecture_qgen"
  | "feature_archive_qgen"
  | "feature_all_in_one"
  | "feature_ai_import"
  | "feature_review";

const LABEL: Record<QuotaKind, string> = {
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

const COLUMN: Record<QuotaKind, string> = {
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

const FEATURE_LABEL: Record<PlanFeature, string> = {
  feature_lecture_qgen: "Lecture question generation",
  feature_archive_qgen: "Archive question generation",
  feature_all_in_one: "All-in-One",
  feature_ai_import: "AI import",
  feature_review: "Spaced repetition",
};

/** One lifetime bucket — allowances count down and never reset. */
const PERIOD = "lifetime";

type PlanRow = Record<string, unknown> & { name?: string };

async function loadPlan(userId: string): Promise<{ admin: boolean; plan: PlanRow | null }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
  const admin = supabaseAdmin as any;

  const { data: role } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (role) return { admin: true, plan: null };

  const { data: effectiveSlug } = await admin.rpc("effective_plan_slug", { _user_id: userId });

  const { data: plan } = await admin
    .from("plans")
    .select("*")
    .eq("slug", effectiveSlug ?? "starter")
    .maybeSingle();

  const merged = await mergeClaimedOffer(userId, (plan as PlanRow) ?? null);
  return { admin: false, plan: merged };
}

/** `null` is unlimited, so it always wins; otherwise the roomier cap wins. */
function bestCap(a: unknown, b: unknown): number | null {
  if (a === null || a === undefined) return null;
  if (b === null || b === undefined) return null;
  return Math.max(Number(a), Number(b));
}

/**
 * A claimed special offer is a live entitlement while it lasts: the student
 * keeps the best of their own plan and the offer's plan, and drops back to
 * their own plan the moment the claim expires.
 */
async function mergeClaimedOffer(userId: string, plan: PlanRow | null): Promise<PlanRow | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
  const db = supabaseAdmin as any;

  const { data: claim } = await db
    .from("toolkit_claims")
    .select("plan_slug, expires_at")
    .eq("user_id", userId)
    .not("offer_id", "is", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!claim?.plan_slug) return plan;

  const { data: offerPlan } = await db
    .from("plans")
    .select("*")
    .eq("slug", claim.plan_slug)
    .maybeSingle();
  if (!offerPlan) return plan;
  if (!plan) return offerPlan as PlanRow;

  const out: Record<string, unknown> = { ...plan };
  for (const column of Object.values(COLUMN)) {
    out[column] = bestCap((plan as any)[column], (offerPlan as any)[column]);
  }
  for (const flag of [
    "todo_full",
    "rich_cards",
    "feature_lecture_qgen",
    "feature_archive_qgen",
    "feature_all_in_one",
  ]) {
    out[flag] = Boolean((plan as any)[flag]) || Boolean((offerPlan as any)[flag]);
  }
  out["name"] = `${(plan as any).name} + ${(offerPlan as any).name}`;
  return out as PlanRow;
}


/** Extra allowance bought as one-time packs — repurchases stack. */
async function grantedSoFar(userId: string, kind: QuotaKind): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
  const { data } = await (supabaseAdmin as any)
    .from("plan_credit_grants")
    .select(kind)
    .eq("user_id", userId);
  return ((data ?? []) as any[]).reduce((sum, row) => sum + Number(row?.[kind] ?? 0), 0);
}

async function usedSoFar(userId: string, kind: QuotaKind): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
  const { data } = await (supabaseAdmin as any)
    .from("usage_counters")
    .select(kind)
    .eq("user_id", userId)
    .eq("period", PERIOD)
    .maybeSingle();
  return Number((data as any)?.[kind] ?? 0);
}

/**
 * How many of this allowance the student still has. `null` means unlimited.
 */
export async function remainingQuota(userId: string, kind: QuotaKind): Promise<number | null> {
  const { admin, plan } = await loadPlan(userId);
  if (admin || !plan) return null;
  const base = plan[COLUMN[kind]] as number | null | undefined;
  if (base === null || base === undefined) return null;
  const cap = base + (await grantedSoFar(userId, kind));
  const used = await usedSoFar(userId, kind);
  return Math.max(0, cap - used);
}

/**
 * Throws a friendly error when the signed-in student has used up the allowance
 * their plan gives them. Admins are never limited.
 *
 * `n` is the real size of the job — the number of questions in the PDF, the
 * number of cards in the paste — so a big upload is refused before a single
 * token is spent, instead of being counted afterwards.
 */
export async function assertQuota(userId: string, kind: QuotaKind, n = 1) {
  const { admin, plan } = await loadPlan(userId);
  if (admin || !plan) return;

  const base = plan[COLUMN[kind]] as number | null | undefined;
  if (base === null || base === undefined) return; // unlimited

  const cap = base + (await grantedSoFar(userId, kind));

  if (cap === 0) {
    throw new Error(
      `${LABEL[kind]} are not part of the ${plan.name} plan. Open the Plans page to upgrade.`,
    );
  }

  const used = await usedSoFar(userId, kind);
  const left = Math.max(0, cap - used);

  if (left <= 0) {
    throw new Error(
      `You have used all ${cap} ${LABEL[kind]} on the ${plan.name} plan. Open the Plans page to upgrade for more.`,
    );
  }
  if (n > left) {
    throw new Error(
      `This would add ${n} ${LABEL[kind]}, but only ${left} of your ${cap} on the ${plan.name} plan ` +
        `${left === 1 ? "is" : "are"} left. Send a smaller part, or upgrade on the Plans page.`,
    );
  }
}

/**
 * The same check, named for the place it belongs: call it with the real number
 * of items a file or paste contains *before* parsing, importing or generating.
 */
export async function assertBatchFits(userId: string, kind: QuotaKind, n: number) {
  await assertQuota(userId, kind, Math.max(1, Math.floor(n)));
}

/** Throws when the student's plan does not include this tool at all. */
export async function assertFeature(userId: string, feature: PlanFeature) {
  const { admin, plan } = await loadPlan(userId);
  if (admin || !plan) return;
  if (plan[feature] === false) {
    throw new Error(
      `${FEATURE_LABEL[feature]} is not part of the ${plan.name} plan. Open the Plans page to upgrade.`,
    );
  }
}

/** Records a successful use so the counter stays honest. */
export async function bumpQuota(userId: string, kind: QuotaKind, n = 1) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
    await (supabaseAdmin as any).rpc("bump_usage", { _user_id: userId, _kind: kind, _n: n });
  } catch {
    /* never block the student because a counter failed */
  }
}
