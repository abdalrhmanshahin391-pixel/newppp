import { test } from "node:test";
import assert from "node:assert/strict";
import { planBillingMonths, periodSuffix, periodWords } from "./plan-billing.ts";

test("a plan renews every month only when it says 1; anything else is the older 3 months", () => {
  assert.equal(planBillingMonths({ billing_months: 1 }), 1);
  assert.equal(planBillingMonths({ billing_months: 3 }), 3);
  assert.equal(planBillingMonths({}), 3);
  assert.equal(planBillingMonths(null), 3);
  assert.equal(periodSuffix({ billing_months: 1 }), "/month");
  assert.equal(periodSuffix({}), "/3 months");
  assert.deepEqual(periodWords({ billing_months: 1 }), {
    charge: "per month",
    renews: "every month",
  });
});
