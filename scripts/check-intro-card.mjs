// The home intro card: the real hero and card, served locally. Nothing remote is contacted.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { compile } from "@tailwindcss/node";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve, relative, extname } from "node:path";
import { createServer } from "node:http";

const root = process.cwd(),
  out = resolve(root, "output/home-intro");
await mkdir(out, { recursive: true });
const entry = `
import React from 'react';import {createRoot} from 'react-dom/client';
import {UltraHero} from './src/components/home/procreate/UltraHero';
import {IntroCard} from './src/components/home/procreate/IntroCard';
function Home(){return <main className="uz-home rita-cream edith-light edith-premium relative min-h-screen overflow-clip bg-black text-white" style={{fontFamily:'var(--font-grotesk)'}}><UltraHero/><IntroCard/><div className="qa-tail">Uzyra · Learn at your pace</div></main>}
createRoot(document.getElementById('app')).render(<Home/>);
`;
const result = await build({
  stdin: { contents: entry, loader: "tsx", resolveDir: root },
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  outdir: resolve(out, "bundle"),
  alias: { "@": resolve(root, "src") },
  loader: { ".webp": "file", ".jpg": "file", ".png": "file" },
  assetNames: "assets/[name]-[hash]",
  publicPath: "/",
  define: { "process.env.NODE_ENV": '"production"' },
});
const bundledCss = result.outputFiles.find((f) => f.path.endsWith(".css"))?.text ?? "";
const source = await readFile(resolve(root, "src/styles.css"), "utf8");
const compiler = await compile(source, { base: root, onDependency: () => {} });
const tokens = new Set(entry.match(/[\w!:/.[\]#%(),+-]+/g));
for (const directory of ["src/components/home/procreate", "src/components/rita-study"]) {
  for (const name of await readdir(resolve(root, directory))) {
    if (!name.endsWith(".tsx")) continue;
    const text = await readFile(resolve(root, directory, name), "utf8");
    for (const token of text.match(/[\w!:/.[\]#%(),+-]+/g) || []) tokens.add(token);
  }
}
const fonts = [
  ["Figtree", "figtree-latin-400-normal.woff2", 400],
  ["Figtree", "figtree-latin-600-normal.woff2", 600],
  ["Figtree", "figtree-latin-700-normal.woff2", 700],
  ["Inter Tight", "inter-tight-latin-600-normal.woff2", 600],
  ["Inter Tight", "inter-tight-latin-700-normal.woff2", 700],
]
  .map(
    ([family, file, weight]) =>
      `@font-face{font-family:"${family}";src:url("/fonts/guides/${file}") format("woff2");font-weight:${weight};font-display:swap}`,
  )
  .join("\n");
const css =
  fonts +
  compiler.build([...tokens]) +
  bundledCss +
  `
body{margin:0}.qa-header{height:64px;padding:0 28px;display:flex;align-items:center;justify-content:space-between;background:#121117;color:white;position:relative;z-index:3;font:500 14px Figtree,sans-serif}.qa-header nav{display:flex;gap:16px}.qa-tail{height:110vh;padding:100px 24px;text-align:center;color:#6a697c}
/* Match ProHome's explicit font and its floating ProHeader; the navigation labels are test controls. */
.uz-home .qa-header{position:fixed;inset:0 0 auto;z-index:50}
.qa-reader{min-height:100dvh;background:#f4f4f8;color:#121117}.qa-reader-grid{display:grid;grid-template-columns:1fr 1fr;gap:28px;padding:40px}.qa-reader section{padding:24px}.qa-reader h1{font-size:32px!important}.qa-reader p{margin-block:24px}.qa-reader button,.qa-reader summary{min-height:44px;padding:10px;border:1px solid;border-radius:8px}.qa-reader textarea{display:block;margin-top:24px;border:1px solid;padding:16px;width:100%;font-size:16px;background:white}.qa-paper{background:white;padding:40px;border:1px solid #dcdce5;border-radius:12px;min-height:70vh}.qa-paper h2{font-size:28px!important}.qa-dark{min-height:100vh;background:#121117;color:white}.qa-dark>h1,.qa-dark>p{margin:40px}.qa-dark>h1{font-size:48px!important}
@media(max-width:600px){.qa-header{padding:0 16px}.qa-header nav{gap:8px;font-size:12px}.qa-reader-grid{grid-template-columns:1fr;padding:16px}.qa-paper{padding:24px}}
`;
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/client.css") {
    res.setHeader("Content-Type", "text/css");
    return res.end(css);
  }
  const asset = result.outputFiles.find(
    (f) => "/" + relative(resolve(out, "bundle"), f.path).replaceAll("\\", "/") === url.pathname,
  );
  if (url.pathname === "/client.js") {
    res.setHeader("Content-Type", "text/javascript");
    return res.end(result.outputFiles.find((f) => f.path.endsWith(".js")).text);
  }
  if (asset) {
    res.setHeader("Content-Type", extname(asset.path) === ".webp" ? "image/webp" : "image/jpeg");
    return res.end(asset.contents);
  }
  if (url.pathname.startsWith("/fonts/")) {
    const path = resolve(root, "public", "." + url.pathname);
    if (
      !path.startsWith(resolve(root, "public") + "/") &&
      !path.startsWith(resolve(root, "public") + "\\")
    ) {
      res.statusCode = 403;
      return res.end();
    }
    try {
      res.setHeader("Content-Type", "font/woff2");
      return res.end(await readFile(path));
    } catch {
      res.statusCode = 404;
      return res.end();
    }
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  const ar = url.searchParams.get("lang") === "ar";
  res.end(
    `<!doctype html><html lang="${ar ? "ar" : "en"}" dir="${ar ? "rtl" : "ltr"}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/client.css"><body><div id="app"></div><script src="/client.js"></script></body></html>`,
  );
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = "http://127.0.0.1:" + server.address().port;
if (process.argv.includes("--serve")) {
  console.log(origin);
  await new Promise(() => {});
}

const pw = await import(process.env.PLAYWRIGHT_MODULE || "playwright"),
  engine = process.env.BROWSER || "chromium";
const browser = await pw[engine].launch({ headless: true });
const findings = [],
  errors = [];

// Helpers that read the page.
const scaleOf = (page) =>
  page.locator(".uz-intro-card").evaluate((el) => {
    const t = getComputedStyle(el).transform;
    return t === "none" ? 1 : new DOMMatrix(t).a;
  });
const cardTop = (page) =>
  page.locator(".uz-intro").evaluate((el) => el.getBoundingClientRect().top);
const scrollCardTo = async (page, share) => {
  await page.evaluate((share) => {
    const el = document.querySelector(".uz-intro");
    scrollBy(0, el.getBoundingClientRect().top - innerHeight * share);
  }, share);
};
const pixels = (page) =>
  page.locator(".uz-intro-canvas").evaluate((c) => {
    const data = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let lit = 0,
      tinted = 0,
      sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      lit += 1;
      sum = (sum + data[i + 3] * (i % 9973)) % 1e9;
      if (data[i] !== data[i + 1] || data[i + 1] !== data[i + 2]) tinted += 1;
    }
    return { lit, tinted, sum };
  });
const opacity = (page, selector) =>
  page.locator(selector).evaluate((el) => Number(getComputedStyle(el).opacity));

try {
  for (const [width, height, phone] of [
    [1280, 800, false],
    [820, 1180, false],
    [390, 844, true],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      ...(phone ? { isMobile: engine !== "firefox", hasTouch: true } : {}),
      recordVideo: { dir: resolve(out, engine + "-video-" + width), size: { width, height } },
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin + "/");
    await page.locator(".uz-intro[data-film='on']").waitFor();
    await page.evaluate(() => document.fonts.ready);
    const small = phone ? 0.92 : 0.5;

    // Below the fold it waits at its small size.
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(1300);
    if ((await cardTop(page)) >= height) {
      assert.ok(Math.abs((await scaleOf(page)) - small) < 0.01, "starts small below the fold");
    }
    // Part way: eased (power2.out on the scroll progress), after the one-second catch-up.
    const expected = (top) => {
      const end = phone ? 0.8 : 0.5;
      const p = Math.min(1, Math.max(0, (height - top) / (height - height * end)));
      return small + (1 - small) * (1 - (1 - p) ** 2);
    };
    await scrollCardTo(page, phone ? 0.9 : 0.75);
    await page.waitForTimeout(1300);
    const mid = await scaleOf(page);
    const want = expected(await cardTop(page));
    assert.ok(Math.abs(mid - want) < 0.01, `scale ${mid}, expected ${want}`);
    // It lags the scroll a little, then catches up to full size.
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(1300);
    const lowest = await scaleOf(page);
    await scrollCardTo(page, phone ? 0.5 : 0.08);
    // Read it early in the one-second catch-up (poll a little: a busy CI runner can take a few
    // frames to start it).
    await page.waitForTimeout(150);
    let lagging = await scaleOf(page);
    for (let i = 0; i < 6 && lagging === lowest; i++) {
      await page.waitForTimeout(50);
      lagging = await scaleOf(page);
    }
    if (lowest < 0.99) {
      assert.ok(
        lagging > lowest && lagging < 1,
        `it catches up rather than jumps (${lowest} -> ${lagging})`,
      );
    }
    await page.waitForTimeout(1300);
    assert.ok(Math.abs((await scaleOf(page)) - 1) < 0.005, "full size once it reaches its mark");

    // The film: dots first, then the cube and the name.
    await page.waitForTimeout(600);
    const early = await pixels(page);
    assert.ok(early.lit > 500, `dots are drawn (${early.lit})`);
    assert.equal(early.tinted, 0, "the dots are white and grey only");
    await page.waitForTimeout(2800);
    assert.equal(await opacity(page, ".uz-intro-mark"), 1, "the live cube has taken over");
    assert.equal(await opacity(page, ".uz-intro-word >> nth=1"), 1, "the name is in");
    assert.equal(
      (await page.locator(".uz-intro-lockup").innerText()).replace(/\s+/g, " ").trim(),
      "Uzyra Ultra",
    );
    const shot = resolve(out, engine + "-intro-" + width + ".png");
    await page.screenshot({ path: shot });
    const ringA = await pixels(page);
    await page.waitForTimeout(400);
    assert.notEqual((await pixels(page)).sum, ringA.sum, "the ring keeps turning");

    // Pause holds the frame; play carries on.
    await page.locator(".uz-intro-toggle").focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(100);
    assert.equal(await page.locator(".uz-intro-toggle").getAttribute("aria-pressed"), "true");
    const held = await pixels(page);
    await page.waitForTimeout(500);
    assert.equal((await pixels(page)).sum, held.sum, "paused");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    assert.notEqual((await pixels(page)).sum, held.sum, "playing again");

    // A tap (or Enter) replays from the dots.
    if (phone) await page.locator(".uz-intro-stage").tap({ position: { x: 40, y: 40 } });
    else await page.locator(".uz-intro-stage").click({ position: { x: 60, y: 60 } });
    await page.waitForTimeout(250);
    assert.ok((await opacity(page, ".uz-intro-mark")) < 0.05, "replayed from the start");
    assert.ok((await opacity(page, ".uz-intro-word >> nth=0")) < 0.05);

    // The pointer pill, on a mouse only.
    if (!phone) {
      const box = await page.locator(".uz-intro-card").boundingBox();
      await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
      await page.mouse.move(box.x + box.width * 0.32, box.y + box.height * 0.42);
      await page.waitForTimeout(500);
      assert.equal(await page.locator(".uz-intro-pill[data-shown]").count(), 1, "pill shows");
      const pill = await page.locator(".uz-intro-pill-body").boundingBox();
      const cx = pill.x + pill.width / 2;
      const cy = pill.y + pill.height / 2;
      assert.ok(
        Math.abs(cx - (box.x + box.width * 0.32)) < 3 &&
          Math.abs(cy - (box.y + box.height * 0.42)) < 3,
        `pill follows the pointer (${cx},${cy})`,
      );
      await page.screenshot({ path: resolve(out, engine + "-pill-" + width + ".png") });
      await page.mouse.move(box.x + box.width / 2, box.y + box.height + 120);
      await page.waitForTimeout(300);
      assert.equal(await page.locator(".uz-intro-pill[data-shown]").count(), 0, "pill hides");
    } else {
      assert.equal(
        await page.locator(".uz-intro-pill").evaluate((el) => getComputedStyle(el).display),
        "none",
        "no pill on touch",
      );
    }

    // Off screen it stops drawing.
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    const away = await pixels(page);
    await page.waitForTimeout(500);
    assert.equal((await pixels(page)).sum, away.sum, "offscreen film pauses");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    findings.push({ engine, width, height, phone, acceptance: "passed" });
    await context.close();
  }

  // Reduced motion: still frame, no growing, no buttons.
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/");
  await page.locator(".uz-intro[data-film='still']").waitFor();
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(200);
  assert.equal(await scaleOf(page), 1, "no scale with reduced motion");
  await scrollCardTo(page, 0.1);
  await page.waitForTimeout(300);
  assert.equal(await opacity(page, ".uz-intro-mark"), 1);
  assert.equal(await opacity(page, ".uz-intro-word >> nth=1"), 1);
  assert.equal(await page.locator(".uz-intro-toggle").count(), 0);
  assert.equal(await page.locator(".uz-intro-stage[role=button]").count(), 0);
  const a = await pixels(page);
  await page.waitForTimeout(500);
  assert.equal((await pixels(page)).sum, a.sum, "still frame");
  await page.screenshot({ path: resolve(out, engine + "-intro-reduced.png") });
  findings.push({ engine, reduced: true, acceptance: "passed" });
  await context.close();

  assert.deepEqual(errors, []);
  console.log(JSON.stringify(findings, null, 2));
  await writeFile(
    resolve(out, engine + "-checks.json"),
    JSON.stringify({ findings, errors }, null, 2),
  );
} finally {
  await browser.close();
  server.close();
}
