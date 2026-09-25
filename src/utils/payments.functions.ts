import { createServerFn } from "@tanstack/react-start";
import { gatewayFetch, type PaddleEnv } from "@/lib/paddle.server";

export type ResolvedPrice =
  | {
      ok: true;
      paddlePriceId: string;
      environment: PaddleEnv;
      amountCents?: number;
      currency?: string;
    }
  | { ok: false; error: string };

async function lookup(
  environment: PaddleEnv,
  priceId: string,
): Promise<{ id: string; amountCents?: number; currency?: string } | null> {
  try {
    const isPri = priceId.startsWith("pri_");
    const endpoint = isPri
      ? `/prices/${encodeURIComponent(priceId)}`
      : `/prices?external_id=${encodeURIComponent(priceId)}`;
    const response = await gatewayFetch(environment, endpoint);
    const bodyText = await response.text();
    if (!response.ok) {
      console.error(
        `Payments lookup failed (${response.status}) in ${environment}: ${bodyText.slice(0, 200)}`,
      );
      return null;
    }
    const result = JSON.parse(bodyText) as { data?: any };
    const price = isPri ? result.data : result.data?.[0];
    if (!price?.id) return null;
    const amountStr = price.unit_price?.amount;
    const amountCents = amountStr ? Number(amountStr) : undefined;
    const currency = price.unit_price?.currency_code;
    return { id: price.id, amountCents, currency };
  } catch (error) {
    console.error(`Payments lookup crashed in ${environment}:`, error);
    return null;
  }
}

/**
 * Resolves our human-readable price id to the provider's internal id.
 * Never throws: the checkout page shows a calm message instead of breaking.
 */
export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator((data: { priceId: string; environment: PaddleEnv }) => data)
  .handler(async ({ data }): Promise<ResolvedPrice> => {
    // If it's already a pri_ ID, also fetch its live details from Paddle
    if (data.priceId.startsWith("pri_")) {
      const details = await lookup(data.environment, data.priceId);
      return {
        ok: true,
        paddlePriceId: data.priceId,
        environment: data.environment,
        amountCents: details?.amountCents,
        currency: details?.currency,
      };
    }

    const first = await lookup(data.environment, data.priceId);
    if (first) {
      return {
        ok: true,
        paddlePriceId: first.id,
        environment: data.environment,
        amountCents: first.amountCents,
        currency: first.currency,
      };
    }

    // In sandbox, allow looking up live catalog if sandbox prices are missing.
    // In live production, strictly keep checkout in live mode.
    if (data.environment === "sandbox") {
      const fallback = await lookup("live", data.priceId);
      if (fallback) {
        return {
          ok: true,
          paddlePriceId: fallback.id,
          environment: "live",
          amountCents: fallback.amountCents,
          currency: fallback.currency,
        };
      }
    }

    return {
      ok: false,
      error: "This plan is not on sale yet. Please try again in a few minutes or contact support.",
    };
  });
