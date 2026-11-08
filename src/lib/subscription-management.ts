export type BillingChangeResult = {
  ok: boolean;
  code?: "provider_failed" | "card_failed" | "sync_pending";
  renewalStopped: boolean;
  cardRemoved: boolean;
};

/** Provider confirmation always precedes local changes; partial outcomes stay explicit. */
export async function applyBillingChange(steps: {
  cancelRenewal?: () => Promise<void>;
  syncCancellation?: () => Promise<void>;
  removeCard?: () => Promise<void>;
  syncCardRemoval?: () => Promise<void>;
}): Promise<BillingChangeResult> {
  const result: BillingChangeResult = { ok: false, renewalStopped: false, cardRemoved: false };
  if (steps.cancelRenewal) {
    try {
      await steps.cancelRenewal();
      result.renewalStopped = true;
    } catch {
      return { ...result, code: "provider_failed" };
    }
    try {
      await steps.syncCancellation?.();
    } catch {
      return { ...result, code: "sync_pending" };
    }
  }
  if (steps.removeCard) {
    try {
      await steps.removeCard();
      result.cardRemoved = true;
    } catch {
      return { ...result, code: "card_failed" };
    }
  }
  try {
    await steps.syncCardRemoval?.();
    if (steps.syncCardRemoval) result.cardRemoved = true;
  } catch {
    return { ...result, code: "sync_pending" };
  }
  return { ...result, ok: true };
}

type ProviderFetch = (path: string, init?: RequestInit) => Promise<Response>;
/** An uncertain POST is confirmed by reading provider state, making retries safe. */
export async function confirmCancellation(fetchProvider: ProviderFetch, subscriptionId: string) {
  try {
    const response = await fetchProvider(
      `/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
      {
        method: "POST",
        body: JSON.stringify({ effective_from: "next_billing_period" }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (response.ok) return;
  } catch {
    /* A timeout can happen after the provider applied the change. */
  }
  const response = await fetchProvider(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (response.ok) {
    const { data } = await response.json();
    if (data?.status === "canceled" || data?.scheduled_change?.action === "cancel") return;
  }
  throw new Error("Cancellation was not confirmed by Paddle.");
}
export async function confirmCardRemoval(
  fetchProvider: ProviderFetch,
  customerId: string,
  methodId: string,
) {
  const response = await fetchProvider(
    `/customers/${encodeURIComponent(customerId)}/payment-methods/${encodeURIComponent(methodId)}`,
    {
      method: "DELETE",
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok && response.status !== 404)
    throw new Error("Card removal was not confirmed by Paddle.");
}
