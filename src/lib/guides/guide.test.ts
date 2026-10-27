import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { test } from "node:test";
import {
  GuideContentSchema,
  normalizeGuideReply,
  parseMarkup,
  plainText,
  type GuideContent,
} from "./guide-content.ts";
import { PAGE_HEIGHT_PT, PAGE_WIDTH_PT, escapeHtml, renderGuideHtml } from "./guide-html.ts";
import { SAMPLE_GUIDES } from "./guide-samples.ts";

const FONTS = new URL("../../../guides-worker/fonts/", import.meta.url);

test("markup: term, strong and italic runs, nested, and plain text around them", () => {
  const runs = parseMarkup("We use [[the term]] and {{stress}} //an {{example}}//.");
  assert.equal(plainText("We use [[the term]] and {{stress}}"), "We use the term and stress");
  assert.deepEqual(
    runs.filter((run) => run.term).map((run) => run.text),
    ["the term"],
  );
  assert.deepEqual(
    runs.filter((run) => run.strong).map((run) => run.text),
    ["stress", "example"],
  );
  assert.ok(runs.some((run) => run.italic && run.strong && run.text === "example"));
});

test("markup: a broken tag is dropped and never swallows the rest", () => {
  assert.equal(plainText("a [[b c"), "a b c");
  assert.equal(plainText("a {{b}} {{c"), "a b c");
  assert.equal(plainText("a //b"), "a b");
  assert.equal(parseMarkup("I / you / we").length, 1);
});

test("the sample guides pass the schema", () => {
  assert.equal(SAMPLE_GUIDES.length, 3);
  for (const { content } of SAMPLE_GUIDES) assert.ok(GuideContentSchema.safeParse(content).success);
});

const base = () => structuredClone(SAMPLE_GUIDES[0].content) as GuideContent;

test("schema: a row with the wrong number of cells is refused", () => {
  const guide = base();
  const table = guide.sections[0];
  assert.equal(table.kind, "table");
  if (table.kind === "table") table.rows[0] = ["only", "three", "cells"];
  assert.equal(GuideContentSchema.safeParse(guide).success, false);
});

test("schema: angle brackets, an English-only Arabic note and too many sections are refused", () => {
  const html = base();
  html.intro = "Use <b>this</b>";
  assert.equal(GuideContentSchema.safeParse(html).success, false);
  const note = base();
  note.arabic_note = "This note is not Arabic";
  assert.equal(GuideContentSchema.safeParse(note).success, false);
  const many = base();
  many.sections = [
    many.sections[0],
    many.sections[1],
    many.sections[0],
    many.sections[1],
    many.sections[0],
  ];
  assert.equal(GuideContentSchema.safeParse(many).success, false);
});

test("normalize: strips tags and control characters, cuts at a word, keeps the meaning", () => {
  const raw = {
    title: "  Present <i>simple</i>\u0007  ",
    intro: "word ".repeat(80),
    sections: [
      {
        kind: "usage",
        heading: "Usage",
        items: [{ example: "I  {{drink}}   tea." }],
      },
    ],
    arabic_note: "ملاحظة",
  };
  const out = normalizeGuideReply(raw) as Record<string, unknown>;
  assert.equal(out.title, "Present simple");
  assert.ok(String(out.intro).length <= 280 && !String(out.intro).endsWith(" "));
  const parsed = GuideContentSchema.parse(out);
  const usage = parsed.sections[0];
  assert.equal(usage.kind, "usage");
  if (usage.kind === "usage") assert.equal(usage.items[0].example, "I {{drink}} tea.");
});

test("normalize: a wrong rule is left exactly as written (the checker must see it)", () => {
  const out = normalizeGuideReply({
    title: "Third person",
    intro: "x",
    sections: [{ kind: "usage", heading: "h", items: [{ example: "She {{go}} to school." }] }],
  }) as { sections: { items: { example: string }[] }[] };
  assert.equal(out.sections[0].items[0].example, "She {{go}} to school.");
});

test("html: a page is made at the booklet size with the Uzyra mark and name, and no script", () => {
  const html = renderGuideHtml(SAMPLE_GUIDES[0].content);
  assert.match(html, new RegExp(`size:${PAGE_WIDTH_PT}pt ${PAGE_HEIGHT_PT}pt`));
  assert.match(html, /aria-label="Uzyra"/);
  assert.match(html, /UZYR<svg class="a"/);
  assert.doesNotMatch(html, /<script/i);
  assert.match(html, /draft for review/);
  assert.doesNotMatch(
    renderGuideHtml(SAMPLE_GUIDES[0].content, { draft: false }),
    /draft for review/,
  );
});

test("html: text from a guide is escaped, even when it skipped the schema", () => {
  const guide = base();
  guide.title = `<img src=x onerror="alert(1)">`;
  guide.intro = `"quoted" & <b>bold</b>`;
  const table = guide.sections[0];
  if (table.kind === "table") table.rows[0][1] = "<script>alert(1)</script>";
  const html = renderGuideHtml(guide);
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.equal(escapeHtml(`a&b<"'`), "a&amp;b&lt;&quot;&#39;");
});

test("html: endings like -es never break across lines, and Arabic notes isolate Latin words", () => {
  const html = renderGuideHtml(SAMPLE_GUIDES[1].content);
  assert.match(html, /<span class="nb">-es<\/span>/);
  assert.match(html, /<bdi dir="ltr">he \/ she \/ it<\/bdi>/);
  assert.match(html, /<bdi dir="ltr">-es<\/bdi>/);
  assert.match(
    html,
    /<h1>Third person <span class="nb">-s<\/span> and <span class="nb">-es<\/span><\/h1>/,
  );
});

test("html: every block type renders", () => {
  const all = SAMPLE_GUIDES.map((sample) => renderGuideHtml(sample.content)).join("");
  assert.match(all, /class="grid"/);
  assert.match(all, /class="grid matrix"/);
  assert.match(all, /class="card usage block"/);
  const rules = base();
  rules.sections = [
    {
      kind: "rules",
      heading: "Rules",
      items: [{ rule: "Add {{-s}} after a vowel + y", examples: ["play → plays"] }],
    },
  ];
  assert.match(renderGuideHtml(rules), /class="rules"/);
});

test("fonts: every font file the stylesheet names is in guides-worker/fonts", () => {
  const html = renderGuideHtml(SAMPLE_GUIDES[0].content);
  const files = [...html.matchAll(/url\("fonts\/([^"]+)"\)/g)].map((match) => match[1]);
  assert.ok(files.length >= 8);
  const present = new Set(readdirSync(FONTS));
  for (const file of files) assert.ok(present.has(file), `${file} is missing`);
});
