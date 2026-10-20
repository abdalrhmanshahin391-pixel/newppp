import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import {
  FLAG_COUNTRIES,
  countryName,
  flagCountryFor,
  flagSrc,
  isFlagCountry,
} from "./language-flags.ts";

test("every offered country has its flag file", () => {
  for (const country of FLAG_COUNTRIES) {
    assert.ok(existsSync(new URL(`../../public/flags/${country}.svg`, import.meta.url)), country);
  }
});

test("only offered countries become a flag address (no paths from the database)", () => {
  assert.equal(flagSrc("gb"), "/flags/gb.svg");
  assert.equal(flagSrc("de"), "/flags/de.svg");
  for (const bad of ["../secret", "GB", "gbr", "", null, undefined, "zz", "/flags/gb.svg"]) {
    assert.equal(flagSrc(bad), null, String(bad));
    assert.equal(isFlagCountry(bad), false, String(bad));
  }
});

test("a language uses its admin-chosen country, else a default for its code, else none", () => {
  assert.equal(flagCountryFor({ code: "en", flag_country: "us" }), "us");
  assert.equal(flagCountryFor({ code: "en", flag_country: null }), "gb");
  assert.equal(flagCountryFor({ code: "en" }), "gb");
  assert.equal(flagCountryFor({ code: "de", flag_country: "at" }), "at");
  assert.equal(flagCountryFor({ code: "pt-br", flag_country: null }), "pt");
  assert.equal(flagCountryFor({ code: "xx", flag_country: null }), null);
  assert.equal(
    flagCountryFor({ code: "en", flag_country: "zz" }),
    "gb",
    "unknown country falls back",
  );
});

test("country names come from the platform, in Arabic or English", () => {
  assert.match(countryName("gb", "en"), /United Kingdom/);
  assert.match(countryName("de", "ar"), /ألمانيا/);
  assert.equal(countryName("zz", "en").length > 0, true);
});
