import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import { z } from "zod";

const planSchema = z.object({
  slug: z.string().min(1).max(40).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(60),
  tagline: z.string().max(200).default(""),
  price_cents: z.number().int().min(0).max(1_000_000),
  yearly_cents: z.number().int().min(0).max(10_000_000),
  currency: z.string().min(1).max(6).default("USD"),
  billing_kind: z.enum(["monthly", "lifetime"]).default("monthly"),
  once_cents: z.number().int().min(0).max(10_000_000).default(0),
  paddle_price_monthly: z.string().max(80).nullable().default(null),
  paddle_price_yearly: z.string().max(80).nullable().default(null),
  paddle_price_once: z.string().max(80).nullable().default(null),
  cta_label: z.string().max(40).nullable().default(null),
  max_flashcards: z.number().int().min(0).nullable(),
  max_ai_questions: z.number().int().min(0).nullable(),
  max_summaries: z.number().int().min(0).nullable(),
  max_todo_tasks: z.number().int().min(0).nullable().default(null),
  max_calendar_items: z.number().int().min(0).nullable().default(null),
  max_groups: z.number().int().min(0).nullable().default(null),
  max_all_in_one_lectures: z.number().int().min(0).nullable().default(null),
  max_all_in_one_questions: z.number().int().min(0).nullable().default(null),
  max_archive_questions: z.number().int().min(0).nullable().default(null),
  todo_full: z.boolean(),
  rich_cards: z.boolean(),
  feature_ai_import: z.boolean(),
  feature_review: z.boolean(),
  feature_lecture_qgen: z.boolean().default(true),
  feature_archive_qgen: z.boolean().default(true),
  feature_all_in_one: z.boolean().default(true),
  perks: z.array(z.string().max(120)).max(12).default([]),
  published: z.boolean(),
  highlight: z.boolean(),
  sort: z.number().int().min(0).max(999),
  /* Offer / discount */
  ribbon_label: z.string().max(24).nullable().default(null),
  ribbon_color: z.string().max(16).nullable().default(null),
  compare_cents: z.number().int().min(0).max(10_000_000).nullable().default(null),
  offer_ends_at: z.string().nullable().default(null),
});

export type AdminPlan = z.infer<typeof planSchema>;

async function assertAdmin(context: unknown) {
  const ctx = context as { supabase: any; userId: string };
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

/** Every plan, published or not — admin only. */
export const adminListPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
    const { data, error } = await (supabaseAdmin as any).from("plans").select("*").order("sort");
    if (error) throw new Error(error.message);
    return (data ?? []) as AdminPlan[];
  });

type Env = "sandbox" | "live";

export function getActiveServerPaddleEnv(): Env {
  const forceTest = String(process.env.VITE_PAYMENTS_FORCE_TEST ?? "") === "1";
  if (forceTest) return "sandbox";
  const liveToken = process.env.VITE_PAYMENTS_CLIENT_TOKEN;
  if (liveToken?.startsWith("live_")) return "live";
  if (process.env.PADDLE_LIVE_API_KEY) return "live";
  return "sandbox";
}

async function pay(env: Env, path: string, init?: RequestInit) {
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
    const detail =
      body?.error?.detail ||
      body?.error?.message ||
      body?.message ||
      `Payment catalog request failed (${res.status})`;
    throw new Error(detail);
  }
  return body;
}

export type SyncResult = {
  done: string[];
  failed: { id: string; reason: string }[];
  env: Env;
  updatedPriceIds?: Record<string, string>;
};

type TargetSpec = {
  key: "monthly" | "yearly" | "once";
  label: string;
  field: "paddle_price_monthly" | "paddle_price_yearly" | "paddle_price_once";
  externalId: string | null;
  cents: number;
  billingCycle: { interval: "month" | "year"; frequency: number } | null;
  name: string;
  description: string;
};

/**
 * Pushes a plan's name, prices, and billing intervals to the payment catalog
 * so the amount and cadence a student is charged always matches what RitaJet promises.
 * Automatically migrates legacy 1-month prices to 3-month recurring subscriptions,
 * archives obsolete 1-month prices, and synchronizes product metadata.
 */
