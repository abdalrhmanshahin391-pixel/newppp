import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import { z } from "zod";

export type PlanRow = {
  slug: string;
  name: string;
  tagline: string;
  price_cents: number;
  yearly_cents: number;
  max_flashcards: number | null;
  max_ai_questions: number | null;
  max_summaries: number | null;
  max_todo_tasks: number | null;
  max_calendar_items: number | null;
  max_groups: number | null;
  max_all_in_one_lectures: number | null;
  max_all_in_one_questions: number | null;
  max_archive_questions: number | null;
  todo_full: boolean;
  rich_cards: boolean;
  feature_lecture_qgen: boolean;
  feature_archive_qgen: boolean;
  feature_all_in_one: boolean;
  sort: number;
  billing_kind?: "monthly" | "lifetime";
  once_cents?: number;
  paddle_price_monthly?: string | null;
  paddle_price_yearly?: string | null;
  paddle_price_once?: string | null;
};

export type PlanUsage = {
  plan: PlanRow;
  usage: {
    summaries: number;
    ai_questions: number;
    flashcards: number;
    todo_tasks: number;
    calendar_items: number;
    all_in_one_lectures: number;
    all_in_one_questions: number;
    archive_questions: number;
    groups: number;
  };
  /** Extra allowance bought as one-time packs, on top of the plan caps. */
  grants?: Partial<Record<keyof PlanUsage["usage"], number>>;
  /** Set while a claimed special offer is still running. */
  offer_name?: string | null;
  offer_expires_at?: string | null;
  is_admin: boolean;
};



const PLANS_CACHE_TTL_MS = 60_000;
let cachedPlans: { at: number; data: PlanRow[] } | null = null;
let inFlightPlans: Promise<PlanRow[]> | null = null;

async function fetchPlans(): Promise<PlanRow[]> {
  const url = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
  const key = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return [];
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await (client.from as any)("plans").select("*").order("sort");
  if (error) throw new Error(error.message);
  return (data ?? []) as PlanRow[];
}

/** Public plan catalogue for the pricing page with in-memory edge caching for sub-millisecond SSR. */
export const listPlans = createServerFn({ method: "GET" }).handler(async () => {
  const now = Date.now();
  if (cachedPlans && now - cachedPlans.at < PLANS_CACHE_TTL_MS) {
    return cachedPlans.data;
  }
  if (!inFlightPlans) {
    inFlightPlans = fetchPlans()
      .then((data) => {
        cachedPlans = { at: Date.now(), data };
        return data;
      })
      .catch((err) => {
        if (cachedPlans) return cachedPlans.data;
        throw err;
      })
      .finally(() => {
        inFlightPlans = null;
      });
  }
  return inFlightPlans;
});

/** The signed-in student's plan plus what they have used this month. */
export const myPlanUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await ((context as any).supabase as any).rpc("my_plan_usage");
    if (error) throw new Error(error.message);
    return data as PlanUsage;
  });

/** Counts locally created flashcards against the plan limit. */
export const recordFlashcards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ count: z.number().int().min(1).max(50) }).parse(d))
  .handler(async ({ data, context }) => {
    const userId = (context as any).userId as string;
    const { assertQuota, bumpQuota } = await import("@/lib/quota.server");
    await assertQuota(userId, "flashcards", data.count);
    await bumpQuota(userId, "flashcards", data.count);
    return { ok: true };
  });

/** Activates plan immediately after successful checkout confirmation. */
export const activatePlanAfterCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        planSlug: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const userId = (context as any).userId as string;
    const client = (context as any).supabase as any;

    // Verify plan exists
    const { data: plan, error: planErr } = await client
      .from("plans")
      .select("*")
      .eq("slug", data.planSlug)
      .maybeSingle();

    if (planErr || !plan) {
      throw new Error(`Plan "${data.planSlug}" not found`);
    }

    // Call activate_user_plan RPC
    const { error: rpcErr } = await client.rpc("activate_user_plan", {
      _user_id: userId,
      _plan_slug: plan.slug,
    });

    if (rpcErr) {
      console.warn("activate_user_plan RPC error, trying fallback:", rpcErr);
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await (supabaseAdmin as any)
          .from("user_plans")
          .upsert(
            { user_id: userId, plan_slug: plan.slug, updated_at: new Date().toISOString() },
            { onConflict: "user_id" },
          );
      } catch (adminErr) {
        console.warn("supabaseAdmin upsert error:", adminErr);
        await client
          .from("user_plans")
          .upsert(
            { user_id: userId, plan_slug: plan.slug, updated_at: new Date().toISOString() },
            { onConflict: "user_id" },
          );
      }
    }

    return { ok: true, planSlug: plan.slug };
  });

