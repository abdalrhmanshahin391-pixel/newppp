// Renders the sample guides to PDF with Chromium (Playwright) so the look can be reviewed.
//   node scripts/guides/build-samples.mjs [outDir]
// Needs Playwright with a Chromium on this machine (not part of the site's dependencies and not run
// in CI). The same renderer runs on Modal for real guides (guides-worker).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { renderGuideHtml } from "../../src/lib/guides/guide-html.ts";
import { SAMPLE_GUIDES } from "../../src/lib/guides/guide-samples.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = resolve(process.argv[2] ?? join(root, "guides-worker", "samples"));
mkdirSync(out, { recursive: true });

let playwright;
for (const spec of ["playwright", "/opt/node-tools/node_modules/playwright/index.mjs"]) {
  try {
    playwright = await import(spec.startsWith("/") ? pathToFileURL(spec).href : spec);
    break;
  } catch {
    /* try the next one */
  }
}
if (!playwright) throw new Error("Playwright is not installed here.");

const fontBase = pathToFileURL(join(root, "guides-worker", "fonts") + "/").href;
const browser = await playwright.chromium.launch();
for (const { slug, content } of SAMPLE_GUIDES) {
  const html = renderGuideHtml(content, { fontBase, draft: true });
  const htmlPath = join(out, `${slug}.html`);
  writeFileSync(htmlPath, html);
  const page = await browser.newPage({ javaScriptEnabled: false });
  await page.goto(pathToFileURL(htmlPath).href);
  await page.waitForTimeout(400);
  await page.pdf({
    path: join(out, `${slug}.pdf`),
    printBackground: true,
    preferCSSPageSize: true,
    tagged: true,
  });
  await page.close();
  console.log("wrote", join(out, `${slug}.pdf`));
}
await browser.close();
