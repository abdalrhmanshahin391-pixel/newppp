// Isolated checks of the actual learning UI. No live site, login or backend.
// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/check-learn-navigation.mjs
// --baseline compares the immutable pre-change implementation.
import { build } from "esbuild";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, relative, extname } from "node:path";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

const root = process.cwd(),
  out = resolve(root, "output/learn-preview");
await mkdir(out, { recursive: true });
const baseline = process.argv.includes("--baseline");
const revision = "f786d6207915a698392b92565b5e1c52fdde99b0";
const original = (path) =>
  execFileSync(
    "git",
    ["-c", "safe.directory=" + root.replaceAll("\\", "/"), "show", revision + ":" + path],
    { cwd: root, encoding: "utf8" },
  );
let panel = 'import { LearnSections } from "./src/components/learn/LearnHomeView";';
if (baseline) {
  const old = original("src/components/learn/LearnHome.tsx");
  panel = old
    .slice(0, old.indexOf("/** /learn:"))
    .split("\n")
    .filter(
      (l) =>
        !/import.*(useTranslation|SiteHeader|useLessonPath|useAuth|useLearningLanguage|LanguageChooserCard|showsGermanLab|useStudyOverview|lessonsDone)/.test(
          l,
        ),
    )
    .join("\n");
  panel += `
export function LearnSections({lang,showGerman,chips}){
 const sections=buildSections(chips);
 const rail=useMemo(()=>showGerman?RAIL:RAIL.filter(x=>x.id!=="german"),[showGerman]);
 const ids=useMemo(()=>rail.map(x=>x.id),[rail]);const [active,choose]=useSection(ids);
 return <div className="uz-learn-grid"><SideList lang={lang} rail={rail} active={active} onChoose={choose}/><div className="min-w-0">{sections.filter(x=>x.id===active).map(section=><Section key={section.id} section={section} lang={lang}/>)}</div></div>;
}`;
}
const entry =
  `
import React,{useState as usePreviewState} from "react";
import {createRoot} from "react-dom/client";
import {createBrowserHistory,createRootRoute,createRoute,createRouter,RouterProvider,Outlet} from "@tanstack/react-router";
import {UzyraWordmark} from "./src/components/brand/UzyraWordmark";
` +
  panel +
  `
const q=new URLSearchParams(location.search),lang=q.get("lang")==="ar"?"ar":"en";
function Shell(){
 const [german,setGerman]=usePreviewState(true);
 const chips=q.has("stress")?{flashcards:{en:"1000 due "+"W".repeat(70),ar:"١٠٠٠ مستحقة "+"كلمةطويلة".repeat(12)},lessons:{en:"1000 of 1000 done",ar:"١٠٠٠ من ١٠٠٠ منجزة"}}:{flashcards:null,lessons:null};
 return <div className="edith-premium uz-learn"><header className="qa-header"><UzyraWordmark size={24}/><span>{lang==="ar"?"ابدأ التعلّم":"Start learning"}</span></header><main className="uz-learn-main"><LearnSections lang={lang} showGerman={german} chips={chips}/></main><footer className="qa-footer"><button onClick={()=>setGerman(x=>!x)}>Test language availability</button></footer></div>;
}
const rootRoute=createRootRoute({component:()=> <Outlet/>});
const pageRoute=createRoute({getParentRoute:()=>rootRoute,path:"/learn",component:Shell});
const fallback=createRoute({getParentRoute:()=>rootRoute,path:"$",component:()=>null});
const router=createRouter({routeTree:rootRoute.addChildren([pageRoute,fallback]),history:createBrowserHistory(),scrollRestoration:true});
createRoot(document.getElementById("app")).render(<RouterProvider router={router}/>);
`;
const result = await build({
  stdin: { contents: entry, loader: "tsx", resolveDir: root },
  bundle: true,
  format: "iife",
  platform: "browser",
  write: false,
  alias: { "@": resolve(root, "src") },
  loader: { ".webp": "file", ".jpg": "file" },
  outdir: resolve(out, "bundle"),
  assetNames: "assets/[name]-[hash]",
  publicPath: "/",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: baseline
    ? [
        {
          name: "original-image",
          setup(b) {
            b.onLoad({ filter: /[\\/]learn[\\/]ImageSlot\.tsx$/ }, () => ({
              contents: original("src/components/learn/ImageSlot.tsx"),
              loader: "tsx",
              resolveDir: resolve(root, "src/components/learn"),
            }));
          },
        },
      ]
    : [],
});
const oldCss = baseline ? original("src/styles.css") : "";
const source = (
  baseline ? oldCss : await readFile(resolve(root, "src/styles.css"), "utf8")
).replaceAll("\r\n", "\n");
const from = source.indexOf(
  "/* ===========================================================================\n   The learning home",
);
const to = source.indexOf(
  "/* ===========================================================================\n   Welcome, sign in",
  from,
);
assert.ok(from >= 0 && to > from);
let css = source.slice(from, to);
if (baseline)
  css += oldCss.slice(
    oldCss.indexOf("@keyframes rh-pop"),
    oldCss.indexOf("@media (hover: hover)", oldCss.indexOf("@keyframes rh-pop")),
  );
