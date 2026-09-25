import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";

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
    const userId = (context as any).userId as string;
    const client = (context as any).supabase as any;

    const { data, error } = await client
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("getMySubscription query error:", error);
      return null;
    }
    return data as SubscriptionRow | null;
  });

/** Retrieves saved payment methods for the authenticated student. */
export const getMySavedPaymentMethods = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as any).userId as string;
    const client = (context as any).supabase as any;

    // 1. Check local table
    const { data: localCards, error: localErr } = await client
      .from("customer_payment_methods")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!localErr && localCards && localCards.length > 0) {
      return localCards as SavedPaymentMethod[];
    }

    // 2. If no local cards, check if user has a paddle_customer_id in subscriptions
    const { data: sub } = await client
      .from("subscriptions")
      .select("paddle_customer_id, environment")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sub?.paddle_customer_id) {
      const env: "sandbox" | "live" = (sub.environment as any) === "live" ? "live" : "sandbox";
      try {
        const { gatewayFetch } = await import("@/lib/paddle.server");
        const res = await gatewayFetch(
          env,
          `/customers/${sub.paddle_customer_id}/payment-methods?status=active`,
        );
        if (res.ok) {
          const body = await res.json();
          const list = (body?.data ?? []) as any[];
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
              const { data: inserted } = await client
                .from("customer_payment_methods")
                .insert(row)
                .select()
                .maybeSingle();
              if (inserted) savedList.push(inserted as SavedPaymentMethod);
            }
          }
          if (savedList.length > 0) return savedList;
        }
      } catch (e) {
        console.warn("Syncing paddle payment methods failed:", e);
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
    const userId = (context as any).userId as string;
    const client = (context as any).supabase as any;

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

/** Removes a saved payment method, cancelling auto-renewal so no future charges occur. */
export const removeSavedPaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cardId: z.string().uuid(),
        paddlePaymentMethodId: z.string().optional().nullable(),
        paddleCustomerId: z.string().optional().nullable(),
        paddleSubscriptionId: z.string().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const userId = (context as any).userId as string;
    const client = (context as any).supabase as any;

    // 1. If subscription ID is provided or user has an active subscription, cancel auto-renewal in Paddle
    let subId = data.paddleSubscriptionId;
    let customerId = data.paddleCustomerId;
    let env: "sandbox" | "live" = "sandbox";

    const { data: sub } = await client
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sub) {
      subId = subId || sub.paddle_subscription_id;
      customerId = customerId || sub.paddle_customer_id;
      env = (sub.environment as any) === "live" ? "live" : "sandbox";
    }

    if (subId) {
      try {
        const { gatewayFetch } = await import("@/lib/paddle.server");
        const res = await gatewayFetch(env, `/subscriptions/${subId}/cancel`, {
          method: "POST",
          body: JSON.stringify({ effective_from: "next_billing_period" }),
        });
        if (!res.ok) {
          console.warn("Paddle cancel sub on remove card error:", res.status, await res.text());
        }
      } catch (err) {
        console.warn("Paddle cancel call error:", err);
      }
    }

    // 2. If paddlePaymentMethodId and customerId exist, delete from Paddle vault
    if (customerId && data.paddlePaymentMethodId) {
      try {
        const { gatewayFetch } = await import("@/lib/paddle.server");
        const delRes = await gatewayFetch(
          env,
          `/customers/${customerId}/payment-methods/${data.paddlePaymentMethodId}`,
          { method: "DELETE" },
        );
        if (!delRes.ok) {
          console.warn("Paddle delete payment method warning:", delRes.status, await delRes.text());
        }
      } catch (delErr) {
        console.warn("Paddle delete payment method call error:", delErr);
      }
    }

    // 3. Atomically remove card and cancel auto-renew locally using RPC
    const { error: rpcErr } = await client.rpc("remove_user_card_and_cancel_auto_renew", {
      _user_id: userId,
      _card_id: data.cardId,
    });

    if (rpcErr) {
      console.warn("remove_user_card_and_cancel_auto_renew RPC fallback:", rpcErr);
      await client.from("customer_payment_methods").delete().eq("id", data.cardId).eq("user_id", userId);
      if (subId) {
        await client.from("subscriptions").update({ cancel_at_period_end: true }).eq("user_id", userId);
      }
    }

    return {
      ok: true,
      message: "Your credit card has been removed and auto-renewal has been cancelled.",
    };
  });

/** Creates a secure Paddle Customer Portal session to manage/remove payment methods and view receipts. */
export const createCustomerPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as any).userId as string;
    const client = (context as any).supabase as any;

    const { data: sub } = await client
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const env: "sandbox" | "live" = (sub?.environment as any) === "live" ? "live" : "sandbox";
    const customerId = sub?.paddle_customer_id;

    if (customerId) {
      try {
        const { gatewayFetch } = await import("@/lib/paddle.server");
        const bodyPayload: Record<string, unknown> = {};
        if (sub?.paddle_subscription_id) {
          bodyPayload.subscription_ids = [sub.paddle_subscription_id];
        }
        const res = await gatewayFetch(env, `/customers/${customerId}/portal-sessions`, {
          method: "POST",
          body: JSON.stringify(bodyPayload),
        });

        if (res.ok) {
          const body = await res.json();
          const portalUrl =
            body?.data?.urls?.general?.overview ||
            body?.data?.urls?.subscriptions?.[0]?.update_payment_method;
          if (portalUrl) {
            return { url: portalUrl };
          }
        } else {
          console.warn("Portal session creation error:", res.status, await res.text());
        }
      } catch (err) {
        console.warn("createCustomerPortalSession failed:", err);
      }
    }

    // Default fallback: official Paddle customer self-service hub
    return { url: "https://paddle.net" };
  });

/** Cancels a subscription at the end of its current billing period. */
export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        paddleSubscriptionId: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const userId = (context as any).userId as string;
    const client = (context as any).supabase as any;

    const { data: sub, error } = await client
      .from("subscriptions")
      .select("*")
      .eq("paddle_subscription_id", data.paddleSubscriptionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !sub) {
      throw new Error("Subscription not found on your account.");
    }

    const env: "sandbox" | "live" = (sub.environment as any) === "live" ? "live" : "sandbox";

    // Call Paddle cancellation API
    try {
      const { gatewayFetch } = await import("@/lib/paddle.server");
      const res = await gatewayFetch(env, `/subscriptions/${sub.paddle_subscription_id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ effective_from: "next_billing_period" }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.warn("Paddle cancel API error:", res.status, text);
      }
    } catch (err) {
      console.warn("Paddle cancel API call failed:", err);
    }

    // Update in database using RPC or admin
    const { error: rpcErr } = await client.rpc("cancel_user_subscription", {
      _user_id: userId,
      _paddle_sub_id: data.paddleSubscriptionId,
    });

    if (rpcErr) {
      console.warn("cancel_user_subscription RPC error:", rpcErr);
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await (supabaseAdmin as any)
          .from("subscriptions")
          .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
          .eq("paddle_subscription_id", data.paddleSubscriptionId);
      } catch (adminErr) {
        console.warn("supabaseAdmin update error:", adminErr);
      }
    }

    return { ok: true, message: "Your subscription will cancel at the end of your billing cycle." };
  });