async function syncPlanToPaddle(plan: AdminPlan, env: Env): Promise<SyncResult> {
  const isLifetime = (plan.billing_kind ?? "monthly") === "lifetime";
  const targets: TargetSpec[] = isLifetime
    ? [
        {
          key: "once",
          label: "One-Time Pack",
          field: "paddle_price_once",
          externalId: plan.paddle_price_once,
          cents: plan.once_cents ?? 0,
          billingCycle: null,
          name: `${plan.name} (One-Time)`,
          description: `${plan.name} Lifetime Pack`,
        },
      ]
    : [
        {
          key: "monthly",
          label: "3-Month Subscription",
          field: "paddle_price_monthly",
          externalId: plan.paddle_price_monthly,
          cents: plan.price_cents ?? 0,
          billingCycle: { interval: "month", frequency: 3 },
          name: `${plan.name} (3 Months)`,
          description: `${plan.name} - 3 Months Access`,
        },
        {
          key: "yearly",
          label: "Yearly Subscription",
          field: "paddle_price_yearly",
          externalId: plan.paddle_price_yearly,
          cents: plan.yearly_cents ?? 0,
          billingCycle: { interval: "year", frequency: 1 },
          name: `${plan.name} (Yearly)`,
          description: `${plan.name} - 1 Year Access`,
        },
      ];

  const done: string[] = [];
  const failed: { id: string; reason: string }[] = [];
  const updatedPriceIds: Record<string, string> = {};
  let productId: string | null = null;
  let productSynced = false;

  // First, find productId from any known price or by searching product catalog
  for (const t of targets) {
    if (!t.externalId) continue;
    try {
      const isPri = t.externalId.startsWith("pri_");
      const found = isPri
        ? await pay(env, `/prices/${encodeURIComponent(t.externalId)}`)
        : await pay(env, `/prices?external_id=${encodeURIComponent(t.externalId)}`);
      const price = isPri ? found?.data : found?.data?.[0];
      if (price?.product_id) {
        productId = price.product_id;
        break;
      }
    } catch {
      // continue searching
    }
  }

  // If no product_id found from prices, search products by name
  if (!productId) {
    try {
      const prods = await pay(env, `/products?search=${encodeURIComponent(plan.name)}`);
      if (prods?.data?.[0]?.id) {
        productId = prods.data[0].id;
      }
    } catch {
      // non-blocking
    }
  }

  // If still no product_id, create the product in Paddle
  if (!productId) {
    try {
      const createdProd = await pay(env, "/products", {
        method: "POST",
        body: JSON.stringify({
          name: plan.name,
          description: plan.tagline || plan.name,
          tax_category: "standard",
        }),
      });
      if (createdProd?.data?.id) {
        productId = createdProd.data.id;
        done.push(`Created product "${plan.name}" in Paddle (${productId})`);
      }
    } catch (e: any) {
      console.warn("Product creation error:", e?.message);
    }
  }

  for (const t of targets) {
    if (!t.cents || t.cents <= 0) continue;
    try {
      let existingPrice: any = null;
      if (t.externalId) {
        const isPri = t.externalId.startsWith("pri_");
        const found = isPri
          ? await pay(env, `/prices/${encodeURIComponent(t.externalId)}`)
          : await pay(env, `/prices?external_id=${encodeURIComponent(t.externalId)}`);
        existingPrice = isPri ? found?.data : found?.data?.[0];
      }

      if (existingPrice?.id) {
        if (!productId && existingPrice.product_id) productId = existingPrice.product_id;

        // Check if billing cycle matches
        const existingCycle = existingPrice.billing_cycle;
        const cycleMatches =
          (!t.billingCycle && !existingCycle) ||
          (Boolean(t.billingCycle) &&
            Boolean(existingCycle) &&
            existingCycle?.interval === t.billingCycle?.interval &&
            existingCycle?.frequency === t.billingCycle?.frequency);

        if (cycleMatches) {
          // Billing cycle matches (e.g. 3 months). Update unit price and names
          await pay(env, `/prices/${existingPrice.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              name: t.name,
              description: t.description,
              unit_price: { amount: String(t.cents), currency_code: plan.currency.toUpperCase() },
              status: "active",
            }),
          });
          done.push(`${t.label}: Updated price to $${(t.cents / 100).toFixed(2)} ${plan.currency} (${existingPrice.id})`);
        } else {
          // Billing cycle changed (e.g. was legacy 1-month frequency:1, now 3-month frequency:3)!
          // In Paddle, billing_cycle is immutable on existing price. Create new price with proper billing_cycle.
          const prodId = productId || existingPrice.product_id;
          if (!prodId) throw new Error("Missing product ID for creating 3-month price");

          const newPriceRes = await pay(env, "/prices", {
            method: "POST",
            body: JSON.stringify({
              product_id: prodId,
              name: t.name,
              description: t.description,
              unit_price: { amount: String(t.cents), currency_code: plan.currency.toUpperCase() },
              ...(t.billingCycle ? { billing_cycle: t.billingCycle } : {}),
            }),
          });

          const newPrice = newPriceRes?.data;
          if (!newPrice?.id) throw new Error("Paddle did not return new price ID");

          // Archive old legacy price so nobody can purchase the 1-month version
          await pay(env, `/prices/${existingPrice.id}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "archived" }),
          }).catch(() => null);

          updatedPriceIds[t.field] = newPrice.id;
          done.push(
            `${t.label}: Migrated to 3-month cycle. Created ${newPrice.id} ($${(t.cents / 100).toFixed(2)}) and archived legacy 1-month ${existingPrice.id}`,
          );
        }
      } else {
        // Price does not exist in Paddle yet. Create it under productId!
        if (!productId) {
          const createdProd = await pay(env, "/products", {
            method: "POST",
            body: JSON.stringify({
              name: plan.name,
              description: plan.tagline || plan.name,
              tax_category: "standard",
            }),
          });
          productId = createdProd?.data?.id;
        }

        if (!productId) {
          throw new Error(`Could not find or create product for plan "${plan.name}"`);
        }

        const newPriceRes = await pay(env, "/prices", {
          method: "POST",
          body: JSON.stringify({
            product_id: productId,
            name: t.name,
            description: t.description,
            unit_price: { amount: String(t.cents), currency_code: plan.currency.toUpperCase() },
            ...(t.billingCycle ? { billing_cycle: t.billingCycle } : {}),
          }),
        });

        const newPrice = newPriceRes?.data;
        if (!newPrice?.id) throw new Error("Paddle price creation failed");

        updatedPriceIds[t.field] = newPrice.id;
        done.push(
          `${t.label}: Created ${newPrice.id} ($${(t.cents / 100).toFixed(2)}) in Paddle (${env})`,
        );
      }
    } catch (err: any) {
      failed.push({
        id: t.label,
        reason: err?.message || "Paddle update failed",
      });
    }
  }

  // Update product title and description if product is known
  if (!productSynced && productId) {
    await pay(env, `/products/${productId}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: plan.name,
        description: plan.tagline || plan.name,
      }),
    }).catch(() => null);
    productSynced = true;
  }

  // If any price IDs were updated/migrated, persist them in Supabase plans table
  if (Object.keys(updatedPriceIds).length > 0) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
      await (supabaseAdmin as any)
        .from("plans")
        .update(updatedPriceIds)
        .eq("slug", plan.slug);
    } catch (dbErr: any) {
      console.warn("Could not save new price IDs to Supabase:", dbErr?.message);
    }
  }

  return { done, failed, env, updatedPriceIds };
}

export type PaddleTargetInspection = {
  key: "monthly" | "yearly" | "once";
  label: string;
  configuredId: string;
  expectedCents: number;
  currency: string;
  foundInPaddle: boolean;
  paddlePriceId?: string;
  paddleCents?: number;
  paddleCurrency?: string;
  paddleStatus?: string;
  billingCycle?: { interval: string; frequency: number } | null;
  status: "in_sync" | "desynced" | "not_found" | "error";
  message: string;
};

export type PaddlePlanInspection = {
  slug: string;
  name: string;
  activeEnv: Env;
  targets: PaddleTargetInspection[];
  overallStatus: "in_sync" | "desynced" | "not_found" | "not_configured";
};

/** Inspect real-time prices directly from the Paddle API. */
export const adminInspectPaddlePrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string().min(1),
        environment: z.enum(["sandbox", "live", "auto"]).default("auto"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<PaddlePlanInspection> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("plans")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error || !row) throw new Error("Plan not found");

    const plan = row as AdminPlan;
    const env: Env = data.environment === "auto" ? getActiveServerPaddleEnv() : data.environment;

    const list: { key: "monthly" | "yearly" | "once"; label: string; id: string | null; cents: number }[] = [
      { key: "monthly", label: "3-Month Subscription", id: plan.paddle_price_monthly, cents: plan.price_cents },
      { key: "yearly", label: "Yearly Subscription", id: plan.paddle_price_yearly, cents: plan.yearly_cents },
      { key: "once", label: "One-Time Pack", id: plan.paddle_price_once, cents: plan.once_cents },
    ];

    const targets: PaddleTargetInspection[] = [];

    for (const item of list) {
      if (!item.id) continue;
      const expectedCents = item.cents;
      try {
        const isPri = item.id.startsWith("pri_");
        const res = isPri
          ? await pay(env, `/prices/${encodeURIComponent(item.id)}`)
          : await pay(env, `/prices?external_id=${encodeURIComponent(item.id)}`);

        const price = isPri ? res?.data : res?.data?.[0];
        if (!price || !price.id) {
          targets.push({
            key: item.key,
            label: item.label,
            configuredId: item.id,
            expectedCents,
            currency: plan.currency,
            foundInPaddle: false,
            status: "not_found",
            message: `Not found in Paddle (${env}) catalog`,
          });
          continue;
        }

        const paddleCents = price.unit_price?.amount ? Number(price.unit_price.amount) : 0;
        const paddleCurrency = price.unit_price?.currency_code || plan.currency;
        const billingCycle = price.billing_cycle ?? null;

        const expectedCycle =
          item.key === "monthly"
            ? { interval: "month", frequency: 3 }
            : item.key === "yearly"
              ? { interval: "year", frequency: 1 }
              : null;

        const cycleMatches =
          (!expectedCycle && !billingCycle) ||
          (Boolean(expectedCycle) &&
            Boolean(billingCycle) &&
            billingCycle?.interval === expectedCycle?.interval &&
            billingCycle?.frequency === expectedCycle?.frequency);

        const inSync = paddleCents === expectedCents && cycleMatches;

        let message = "";
        if (inSync) {
          const cycleLabel = expectedCycle
            ? expectedCycle.frequency === 3
              ? "every 3 months"
              : "yearly"
            : "one-time";
          message = `In sync ($${(paddleCents / 100).toFixed(2)} ${paddleCurrency} ${cycleLabel})`;
        } else if (!cycleMatches && billingCycle?.frequency === 1 && billingCycle?.interval === "month") {
          message = `Desynced: Paddle has legacy 1-Month ($${(paddleCents / 100).toFixed(2)}/mo). Website requires 3-Month ($${(expectedCents / 100).toFixed(2)})`;
        } else {
          message = `Desynced: Paddle has $${(paddleCents / 100).toFixed(2)} ${paddleCurrency}, website has $${(expectedCents / 100).toFixed(2)} ${plan.currency}`;
        }

        targets.push({
          key: item.key,
          label: item.label,
          configuredId: item.id,
          expectedCents,
          currency: plan.currency,
          foundInPaddle: true,
          paddlePriceId: price.id,
          paddleCents,
          paddleCurrency,
          paddleStatus: price.status,
          billingCycle,
          status: inSync ? "in_sync" : "desynced",
          message,
        });
      } catch (err: any) {
        targets.push({
          key: item.key,
          label: item.label,
          configuredId: item.id,
          expectedCents,
          currency: plan.currency,
          foundInPaddle: false,
          status: "error",
          message: err?.message || "Paddle lookup failed",
        });
      }
    }

    let overallStatus: PaddlePlanInspection["overallStatus"] = "in_sync";
    if (targets.length === 0) {
      overallStatus = "not_configured";
    } else if (targets.some((t) => t.status === "desynced")) {
      overallStatus = "desynced";
    } else if (targets.some((t) => t.status === "not_found" || t.status === "error")) {
      overallStatus = "not_found";
    }

    return {
      slug: plan.slug,
      name: plan.name,
      activeEnv: env,
      targets,
      overallStatus,
    };
  });

/** Create or update one plan, and keep the payment catalog in step. */
export const adminSavePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => planSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
    const { error } = await (supabaseAdmin as any)
      .from("plans")
      .upsert({ ...data, updated_at: new Date().toISOString() }, { onConflict: "slug" });
    if (error) throw new Error(error.message);

    // Sync to active payment environment (live production or sandbox)
    const env = getActiveServerPaddleEnv();
    let sync: SyncResult = { done: [], failed: [], env };
    try {
      sync = await syncPlanToPaddle(data, env);
      // If active is live, also attempt sandbox as best effort
      if (env === "live") {
        try {
          await syncPlanToPaddle(data, "sandbox");
        } catch {
          // sandbox error should not affect live sync
        }
      }
    } catch (e: any) {
      sync = {
        done: [],
        failed: [{ id: "all", reason: e?.message || "Catalog unreachable" }],
        env,
      };
    }
    return { ok: true, sync };
  });

/** Re-send one plan's prices to the payment catalog on demand. */
export const adminSyncPlanPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string().min(1),
        environment: z.enum(["sandbox", "live", "auto"]).default("auto"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("plans")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("That plan no longer exists.");

    const env: Env = data.environment === "auto" ? getActiveServerPaddleEnv() : data.environment;
    return await syncPlanToPaddle(row as AdminPlan, env);
  });

/**
 * Automatically reconciles ALL plans against the active Paddle catalog:
 * Migrates deprecated 1-month prices to 3-month prices, archives obsolete prices,
 * updates amounts, and keeps Supabase synchronized.
 */
export const adminReconcileAllPaddlePrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("plans")
      .select("*")
      .neq("slug", "starter")
      .order("sort");
    if (error) throw new Error(error.message);

    const env = getActiveServerPaddleEnv();
    const results: Array<{ slug: string; name: string; sync: SyncResult }> = [];

    for (const row of rows ?? []) {
      try {
        const sync = await syncPlanToPaddle(row as AdminPlan, env);
        results.push({ slug: row.slug, name: row.name, sync });
      } catch (e: any) {
        results.push({
          slug: row.slug,
          name: row.name,
          sync: {
            done: [],
            failed: [{ id: row.slug, reason: e?.message || "Reconciliation failed" }],
            env,
          },
        });
      }
    }
    return { ok: true, env, results };
  });

/** Delete a plan; students on it fall back to Starter. */
export const adminDeletePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.slug === "starter") throw new Error("The Starter plan cannot be deleted.");
    const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
    const admin = supabaseAdmin as any;
    await admin.from("user_plans").update({ plan_slug: "starter" }).eq("plan_slug", data.slug);
    const { error } = await admin.from("plans").delete().eq("slug", data.slug);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const grantSchema = z.object({
  query: z.string().trim().min(2).max(200),
  slug: z.string().min(1),
  startsAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  reason: z.string().trim().max(500).default(""),
  overridesPaid: z.boolean().default(true),
});

async function exactStudent(admin: any, raw: string) {
  const q = raw.trim().toLowerCase();
  const { data: rows, error } = await admin
    .from("profiles")
    .select("id, full_name, email, username")
    .or(`email.eq.${q},username.eq.${q}`)
    .limit(2);
  if (error) throw new Error(error.message);
  if (!rows?.length) throw new Error(`No exact account matches “${raw.trim()}”. Check the full username or email.`);
  if (rows.length > 1) throw new Error("More than one account matched. Use the complete email address.");
  return rows[0];
}

/** Preview the exact account before granting access. */
export const adminFindGrantStudent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ query: z.string().trim().min(2).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
    const admin = supabaseAdmin as any;
    const student = await exactStudent(admin, data.query);
    const [{ data: paid }, { data: manual }] = await Promise.all([
      admin.from("user_plans").select("plan_slug, updated_at").eq("user_id", student.id).maybeSingle(),
      admin.from("manual_plan_grants").select("id, plan_slug, starts_at, expires_at, overrides_paid").eq("user_id", student.id).is("revoked_at", null).order("granted_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    return { student, paid: paid ?? null, manual: manual ?? null };
  });

/** Create a dated, audited manual access grant without changing a purchase. */
export const adminCreatePlanGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => grantSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
    const admin = supabaseAdmin as any;
    const target = await exactStudent(admin, data.query);
    if (data.expiresAt && new Date(data.expiresAt) <= new Date(data.startsAt)) {
      throw new Error("The expiry must be after the start date.");
    }
    const { error } = await admin.from("manual_plan_grants").insert({
      user_id: target.id,
      plan_slug: data.slug,
      starts_at: data.startsAt,
      expires_at: data.expiresAt,
      reason: data.reason,
      overrides_paid: data.overridesPaid,
      granted_by: (context as any).userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true, who: target.email ?? target.username ?? data.query };
  });

export type ManualPlanGrant = {
  id: string; user_id: string; plan_slug: string; starts_at: string; expires_at: string | null;
  reason: string; overrides_paid: boolean; granted_at: string; revoked_at: string | null;
  revoke_reason: string | null; student: { full_name: string; username: string; email: string } | null;
};

/** Recent manual-access history, including expired and revoked entries. */
export const adminListPlanGrants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
    const admin = supabaseAdmin as any;
    const { data, error } = await admin
      .from("manual_plan_grants")
      .select("id,user_id,plan_slug,starts_at,expires_at,reason,overrides_paid,granted_at,revoked_at,revoke_reason")
      .order("granted_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = [...new Set((data ?? []).map((row: any) => row.user_id))];
    const { data: people } = ids.length
      ? await admin.from("profiles").select("id,full_name,username,email").in("id", ids)
      : { data: [] };
    const byId = new Map((people ?? []).map((person: any) => [person.id, person]));
    return (data ?? []).map((row: any) => ({ ...row, student: byId.get(row.user_id) ?? null })) as ManualPlanGrant[];
  });

export const adminRevokePlanGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), reason: z.string().trim().max(500).default("") }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
    const { error } = await (supabaseAdmin as any).from("manual_plan_grants").update({
      revoked_at: new Date().toISOString(), revoked_by: (context as any).userId, revoke_reason: data.reason,
    }).eq("id", data.id).is("revoked_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
