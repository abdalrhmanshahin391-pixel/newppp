import { useEffect, useRef, useState, useCallback } from "react";
import {
  initializePaddle,
  getPaddlePriceId,
  addPaddleEventListener,
  type PayEnv,
} from "@/lib/paddle";

export type CheckoutStatus =
  | "idle"
  | "loading"
  | "loaded"
  | "closed"
  | "completed"
  | "error";

export type PaymentMethodSelection = "all" | "card_only" | "card_and_paypal";

export interface OpenCheckoutOptions {
  priceId: string;
  customerEmail?: string;
  customData?: Record<string, string>;
  successUrl?: string;
  discountCode?: string;
  frameTarget?: string;
  displayMode?: "inline" | "overlay";
  /** Payment method restriction. "card_only" strictly allows only credit/debit cards. */
  methodRestriction?: PaymentMethodSelection;
  /** Backwards compatible alias */
  cardsOnly?: boolean;
}

export function usePaddleCheckout() {
  const [status, setStatus] = useState<CheckoutStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const activeSessionRef = useRef<number>(0);

  // Subscribe to global Paddle event bus
  useEffect(() => {
    const unsubscribe = addPaddleEventListener((event) => {
      const name = event.name;
      const data = event.data;

      if (name === "checkout.loaded") {
        setStatus("loaded");
        setError(null);
      } else if (name === "checkout.closed") {
        setStatus("closed");
      } else if (name === "checkout.completed") {
        setStatus("completed");
        try {
          const p = data?.payment || data?.payments?.[0];
          const details = p?.method_details;
          const card = details?.card;
          const customerId = data?.customer?.id || data?.customerId || data?.customer_id;
          const paymentMethodId = p?.payment_method_id || p?.paymentMethodId;
          if (card || details?.type === "card") {
            const cardInfo = {
              cardBrand: card?.type || details?.type || "card",
              cardLast4: card?.last4 || "4242",
              cardExpMonth: card?.expiry_month || null,
              cardExpYear: card?.expiry_year || null,
              cardholderName: card?.cardholder_name || null,
              customerId: customerId || null,
              paymentMethodId: paymentMethodId || null,
            };
            if (typeof window !== "undefined" && window.sessionStorage) {
              window.sessionStorage.setItem("rita_last_payment_method", JSON.stringify(cardInfo));
            }
          }
        } catch (e) {
          console.warn("Could not cache checkout payment method in session:", e);
        }
      } else if (name === "checkout.error") {
        setStatus("error");
        console.warn("Paddle checkout.error event payload:", data);
        const msg =
          data?.error?.message ||
          data?.detail ||
          data?.error?.detail ||
          data?.message ||
          (typeof data?.error === "string" ? data.error : null) ||
          "Paddle encountered an error opening the payment form. Please try again or select card payment.";
        setError(msg);
      } else if (name === "checkout.payment.failed") {
        console.warn("Paddle checkout.payment.failed event payload:", data);
        const msg =
          data?.error?.message ||
          data?.error?.detail ||
          data?.detail ||
          data?.message ||
          "Payment was declined or cancelled. Please check your card details or try another method.";
        setError(msg);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const openCheckout = useCallback(async (options: OpenCheckoutOptions) => {
    const sessionId = ++activeSessionRef.current;
    setStatus("loading");
    setError(null);

    try {
      const { paddlePriceId, environment } = await getPaddlePriceId(options.priceId);
      await initializePaddle(environment);

      if (activeSessionRef.current !== sessionId) return;

      const targetEl =
        options.frameTarget && typeof document !== "undefined"
          ? (document.getElementsByClassName(options.frameTarget)[0] as HTMLElement | undefined)
          : undefined;
      const hasTarget = !!targetEl;

      // Use inline if requested and target exists; otherwise overlay
      const isInline = options.displayMode === "inline" || (!options.displayMode && hasTarget);

      if (isInline && !hasTarget) {
        throw new Error("Payment container is not ready. Please refresh the page.");
      }

      // Container Hygiene: Clean out any previous stale iframe to prevent DOM collisions on PC
      if (isInline && targetEl) {
        targetEl.innerHTML = "";
      }

      // Strictly map allowedPaymentMethods based on user's choice
      let allowedPaymentMethods: string[] | undefined = undefined;
      if (options.cardsOnly || options.methodRestriction === "card_only") {
        allowedPaymentMethods = ["card"];
      } else if (options.methodRestriction === "card_and_paypal") {
        allowedPaymentMethods = ["card", "paypal"];
      }
      // If "all" or omitted, allowedPaymentMethods remains undefined so Paddle decides based on dashboard & device.

      window.Paddle.Checkout.open({
        items: [{ priceId: paddlePriceId, quantity: 1 }],
        customer: options.customerEmail ? { email: options.customerEmail } : undefined,
        customData: options.customData,
        discountCode: options.discountCode || undefined,
        settings: {
          displayMode: isInline ? "inline" : "overlay",
          ...(isInline && options.frameTarget
            ? {
                frameTarget: options.frameTarget,
                frameInitialHeight: 460,
                frameStyle:
                  "width:100%; max-width:100%; background-color:transparent; border:none;",
              }
            : {}),
          successUrl: options.successUrl || `${window.location.origin}/pricing?checkout=success`,
          allowLogout: false,
          showAddTaxId: false,
          showAddDiscounts: false,
          variant: "one-page",
          ...(allowedPaymentMethods ? { allowedPaymentMethods } : {}),
        },
      });
    } catch (err: any) {
      if (activeSessionRef.current === sessionId) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Could not open checkout.");
        throw err;
      }
    }
  }, []);

  const closeCheckout = useCallback(() => {
    try {
      window.Paddle?.Checkout?.close?.();
      setStatus("closed");
    } catch {
      /* nothing open */
    }
  }, []);

  return {
    openCheckout,
    closeCheckout,
    status,
    loading: status === "loading",
    isLoaded: status === "loaded",
    isClosed: status === "closed",
    isCompleted: status === "completed",
    error,
  };
}