let fonts = "";
for (const [family, file, weight] of [
  ["Figtree", "figtree-latin-400-normal.woff2", 400],
  ["Figtree", "figtree-latin-600-normal.woff2", 600],
  ["Figtree", "figtree-latin-700-normal.woff2", 700],
  ["Inter Tight", "inter-tight-latin-700-normal.woff2", 700],
  ["Uzyra Footer Arabic", "noto-sans-arabic-arabic-400-normal.woff2", 400],
  ["Uzyra Footer Arabic", "noto-sans-arabic-arabic-700-normal.woff2", 700],
]) {
  const bytes = await readFile(resolve(root, "public/fonts/guides", file));
  fonts +=
    '@font-face{font-family:"' +
    family +
    '";src:url(data:font/woff2;base64,' +
    bytes.toString("base64") +
    ");font-weight:" +
    weight +
    ";font-display:swap}";
}
const reset = `
*{box-sizing:border-box}body{margin:0}a{color:inherit;text-decoration:none}button{font:inherit}h2,p{margin:0}
.edith-premium{--pp-ink:#121117;--pp-muted:#6a697c;--pp-grey:#f4f4f8;--pp-accent:#2b6df0;--pp-accent-soft:#e7eefd;--pp-ease:cubic-bezier(.22,1,.36,1);--font-grotesk:"Figtree","Uzyra Footer Arabic",sans-serif;--pp-display:"Inter Tight","Uzyra Footer Arabic",sans-serif}
.edith-premium h2{font-family:var(--pp-display);font-weight:700;letter-spacing:-.035em;text-wrap:balance}
.rita-btn{display:inline-flex;align-items:center;justify-content:center;height:48px;padding-inline:24px;border:2px solid;border-radius:8px;font-family:Figtree,sans-serif;font-size:18px;font-weight:600;line-height:24px}
.min-w-0{min-width:0}.qa-header{height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 32px;background:#121117;color:#f2f2f5;font:600 15px Figtree,sans-serif;position:sticky;top:0;z-index:2}
.qa-header [role=img]{display:inline-flex;align-items:center;gap:.4em}.qa-header svg{width:1.3em;height:1.3em}.qa-footer{height:300px;padding:30px;background:#f4f4f8}
[dir=rtl] .rtl\\:rotate-180{transform:rotate(180deg)}
`;
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/client.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(result.outputFiles.find((f) => f.path.endsWith(".js")).text);
    return;
  }
  const asset = result.outputFiles.find(
    (f) => "/" + relative(resolve(out, "bundle"), f.path).replaceAll("\\", "/") === url.pathname,
  );
  if (asset) {
    res.setHeader("Content-Type", extname(asset.path) === ".webp" ? "image/webp" : "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.end(asset.contents);
    return;
  }
  const ar = url.searchParams.get("lang") === "ar";
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(
    '<!doctype html><html lang="' +
      (ar ? "ar" : "en") +
      '" dir="' +
      (ar ? "rtl" : "ltr") +
      '"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
      reset +
      css +
      fonts +
      '</style><body><div id="app"></div><script src="/client.js"></script></body></html>',
  );
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = "http://127.0.0.1:" + server.address().port;
if (process.argv.includes("--serve")) {
  console.log("Learning preview: " + origin + "/learn");
  await new Promise(() => {});
}
const pw = await import(process.env.PLAYWRIGHT_MODULE || "playwright"),
  engine = process.env.BROWSER || "chromium";
const browser = await pw[engine].launch({ headless: true }),
  findings = [];
const prefix = (baseline ? "before" : "after") + "-" + engine,
  paneSelector = baseline ? ".uz-pane" : ".uz-panel:not([hidden])";
async function ready(p) {
  await p.locator(".uz-rail a").first().waitFor();
  await p.evaluate(() => document.fonts.ready);
}
async function select(p, id) {
  await p.locator('.uz-rail a[href="#' + id + '"]').click();
  await p.waitForFunction(
    (id) =>
      document.querySelector('.uz-rail a[aria-current="page"]')?.getAttribute("href") === "#" + id,
    id,
  );
}
async function checks(p) {
  return p.evaluate((selector) => {
    const pane = document.querySelector(selector),
      animations = pane.getAnimations({ subtree: true });
    const finite = animations.filter((a) => a.effect.getTiming().iterations !== Infinity);
    return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      infinite: animations.filter((a) => a.effect.getTiming().iterations === Infinity).length,
      maxEntrance: Math.max(
        0,
        ...finite.map(
          (a) => Number(a.effect.getTiming().duration) + Number(a.effect.getTiming().delay),
        ),
      ),
      gradients: [...pane.querySelectorAll(".uz-tile,.uz-stage,.uz-lessons")].some(
        (x) => getComputedStyle(x).backgroundImage !== "none",
      ),
    };
  }, paneSelector);
}
try {
  for (const width of [390, 768, 1180, 1280])
    for (const lang of ["en", "ar"]) {
      const p = await browser.newPage({ viewport: { width, height: 900 } }),
        errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(origin + "/learn?lang=" + lang);
      await ready(p);
      await p
        .locator("main")
        .screenshot({ path: resolve(out, prefix + "-" + lang + "-" + width + "-rita.png") });
      await select(p, "study");
      await p.locator('[data-learn-row="flashcards"] img').evaluate((img) => img.decode());
      const state = await checks(p);
      await p
        .locator("main")
        .screenshot({ path: resolve(out, prefix + "-" + lang + "-" + width + "-study.png") });
      assert.equal(state.overflow, false, "overflow " + lang + " " + width);
      if (!baseline) {
        assert.equal(
          await p
            .locator(".uz-rail a")
            .evaluateAll((links) => links.every((a) => a.getBoundingClientRect().height >= 44)),
          true,
        );
        assert.equal(
          await p
            .locator(".uz-rail a[aria-controls]")
            .evaluateAll((links) =>
              links.every((a) => document.getElementById(a.getAttribute("aria-controls"))),
            ),
          true,
        );
        assert.equal(state.infinite, 0);
        assert.ok(state.maxEntrance <= 150);
        assert.equal(state.gradients, false);
        await p.evaluate(() => {
          window.qaImage = document.querySelector('[data-learn-row="flashcards"] img');
        });
        await select(p, "plan");
        assert.equal(await p.locator("#learn-panel-study").getAttribute("inert"), "");
        assert.equal(await p.locator("#learn-panel-study").isVisible(), false);
        await select(p, "study");
        assert.equal(
          await p.evaluate(
            () => window.qaImage === document.querySelector('[data-learn-row="flashcards"] img'),
          ),
          true,
        );
        await p.goBack();
        await p.waitForFunction(
          () =>
            location.hash === "#plan" &&
            document.querySelector("[aria-current=page]")?.getAttribute("href") === "#plan",
        );
        await p.goForward();
        await p.waitForFunction(
          () =>
            location.hash === "#study" &&
            document.querySelector("[aria-current=page]")?.getAttribute("href") === "#study",
        );
        await p.reload();
        await ready(p);
        await p.waitForFunction(
          () => document.querySelector("[aria-current=page]")?.getAttribute("href") === "#study",
        );
        for (const id of ["plan", "together", "german", "rita", "study", "rita", "plan", "study"])
          await select(p, id);
        await p.locator('.uz-rail a[href="#rita"]').focus();
        await p.keyboard.press("Enter");
        await p.waitForFunction(() => location.hash === "#rita");
        assert.equal(
          await p
            .locator('.uz-rail a[href="#rita"]')
            .evaluate((el) => getComputedStyle(el).outlineStyle),
          "solid",
        );
        if (width >= 1024) {
          await select(p, "study");
          await p.evaluate(() => scrollTo(0, 350));
          await select(p, "plan");
          assert.ok(
            await p
              .locator(".uz-learn-grid")
              .evaluate((el) => el.getBoundingClientRect().top >= 60),
            "short-panel scroll correction",
          );
        }
        await select(p, "german");
        await p.getByRole("button", { name: "Test language availability" }).click();
        assert.equal(await p.locator('.uz-rail a[href="#german"]').count(), 0);
        await p.waitForFunction(
          () => document.querySelector("[aria-current=page]")?.getAttribute("href") === "#rita",
        );
        await p.goto(origin + "/learn?lang=" + lang + "&stress=1#study");
        await ready(p);
        await p.waitForFunction(
          () => document.querySelector("[aria-current=page]")?.getAttribute("href") === "#study",
        );
        assert.equal((await checks(p)).overflow, false, "stress overflow");
        await p.emulateMedia({ reducedMotion: "reduce" });
        await select(p, "plan");
        assert.equal((await checks(p)).maxEntrance, 0);
        await p.setViewportSize({ width: 320, height: 800 });
        await select(p, "study");
        assert.equal((await checks(p)).overflow, false);
        // Equivalent CSS viewport at 200% zoom on a 1280px desktop.
        await p.setViewportSize({ width: 640, height: 450 });
        assert.equal((await checks(p)).overflow, false);
      }
      assert.deepEqual(errors, []);
      findings.push({ lang, width, ...state, errors });
      await p.close();
    }
  if (!baseline) {
    const slow = await browser.newPage({ viewport: { width: 1180, height: 900 } });
    await slow.route("**/assets/*.webp", async (route) => {
      await new Promise((done) => setTimeout(done, 250));
      await route.continue();
    });
    await slow.goto(origin + "/learn#study");
    await ready(slow);
    await slow.locator('[data-learn-row="flashcards"]').waitFor();
    assert.equal(await slow.locator('[data-learn-row="flashcards"]').isVisible(), true);
    assert.ok(
      await slow
        .locator('[data-learn-row="flashcards"] .uz-tile-img')
        .evaluate((el) => el.getBoundingClientRect().height > 0),
    );
    await slow.close();
  }
  const p = await browser.newPage({ viewport: { width: 1180, height: 900 } });
  await p.goto(origin + "/learn");
  await ready(p);
  await p.evaluate(() => {
    window.qaSamples = [];
    document.querySelector(".uz-rail").addEventListener(
      "click",
      (e) => {
        const link = e.target.closest("a");
        if (!link) return;
        const start = performance.now(),
          target = link.getAttribute("href"),
          observer = new MutationObserver(() => {
            if (document.querySelector("[aria-current=page]")?.getAttribute("href") !== target)
              return;
            observer.disconnect();
            requestAnimationFrame(() =>
              requestAnimationFrame(() => window.qaSamples.push(performance.now() - start)),
            );
          });
        observer.observe(document.querySelector(".uz-learn-grid"), {
          attributes: true,
          subtree: true,
          childList: true,
        });
      },
      true,
    );
  });
  for (const id of ["study", "plan", "together", "rita", "study", "rita", "plan", "study"])
    await select(p, id);
  await p.waitForTimeout(180);
  const samples = await p.evaluate(() => window.qaSamples);
  findings.push({
    labClickToTwoFramesMs: samples,
    medianMs: [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)],
  });
  await p.close();
  if (!baseline && process.env.RECORD_VIDEO === "1")
    for (const viewport of [
      { width: 1180, height: 820 },
      { width: 390, height: 844 },
    ]) {
      const context = await browser.newContext({
          viewport,
          recordVideo: { dir: out, size: viewport },
        }),
        p = await context.newPage();
      await p.goto(origin + "/learn?lang=ar");
      await ready(p);
      for (const id of ["study", "plan", "together", "rita", "study"]) {
        await select(p, id);
        await p.waitForTimeout(650);
      }
      const video = p.video();
      await context.close();
      await video.saveAs(resolve(out, "navigation-" + engine + "-" + viewport.width + ".webm"));
    }
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
await writeFile(resolve(out, prefix + "-checks.json"), JSON.stringify(findings, null, 2));
console.log(JSON.stringify({ engine, baseline, findings }, null, 2));
