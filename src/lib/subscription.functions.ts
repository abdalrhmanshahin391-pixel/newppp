import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
type BillingClient = SupabaseClient;
type PaddleSavedMethod = {
  id: string;
  card?: {
    type?: string;
    last4?: string;
    expiry_month?: number;
    expiry_year?: number;
    cardholder_name?: string;
  };
};
import {
  applyBillingChange,
  confirmCancellation,
  confirmCardRemoval,
} from "./subscription-management";

export type SubscriptionRow = {
  id: string;
  user_id: string;
  paddle_subscription_id: string;
  paddle_customer_id: string | null;
  product_id: string | null;
  price_id: string | null;
  plan_slug: string | null;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  environment: string;
  created_at: string;
  updated_at: string;
};

export type SavedPaymentMethod = {
  id: string;
  user_id: string;
  paddle_customer_id: string | null;
  paddle_payment_method_id: string | null;
  card_brand: string;
  card_last4: string;
  card_exp_month: number | null;
  card_exp_year: number | null;
  cardholder_name: string | null;
  environment: string;
  created_at: string;
};

/** Retrieves the authenticated student's latest subscription. */
export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const client = context.supabase;

    const { data, error } = await client
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("getMySubscription query error:", error);
      throw new Error("Could not load your subscription.");
    }
    return data as SubscriptionRow | null;
  });

/** Retrieves saved payment methods for the authenticated student. */
export const getMySavedPaymentMethods = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const client = context.supabase;

    // 1. Check local table
    const { data: localCards, error: localErr } = await client
      .from("customer_payment_methods")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (localErr) throw new Error("Could not load your saved payment methods.");
    if (localCards && localCards.length > 0) {
      return localCards as SavedPaymentMethod[];
    }

    // 2. If no local cards, check if user has a paddle_customer_id in subscriptions
    const { data: sub, error: subError } = await client
      .from("subscriptions")
      .select("paddle_customer_id, environment")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) throw new Error("Could not check your saved payment methods.");
    if (sub?.paddle_customer_id) {
      const env: "sandbox" | "live" = sub.environment === "live" ? "live" : "sandbox";
      try {
        const { gatewayFetch } = await import("@/lib/paddle.server");
        const res = await gatewayFetch(
          env,
          `/customers/${sub.paddle_customer_id}/payment-methods?status=active`,
          { signal: AbortSignal.timeout(15_000) },
        );
        if (!res.ok) throw new Error("Could not load saved payment methods from Paddle.");
        if (res.ok) {
          const body = await res.json();
          const list = (body?.data ?? []) as PaddleSavedMethod[];
          const savedList: SavedPaymentMethod[] = [];

          for (const item of list) {
            const cardObj = item?.card;
            if (cardObj) {
              const row = {
                user_id: userId,
                paddle_customer_id: sub.paddle_customer_id,
                paddle_payment_method_id: item.id,
                card_brand: cardObj.type || "card",
                card_last4: cardObj.last4 || "••••",
                card_exp_month: cardObj.expiry_month || null,
                card_exp_year: cardObj.expiry_year || null,
                cardholder_name: cardObj.cardholder_name || null,
                environment: env,
              };
              const { data: inserted, error: insertError } = await client
                .from("customer_payment_methods")
                .insert(row)
                .select()
                .maybeSingle();
              if (insertError) throw new Error("Could not update saved payment methods.");
              if (inserted) savedList.push(inserted as SavedPaymentMethod);
            }
          }
          if (savedList.length > 0) return savedList;
        }
      } catch (e) {
        console.warn("Syncing paddle payment methods failed:", e);
        throw new Error("Could not load your saved payment methods. Please try again.");
      }
    }

    return (localCards ?? []) as SavedPaymentMethod[];
  });

/** Saves or records a credit card used at checkout. */
export const saveCheckoutPaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cardBrand: z.string().default("card"),
        cardLast4: z.string().min(1).max(10),
        cardExpMonth: z.number().int().optional().nullable(),
        cardExpYear: z.number().int().optional().nullable(),
        cardholderName: z.string().optional().nullable(),
        customerId: z.string().optional().nullable(),
        paymentMethodId: z.string().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const client = context.supabase;

    const row = {
      user_id: userId,
      paddle_customer_id: data.customerId || null,
      paddle_payment_method_id: data.paymentMethodId || null,
      card_brand: data.cardBrand.toLowerCase(),
      card_last4: data.cardLast4,
      card_exp_month: data.cardExpMonth || null,
      card_exp_year: data.cardExpYear || null,
      cardholder_name: data.cardholderName || null,
      updated_at: new Date().toISOString(),
    };

    // Upsert or insert card
    const { data: saved, error } = await client
      .from("customer_payment_methods")
      .insert(row)
      .select()
      .maybeSingle();

    if (error) {
      console.warn("saveCheckoutPaymentMethod insert error:", error);
    }
    return { ok: true, card: saved };
  });

