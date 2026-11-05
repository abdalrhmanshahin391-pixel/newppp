// Actual StudyPage / orb / window / quiz. Only server functions, voice and phrase dialog
// are inert fixtures: this preview cannot log in, call a model, or change a live account.
import { build } from "esbuild";
import { compile } from "@tailwindcss/node";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve, relative, extname } from "node:path";
import { createServer } from "node:http";
import assert from "node:assert/strict";

const root = process.cwd(),
  out = resolve(root, "output/question-preview");
await mkdir(out, { recursive: true });
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {createRootRoute,createRoute,createRouter,RouterProvider,Outlet} from '@tanstack/react-router';
import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import {StudyPage} from './src/components/rita-study/StudyPage';
import {SAMPLE_PRESENT_SIMPLE} from './src/lib/guides/guide-samples';
import {PREVIEW_QUESTIONS} from './src/components/rita-study/question-preview';
const lang=new URLSearchParams(location.search).get('lang')==='en'?'en':'ar';
if(new URLSearchParams(location.search).has('stress')) for(const q of PREVIEW_QUESTIONS){q.question.ar='اختار الإجابة المناسبة للنص الطويل. '.repeat(12);q.question.en='Choose an answer for this longer question. '.repeat(12);q.options=q.options.map(x=>x+' '+ 'LongUnbrokenText'.repeat(16));}
i18n.use(initReactI18next).init({lng:lang,fallbackLng:'en',resources:{ar:{translation:{}},en:{translation:{}}},interpolation:{escapeValue:false}});
const data={lesson:{id:'question-design-preview',title:'Present simple',title_ar:'المضارع البسيط',topic:'sample',objectives:[]},guide:{id:'sample',title:'Present simple',version:1,content:SAMPLE_PRESENT_SIMPLE,learner_path:'',allow_download:false},preview:true};
const r=createRootRoute({component:()=> <Outlet/>});
const p=createRoute({getParentRoute:()=>r,path:'/preview',component:()=> <StudyPage data={data}/>});
const router=createRouter({routeTree:r.addChildren([p])});
localStorage.setItem('uzyra-study-sound','off');
createRoot(document.getElementById('app')).render(<RouterProvider router={router}/>);
`;
const result = await build({
  stdin: { contents: entry, loader: "tsx", resolveDir: root },
  bundle: true,
  format: "iife",
  platform: "browser",
  write: false,
  outdir: resolve(out, "bundle"),
  alias: { "@": resolve(root, "src") },
  external: ["/fonts/*"],
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "offline-boundaries",
      setup(b) {
        b.onResolve(
          {
            filter:
              /(^@tanstack\/react-start$|[\\/]RitaRealtimeV3$|[\\/]PhraseDialog$|\.functions$)/,
          },
          (args) => ({ path: args.path, namespace: "fixture" }),
        );
        b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => {
          if (path.endsWith("RitaRealtimeV3"))
            return {
              loader: "tsx",
              contents: `import React from 'react'; import {UzyraWordmark} from '@/components/brand/UzyraWordmark'; export function RitaRealtimeV3(){return <div className="qa-rita"><UzyraWordmark size={13} withMark={false}/><div className="qa-cube"><i/><i/></div><p>معاينة التصميم · بدون مكالمة</p></div>}`,
              resolveDir: root,
            };
          if (path.endsWith("PhraseDialog"))
            return { contents: "export const PhraseDialog=()=>null;" };
          if (path === "@tanstack/react-start")
            return { contents: "export const useServerFn=f=>f;" };
          const names = [
            "studyGuideDownload",
            "studyMakeCards",
            "studyMakeMcq",
            "resolveReplyRequest",
            "resolveStudyRequest",
            "studyExplainReplyText",
            "studyExplainText",
          ];
          return {
            contents: names
              .map(
                (name) =>
                  `export function ${name}(){throw new Error('Unexpected backend call in design preview')}`,
              )
              .join("\n"),
          };
        });
      },
    },
  ],
});
const source = await readFile(resolve(root, "src/styles.css"), "utf8");
const compiler = await compile(source, { base: root, onDependency: () => {} });
let tokens = new Set();
for (const name of await readdir(resolve(root, "src/components/rita-study"))) {
  if (!name.endsWith(".tsx")) continue;
  const text = await readFile(resolve(root, "src/components/rita-study", name), "utf8");
  for (const token of text.match(/[\w!:/.[\]#%(),+-]+/g) || []) tokens.add(token);
}
const css =
  compiler.build([...tokens]) +
  result.outputFiles.find((f) => f.path.endsWith(".css")).text +
  `
