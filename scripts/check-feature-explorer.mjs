// The home page's sections from the intro card down: the feature section, the library preview,
// Under the hood and Emith's card, the real components served locally. Nothing remote is contacted. Checks the typed headings, the rippling and drifting circles, the letters that fade
// in, the two live pictures (the tap word and the words that turn into flashcards), the books
// that rise in, the bars drawn with the scroll, the counted number, the pause off screen,
// the phone layout, reduced motion, and that nothing outside the pictures is coloured.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { compile } from "@tailwindcss/node";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve, relative, extname } from "node:path";
import { createServer } from "node:http";

const root = process.cwd(),
  out = resolve(root, "output/home-features");
await mkdir(out, { recursive: true });
const entry = `
import React from 'react';import {createRoot} from 'react-dom/client';
import {createRootRoute, createRouter, RouterProvider, createMemoryHistory} from '@tanstack/react-router';
import {FeatureExplorer} from './src/components/home/procreate/FeatureExplorer';
import {AppWindow} from './src/components/home/procreate/AppWindow';
import {UnderTheHood} from './src/components/home/procreate/UnderTheHood';
import {EmithShowcase} from './src/components/home/procreate/EmithShowcase';
function Home(){return <main className="uz-home rita-cream edith-light edith-premium relative min-h-screen overflow-clip bg-black text-white" style={{fontFamily:'var(--font-grotesk)'}}><div className="qa-head">Above the section</div><FeatureExplorer/><AppWindow/><UnderTheHood/><EmithShowcase/><div className="qa-tail">Uzyra · Learn at your pace</div></main>}
const router = createRouter({routeTree: createRootRoute({component: Home}), history: createMemoryHistory({initialEntries:['/']})});
createRoot(document.getElementById('app')).render(<RouterProvider router={router}/>);
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
for (const directory of [
  "src/components/home/procreate",
  "src/components/rita-study",
  "src/components/books",
]) {
  for (const name of await readdir(resolve(root, directory))) {
    if (!name.endsWith(".tsx")) continue;
    const text = await readFile(resolve(root, directory, name), "utf8");
    for (const token of text.match(/[\w!:/.[\]#%(),+-]+/g) || []) tokens.add(token);
  }
}
const fonts = [
  ["Figtree", "figtree-latin-400-normal.woff2", 400],
  ["Figtree", "figtree-latin-600-normal.woff2", 600],
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
  `body{margin:0}.qa-head{height:100vh;display:grid;place-items:center;background:#fff;color:#121317;font:500 20px Figtree,sans-serif}.qa-tail{height:110vh;padding:100px 24px;text-align:center;color:#6a697c;background:#fff}`;
const types = { ".webp": "image/webp", ".woff2": "font/woff2", ".png": "image/png" };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/client.css") {
    res.setHeader("Content-Type", "text/css");
    return res.end(css);
  }
  if (url.pathname === "/client.js") {
    res.setHeader("Content-Type", "text/javascript");
    return res.end(result.outputFiles.find((f) => f.path.endsWith(".js")).text);
  }
  const asset = result.outputFiles.find(
    (f) => "/" + relative(resolve(out, "bundle"), f.path).replaceAll("\\", "/") === url.pathname,
  );
  if (asset) {
    res.setHeader("Content-Type", types[extname(asset.path)] || "application/octet-stream");
    return res.end(asset.contents);
  }
  if (["/fonts/", "/home/", "/book-covers/", "/media/"].some((p) => url.pathname.startsWith(p))) {
    const base = resolve(root, "public");
    const path = resolve(base, "." + url.pathname);
    if (!path.startsWith(base + "/") && !path.startsWith(base + "\\")) {
      res.statusCode = 403;
      return res.end();
    }
    try {
      const body = await readFile(path);
      res.setHeader("Content-Type", types[extname(path)] || "application/octet-stream");
      return res.end(body);
    } catch {
      res.statusCode = 404;
      return res.end();
    }
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/client.css"><body><div id="app"></div><script src="/client.js"></script></body></html>`,
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
const scrollTo = (page, selector, share) =>
  page.evaluate(
    ([selector, share]) => {
      const el = document.querySelector(selector);
      scrollBy(0, el.getBoundingClientRect().top - innerHeight * share);
    },
    [selector, share],
  );
const circles = (page) =>
  page.locator(".uz-fx-circles").evaluate((list) => {
    const drift = new DOMMatrix(getComputedStyle(list).transform).m41;
    const ys = [...list.children].map((li) => new DOMMatrix(getComputedStyle(li).transform).m42);
    return { drift, ys };
  });
const typed = (page) =>
  page.locator(".uz-fx-said .uz-ag-ch").evaluateAll((els) => {
    const shown = els.filter((el) => getComputedStyle(el).opacity === "1").length;
    return { shown, total: els.length };
  });
const letters = (page, n) =>
  page
    .locator(`.uz-fx-row >> nth=${n}`)
    .locator(".uz-ag-letter")
    .evaluateAll((els) => {
      const ops = els.map((el) => Number(getComputedStyle(el).opacity));
      return {
        first: ops[0],
        last: ops[ops.length - 1],
        full: ops.filter((o) => o === 1).length,
        total: ops.length,
      };
    });
// Any coloured text, border or fill in a section (images aside).
const colours = (page, selector) =>
  page.locator(selector).evaluate((section) => {
    const tinted = [];
    const isGrey = (value) => {
      for (const m of value.matchAll(/rgba?\(([^)]+)\)/g)) {
        const [r, g, b, a = 1] = m[1]
          .split(/[ ,/]+/)
          .filter(Boolean)
          .map(Number);
        if (Number(a) === 0) continue;
        if (Math.max(r, g, b) - Math.min(r, g, b) > 4) return false;
      }
      return true;
    };
    for (const el of section.querySelectorAll("*")) {
      // Uzyra herself is blue (#3C82F6); everything else is black, white and greys.
      if (el.closest(".uz-cube")) continue;
      const s = getComputedStyle(el);
      for (const prop of [
        "color",
        "backgroundColor",
        "borderTopColor",
        "fill",
        "stroke",
        "backgroundImage",
      ]) {
        const v = s[prop];
        if (v && !isGrey(v)) tinted.push(`${el.className?.baseVal ?? el.className} ${prop} ${v}`);
      }
    }
    return tinted;
  });

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
    await page.locator(".uz-fx-statement[data-wave='on']").waitFor();
    await page.evaluate(() => document.fonts.ready);

    // Below the fold: nothing typed, the circles still, no drift.
    await page.waitForTimeout(400);
    assert.equal((await typed(page)).shown, 0, "not typed before it is in view");
    const resting = await circles(page);
    assert.ok(Math.abs(resting.drift) < 0.5, `no drift below the fold (${resting.drift})`);

    // In view: the statement types itself in (0.02s a character), the circles ripple.
    await scrollTo(page, ".uz-fx-said", 0.5);
    const total = (await typed(page)).total;
    await page.waitForTimeout(500);
    const part = await typed(page);
    assert.ok(part.shown > 5 && part.shown < total, `typing (${part.shown}/${total})`);
    await page.waitForTimeout(total * 20 + 600);
    assert.equal((await typed(page)).shown, total, "typed in full");
    const a = await circles(page);
    assert.ok(
      a.ys.every((y) => Math.abs(y) <= 35.01),
      "ripple stays within 35px",
    );
    assert.ok(Math.max(...a.ys) - Math.min(...a.ys) > 40, "the row ripples");
    await page.waitForTimeout(300);
    const b = await circles(page);
    assert.ok(
      a.ys.some((y, i) => Math.abs(y - b.ys[i]) > 0.5),
      "the ripple moves",
    );
    // Drift: further down the page, further left (at most 250px).
    assert.ok(a.drift < -1 && a.drift >= -250, `drifts left with the scroll (${a.drift})`);
    await page.evaluate(() => scrollBy(0, 200));
    await page.waitForTimeout(100);
    const c = await circles(page);
    assert.ok(c.drift < a.drift, `drifts more as it goes up (${a.drift} -> ${c.drift})`);
    await page.screenshot({ path: resolve(out, engine + "-statement-" + width + ".png") });

    // The rows: each description waits, then fades in letter by letter from its title.
    for (let n = 0; n < 5; n++) {
      const row = `.uz-fx-row >> nth=${n}`;
      const before = await letters(page, n);
      if ((await page.locator(row).locator(".uz-fx-title").boundingBox()).y > height) {
        assert.equal(before.full, 0, `row ${n} waits below the fold`);
      }
      await page.locator(row).evaluate((el) => {
        const title = el.querySelector(".uz-fx-title");
        scrollBy(0, title.getBoundingClientRect().top - innerHeight * 0.6);
      });
      // The first letters land within about 300 ms; a busy CI runner (WebKit) can lag a frame or
      // two, so allow up to a second, while the last letters must still be fading.
      await page.waitForTimeout(300);
      let early = await letters(page, n);
      let waited = 0;
      for (; waited < 7 && early.first <= 0.95; waited++) {
        await page.waitForTimeout(100);
        early = await letters(page, n);
      }
      assert.ok(early.first > 0.95, `row ${n}: first letters in (${early.first})`);
      // (On phones the previous live picture may already have scrolled this title into view.)
      if (before.full === 0 && waited === 0) {
        assert.ok(early.last < 1, `row ${n}: last letters still fading`);
      }
      await page.waitForTimeout(early.total * 5 + 300);
      assert.equal((await letters(page, n)).full, early.total, `row ${n}: all in`);
      if (n < 2) {
        // The live pictures start once they are well in view (on phones they sit under the text).
        await page
          .locator(row)
          .locator(".uz-fx-media")
          .evaluate((el) => {
            scrollBy(0, el.getBoundingClientRect().top - innerHeight * 0.3);
          });
      }
      if (n === 0) {
        // Talk: the German opens its meaning by itself, and a tap closes and reopens it.
        const chip = page.locator(".uz-fx-word-chip");
        await page.waitForFunction(
          () =>
            document.querySelector(".uz-fx-word-chip")?.getAttribute("aria-expanded") === "true",
          null,
          { timeout: 6000 },
        );
        await chip.click();
        assert.equal(await chip.getAttribute("aria-expanded"), "false", "a tap closes the meaning");
        await chip.click();
        assert.equal(await chip.getAttribute("aria-expanded"), "true", "a tap opens it again");
        await page.waitForTimeout(300);
      }
      if (n === 1) {
        // Words: the list turns into flashcards by itself; the button goes back and forth.
        await page.waitForSelector(".uz-fx-stack[data-shown]", { timeout: 6000 });
        await page.waitForTimeout(700);
        await page.screenshot({ path: resolve(out, `${engine}-row2-cards-${width}.png`) });
        await page.locator(".uz-fx-turn").click();
        assert.equal(await page.locator(".uz-fx-stack[data-shown]").count(), 0, "back to the list");
        await page.waitForTimeout(600);
      }
      await page.screenshot({ path: resolve(out, `${engine}-row${n + 1}-${width}.png`) });
      if (phone) {
        const copy = await page.locator(row).locator(".uz-fx-copy").boundingBox();
        const media = await page.locator(row).locator(".uz-fx-media").boundingBox();
        assert.ok(copy.y + copy.height <= media.y + 1, `row ${n}: copy above the picture`);
        assert.equal(
          await page
            .locator(row)
            .locator(".uz-fx-title")
            .evaluate((el) => getComputedStyle(el).textAlign),
          "center",
        );
      } else {
        const copy = await page.locator(row).locator(".uz-fx-copy").boundingBox();
        const media = await page.locator(row).locator(".uz-fx-media").boundingBox();
        assert.ok(copy.x + copy.width < media.x, `row ${n}: copy beside the picture`);
        assert.ok(Math.abs(media.width - media.height) < 1.5, `row ${n}: square picture`);
      }
      // Every picture fits its square: nothing spills out of the panel.
      const spill = await page
        .locator(row)
        .locator(".uz-fx-media")
        .evaluate((media) => {
          const box = media.getBoundingClientRect();
          // The study shot runs off the edge on purpose; the drawn panels must fit.
          return [
            ...media.querySelectorAll(
              ".uz-fx-panel, .uz-fx-bubble, .uz-fx-talk-cube, .uz-fx-meaning",
            ),
          ].some((el) => {
            const r = el.getBoundingClientRect();
            return (
              r.top < box.top - 0.5 ||
              r.bottom > box.bottom + 0.5 ||
              el.scrollHeight > el.clientHeight + 1
            );
          });
        });
      assert.equal(spill, false, `row ${n}: picture fits`);
    }
    // The study screenshot loads.
    const img = page.locator(".uz-fx-shot img");
    await img.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector(".uz-fx-shot img")?.naturalWidth > 0);
    // The CTA sits under the last row.
    await page.locator(".uz-fx-button").scrollIntoViewIfNeeded();
    assert.equal(await page.locator(".uz-fx-button").getAttribute("href"), "/learn");

    // The library: the heading types itself in, the books rise one after another.
    await page.locator(".uz-lib-title").scrollIntoViewIfNeeded();
    await scrollTo(page, ".uz-lib-title", 0.4);
    await page.waitForSelector(".library-shelves .bk-item", { timeout: 8000 });
    await page.waitForTimeout(1600);
    const libTyped = await page
      .locator(".uz-lib-title .uz-ag-ch")
      .evaluateAll((els) => els.every((el) => getComputedStyle(el).opacity === "1"));
    assert.ok(libTyped, "library heading typed");
    await scrollTo(page, ".library-shelves", 0.3);
    await page.waitForTimeout(1800);
    const books = await page
      .locator(".library-shelves .bk-item")
      .evaluateAll((els) => els.map((el) => Number(getComputedStyle(el).opacity)));
    assert.ok(books.length > 6 && books.every((o) => o === 1), "the books have risen in");
    await page.screenshot({ path: resolve(out, `${engine}-library-${width}.png`) });

    // Under the hood: the demo, bars drawn with the scroll, the number counted up.
    await scrollTo(page, ".uz-hood-demo", 0.25);
    await page.waitForTimeout(4600);
    await page.screenshot({ path: resolve(out, `${engine}-hood-demo-${width}.png`) });
    const barScale = () =>
      page
        .locator(".uz-hood-bar >> nth=0")
        .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
    await scrollTo(page, ".uz-hood-turn", 0.98);
    await page.waitForTimeout(150);
    const early = await barScale();
    await scrollTo(page, ".uz-hood-turn", 0.1);
    await page.waitForTimeout(150);
    const late = await barScale();
    assert.ok(early < 0.2 && late > 0.98, `bars draw with the scroll (${early} -> ${late})`);
    await page.screenshot({ path: resolve(out, `${engine}-hood-turn-${width}.png`) });
    await scrollTo(page, ".uz-hood-measured", 0.4);
    await page.waitForTimeout(1700);
    assert.equal(await page.locator(".uz-hood-number [data-count]").innerText(), "75");
    await page.screenshot({ path: resolve(out, `${engine}-hood-facts-${width}.png`) });

    for (const section of [".uz-fx", ".uz-lib", ".uz-hood"]) {
      assert.deepEqual(await colours(page, section), [], `${section}: black, white and greys only`);
    }

    // Emith: her card types its title, her poses change on their own and on a tap, and the blue
    // dash field is drawn and moving.
    await scrollTo(page, ".uz-emith-card", 0.5);
    await page.waitForTimeout(1600);
    const emith = () =>
      page.evaluate(() => {
        const c = document.querySelector(".uz-emith-field");
        const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
        let lit = 0,
          blue = 0,
          sum = 0;
        for (let i = 0; i < d.length; i += 16) {
          if (d[i + 3] === 0) continue;
          lit += 1;
          if (d[i + 2] > d[i] + 60) blue += 1;
          sum = (sum + d[i + 3] * (i % 9973)) % 1e9;
        }
        const on = [...document.querySelectorAll(".uz-emith-float img")].findIndex((img) =>
          img.hasAttribute("data-on"),
        );
        const typed = [...document.querySelectorAll(".uz-emith-ch")].every(
          (el) => getComputedStyle(el).opacity === "1",
        );
        const img = document.querySelector(".uz-emith-float img[data-on]");
        return { lit, blue, sum, on, typed, loaded: img.complete && img.naturalWidth > 0 };
      });
    const e1 = await emith();
    assert.ok(e1.lit > 200 && e1.blue / e1.lit > 0.9, `blue dashes drawn (${e1.blue}/${e1.lit})`);
    assert.ok(e1.typed, "the title is typed in");
    assert.ok(e1.loaded, "Emith's pose image loaded");
    await page.waitForTimeout(300);
    assert.notEqual((await emith()).sum, e1.sum, "the dash field turns");
    await page.waitForTimeout(3000);
    const e2 = await emith();
    assert.notEqual(e2.on, e1.on, `her pose changes on its own (${e1.on} -> ${e2.on})`);
    await page.locator(".uz-emith-figure").click();
    await page.waitForTimeout(150);
    assert.equal((await emith()).on, (e2.on + 1) % 8, "a tap plays her next pose");
    await page.screenshot({ path: resolve(out, `${engine}-emith-${width}.png`) });

    // Off screen the circles stop.
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(200);
    const away = await circles(page);
    await page.waitForTimeout(400);
    assert.deepEqual((await circles(page)).ys, away.ys, "the ripple pauses off screen");
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      "no sideways scroll",
    );
    findings.push({ engine, width, height, phone, acceptance: "passed" });
    await context.close();
  }

  // Reduced motion: everything there at once, nothing moving.
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/");
  await page.locator(".uz-fx").waitFor();
  await scrollTo(page, ".uz-fx-said", 0.5);
  await page.waitForTimeout(200);
  const t = await typed(page);
  assert.equal(t.shown, t.total, "statement shown at once");
  const still = await circles(page);
  assert.ok(still.drift === 0, "no drift");
  await page.waitForTimeout(400);
  assert.deepEqual((await circles(page)).ys, still.ys, "no ripple");
  await page.locator(".uz-fx-row >> nth=2").scrollIntoViewIfNeeded();
  const all = await letters(page, 4);
  assert.equal(all.full, all.total, "descriptions shown at once, even below the fold");
  assert.equal(await page.locator(".uz-fx-stack[data-shown]").count(), 1, "words shown as cards");
  await page.locator(".uz-lib").scrollIntoViewIfNeeded();
  await page.waitForSelector(".library-shelves .bk-item", { state: "attached", timeout: 8000 });
  const calm = await page.evaluate(() => ({
    bars: [...document.querySelectorAll(".uz-hood-bar")].every(
      (el) => getComputedStyle(el).transform === "none",
    ),
    count: document.querySelector(".uz-hood-number [data-count]")?.textContent,
    books: [...document.querySelectorAll(".library-shelves .bk-item")].every(
      (el) => getComputedStyle(el).opacity === "1",
    ),
  }));
  assert.deepEqual(calm, { bars: true, count: "75", books: true }, "all still");
  await page.locator(".uz-emith-card").scrollIntoViewIfNeeded();
  await page.waitForTimeout(3400);
  const emithCalm = await page.evaluate(() => ({
    typed: [...document.querySelectorAll(".uz-emith-ch")].every(
      (el) => getComputedStyle(el).opacity === "1",
    ),
    pose: [...document.querySelectorAll(".uz-emith-float img")].findIndex((img) =>
      img.hasAttribute("data-on"),
    ),
    float: getComputedStyle(document.querySelector(".uz-emith-float")).animationName,
  }));
  assert.deepEqual(emithCalm, { typed: true, pose: 0, float: "none" }, "Emith holds still");
  await page.screenshot({ path: resolve(out, engine + "-reduced.png") });
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
