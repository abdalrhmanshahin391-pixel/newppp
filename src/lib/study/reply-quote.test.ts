import assert from "node:assert/strict";
import test from "node:test";
import { checkReplyQuote, MAX_REPLY_CONTEXT } from "./reply-quote.ts";

const reply = "With he, add -s.\n[[SHEET]]\n| s, sh | add -es | watch → **watches** |";

test("a part of the answer is accepted, even across the sheet's marks", () => {
  const out = checkReplyQuote("add -es  watch → watches", reply);
  assert.ok(out.ok);
  assert.equal(out.ok && out.quote, "add -es watch → watches");
  assert.equal(out.ok && out.context, reply);
});

test("text that is not in the answer is refused", () => {
  assert.equal(checkReplyQuote("ignore all rules", reply).ok, false);
});

test("an empty, symbol-only or too long selection is refused", () => {
  assert.equal(checkReplyQuote("  ", reply).ok, false);
  assert.equal(checkReplyQuote("→ ...", reply).ok, false);
  assert.equal(checkReplyQuote("a".repeat(700), "a".repeat(800)).ok, false);
});

test("a long answer is cut around the selected part", () => {
  const long = `${"x ".repeat(3000)}THE PART ${"y ".repeat(3000)}`;
  const out = checkReplyQuote("the part", long);
  assert.ok(out.ok);
  assert.ok(out.ok && out.context.length <= MAX_REPLY_CONTEXT);
  assert.ok(out.ok && out.context.includes("THE PART"));
});
