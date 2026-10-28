// The study page's selection in a real browser: the guide (same template as the PDF) in a frame
// with no script, text selected inside it, read from outside by selection.ts, then checked by the
// server's own rules (study-resolve.ts). Needs Playwright with Chromium (CI installs it; locally
// set PLAYWRIGHT_MODULE to an installed copy if `playwright` is not in node_modules).
import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { renderGuideHtml } from "../../lib/guides/guide-html.ts";
import { SAMPLE_GUIDES } from "../../lib/guides/guide-samples.ts";
import { resolveSelection } from "../../lib/study/study-resolve.ts";

type Browser = { newPage: () => Promise<Page>; close: () => Promise<void> };
type Page = {
  setContent: (html: string) => Promise<void>;
  addScriptTag: (options: { content: string }) => Promise<void>;
  evaluate: <T>(fn: (arg: never) => T, arg?: unknown) => Promise<T>;
  waitForFunction: (fn: () => boolean) => Promise<unknown>;
};

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const content = SAMPLE_GUIDES[1].content; // third person -s / -es

async function launch(): Promise<Browser> {
  const name = process.env.PLAYWRIGHT_MODULE || "playwright";
  const { chromium } = (await import(name)) as {
    chromium: { launch: () => Promise<Browser> };
  };
  return chromium.launch();
}

async function bundleSelection(): Promise<string> {
  const result = await build({
    entryPoints: [`${ROOT}src/components/rita-study/selection.ts`],
    bundle: true,
    format: "iife",
    globalName: "StudySelection",
    alias: { "@": `${ROOT}src` },
    write: false,
    logLevel: "silent",
  });
  return result.outputFiles[0].text;
}

/** Selects inside the frame (a whole piece, or from one piece's offset to another's) and reads it. */
type Pick = { from: string; to?: string; start?: number; end?: number };

test("the guide's selection maps to named pieces the server accepts", async (t) => {
  let browser: Browser;
  try {
    browser = await launch();
  } catch (error) {
    if (process.env.CI) throw error;
    t.skip(`Playwright is not available here: ${String(error).slice(0, 120)}`);
    return;
  }
  try {
    const page = await browser.newPage();
    const guide = renderGuideHtml(content, { anchors: true, screen: true, draft: false });
    await page.setContent(
      `<!doctype html><body style="margin:0"><iframe id="f" sandbox="allow-same-origin" style="width:900px;height:900px;border:0"></iframe></body>`,
    );
    await page.evaluate((html: string) => {
      (document.getElementById("f") as HTMLIFrameElement).srcdoc = html;
    }, guide as never);
    await page.waitForFunction(() =>
      Boolean(
        (document.getElementById("f") as HTMLIFrameElement).contentDocument?.querySelector(
          "[data-seg]",
        ),
      ),
    );
    await page.addScriptTag({ content: await bundleSelection() });

    const read = (pick: Pick) =>
      page.evaluate((p: Pick) => {
        const doc = (document.getElementById("f") as HTMLIFrameElement).contentDocument as Document;
        const textNodes = (selector: string) => {
          const walker = doc.createTreeWalker(doc.querySelector(selector) as Node, 4);
          const nodes: Text[] = [];
          for (let node = walker.nextNode(); node; node = walker.nextNode())
            nodes.push(node as Text);
          return nodes;
        };
        const range = doc.createRange();
        const first = textNodes(p.from);
        const last = textNodes(p.to ?? p.from);
        range.setStart(first[0], Math.min(p.start ?? 0, first[0].length));
        // Inside one piece with an end offset, stay in the first text node; else end at the last.
        const end = !p.to && p.end !== undefined ? first[0] : last[last.length - 1];
        range.setEnd(end, p.end === undefined ? end.length : Math.min(p.end, end.length));
        const selection = doc.getSelection() as Selection;
        selection.removeAllRanges();
        selection.addRange(range);
        const api = (
          window as unknown as { StudySelection: Record<string, (...a: unknown[]) => unknown> }
        ).StudySelection;
        const result = api.readSelection(doc) as {
          segIds: string[];
          parts: string[];
          exact: string;
          range: Range;
        } | null;
        api.markSelection(doc.defaultView, result?.range ?? null);
        const highlights = (
          doc.defaultView as unknown as { CSS: { highlights?: Map<string, unknown> } }
        ).CSS.highlights;
        return result
          ? {
              segIds: result.segIds,
              parts: result.parts,
              exact: result.exact,
              marked: Boolean(highlights?.has("st-sel")),
            }
          : null;
      }, pick as never);

    const cases: { name: string; pick: Pick; segIds: string[]; kind: string }[] = [
      {
        name: "one word in a cell",
        pick: { from: "[data-seg='s1.r2.c3']", end: 4 },
        segIds: ["s1.r2.c3"],
        kind: "word",
      },
      {
        name: "two cells side by side",
        pick: { from: "[data-seg='s1.r1.c1']", to: "[data-seg='s1.r1.c2']" },
        segIds: ["s1.r1.c1", "s1.r1.c2"],
        kind: "table_cells",
      },
      {
        name: "a cut word across two cells",
        pick: { from: "[data-seg='s1.r1.c1']", start: 7, to: "[data-seg='s1.r1.c2']" },
        segIds: ["s1.r1.c1", "s1.r1.c2"],
        kind: "table_cells",
      },
      {
        name: "the Arabic note",
        pick: { from: "[data-seg='a']", end: 12 },
        segIds: ["a"],
        kind: "arabic_only",
      },
      {
        name: "three blocks",
        pick: { from: "[data-seg='s2.i1.x']", to: "[data-seg='c']" },
        segIds: ["s2.i1.x", "s2.i2.x", "c"],
        kind: "multi_block",
      },
    ];
    for (const item of cases) {
      const result = await read(item.pick);
      assert.ok(result, item.name);
      assert.deepEqual(result.segIds, item.segIds, item.name);
      assert.ok(result.marked, `${item.name}: stays marked after the browser's selection goes`);
      const server = resolveSelection(content, result, "explain");
      assert.ok(
        server.ok,
        `${item.name}: refused (${server.ok ? "" : server.code}) for «${result.exact}»`,
      );
      assert.equal(server.kind, item.kind, item.name);
    }
    // Text that belongs to no piece (the brand in the header) is not a selection of the lesson.
    const brand = await read({ from: ".brand" });
    assert.ok(!brand || brand.segIds.length === 0);
  } finally {
    await browser.close();
  }
});
