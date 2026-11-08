import assert from "node:assert/strict";
import test from "node:test";
import {
  matchingSettings,
  settingsAllowance,
  settingsDate,
  settingsSection,
  SETTINGS_METERS,
} from "./settings.ts";
import type { PlanUsage } from "./plans.functions";

test("settings search finds destinations in either language and rejects unknown sections", () => {
  assert.deepEqual(matchingSettings("كلمة السر"), ["security"]);
  assert.deepEqual(matchingSettings("فاتورة"), ["billing"]);
  assert.deepEqual(matchingSettings("password"), ["security"]);
  assert.deepEqual(matchingSettings("receipt"), ["billing"]);
  assert.deepEqual(matchingSettings("nothing-like-this"), []);
  assert.equal(settingsSection("billing"), "billing");
  assert.equal(settingsSection(["billing"]), "account");
  assert.equal(settingsSection("__proto__"), "account");
});
test("zero, unknown and unlimited allowances stay distinct, with packs added once", () => {
  const input = (cap: number | null | undefined, extra = 0, used = 0) =>
    ({
      plan: { max_flashcards: cap },
      grants: { flashcards: extra },
      usage: { flashcards: used },
      is_admin: false,
    }) as unknown as PlanUsage;
  assert.equal(settingsAllowance(input(0), SETTINGS_METERS[0]).total, 0);
  assert.equal(settingsAllowance(input(undefined), SETTINGS_METERS[0]).total, undefined);
  assert.equal(settingsAllowance(input(null), SETTINGS_METERS[0]).total, null);
  const result = settingsAllowance(input(10, 5, 18), SETTINGS_METERS[0]);
  assert.equal(result.total, 15);
  assert.equal(result.left, 0);
  assert.equal(result.percent, 100);
  assert.equal(settingsDate("invalid", "ar"), null);
  assert.equal(settingsDate(null, "en"), null);
});