/** Claims a 100% free plan using a valid 100% discount promo code without requiring credit card or payment details. */
export const claimFreePlanWithPromo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        code: z.string().trim().min(1).max(32),
        planSlug: z.string().min(1),
        billing: z.enum(["monthly", "three_months", "yearly", "once"]).default("three_months"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const userId = (context as any).userId as string;
    const client = (context as any).supabase as any;

    // 1. Fetch plan
    const { data: plan, error: planErr } = await client
      .from("plans")
      .select("*")
      .eq("slug", data.planSlug)
      .maybeSingle();

    if (planErr || !plan) {
      throw new Error("Target plan not found");
    }

    const priceId =
      data.billing === "once"
        ? plan.paddle_price_once
        : data.billing === "yearly"
          ? plan.paddle_price_yearly
          : plan.paddle_price_monthly;

    const baseCents =
      data.billing === "once"
        ? (plan.once_cents ?? 0)
        : data.billing === "yearly"
          ? (plan.yearly_cents ?? 0)
          : (plan.price_cents ?? 0);

    // 2. Validate discount via Paddle API
    const { gatewayFetch } = await import("@/lib/paddle.server");
    const { getPaddlePriceId } = await import("@/lib/paddle");

    let paddlePriceId = "";
    let env: "sandbox" | "live" = "sandbox";
    if (priceId) {
      try {
        const p = await getPaddlePriceId(priceId);
        paddlePriceId = p.paddlePriceId;
        env = p.environment;
      } catch (err) {
        console.warn("getPaddlePriceId error in free promo claim:", err);
      }
    }

    const cleanCode = data.code.trim().toUpperCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Check if user has already redeemed this promo code
    try {
      const { data: existing } = await (supabaseAdmin as any)
        .from("promo_code_redemptions")
        .select("id, code")
        .eq("user_id", userId)
        .eq("code", cleanCode)
        .maybeSingle();

      if (existing) {
        throw new Error("You have already redeemed this promo code on your account.");
      }
    } catch (err: any) {
      if (err?.message?.includes("already redeemed")) {
        throw err;
      }
    }

    // Secondary check against manual_plan_grants
    try {
      const { data: existingGrant } = await (supabaseAdmin as any)
        .from("manual_plan_grants")
        .select("id, reason")
        .eq("user_id", userId)
        .ilike("reason", `%${cleanCode}%`)
        .maybeSingle();

      if (existingGrant) {
        throw new Error("You have already redeemed this promo code on your account.");
      }
    } catch (err: any) {
      if (err?.message?.includes("already redeemed")) {
        throw err;
      }
    }

    let discountObj: any = null;
    for (const testEnv of [env, env === "sandbox" ? "live" : "sandbox"] as const) {
      try {
        const res = await gatewayFetch(testEnv, "/discounts?status=active&per_page=200");
        if (res.ok) {
          const body = await res.json();
          const list = (body?.data ?? []) as any[];
          const match = list.find(
            (x: any) => (x.code ?? "").toUpperCase() === cleanCode,
          );
          if (match) {
            discountObj = match;
            break;
          }
        }
      } catch (err) {
        console.warn("Discounts fetch error:", err);
      }
    }

    if (!discountObj) {
      throw new Error("Promo code not found or inactive.");
    }
    if (!discountObj.enabled_for_checkout) {
      throw new Error("This promo code cannot be used at checkout.");
    }
    if (discountObj.expires_at && new Date(discountObj.expires_at) < new Date()) {
      throw new Error("This promo code has expired.");
    }
    if (discountObj.usage_limit !== null && discountObj.times_used >= discountObj.usage_limit) {
      throw new Error("This promo code usage limit has been reached.");
    }

    const { doesPromoApplyToPlan } = await import("@/lib/promo.functions");
    const applies = await doesPromoApplyToPlan(
      discountObj.restrict_to,
      data.planSlug,
      data.billing,
      paddlePriceId,
      priceId,
      env,
    );
    if (!applies) {
      throw new Error("This promo code does not apply to this plan.");
    }

    // Verify 100% discount
    const amount = Number(discountObj.amount || 0);
    const isFree =
      (discountObj.type === "percentage" && amount >= 100) ||
      (discountObj.type === "flat" && amount >= baseCents);

    if (!isFree) {
      throw new Error("This promo code does not provide a 100% free plan.");
    }

    // Calculate 3-month or yearly duration window
    const now = new Date();
    const isYearly = data.billing === "yearly";
    const durationDays = isYearly ? 365 : 90; // 3 months = 90 days!
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    // 3. Activate plan for user
    const { error: rpcErr } = await client.rpc("activate_user_plan", {
      _user_id: userId,
      _plan_slug: plan.slug,
    });

    if (rpcErr) {
      console.warn("activate_user_plan RPC error:", rpcErr);
    }
    try {
      await (supabaseAdmin as any)
        .from("user_plans")
        .upsert(
          { user_id: userId, plan_slug: plan.slug, updated_at: now.toISOString() },
          { onConflict: "user_id" },
        );
    } catch (adminErr) {
      console.warn("Admin upsert fallback failed:", adminErr);
    }

    // Record grant in manual_plan_grants with 3-month expiration
    try {
      await (supabaseAdmin as any).from("manual_plan_grants").insert({
        user_id: userId,
        plan_slug: plan.slug,
        starts_at: now.toISOString(),
        expires_at: expiresAt,
        reason: `Promo code: ${cleanCode} (${isYearly ? "1 year" : "3 months"} gift)`,
        overrides_paid: true,
        granted_by: userId,
      });
    } catch (mpgErr) {
      console.warn("manual_plan_grants insert error:", mpgErr);
    }

    // Record in toolkit_claims so /my-plan countdown timer displays the active 3 months
    try {
      await (supabaseAdmin as any).from("toolkit_claims").insert({
        user_id: userId,
        plan_slug: plan.slug,
        expires_at: expiresAt,
      });
    } catch (tcErr) {
      console.warn("toolkit_claims insert error:", tcErr);
    }

    // Record redemption permanently in promo_code_redemptions to prevent multiple claims
    try {
      await (supabaseAdmin as any).from("promo_code_redemptions").upsert(
        {
          user_id: userId,
          code: cleanCode,
          plan_slug: plan.slug,
          billing: data.billing,
          expires_at: expiresAt,
        },
        { onConflict: "user_id,code" },
      );
    } catch (pcrErr) {
      console.warn("promo_code_redemptions insert error:", pcrErr);
    }

    // If lifetime / pack, grant allowances
    if (plan.billing_kind === "lifetime") {
      const grantRow: Record<string, unknown> = {
        user_id: userId,
        plan_slug: plan.slug,
        transaction_id: `free_promo_${cleanCode}_${Date.now()}`,
        environment: env,
      };
      const GRANT_COLUMNS = [
        ["flashcards", "max_flashcards"],
        ["ai_questions", "max_ai_questions"],
        ["summaries", "max_summaries"],
        ["todo_tasks", "max_todo_tasks"],
        ["calendar_items", "max_calendar_items"],
        ["all_in_one_lectures", "max_all_in_one_lectures"],
        ["all_in_one_questions", "max_all_in_one_questions"],
        ["archive_questions", "max_archive_questions"],
        ["groups", "max_groups"],
      ] as const;
      for (const [grantCol, planCol] of GRANT_COLUMNS) {
        grantRow[grantCol] = Number(plan[planCol] ?? 0);
      }
      try {
        await client.from("plan_credit_grants").upsert(grantRow, { ignoreDuplicates: true });
      } catch (gErr) {
        console.warn("Grant pack error:", gErr);
      }
    }

    return { ok: true, planSlug: plan.slug, expiresAt };
  });
