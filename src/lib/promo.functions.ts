import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";

const envSchema = z.enum(["sandbox", "live"]).default("sandbox");

type Env = "sandbox" | "live";

type Discount = {
  id: string;
  status: string;
  description: string;
  code: string | null;
  type: "percentage" | "flat" | "flat_per_seat";
  amount: string;
  currency_code: string | null;
  recur: boolean;
  maximum_recurring_intervals: number | null;
  usage_limit: number | null;
  times_used: number;
  restrict_to: string[] | null;
  expires_at: string | null;
  enabled_for_checkout: boolean;
  created_at: string;
};

async function api(env: Env, path: string, init?: RequestInit) {
  const { gatewayFetch } = await import("@/lib/paddle.server");
  const res = await gatewayFetch(env, path, init);
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const fieldErrors = Array.isArray(body?.error?.errors)
      ? body.error.errors
          .map((e: any) => (e.field ? `${e.field}: ${e.message}` : e.message))
          .join("; ")
      : null;
    const detail =
      fieldErrors || body?.error?.detail || body?.error?.code || `Request failed (${res.status})`;
    throw new Error(detail);
  }
  return body;
}

async function assertAdmin(context: unknown) {
  const ctx = context as { supabase: any; userId: string };
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

/**
 * Robust multi-factor check ensuring a discount applies to the selected plan
 * across external IDs, internal Paddle pri_ IDs, plan slugs, and environments.
 */
export async function doesPromoApplyToPlan(
  restrictTo: string[] | null | undefined,
  planSlug?: string | null,
  billing?: string | null,
  paddlePriceId?: string | null,
  externalPriceId?: string | null,
  environment: Env = "live",
): Promise<boolean> {
  if (!restrictTo || restrictTo.length === 0) return true;

  const cleanRestrictions = restrictTo.map((r) => r.trim()).filter(Boolean);
  if (cleanRestrictions.length === 0) return true;

  // 1. Direct match with paddlePriceId
  if (paddlePriceId && cleanRestrictions.includes(paddlePriceId.trim())) return true;

  // 2. Direct match with externalPriceId (e.g. "toolkit_monthly")
  if (externalPriceId && cleanRestrictions.includes(externalPriceId.trim())) return true;

  // 3. Direct match with planSlug (e.g. "toolkit")
  if (planSlug && cleanRestrictions.includes(planSlug.trim())) return true;

  // 4. Query plan from Supabase to check plan external price IDs and aliases
  if (planSlug) {
    try {
      const url = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
      const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
      if (url && key) {
        const { createClient } = await import("@supabase/supabase-js");
        const client = createClient(url, key, { auth: { persistSession: false } });
        const { data: plan } = await (client.from as any)("plans")
          .select("*")
          .eq("slug", planSlug)
          .maybeSingle();

        if (plan) {
          const is3m = !billing || billing === "three_months" || billing === "monthly";
          const isYearly = billing === "yearly";
          const isOnce = billing === "once";

          const planPriceKey = is3m
            ? plan.paddle_price_monthly
            : isYearly
              ? plan.paddle_price_yearly
              : plan.paddle_price_once;

          if (planPriceKey && cleanRestrictions.includes(planPriceKey)) return true;

          // 5. Cross-environment price lookup in Paddle:
          // Check if any restricted ID matches the Paddle price resolved for planPriceKey
          if (planPriceKey) {
            const { gatewayFetch } = await import("@/lib/paddle.server");
            for (const envToCheck of ["live", "sandbox"] as const) {
              try {
                const res = await gatewayFetch(
                  envToCheck,
                  `/prices?external_id=${encodeURIComponent(planPriceKey)}`,
                );
                if (res.ok) {
                  const body = await res.json();
                  const foundPriceId = body?.data?.[0]?.id;
                  if (foundPriceId && cleanRestrictions.includes(foundPriceId)) {
                    return true;
                  }
                }
              } catch {
                /* continue */
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn("doesPromoApplyToPlan lookup error:", err);
    }
  }

  return false;
}

/* ------------------------------------------------------------- customer */

/**
 * Checks a promo code the student typed at checkout and works out what the
 * new total would be. Also enforces that each student can only redeem each promo code once.
 */
export const checkPromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        code: z.string().trim().min(1).max(32),
        environment: envSchema,
        paddlePriceId: z.string().min(1),
        externalPriceId: z.string().optional(),
        planSlug: z.string().optional(),
        billing: z.string().optional(),
        cents: z.number().int().min(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const cleanCode = data.code.trim().toUpperCase();
    const userId = (context as { userId?: string }).userId;

    // Single-use per user check: ensure user has not already redeemed this code
    if (userId) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
    }

    let found: Discount[] = [];
    try {
      const body = await api(data.environment, "/discounts?status=active&per_page=200");
      found = (body?.data ?? []) as Discount[];
    } catch (err) {
      console.warn(`Discounts fetch in ${data.environment} failed:`, err);
    }

    let d = found.find((x) => (x.code ?? "").toUpperCase() === cleanCode);

    // Fall back to check the other environment if not found in primary
    if (!d) {
      const other: Env = data.environment === "sandbox" ? "live" : "sandbox";
      try {
        const bodyOther = await api(other, "/discounts?status=active&per_page=200");
        const foundOther = (bodyOther?.data ?? []) as Discount[];
        d = foundOther.find((x) => (x.code ?? "").toUpperCase() === cleanCode);
      } catch (err) {
        console.warn(`Discounts fallback in ${other} failed:`, err);
      }
    }

    if (!d) throw new Error("That code is not valid — check the spelling and try again.");
    if (!d.enabled_for_checkout) throw new Error("That code cannot be used at checkout.");
    if (d.expires_at && new Date(d.expires_at) < new Date())
      throw new Error("That code has expired.");
    if (d.usage_limit !== null && d.times_used >= d.usage_limit)
      throw new Error("That code has already been fully used.");

    const applies = await doesPromoApplyToPlan(
      d.restrict_to,
      data.planSlug,
      data.billing,
      data.paddlePriceId,
      data.externalPriceId,
      data.environment,
    );
    if (!applies) {
      throw new Error("That code does not apply to this plan.");
    }

    const amount = Number(d.amount || 0);
    const off =
      d.type === "percentage" ? Math.round((data.cents * amount) / 100) : Math.round(amount);
    const discountCents = Math.min(off, data.cents);

    return {
      code: (d.code ?? data.code).toUpperCase(),
      label: d.description,
      type: d.type,
      discountCents,
      totalCents: data.cents - discountCents,
      recurring: d.recur,
    };
  });

/* ---------------------------------------------------------------- admin */

export const adminListDiscounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ environment: envSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const body = await api(
      data.environment,
      "/discounts?status=active,archived&per_page=200&order_by=created_at[DESC]",
    );
    return (body?.data ?? []) as Discount[];
  });

const createSchema = z.object({
  environment: envSchema,
  description: z.string().trim().min(1).max(200),
  code: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9]+$/, "Codes can only use letters and numbers"),
  type: z.enum(["percentage", "flat"]),
  amount: z.number().min(0.01),
  currency_code: z.string().length(3).default("USD"),
  recur: z.boolean().default(false),
  maximum_recurring_intervals: z.number().int().min(1).max(60).nullable().default(null),
  usage_limit: z.number().int().min(1).max(1_000_000).nullable().default(null),
  expires_at: z.string().nullable().default(null),
  restrict_to: z.array(z.string()).default([]),
});

