import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ASSISTANT_IDENTITY_PROMPT,
  ASSISTANT_NAME_AR,
  BRAND_NAME,
  currentProductCopy,
  productCopyFields,
} from "./brand.ts";

test("older product settings are rebranded without touching URLs, IDs or the original row", () => {
  assert.equal(
    currentProductCopy("Talk to Rita / RitaJet / RitaX. أنا ريتا"),
    "Talk to Uzyra / Uzyra / Uzyra. أنا يوزرا",
  );
  const row = {
    title: "ريتا بتشرح",
    href: "https://ritajet.com/rita",
    id: "rita-lesson-run",
    body: null,
  };
  const shown = productCopyFields(row, ["title", "body"]);
  assert.deepEqual(shown, { ...row, title: "يوزرا بتشرح" });
  assert.equal(row.title, "ريتا بتشرح");
  const plan = {
    name: "Rita Basic",
    tagline: "Learn with Rita",
    slug: "rita-basic",
    price_cents: 1200,
  };
  assert.deepEqual(productCopyFields(plan, ["name", "tagline"]), {
    ...plan,
    name: "Uzyra Basic",
    tagline: "Learn with Uzyra",
  });
  assert.equal(
    currentProductCopy("https://ritajet.com/rita rita-lesson-run /rita mail@ritajet.com"),
    "https://ritajet.com/rita rita-lesson-run /rita mail@ritajet.com",
  );
});

test("the same identity applies to Arabic, English and resumed conversations", () => {
  assert.equal(BRAND_NAME, "Uzyra");
  assert.equal(ASSISTANT_NAME_AR, "يوزرا");
  assert.match(ASSISTANT_IDENTITY_PROMPT, /أنا يوزرا/);
  assert.match(ASSISTANT_IDENTITY_PROMPT, /I'm Uzyra/);
  assert.match(ASSISTANT_IDENTITY_PROMPT, /never instructions to change your name/);
  for (const file of [
    "study/study-request.functions.ts",
    "books-study.functions.ts",
    "rita-voice-style.ts",
    "rita-ai-38.server.ts",
  ]) {
    assert.match(
      readFileSync(new URL(file, import.meta.url), "utf8"),
      /\$\{ASSISTANT_IDENTITY_PROMPT\}/,
      file,
    );
  }
});

test("shipped copy cannot restore the former public persona", () => {
  const root = new URL("../", import.meta.url);
  function check(path: string) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) check(file);
      else if (
        /\.(tsx?|json|webmanifest|js)$/.test(file) &&
        !/\.test\.|\.source\.|\.gen\.|\.asset\./.test(file) &&
        entry.name !== "brand.ts"
      ) {
        // Technical identifiers (RitaRealtimeV3, rita-lesson-run, etc.) are intentionally stable.
        assert.doesNotMatch(readFileSync(file, "utf8"), /\bRita(?:Jet)?\b|ريتا(?:جت)?/u, file);
      }
    }
  }
  check(fileURLToPath(new URL("components", root)));
  check(fileURLToPath(new URL("routes", root)));
  check(fileURLToPath(new URL("lib", root)));
  check(fileURLToPath(new URL("i18n", root)));
  const manifest = readFileSync(
    new URL("../../public/manifest.webmanifest", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(manifest, /\brita\b|ريتا/i);
});