.qa-rita{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:32px;font:600 13px Figtree,sans-serif;letter-spacing:.12em}.qa-rita p{font-size:12px;color:#6a697c;letter-spacing:0}.qa-cube{display:flex;gap:12px;align-items:center;justify-content:center;width:96px;height:88px;border-radius:25px 22px 24px 19px;background:#101010;transform:rotate(-3deg)}.qa-cube i{width:12px;height:24px;background:#fff;border-radius:8px}
`;
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/client.js") {
    res.setHeader("Content-Type", "text/javascript");
    return res.end(result.outputFiles.find((f) => f.path.endsWith(".js")).text);
  }
  if (url.pathname === "/client.css") {
    res.setHeader("Content-Type", "text/css");
    return res.end(css);
  }
  if (
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/brand/") ||
    /\.(png|webp|jpg|svg)$/.test(url.pathname)
  ) {
    const path = resolve(root, "public", "." + url.pathname);
    if (
      !path.startsWith(resolve(root, "public") + "/") &&
      !path.startsWith(resolve(root, "public") + "\\")
    ) {
      res.statusCode = 403;
      return res.end();
    }
    try {
      res.setHeader("Content-Type", extname(path) === ".woff2" ? "font/woff2" : "image/png");
      return res.end(await readFile(path));
    } catch {
      res.statusCode = 404;
      return res.end();
    }
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/client.css"></head><body><div id="app"></div><script src="/client.js"></script></body></html>',
  );
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = "http://127.0.0.1:" + server.address().port;
if (process.argv.includes("--serve")) {
  console.log("Question preview: " + origin + "/preview");
  await new Promise(() => {});
}
const pw = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const engine = process.env.BROWSER || "chromium";
const browser = await pw[engine].launch({ headless: true });
const findings = [];
const correctTexts = new Set([
  "She watches TV every evening.",
  "studies",
  "has",
  "plays",
  "goes",
  "They work in Amman.",
]);
async function answer(p, right = true) {
  const choices = await p.locator(".qp-option-text").allTextContents();
  const index = choices.findIndex((text) => correctTexts.has(text) === right);
  assert.ok(index >= 0);
  await p.locator(".qp-option").nth(index).click();
  await p.locator(".qp-submit").click();
}
async function open(p) {
  await p.locator(".st-orb").waitFor();
  await p.locator(".st-orb").click();
  await p.getByRole("menuitem", { name: "معاينة الأسئلة", exact: true }).click();
  await p.locator(".qp").waitFor();
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
}
try {
  for (const width of process.env.QA_WIDTHS
    ? process.env.QA_WIDTHS.split(",").map(Number)
    : [390, 768, 1180, 1280])
    for (const lang of ["ar", "en"]) {
      const p = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 } });
      const errors = [],
        remote = [];
      p.on("pageerror", (e) => errors.push(e.message));
      p.on("request", (r) => {
        if (!r.url().startsWith(origin) && !r.url().startsWith("data:")) remote.push(r.url());
      });
      await p.goto(origin + "/preview?lang=" + lang);
      await open(p);
      const start = await p.locator(".qp").evaluate((el) => ({
        overflow: el.scrollWidth > el.clientWidth + 1,
        font: getComputedStyle(el).fontFamily,
        radios: el.querySelectorAll("input[type=radio]").length,
      }));
      assert.equal(start.overflow, false);
      assert.equal(start.radios, 4);
      assert.match(start.font, /Uzyra Quiz Inter/);
      assert.equal(
        await p.locator(".qp-toolbar").evaluate((el) => el.scrollWidth > el.clientWidth + 1),
        false,
      );
      if (width === 390)
        assert.equal(
          await p.locator(".qp-toolbar").evaluate((el) => getComputedStyle(el).display),
          "grid",
        );
      assert.equal(await p.locator(".qp-submit").isDisabled(), true);
      await p.screenshot({ path: resolve(out, `${engine}-${lang}-${width}-initial.png`) });
      await answer(p);
      assert.equal(await p.locator(".qp-feedback").count(), 1);
      assert.equal(await p.locator(".qp-options").getAttribute("disabled"), "");
      assert.equal(await p.getByRole("progressbar").getAttribute("aria-valuenow"), "1");
      await p
        .locator(".qp-arrows")
        .getByRole("button", {
          name: lang === "ar" ? "السؤال التالي" : "Next question",
          exact: true,
        })
        .click();
      await p
        .locator(".qp-arrows")
        .getByRole("button", {
          name: lang === "ar" ? "السؤال السابق" : "Previous question",
          exact: true,
        })
        .click();
      assert.equal(await p.locator(".qp-feedback").count(), 1);
      await p
        .getByRole("button", {
          name: lang === "ar" ? "حفظ التمارين" : "Save exercises",
          exact: true,
        })
        .click();
      assert.equal(await p.locator(".qp-save-menu").isVisible(), true);
      await p.keyboard.press("Escape");
      assert.equal(await p.locator(".qp-save-menu").count(), 0);
      await p.getByRole("button", { name: "أخفِ النافذة", exact: true }).click();
      await p.getByRole("button", { name: "النوافذ المخفية", exact: true }).click();
      await p.getByRole("menuitem", { name: "Uzyra", exact: true }).click();
      await p.locator(".qp-feedback").waitFor({ state: "visible" });
      await p.waitForTimeout(550);
      assert.equal(await p.getByRole("progressbar").getAttribute("aria-valuenow"), "1");
      await p.screenshot({ path: resolve(out, `${engine}-${lang}-${width}-answered.png`) });
      await p.locator(".qp-arrows button").nth(1).click();
      await answer(p, false);
      assert.equal(await p.locator(".qp-feedback").getAttribute("data-correct"), "false");
      await p.locator(".qp-arrows button").nth(1).click();
      await answer(p);
      assert.equal(await p.getByRole("progressbar").getAttribute("aria-valuenow"), "3");
      assert.match(await p.locator(".qp-score").innerText(), /67%/);
      await p.screenshot({ path: resolve(out, `${engine}-${lang}-${width}-complete.png`) });
      assert.deepEqual(errors, []);
      assert.deepEqual(remote, [], "preview must stay offline");
      findings.push({ width, lang, ...start, errors, remote });
      console.log(`${engine}: ${lang} ${width}px passed`);
      await p.close();
    }
  const stress = await browser.newPage({
    viewport: { width: 320, height: 844 },
    reducedMotion: "reduce",
  });
  await stress.goto(origin + "/preview?stress&lang=ar");
  await open(stress);
  assert.equal(
    await stress.locator(".qp-scroll").evaluate((el) => el.scrollWidth > el.clientWidth + 1),
    false,
  );
  assert.equal(
    await stress.locator(".qp-toolbar").evaluate((el) => el.scrollWidth > el.clientWidth + 1),
    false,
  );
  await stress.screenshot({ path: resolve(out, `${engine}-stress-320.png`) });
  await stress.setViewportSize({ width: 640, height: 450 });
  assert.equal(
    await stress.locator(".qp-scroll").evaluate((el) => el.scrollWidth > el.clientWidth + 1),
    false,
  );
  await stress.close();
  const keys = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  await keys.goto(origin + "/preview?lang=en");
  await open(keys);
  await keys.locator(".qp-option input").first().focus();
  await keys.keyboard.press("ArrowRight");
  assert.equal(await keys.locator(".qp-option input").nth(1).isChecked(), true);
  await keys.getByRole("button", { name: "Flag question", exact: true }).click();
  assert.equal(
    await keys
      .getByRole("button", { name: "Flag question", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  const corner = await keys.locator(".fw-corner.is-br").boundingBox();
  await keys.mouse.move(corner.x + 12, corner.y + 12);
  await keys.mouse.down();
  await keys.mouse.move(corner.x - 500, corner.y - 220, { steps: 10 });
  await keys.mouse.up();
  assert.equal(
    await keys.locator(".qp-toolbar").evaluate((el) => el.scrollWidth > el.clientWidth + 1),
    false,
  );
  await keys.screenshot({ path: resolve(out, `${engine}-resized.png`) });
  await keys.close();
  if (process.env.RECORD_VIDEO === "1")
    for (const width of [390, 1180]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 820 },
        recordVideo: { dir: out, size: { width, height: width === 390 ? 844 : 820 } },
      });
      const p = await context.newPage();
      await p.goto(origin + "/preview");
      await open(p);
      await p.locator(".qp-option input").nth(1).check();
      await p.locator(".qp-submit").click();
      await p.waitForTimeout(800);
      await p
        .locator(".qp-arrows")
        .getByRole("button", { name: "السؤال التالي", exact: true })
        .click();
      await p.waitForTimeout(800);
      await p.getByRole("button", { name: "حفظ التمارين", exact: true }).click();
      await p.waitForTimeout(800);
      const video = p.video();
      await context.close();
      await video.saveAs(resolve(out, `${engine}-${width}.webm`));
    }
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
await writeFile(resolve(out, `${engine}-checks.json`), JSON.stringify(findings, null, 2));
console.log(JSON.stringify(findings, null, 2));