/** Card rows are user-editable, so their provider IDs are not an ownership proof. */
async function assertOwnedBillingCustomer(
  client: BillingClient,
  userId: string,
  customerId: string,
  environment: "live" | "sandbox",
) {
  const linked = await client
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("paddle_customer_id", customerId)
    .eq("environment", environment)
    .limit(1)
    .maybeSingle();
  if (linked.error) throw new Error("Could not verify your billing account.");
  if (linked.data) return;
  // One-time buyers may have no subscription mapping. Match a current verified
  // auth email against Paddle, never an editable profile or request field.
  const auth = await client.auth.getUser();
  const user = auth.data?.user;
  if (auth.error || user?.id !== userId || !user.email_confirmed_at || !user.email)
    throw new Error("Could not verify your billing account.");
  const { gatewayFetch } = await import("@/lib/paddle.server");
  const response = await gatewayFetch(environment, `/customers/${encodeURIComponent(customerId)}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Could not verify your billing account.");
  const body = await response.json();
  if (
    typeof body?.data?.email !== "string" ||
    body.data.email.trim().toLowerCase() !== user.email.trim().toLowerCase()
  )
    throw new Error("Billing account not found on your account.");
}

/** Sync a confirmed provider cancellation using the existing user-scoped RPC. */
async function syncCancellation(client: BillingClient, userId: string, sub: SubscriptionRow) {
  const { error } = await client.rpc("cancel_user_subscription", {
    _user_id: userId,
    _paddle_sub_id: sub.paddle_subscription_id,
  });
  if (!error) return;
  const result = await client
    .from("subscriptions")
    .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
    .eq("id", sub.id)
    .eq("user_id", userId)
    .select("id")
    .single();
  if (result.error) throw new Error("Subscription display update is pending.");
}

export const removeSavedPaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ cardId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const client = context.supabase;
    // All provider identifiers come from the authenticated owner's stored records.
    const owned = await client
      .from("customer_payment_methods")
      .select("*")
      .eq("id", data.cardId)
      .eq("user_id", userId)
      .maybeSingle();
    if (owned.error || !owned.data)
      throw new Error("Saved payment method not found on your account.");
    const card = owned.data as SavedPaymentMethod;
    const result = await client
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (result.error) throw new Error("Could not check your subscription.");
    const sub = result.data as SubscriptionRow | null;
    const { gatewayFetch } = await import("@/lib/paddle.server");
    const subEnv = sub?.environment === "live" ? "live" : "sandbox";
    const cardEnv = card.environment === "live" ? "live" : "sandbox";
    if (card.paddle_customer_id && card.paddle_payment_method_id)
      await assertOwnedBillingCustomer(client, userId, card.paddle_customer_id, cardEnv);
    const renews = sub && sub.status !== "canceled";
    return applyBillingChange({
      ...(renews
        ? {
            cancelRenewal: () =>
              confirmCancellation(
                (path, init) => gatewayFetch(subEnv, path, init),
                sub.paddle_subscription_id,
              ),
            syncCancellation: () => syncCancellation(client, userId, sub),
          }
        : {}),
      removeCard:
        card.paddle_customer_id && card.paddle_payment_method_id
          ? () =>
              confirmCardRemoval(
                (path, init) => gatewayFetch(cardEnv, path, init),
                card.paddle_customer_id!,
                card.paddle_payment_method_id!,
              )
          : undefined,
      syncCardRemoval: async () => {
        const deleted = await client
          .from("customer_payment_methods")
          .delete()
          .eq("id", card.id)
          .eq("user_id", userId);
        if (deleted.error) throw new Error("Card display update is pending.");
      },
    });
  });

/** Fresh authenticated portal sessions are created only when the user opens billing. */
export const createCustomerPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const client = context.supabase;
    const result = await client
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (result.error) throw new Error("Could not load billing details.");
    const sub = result.data as SubscriptionRow | null;
    let customerId = sub?.paddle_customer_id;
    let environment = sub?.environment;
    if (!customerId) {
      const card = await client
        .from("customer_payment_methods")
        .select("paddle_customer_id, environment")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (card.error) throw new Error("Could not load billing details.");
      customerId = card.data?.paddle_customer_id;
      environment = card.data?.environment;
    }
    if (!customerId) return { url: "https://paddle.net" };
    await assertOwnedBillingCustomer(
      client,
      userId,
      customerId,
      environment === "live" ? "live" : "sandbox",
    );
    const { gatewayFetch } = await import("@/lib/paddle.server");
    const response = await gatewayFetch(
      environment === "live" ? "live" : "sandbox",
      `/customers/${encodeURIComponent(customerId)}/portal-sessions`,
      {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify(
          sub?.paddle_subscription_id ? { subscription_ids: [sub.paddle_subscription_id] } : {},
        ),
      },
    );
    if (!response.ok) throw new Error("Could not open the payment portal.");
    const body = await response.json();
    const url =
      body?.data?.urls?.general?.overview ||
      body?.data?.urls?.subscriptions?.[0]?.update_payment_method;
    if (typeof url !== "string" || !url.startsWith("https://"))
      throw new Error("Could not open the payment portal.");
    return { url };
  });

/** Stop renewal at period end only after Paddle confirms the change. */
export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ paddleSubscriptionId: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const client = context.supabase;
    const result = await client
      .from("subscriptions")
      .select("*")
      .eq("paddle_subscription_id", data.paddleSubscriptionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (result.error || !result.data) throw new Error("Subscription not found on your account.");
    const sub = result.data as SubscriptionRow;
    const { gatewayFetch } = await import("@/lib/paddle.server");
    const env = sub.environment === "live" ? "live" : "sandbox";
    return applyBillingChange({
      cancelRenewal: () =>
        confirmCancellation(
          (path, init) => gatewayFetch(env, path, init),
          sub.paddle_subscription_id,
        ),
      syncCancellation: () => syncCancellation(client, userId, sub),
    });
  });
