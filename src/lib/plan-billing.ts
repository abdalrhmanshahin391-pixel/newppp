/**
 * How often a plan's subscription renews, from `plans.billing_months`: Uzyra every month, the
 * older plans every 3 months (the column's default). Pure, so the pricing page, the checkout and
 * the Paddle sync read it the same way.
 */
export function planBillingMonths(plan: unknown): 1 | 3 {
  return Number((plan as { billing_months?: unknown } | null)?.billing_months) === 1 ? 1 : 3;
}

/** The price's period after the amount: "/month" or "/3 months". */
export function periodSuffix(plan: unknown): string {
  return planBillingMonths(plan) === 1 ? "/month" : "/3 months";
}

/** The checkout's words for the period: "per month" or "for 3 months". */
export function periodWords(plan: unknown): { charge: string; renews: string } {
  return planBillingMonths(plan) === 1
    ? { charge: "per month", renews: "every month" }
    : { charge: "for 3 months", renews: "every 3 months" };
}
