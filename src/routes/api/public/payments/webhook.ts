import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhook, EventName, type PaddleEnv } from "@/lib/paddle.server";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"]!;
    const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !key) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for payment webhook");
    }
    _supabase = createClient(url, key, { auth: { persistSession: false } });
  }
  return _supabase;
}

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

/** Finds the plan a purchased price belongs to, by its price id or slug. */
async function planForPrice(priceId?: string | null, planSlug?: string | null) {
  const db = getSupabase();
  if (planSlug) {
    const { data } = await (db as any)
      .from("plans")
      .select("*")
      .eq("slug", planSlug)
      .maybeSingle();
    if (data) return data as Record<string, any>;
  }
  if (!priceId) return null;
  const { data } = await (db as any)
    .from("plans")
    .select("*")
    .or(
      `paddle_price_monthly.eq.${priceId},paddle_price_yearly.eq.${priceId},paddle_price_once.eq.${priceId}`,
    )
    .maybeSingle();
  return data as Record<string, any> | null;
}

async function putOnPlan(userId: string, slug: string) {
  const db = getSupabase();
  const { error } = await (db as any).rpc("activate_user_plan", { _user_id: userId, _plan_slug: slug });
  if (error) {
    console.warn("RPC activate_user_plan error, trying direct upsert:", error);
    await (db as any)
      .from("user_plans")
      .upsert({ user_id: userId, plan_slug: slug, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  }
}

/** A one-time pack: add its allowances on top of whatever the student had. */
async function grantPack(
  userId: string,
  plan: Record<string, any>,
  transactionId: string,
  env: PaddleEnv,
) {
  const row: Record<string, unknown> = {
    user_id: userId,
    plan_slug: plan.slug,
    transaction_id: transactionId,
    environment: env,
  };
  for (const [grantCol, planCol] of GRANT_COLUMNS) {
    row[grantCol] = Number(plan[planCol] ?? 0);
  }
  // transaction_id is unique, so a replayed event cannot grant credits twice.
  await (getSupabase() as any)
    .from("plan_credit_grants")
    .upsert(row, { onConflict: "transaction_id", ignoreDuplicates: true });
  await putOnPlan(userId, plan.slug);
}

async function recordWebhookPaymentMethod(userId: string, data: any, env: PaddleEnv) {
  try {
    const payment = data?.payments?.[0] || data?.payment;
    const details = payment?.method_details;
    const card = details?.card;
    const customerId = data?.customerId || data?.customer_id;
    const paymentMethodId = payment?.payment_method_id || payment?.paymentMethodId;

    if (card && (details?.type === "card" || details?.type === "apple_pay" || card?.last4)) {
      const db = getSupabase();
      await (db as any).from("customer_payment_methods").insert({
        user_id: userId,
        paddle_customer_id: customerId || null,
        paddle_payment_method_id: paymentMethodId || null,
        card_brand: (card.type || "card").toLowerCase(),
        card_last4: card.last4 || "••••",
        card_exp_month: card.expiry_month || null,
        card_exp_year: card.expiry_year || null,
        cardholder_name: card.cardholder_name || null,
        environment: env,
      });
    }
  } catch (err) {
    console.warn("recordWebhookPaymentMethod error:", err);
  }
}

async function handleTransactionCompleted(data: any, env: PaddleEnv) {
  const userId = data?.customData?.userId;
  if (!userId) return;
  const item = data?.items?.[0];
  const priceId = item?.price?.id || item?.price?.importMeta?.externalId;
  const planSlug = data?.customData?.planSlug;

  const plan = await planForPrice(priceId, planSlug);
  const targetSlug = planSlug || plan?.slug;
  if (!targetSlug) return;

  if (plan?.billing_kind === "lifetime") {
    await grantPack(userId, plan, data.id, env);
  } else {
    await putOnPlan(userId, targetSlug);
  }

  await recordWebhookPaymentMethod(userId, data, env);
}

async function handleSubscriptionCreated(data: any, env: PaddleEnv) {
  const userId = data?.customData?.userId;
  const item = data?.items?.[0];
  const priceId = item?.price?.id || item?.price?.importMeta?.externalId;
  const productId = item?.product?.id || item?.product?.importMeta?.externalId;
  const planSlug = data?.customData?.planSlug;
  if (!userId) return;

  const plan = await planForPrice(priceId, planSlug);
  const targetSlug = planSlug || plan?.slug;

  await (getSupabase() as any).from("subscriptions").upsert(
    {
      user_id: userId,
      paddle_subscription_id: data.id,
      paddle_customer_id: data.customerId,
      product_id: productId ?? null,
      price_id: priceId ?? null,
      plan_slug: targetSlug ?? null,
      status: data.status,
      current_period_start: data.currentBillingPeriod?.startsAt,
      current_period_end: data.currentBillingPeriod?.endsAt,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "paddle_subscription_id" },
  );

  if (targetSlug) await putOnPlan(userId, targetSlug);

  await recordWebhookPaymentMethod(userId, data, env);
}

async function handleSubscriptionUpdated(data: any, env: PaddleEnv) {
  await (getSupabase() as any)
    .from("subscriptions")
    .update({
      status: data.status,
      current_period_start: data.currentBillingPeriod?.startsAt,
      current_period_end: data.currentBillingPeriod?.endsAt,
      cancel_at_period_end: data.scheduledChange?.action === "cancel",
      updated_at: new Date().toISOString(),
    })
    .eq("paddle_subscription_id", data.id)
    .eq("environment", env);
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  const db = getSupabase() as any;
  await db
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("paddle_subscription_id", data.id)
    .eq("environment", env);

  const userId = data?.customData?.userId;
  if (userId) await putOnPlan(userId, "starter");
}

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.eventType) {
    case EventName.TransactionCompleted:
      await handleTransactionCompleted(event.data, env);
      break;
    case EventName.SubscriptionCreated:
      await handleSubscriptionCreated(event.data, env);
      break;
    case EventName.SubscriptionUpdated:
      await handleSubscriptionUpdated(event.data, env);
      break;
    case EventName.SubscriptionCanceled:
      await handleSubscriptionCanceled(event.data, env);
      break;
    default:
      console.log("Unhandled payments event:", event.eventType);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get("env") || "sandbox") as PaddleEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Payments webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
