// Real hero, cube, learning panels and shared route backdrop; account boundary is a signed-in fixture.
// No live account, voice provider, database, or remote website is contacted.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { compile } from "@tailwindcss/node";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve, relative, extname } from "node:path";
import { createServer } from "node:http";

const root = process.cwd(),
  out = resolve(root, "output/study-help/contour-cube");
await mkdir(out, { recursive: true });
const entry = `
import React from 'react';import {createRoot} from 'react-dom/client';
import {createRootRoute,createRoute,createRouter,RouterProvider,Outlet,Link} from '@tanstack/react-router';
import {HeroTapWord} from './src/components/home/procreate/HeroTapWord';
import {PageContours} from './src/components/brand/PageContours';
import {LearnSections} from './src/components/learn/LearnHomeView';
import {UzyraWordmark} from './src/components/brand/UzyraWordmark';
const lang=new URLSearchParams(location.search).get('lang')==='ar'?'ar':'en';
function Header(){return <header className="qa-header"><UzyraWordmark size={22}/><nav><Link to="/">Home</Link><Link to="/learn">Learn</Link><Link to="/reader">Reader</Link><Link to="/dark">Dark</Link></nav></header>}
function Home(){return <main className="uz-home rita-cream edith-light edith-premium relative min-h-screen overflow-hidden bg-black text-white"><Header/><HeroTapWord/><div className="qa-tail">Uzyra · Learn at your pace</div></main>}
function Learn(){return <div className="edith-premium edith-light uz-learn min-h-screen"><Header/><main className="uz-learn-main"><LearnSections lang={lang} showGerman={true} chips={{flashcards:null,lessons:null}}/></main></div>}
function Reader(){return <main className="edith-premium qa-reader"><Header/><div className="qa-reader-grid"><section><h1>{lang==='ar'?'اسأل يوزرا':'Ask Uzyra'}</h1><p>{lang==='ar'?'حدّد النص واقرأ بهدوء.':'Select the text and read at your pace.'}</p><button>Open menu</button><details><summary>Reader menu</summary><button>Bookmark</button></details><textarea aria-label="Ask Uzyra" placeholder="Ask Uzyra"/></section><article className="qa-paper"><h2>THIRD PERSON -S AND -ES</h2><p>With he, she and it, the present simple verb changes its ending.</p><p>She studies at night and watches a film on Fridays.</p></article></div></main>}
const r=createRootRoute({component:()=> <PageContours><Outlet/></PageContours>});
const pages=[['/',Home],['/learn',Learn],['/reader',Reader],['/dark',()=> <main className="qa-dark edith-premium"><Header/><h1>Uzyra at night</h1><p>Calm contours, with the page’s existing dark background intact.</p></main>]].map(([path,component])=>createRoute({getParentRoute:()=>r,path,component}));
const router=createRouter({routeTree:r.addChildren(pages)});createRoot(document.getElementById('app')).render(<RouterProvider router={router}/>);
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
  plugins: [
    {
      name: "account-fixture",
      setup(b) {
        b.onResolve({ filter: /[\/]useAuth$/ }, (args) => ({
          path: args.path,
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: "export const useAuth=()=>({user:{id:'local-fixture'},loading:false});",
        }));
      },
    },
  ],
});
const source = await readFile(resolve(root, "src/styles.css"), "utf8");
const compiler = await compile(source, { base: root, onDependency: () => {} });
const tokens = new Set(entry.match(/[\w!:/.[\]#%(),+-]+/g));
for (const directory of [
  "src/components/home/procreate",
  "src/components/rita-study",
  "src/components/learn",
  "src/components/brand",
]) {
  for (const name of await readdir(resolve(root, directory))) {
    if (!name.endsWith(".tsx")) continue;
    const text = await readFile(resolve(root, directory, name), "utf8");
    for (const token of text.match(/[\w!:/.[\]#%(),+-]+/g) || []) tokens.add(token);
  }
}
const css =
  compiler.build([...tokens]) +
  `
