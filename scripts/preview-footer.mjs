// Isolated visual QA of the actual footer component. Never opens the live website.
// Usage: PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/preview-footer.mjs
import { build } from "esbuild";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = process.cwd();
const out = resolve(root, "output/footer-preview");
await mkdir(out, { recursive: true });
const shared = `
import React from "react";
import { createMemoryHistory, createRootRoute, createRouter, RouterContextProvider } from "@tanstack/react-router";
import { SiteFooterView } from "./src/components/SiteFooterView";
import { footerColumns } from "./src/lib/footer-links";
import { SUPPORT_EMAIL } from "./src/lib/legal-content";
function surface(ar) {
  const router = createRouter({ routeTree: createRootRoute(), history: createMemoryHistory({ initialEntries: ["/"] }) });
  return <RouterContextProvider router={router}><SiteFooterView ar={ar} columns={footerColumns(ar, "de", true)} supportEmail={SUPPORT_EMAIL} year={2026} /></RouterContextProvider>;
}
`;
await build({
  stdin: {
    contents:
      shared +
      'import { renderToString } from "react-dom/server"; export const render = ar => renderToString(surface(ar));',
    loader: "tsx",
    resolveDir: root,
  },
  bundle: true,
  packages: "external",
  platform: "node",
  format: "esm",
  alias: { "@": resolve(root, "src") },
  outfile: resolve(out, "render.mjs"),
});
const { render } = await import(pathToFileURL(resolve(out, "render.mjs")).href);
const client = await build({
  stdin: {
    contents:
      shared +
      'import { hydrateRoot } from "react-dom/client"; hydrateRoot(document.getElementById("preview"), surface(document.documentElement.lang === "ar"));',
    loader: "tsx",
    resolveDir: root,
  },
  bundle: true,
  platform: "browser",
  format: "iife",
  write: false,
  alias: { "@": resolve(root, "src") },
  define: { "process.env.NODE_ENV": '"production"' },
});
const appCss = await readFile(resolve(root, "src/styles.css"), "utf8");
const footerCss = appCss.slice(appCss.indexOf("/* Closing signature."));
let fonts = "";
for (const [family, file, weight] of [
  ["Figtree", "figtree-latin-400-normal.woff2", 400],
  ["Figtree", "figtree-latin-600-normal.woff2", 600],
  ["Inter Tight", "inter-tight-latin-600-normal.woff2", 600],
  ["Outfit", "outfit-latin-600-normal.woff2", 600],
  ["Uzyra Footer Arabic", "noto-sans-arabic-arabic-400-normal.woff2", 400],
  ["Uzyra Footer Arabic", "noto-sans-arabic-arabic-700-normal.woff2", 700],
]) {
  const data = await readFile(resolve(root, "public/fonts/guides", file));
  fonts += `@font-face{font-family:"${family}";src:url(data:font/woff2;base64,${data.toString("base64")});font-weight:${weight};font-display:swap;}`;
}
const pkg = process.env.PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(pkg);
const browser = await chromium.launch({ headless: true });
const findings = [];
try {
  for (const width of [390, 768, 1280])
    for (const ar of [false, true]) {
      const lang = ar ? "ar" : "en";
      const page = await browser.newPage({
        viewport: { width, height: 1000 },
        reducedMotion: "reduce",
      });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const html = `<!doctype html><html lang="${lang}" dir="${ar ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0}a{color:inherit}button{font:inherit}${footerCss}${fonts}</style></head><body><div id="preview">${render(ar)}</div></body></html>`;
      await page.setContent(html);
      await page.addScriptTag({ content: client.outputFiles[0].text });
      await page.evaluate(() => document.fonts.ready);
      await page
        .locator("footer")
        .screenshot({ path: resolve(out, `footer-${lang}-${width}.png`) });
      const checks = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        targets: [...document.querySelectorAll("footer a, footer button")].every(
          (el) => el.getBoundingClientRect().height >= 44,
        ),
        linkCount: document.querySelectorAll("footer a").length,
      }));
      assert.equal(checks.overflow, false, `overflow at ${lang} ${width}`);
      assert.equal(checks.targets, true, `small targets at ${lang} ${width}`);
      assert.deepEqual(errors, [], `browser errors at ${lang} ${width}`);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.getByRole("button", { name: ar ? "للأعلى" : "Back to top" }).click();
      assert.equal(await page.evaluate(() => window.scrollY), 0);
      await page.getByRole("button", { name: ar ? "للأعلى" : "Back to top" }).focus();
      await page.keyboard.press("Tab");
      const focus = await page.evaluate(() => {
        const style = getComputedStyle(document.activeElement);
        return { outline: style.outlineStyle, width: style.outlineWidth };
      });
      assert.equal(focus.outline, "solid");
      assert.equal(focus.width, "2px");
      findings.push({ lang, width, ...checks, errors });
      await page.close();
    }
} finally {
  await browser.close();
}
await writeFile(resolve(out, "checks.json"), JSON.stringify(findings, null, 2));
console.log(JSON.stringify(findings, null, 2));
