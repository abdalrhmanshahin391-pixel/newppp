import assert from "node:assert/strict";
import test from "node:test";
import { languageCookie, languageFromCookie } from "./ui-language.ts";

test("SSR selects only the explicit UI language cookie", () => {
  assert.equal(languageFromCookie("session=secret; ysmu-lang=ar; other=1"), "ar");
  assert.equal(languageFromCookie("ysmu-lang=en"), "en");
  assert.equal(languageFromCookie("not-ysmu-lang=ar"), null);
  assert.equal(languageFromCookie("ysmu-lang=de"), null);
  assert.equal(languageFromCookie(undefined), null);
});

test("the preference survives reloads and works on HTTPS and local development", () => {
  const https = languageCookie("ar", true);
  assert.equal(languageFromCookie(https), "ar");
  assert.match(https, /Path=\/; Max-Age=31536000; SameSite=Lax; Secure$/);
  assert.doesNotMatch(languageCookie("en", false), /Secure/);
});