body{margin:0}.qa-header{height:64px;padding:0 28px;display:flex;align-items:center;justify-content:space-between;background:#121117;color:white;position:relative;z-index:3;font:500 14px Figtree,sans-serif}.qa-header nav{display:flex;gap:16px}.qa-tail{height:110vh;padding:100px 24px;text-align:center;color:#6a697c}
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
try {
  for (const [width, height, lang] of [
    [390, 844, "en"],
    [768, 1024, "ar"],
    [1280, 900, "en"],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      recordVideo:
        width < 1000
          ? { dir: resolve(out, engine + "-video"), size: { width, height } }
          : undefined,
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin + "/?lang=" + lang);
    await page.locator(".uz-page-contours path").last().waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(4000);
    assert.equal(await page.locator(".uz-page-contours").count(), 1);
    assert.equal(await page.locator(".uz-page-contours path").count(), 9);
    assert.equal(await page.locator(".rh-rings span").count(), 4);
    assert.equal(await page.locator(".rh-hero-cube .uz-cube").count(), 1);
    assert.equal(await page.locator("canvas").count(), 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const before = await page.locator(".uz-page-contours path").first().getAttribute("d");
    await page.waitForTimeout(1000);
    assert.notEqual(await page.locator(".uz-page-contours path").first().getAttribute("d"), before);
    const updates = await page.evaluate(
      () =>
        new Promise((done) => {
          let changes = 0;
          const observer = new MutationObserver((records) => (changes += records.length));
          observer.observe(document.querySelector(".uz-page-contours path"), {
            attributes: true,
            attributeFilter: ["d"],
          });
          setTimeout(() => {
            observer.disconnect();
            done(changes);
          }, 1200);
        }),
    );
    assert.ok(updates >= 6 && updates <= 16, "12Hz path updates: " + updates);
    const positions = await page.evaluate(() => {
      const box = document.querySelector(".rh-hero-cube").getBoundingClientRect();
      const ring = document.querySelector(".rh-rings span").getBoundingClientRect();
      return [
        Math.abs(box.x + box.width / 2 - ring.x - ring.width / 2),
        Math.abs(box.y + box.height / 2 - ring.y - ring.height / 2),
      ];
    });
    assert.ok(
      positions.every((v) => v < 1),
      "cube retains ring centre",
    );
    await page
      .getByRole("button", { name: "Guten Morgen, German. Tap for the meaning.", exact: true })
      .click();
    await page.getByText("صباح الخير", { exact: true }).waitFor();
    await page.screenshot({
      path: resolve(out, engine + "-home-" + width + "-" + lang + ".png"),
      fullPage: false,
    });
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(200);
    const stillCube = await page.locator(".uz-cube-body").getAttribute("style");
    await page.waitForTimeout(400);
    assert.equal(
      await page.locator(".uz-cube-body").getAttribute("style"),
      stillCube,
      "offscreen cube pauses",
    );
    await page.evaluate(() => scrollTo(0, 0));
    await page.getByRole("link", { name: "Learn", exact: true }).click();
    await page.locator(".uz-rail").waitFor();
    assert.equal(
      await page.locator(".uz-page-contours").count(),
      1,
      "one background after route replacement",
    );
    await page.screenshot({
      path: resolve(out, engine + "-learn-" + width + "-" + lang + ".png"),
      fullPage: false,
    });
    await page.getByRole("link", { name: "Reader", exact: true }).click();
    await page.getByRole("textbox", { name: "Ask Uzyra" }).fill("Can I still select and type?");
    await page.locator("summary").click();
    assert.ok(await page.getByRole("button", { name: "Bookmark" }).isVisible());
    assert.equal(
      await page.locator(".qa-paper").evaluate((el) => getComputedStyle(el).backgroundColor),
      "rgb(255, 255, 255)",
    );
    assert.equal(
      await page.locator(".uz-page-contours").evaluate((el) => getComputedStyle(el).pointerEvents),
      "none",
    );
    await page.screenshot({
      path: resolve(out, engine + "-reader-" + width + "-" + lang + ".png"),
      fullPage: false,
    });
    await page.getByRole("link", { name: "Dark", exact: true }).click();
    assert.equal(
      await page.locator(".qa-dark").evaluate((el) => getComputedStyle(el).backgroundColor),
      "rgb(18, 17, 23)",
    );
    assert.equal(
      await page.locator(".uz-page-contours").evaluate((el) => getComputedStyle(el).color),
      "rgb(255, 255, 255)",
    );
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(100);
    const still = await page.locator(".uz-page-contours").innerHTML();
    await page.waitForTimeout(500);
    assert.equal(
      await page.locator(".uz-page-contours").innerHTML(),
      still,
      "reduced motion is static",
    );
    assert.equal(
      await page.locator(".uz-cube-body").evaluate((el) => getComputedStyle(el).transform),
      "none",
    );
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.waitForTimeout(300);
    // Deterministically exercise the visibility event contract; this is not a real background-tab benchmark.
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const hidden = await page.locator(".uz-page-contours").innerHTML();
    await page.waitForTimeout(300);
    assert.equal(
      await page.locator(".uz-page-contours").innerHTML(),
      hidden,
      "hidden document stops path updates",
    );
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(300);
    assert.notEqual(
      await page.locator(".uz-page-contours").innerHTML(),
      hidden,
      "visible document resumes",
    );
    findings.push({
      engine,
      width,
      height,
      lang,
      pathUpdatesIn1200ms: updates,
      acceptance: "passed",
    });
    await context.close();
  }
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