/** Creates a real discount in the payment provider. */
export const adminCreateDiscount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const payload: Record<string, unknown> = {
      description: data.description,
      code: data.code.toUpperCase(),
      type: data.type,
      amount:
        data.type === "percentage"
          ? String(data.amount)
          : String(Math.round(data.amount * 100)),
      enabled_for_checkout: true,
      recur: data.recur,
    };
    if (data.type !== "percentage") {
      payload.currency_code = data.currency_code.toUpperCase();
    }
    if (data.recur && data.maximum_recurring_intervals) {
      payload.maximum_recurring_intervals = data.maximum_recurring_intervals;
    }
    if (data.usage_limit) {
      payload.usage_limit = data.usage_limit;
    }
    if (data.expires_at) {
      payload.expires_at = data.expires_at;
    }
    if (data.restrict_to && data.restrict_to.length > 0) {
      const resolvedRestrictions: string[] = [];
      for (const rawId of data.restrict_to) {
        if (!rawId) continue;
        if (rawId.startsWith("pri_")) {
          resolvedRestrictions.push(rawId);
        } else {
          // Resolve external price ID to Paddle's internal pri_ ID
          try {
            const found = await api(
              data.environment,
              `/prices?external_id=${encodeURIComponent(rawId)}`,
            );
            const priId = found?.data?.[0]?.id;
            if (priId) {
              resolvedRestrictions.push(priId);
            } else {
              // Try fallback environment lookup
              const other: Env = data.environment === "sandbox" ? "live" : "sandbox";
              try {
                const foundOther = await api(
                  other,
                  `/prices?external_id=${encodeURIComponent(rawId)}`,
                );
                const priIdOther = foundOther?.data?.[0]?.id;
                if (priIdOther) {
                  resolvedRestrictions.push(priIdOther);
                } else {
                  throw new Error(
                    `Price "${rawId}" is not found in Paddle ${data.environment}. Please ensure this price exists in Paddle or sync it in Admin > Plans.`,
                  );
                }
              } catch {
                throw new Error(
                  `Price "${rawId}" is not found in Paddle ${data.environment}. Please ensure this price exists in Paddle or sync it in Admin > Plans.`,
                );
              }
            }
          } catch (err: any) {
            throw new Error(
              err.message ||
                `Could not resolve price "${rawId}" in Paddle. Please check your Paddle catalog.`,
            );
          }
        }
      }
      if (resolvedRestrictions.length > 0) {
        payload.restrict_to = resolvedRestrictions;
      }
    }
    const body = await api(data.environment, "/discounts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return body?.data as Discount;
  });

/** Turns a code on or off, or archives it for good. */
export const adminUpdateDiscount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        environment: envSchema,
        id: z.string().min(1),
        enabled_for_checkout: z.boolean().optional(),
        status: z.enum(["active", "archived"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { environment, id, ...patch } = data;
    const body = await api(environment, `/discounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return body?.data as Discount;
  });

/** Prices in the payment catalog, so a code can be limited to some plans. */
export const adminListPaddlePrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ environment: envSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const body = await api(data.environment, "/prices?per_page=200&status=active");
    return ((body?.data ?? []) as any[]).map((p) => ({
      id: p.id as string,
      externalId: (p.import_meta?.external_id ?? null) as string | null,
      description: p.description as string,
      amount: p.unit_price?.amount as string,
      currency: p.unit_price?.currency_code as string,
      interval: (p.billing_cycle?.interval ?? null) as string | null,
    }));
  });
