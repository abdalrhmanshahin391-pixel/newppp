import assert from "node:assert/strict";
import test from "node:test";
import { guideOutline, guideSegments, normalizeStudyText } from "./guide-blocks.ts";
import { renderGuideHtml } from "./guide-html.ts";
import { SAMPLE_GUIDES } from "./guide-samples.ts";
import type { GuideContent } from "./guide-content.ts";

const VOID = new Set(["col", "meta", "br", "img", "path", "input", "hr"]);

function decode(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** The text inside every data-seg element, in page order (a small tag walker, enough for our HTML). */
function segmentsOnPage(html: string): { seg: string; text: string }[] {
  const body = html.slice(html.indexOf("<body>"));
  const found: { seg: string; text: string }[] = [];
  const stack: { tag: string; index: number | null }[] = [];
  const token = /<(\/?)([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g;
  let match: RegExpExecArray | null;
  while ((match = token.exec(body))) {
    const [, closing, rawTag, attrs, text] = match;
    if (text !== undefined) {
      for (const open of stack) if (open.index !== null) found[open.index].text += decode(text);
      continue;
    }
    const tag = rawTag.toLowerCase();
    if (closing) {
      while (stack.length && stack[stack.length - 1].tag !== tag) stack.pop();
      stack.pop();
      continue;
    }
    if (VOID.has(tag) || attrs.trim().endsWith("/")) continue;
    const seg = /data-seg="([^"]+)"/.exec(attrs)?.[1] ?? null;
    let index: number | null = null;
    if (seg) {
      index = found.length;
      found.push({ seg, text: "" });
    }
    stack.push({ tag, index });
  }
  return found;
}

const tricky: GuideContent = {
  version: 1,
  title: "Verbs + -ing",
  intro: "We add [[-ing]] to the {{verb}}: //run → running//.",
  sections: [
    {
      kind: "table",
      heading: "Forms",
      columns: [
        { label: "Base", tone: "neutral" },
        { label: "+ -ing", tone: "positive" },
      ],
      row_headers: true,
      rows: [
        ["run", "runn{{ing}}"],
        ["", "empty first cell"],
      ],
    },
    {
      kind: "usage",
      heading: "Usage",
      items: [
        { label: "", example: "I am //running//." },
        { label: "Now", example: "She is [[eating]]." },
      ],
    },
  ],
  callout: "Watch the spelling.",
  arabic_note: "نضيف ing للفعل مثل run → running.",
};

const guides: GuideContent[] = [...SAMPLE_GUIDES.map((sample) => sample.content), tricky];

test("ST-U02: the page names the same pieces, in the same order, with the same text", () => {
  for (const content of guides) {
    const expected = guideSegments(content);
    const page = segmentsOnPage(renderGuideHtml(content, { anchors: true, screen: true }));
    assert.deepEqual(
      page.map((piece) => piece.seg),
      expected.map((piece) => piece.seg),
      content.title,
    );
    page.forEach((piece, index) =>
      assert.equal(normalizeStudyText(piece.text), expected[index].text, piece.seg),
    );
  }
});

test("names are unique and point at a block and a section", () => {
  for (const content of guides) {
    const segments = guideSegments(content);
    assert.equal(new Set(segments.map((piece) => piece.seg)).size, segments.length);
    for (const piece of segments) {
      assert.ok(piece.seg.startsWith(piece.block), piece.seg);
      if (piece.section) assert.ok(piece.block.startsWith(`${piece.section}.`), piece.seg);
    }
  }
});

test("an empty cell gets no name, a usage label does, the Arabic note is Arabic", () => {
  const segments = guideSegments(tricky);
  const names = segments.map((piece) => piece.seg);
  assert.ok(!names.includes("s1.r2.c1"));
  assert.ok(names.includes("s1.r2.c2"));
  assert.ok(names.includes("s2.i2.l"));
  assert.ok(!names.includes("s2.i1.l"));
  assert.equal(segments.find((piece) => piece.seg === "a")?.lang, "ar");
  assert.deepEqual(segments.find((piece) => piece.seg === "i")?.terms, ["-ing"]);
});

test("ST-U03: without anchors and screen the HTML has no names (printing is unchanged)", () => {
  for (const content of guides) {
    const plain = renderGuideHtml(content, { draft: false });
    assert.doesNotMatch(plain, /data-seg|data-block|data-section|class="sheet"|Content-Security/);
    const named = renderGuideHtml(content, { draft: false, anchors: true });
    assert.equal(
      named
        .replace(/ data-(?:block|seg|section)="[^"]*"/g, "")
        .replace(/ id="s\d+"/g, "")
        .replace(/<span>([^<]*)<\/span>: /g, "$1: ")
        .replace(/<span>((?:(?!<\/aside>).)*)<\/span><\/aside>/g, "$1</aside>"),
      plain,
      content.title,
    );
  }
});

test("screen mode: one sheet, a strict policy, fonts from the given site, no script", () => {
  const html = renderGuideHtml(SAMPLE_GUIDES[0].content, {
    screen: true,
    anchors: true,
    draft: false,
    fontBase: "https://uzyra.example/fonts/guides/",
  });
  assert.match(html, /<main class="sheet">/);
  assert.match(
    html,
    /default-src 'none'; style-src 'unsafe-inline'; font-src https:\/\/uzyra.example; img-src data:/,
  );
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /draft for review/);
});

test("the outline names the headings and taught terms only", () => {
  const outline = guideOutline(tricky);
  assert.equal(outline.title, "Verbs + -ing");
  assert.deepEqual(outline.sections, [
    { id: "s1", heading: "Forms", terms: [] },
    { id: "s2", heading: "Usage", terms: ["eating"] },
  ]);
});

test("normalize: NFC and single spaces", () => {
  assert.equal(normalizeStudyText("  éte  x "), "éte x");
});

test("the study page fonts in public/fonts/guides are the same files as guides-worker/fonts", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const worker = readdirSync(`${root}guides-worker/fonts`).sort();
  const site = readdirSync(`${root}public/fonts/guides`).sort();
  assert.deepEqual(site, worker);
  for (const file of worker)
    assert.ok(
      readFileSync(`${root}guides-worker/fonts/${file}`).equals(
        readFileSync(`${root}public/fonts/guides/${file}`),
      ),
      `${file} differs`,
    );
});
