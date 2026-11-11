// Actual StudyPage, selection, radial menu, request hook and PhraseDialog.
// Server/voice/auth boundaries return explicit fixtures. No account or remote AI is used.
import { build } from "esbuild";
import { compile } from "@tailwindcss/node";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { resolve, extname } from "node:path";
import { createServer } from "node:http";

const root = process.cwd(),
  out = resolve(root, "output/study-help");
await mkdir(out, { recursive: true });
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {createRootRoute,createRoute,createRouter,RouterProvider,Outlet} from '@tanstack/react-router';
import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import {StudyPage} from './src/components/rita-study/StudyPage';
import {SAMPLE_THIRD_PERSON} from './src/lib/guides/guide-samples';
window.qaStarts=0;window.qaAudio=[];
const NativeAudio=window.AudioContext||window.webkitAudioContext;
if(NativeAudio)window.AudioContext=class extends NativeAudio{createOscillator(){const node=super.createOscillator();const start=node.start.bind(node),stop=node.stop.bind(node);node.start=(...args)=>{window.qaAudio.push({event:'start',type:node.type});return start(...args)};node.stop=(...args)=>{window.qaAudio.push({event:'stop',type:node.type});return stop(...args)};return node}};
const lang=new URLSearchParams(location.search).get('lang')==='en'?'en':'ar';
i18n.use(initReactI18next).init({lng:lang,fallbackLng:'en',resources:{ar:{translation:{}},en:{translation:{}}},interpolation:{escapeValue:false}});
SAMPLE_THIRD_PERSON.sections.push({kind:'usage',heading:'In context',items:[{label:'Care',example:'She {{looks after}} her little brother.'},{label:'River',example:'We sat on the river {{bank}}.'},{label:'Money',example:'She went to the {{bank}}.'}]});
SAMPLE_THIRD_PERSON.sections.push({kind:'usage',heading:'Sentence structure',items:[{label:'Reading',example:'She is reading a book.'}]});
const data={lesson:{id:'question-design-preview',title:'Present simple',title_ar:'المضارع البسيط',topic:'sample',objectives:[]},guide:{id:'sample',title:'Present simple',version:1,content:SAMPLE_THIRD_PERSON,learner_path:'',allow_download:false},preview:true};
const r=createRootRoute({component:()=> <Outlet/>});
const p=createRoute({getParentRoute:()=>r,path:'/preview',component:()=> <StudyPage data={data}/>});
const router=createRouter({routeTree:r.addChildren([p])});
if(new URLSearchParams(location.search).has('fresh')) for(const key of Object.keys(localStorage)) if(key.startsWith('rita.phrase.'))localStorage.removeItem(key);
localStorage.setItem('uzyra-study-sound',new URLSearchParams(location.search).has('interaction')?'on':'off');
createRoot(document.getElementById('app')).render(<RouterProvider router={router}/>);
window.qaSelect=(wanted, occurrence=0)=>{
 const doc=document.querySelector('iframe')?.contentDocument;
 if(!doc)throw Error('Guide not ready');
 const matches=[...doc.querySelectorAll('[data-seg]')].filter(el=>el.textContent.includes(wanted));
 const el=matches[occurrence]; if(!el)throw Error('Missing selection: '+wanted);
 const full=el.textContent; const from=full.indexOf(wanted); const to=from+wanted.length;
 const walker=doc.createTreeWalker(el,NodeFilter.SHOW_TEXT); let node,offset=0,start,end;
 while(node=walker.nextNode()){const length=node.textContent.length;if(!start&&from<offset+length)start=[node,from-offset];if(to<=offset+length){end=[node,to-offset];break;}offset+=length;}
 const range=doc.createRange();range.setStart(...start);range.setEnd(...end);el.scrollIntoView({block:'center'});
 const sel=doc.getSelection();sel.removeAllRanges();sel.addRange(range);doc.dispatchEvent(new Event('selectionchange'));
 const rect=range.getClientRects()[0],frame=document.querySelector('iframe'),box=frame.getBoundingClientRect(),scale=box.width/frame.clientWidth;
 return {x:box.left+(rect.left+rect.width*.25)*scale,y:box.top+(rect.top+rect.height*.5)*scale};
};

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
            filter: /(^@tanstack\/react-start$|[\\/]RitaRealtimeV3$|[\\/]tts-auth$|\.functions$)/,
          },
          (args) => ({ path: args.path, namespace: "fixture" }),
        );
        b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => {
          if (path.endsWith("RitaRealtimeV3"))
            return {
              loader: "tsx",
              contents: `import React,{useEffect,useState} from 'react'; import {UzyraWordmark} from '@/components/brand/UzyraWordmark';import {HoldToStart} from '@/components/rita/HoldToStart';export function RitaRealtimeV3({study}){const interaction=new URLSearchParams(location.search).has('interaction');const [messages,setMessages]=useState(interaction?[{role:'rita',text:'She studies at night. He watches a film on Fridays.'},{role:'rita',text:'مع الفاعل المفرد نضيف حرفًا إلى نهاية الفعل. هذا مثال آخر للتحديد.'}]:[]);useEffect(()=>{study.bridge.post=(role,text)=>setMessages(m=>[...m,{role,text}]);return()=>{study.bridge.post=undefined}},[study.bridge]);return <div className="qa-rita"><UzyraWordmark size={13} withMark={false}/>{messages.length?messages.map((m,i)=><p data-reply-text="" className="qa-message" key={i} dir="auto">{m.text}</p>):<><div className="qa-cube"><i/><i/></div><p>معاينة محلية · الردود التجريبية ليست اتصالًا بالخادم</p></>}{interaction&&<><button type="button" onClick={()=>{window.qaControl=(window.qaControl||0)+1}}>زر محادثة تجريبي</button><HoldToStart label="اضغط مطوّلاً لتبدأ" onStart={()=>{window.qaStarts++}}/></>}{study.children}</div>}`,
              resolveDir: root,
            };
          if (path.endsWith("tts-auth"))
            return {
              contents: `export const ttsHeaders=async()=>({"Content-Type":"application/json"});`,
            };
          if (path === "@tanstack/react-start")
            return { contents: "export const useServerFn=f=>f;" };
          const names = [
            "explainPhrase",
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
                  `export async function ${name}({data}){await new Promise(r=>setTimeout(r,new URLSearchParams(location.search).has('slow')?6000:900));if(new URLSearchParams(location.search).has('fail')) return {ok:false,reason:'failed',message:'تعذّر تنفيذ الطلب. جرّب مرة ثانية.'};if('${name}'==='explainPhrase')return {ok:true,explanation:{lang:'en',translation_ar:data.text==='bank'?(data.context.includes('Selected (example): We sat')?'ضفة النهر':'بنك'):'يعتني بـ',pronunciation_ar:'',tip_ar:''}};if('${name}'==='studyMakeCards')return {ok:true,cards:[{front:'looks after',back:'يعتني بـ',note:'عبارة واحدة في سياق الجملة.'},{front:'works',back:'يعمل',note:''}]};if('${name}'==='studyMakeMcq')return {ok:true,questions:[{question:'Choose the correct sentence.',options:['He works every day.','He work every day.','He working every day.','He to work every day.'],answer:0,why:'مع He بالمضارع البسيط بنضيف s للفعل.'},{question:'She ___ English.',options:['study','studying','studies','to study'],answer:2,why:'قبل y حرف ساكن؛ مع She بنحوّل y إلى ies.'}]};if(data.action==='common_mistake')return {ok:true,text:['الغلط: He work every day.','الصح: He works every day.','السبب: مع He بالمضارع البسيط بنضيف s للفعل.'].join(String.fromCharCode(10))};if(data.action==='word_by_word')return {ok:true,text:['She: مين عم يعمل الفعل.','is reading: الفعل عم يصير الآن؛ الجزآن بيشتغلوا مع بعض.','a book: الشي اللي عم تقرأه.'].join(String.fromCharCode(10))};if(data.action==='why_form')return {ok:true,text:'استخدمنا studies لأن الفاعل She. مع study، قبل y حرف ساكن، فبنحوّل y إلى ies.'};return {ok:true,text:'لما نحكي عن he أو she أو it بالمضارع البسيط، غالبًا بنضيف s للفعل. مثال: He works.'}}`,
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
for (const directory of ["src/components/rita-study", "src/components/rita"]) {
  for (const name of await readdir(resolve(root, directory))) {
    if (!name.endsWith(".tsx")) continue;
    const text = await readFile(resolve(root, directory, name), "utf8");
    for (const token of text.match(/[\w!:/.[\]#%(),+-]+/g) || []) tokens.add(token);
  }
}
const css =
  compiler.build([...tokens]) +
  result.outputFiles.find((f) => f.path.endsWith(".css")).text +
  `
#app > .edith-premium {height:100%;}
.qa-rita{overflow:auto;padding:24px;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:32px;font:600 13px Figtree,sans-serif;letter-spacing:.12em}.qa-message{width:100%;max-width:480px;font-size:15px!important;line-height:1.8;letter-spacing:0!important}.qa-rita p{font-size:12px;color:#6a697c;letter-spacing:0}.qa-cube{display:flex;gap:12px;align-items:center;justify-content:center;width:96px;height:88px;border-radius:25px 22px 24px 19px;background:#101010;transform:rotate(-3deg)}.qa-cube i{width:12px;height:24px;background:#fff;border-radius:8px}
.qa-rita:has([data-reply-text]){justify-content:flex-start}.qa-message{flex-shrink:0}
`;
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/api/german/tts") {
    if (url.searchParams.has("fail")) {
      res.statusCode = 500;
      return res.end();
    }
    // Silent WAV fixture tests playback plumbing, never pretends to be real pronunciation.
    const wave = Buffer.alloc(44 + 16000);
    wave.write("RIFF");
    wave.writeUInt32LE(wave.length - 8, 4);
    wave.write("WAVEfmt ", 8);
    wave.writeUInt32LE(16, 16);
    wave.writeUInt16LE(1, 20);
    wave.writeUInt16LE(1, 22);
    wave.writeUInt32LE(8000, 24);
    wave.writeUInt32LE(16000, 28);
    wave.writeUInt16LE(2, 32);
    wave.writeUInt16LE(16, 34);
    wave.write("data", 36);
    wave.writeUInt32LE(16000, 40);
    res.setHeader("Content-Type", "audio/wav");
    return res.end(wave);
  }
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
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/client.css"></head><body><div style="height:44px;display:flex;align-items:center;gap:10px;padding:4px 12px;background:#eef2fa;font:12px sans-serif" dir="rtl"><span>فحص محلي بردود تجريبية</span><button onclick="qaSelect(\'looks after\')">تحديد عبارة</button><button onclick="qaSelect(\'With he, she and it, the present simple verb changes its ending. The ending depends on the last letters of the verb.\')">تحديد قاعدة</button><button onclick="qaSelect(\'She is reading a book.\')">حدّد جملة</button><button onclick="qaSelect(\'studies\')">حدّد studies</button></div><div id="app" style="height:calc(100vh - 44px)"></div><script src="/client.js"></script></body></html>',
  );
});
await new Promise((done) => server.listen(4178, "127.0.0.1", done));
const origin = "http://127.0.0.1:" + server.address().port;
if (process.argv.includes("--serve")) {
  console.log("Study help preview: " + origin + "/preview");
  await new Promise(() => {});
}

if (process.argv.includes("--check")) {
  const pw = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
  const engine = process.env.BROWSER || "chromium";
  const browser = await pw[engine].launch({ headless: true });
  const findings = [];
  async function selectPhrase(page) {
    await page.getByRole("button", { name: "تحديد عبارة", exact: true }).click();
    if (engine === "webkit") {
      // Safari's locked guide frame does not emit the native selection event reliably.
      // Exercise the same parent-owned selection layer that a learner double-taps instead.
      const point = await page.evaluate(() => window.qaSelect("looks after"));
      await page.mouse.dblclick(point.x, point.y);
    }
    try {
      await page.locator('.st-orb[data-state="armed"]').waitFor();
    } catch (error) {
      console.log({
        engine,
        selection: await page.evaluate(() =>
          document.querySelector("iframe")?.contentDocument?.getSelection()?.toString(),
        ),
      });
      await page.screenshot({ path: resolve(out, `${engine}-selection-failure.png`) });
      throw error;
    }
  }
  async function menu(page) {
    await page.locator(".st-orb").click();
    await page.locator(".st-rad.is-shown").waitFor();
    await page.getByRole("menu", { name: "شو بدك نعمل؟", exact: true }).waitFor();
  }
  async function choose(page, label, alreadyOpen = false) {
    if (!alreadyOpen) await menu(page);
    const id = label === "فلاش كاردز" ? "make_cards" : "make_mcq";
    for (let turn = 0; turn < 8; turn += 1) {
      const item = page.locator(`[data-service="${id}"]`);
      if (await item.isVisible()) {
        assert.match(await item.innerText(), new RegExp(label));
        return item.click();
      }
      const more = page.locator('[data-service="__more"]');
      try {
        await more.click();
      } catch (error) {
        console.log({
          label,
          menu: await page
            .locator(".st-rad")
            .innerText()
            .catch(() => "closed"),
          errors: await page.locator("[role=alert]").allTextContents(),
        });
        await page.screenshot({ path: resolve(out, `${engine}-menu-failure.png`) });
        throw error;
      }
    }
    throw new Error("Unreachable study service: " + label);
  }
  try {
    for (const width of [390, 768, 1280]) {
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        reducedMotion: "reduce",
      });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(origin + "/preview");
      await page.locator("iframe").waitFor();
      await page.frameLocator("iframe").locator("[data-seg]").first().waitFor();
      await selectPhrase(page);
      await menu(page);
      const seen = new Set();
      for (let turn = 0; turn < 8; turn += 1) {
        for (const id of await page
          .locator("[data-service]")
          .evaluateAll((items) => items.map((item) => item.dataset.service)))
          if (id !== "__more") seen.add(id);
        if (seen.size === 7) break;
        await page.getByRole("menuitem", { name: "المزيد", exact: true }).click();
      }
      assert.deepEqual(
        [...seen].sort(),
        [
          "explain",
          "meaning",
          "word_by_word",
          "why_form",
          "common_mistake",
          "make_cards",
          "make_mcq",
        ].sort(),
      );
      await choose(page, "فلاش كاردز", true);
      await page.locator(".st-practice-front").waitFor();
      assert.equal(await page.locator(".st-practice-front").innerText(), "looks after");
      assert.equal(await page.locator("#study-card-answer").isVisible(), false);
      await page.getByRole("button", { name: "اكشف الإجابة", exact: true }).click();
      assert.match(await page.locator("#study-card-answer").innerText(), /يعتني/);
      await page.getByRole("button", { name: "التالية", exact: true }).click();
      assert.equal(await page.locator(".st-practice-front").innerText(), "works");
      assert.equal(await page.locator("#study-card-answer").isVisible(), false);
      await page.getByRole("button", { name: "إغلاق التدريب", exact: true }).click();
      await page.getByRole("button", { name: "آخر تدريب", exact: true }).click();
      assert.equal(await page.locator(".st-practice-front").innerText(), "works");
      await page.keyboard.press("Escape");
      await selectPhrase(page);
      await choose(page, "تمارين اختيار");
      await page.locator(".st-practice-option").first().waitFor();
      await page.locator(".st-practice-option").nth(1).click();
      assert.match(await page.locator(".st-practice-feedback").innerText(), /He works every day/);
      assert.equal(await page.locator(".st-practice-option:disabled").count(), 4);
      await page.getByRole("button", { name: "التالي", exact: true }).click();
      await page.locator(".st-practice-option").nth(2).click();
      assert.match(await page.locator(".st-practice-feedback").innerText(), /صح/);
      await page.getByRole("button", { name: "السابق", exact: true }).click();
      assert.match(
        await page.locator(".st-practice-option[aria-pressed=true]").innerText(),
        /He work every day\.\s+إجابتك/,
      );
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "آخر تدريب", exact: true }).click();
      await page.locator(".st-practice-feedback").waitFor();
      assert.equal(await page.locator(".st-practice-option:disabled").count(), 4);
      assert.equal(
        await page.locator(".st-practice").evaluate((el) => el.scrollWidth > el.clientWidth + 1),
        false,
      );
      await page.screenshot({ path: resolve(out, `${engine}-${width}-practice.png`) });
      assert.deepEqual(errors, []);
      findings.push({ width, services: [...seen], errors });
      await page.close();
    }
    // A server error must stay visible and offer a usable retry.
    // Shared selection, actual hold component, and actual Web Audio: only auth/voice are fixtures.
    for (const width of [390, 768, 1280]) {
      for (const lang of ["ar", "en"]) {
        const page = await browser.newPage({
          viewport: { width, height: 900 },
          reducedMotion: "reduce",
        });
        await page.goto(origin + `/preview?interaction&lang=${lang}`);
        if (width < 900) await page.getByRole("tab", { name: "ريتا", exact: true }).click();
        const answer = page.locator("[data-reply-text]").first();
        await answer.dblclick();
        await page.locator('.st-orb[data-tone="reply"]').waitFor();
        await page.waitForFunction(() => document.querySelectorAll("#st-fx-reply .b").length > 1);
        const replyFx = await page
          .locator("#st-fx-reply .b")
          .first()
          .evaluate((el) => ({
            stroke: getComputedStyle(el).stroke,
            animation: getComputedStyle(el).animationName,
          }));
        assert.equal(replyFx.stroke, "rgb(142, 27, 43)");
        assert.equal(replyFx.animation, "none");
        const replySoundCount = await page.evaluate(
          () => window.qaAudio.filter((e) => e.event === "start").length,
        );
        assert.equal(replySoundCount, 2, "a completed selection has the same two-note cue");
        assert.match(
          await page.evaluate(() => getSelection().toString()),
          /She studies at night\.|He watches a film on Fridays\./,
        );
        await page.screenshot({
          path: resolve(out, `${engine}-${width}-${lang}-reply-selection.png`),
        });
        await page.getByRole("button", { name: "زر محادثة تجريبي", exact: true }).click();
        assert.equal(
          await page.evaluate(() => window.qaControl),
          1,
          "conversation controls remain clickable",
        );
        if (width < 900) await page.getByRole("tab", { name: "الدرس", exact: true }).click();
        const point = await page.evaluate(() => window.qaSelect("looks after"));
        await page.evaluate(() => {
          window.qaAudio = [];
        });
        await page.mouse.dblclick(point.x, point.y);
        await page.waitForFunction(
          () =>
            document.querySelector("iframe")?.contentDocument.querySelectorAll("#st-fx .b").length >
            0,
        );
        assert.equal(
          await page.locator('.st-orb[data-tone="reply"]').count(),
          0,
          "new guide selection clears reply state",
        );
        assert.equal(
          await page.evaluate(() => window.qaAudio.filter((e) => e.event === "start").length),
          replySoundCount,
        );
        assert.equal(
          await page
            .frameLocator("iframe")
            .locator("#st-fx .b")
            .first()
            .evaluate((el) => getComputedStyle(el).stroke),
          "rgb(43, 109, 240)",
        );
        await page.screenshot({
          path: resolve(out, `${engine}-${width}-${lang}-guide-selection.png`),
        });
        if (width < 900) await page.getByRole("tab", { name: "ريتا", exact: true }).click();
        await page.evaluate(() => {
          window.qaAudio = [];
        });
        const hold = page.getByRole("button", { name: /اضغط مطوّلاً لبدء المكالمة/ });
        await hold.scrollIntoViewIfNeeded();
        const box = await hold.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.waitForFunction(
          () => window.qaAudio.filter((e) => e.event === "start").length === 2,
        );
        await page.mouse.up();
        await page.waitForTimeout(480);
        assert.equal(
          await page.evaluate(() => window.qaStarts),
          0,
          "early release does not start a call",
        );
        assert.deepEqual(
          await page.evaluate(() =>
            window.qaAudio.filter((e) => e.event === "start").map((e) => e.type),
          ),
          ["sine", "sine"],
        );
        assert.equal(
          await page.evaluate(() => window.qaAudio.filter((e) => e.event === "stop").length),
          2,
        );
        await hold.focus();
        await page.keyboard.down("Space");
        await page.waitForFunction(() => window.qaStarts === 1);
        await page.keyboard.up("Space");
        assert.equal(
          await page.evaluate(() => window.qaStarts),
          1,
          "keyboard hold starts exactly once",
        );
        findings.push({
          interaction: true,
          width,
          lang,
          replyFx,
          replySoundCount,
          earlyRelease: "passed",
          keyboardHold: "passed",
        });
        await page.close();
      }
    }
    const gestures = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const pointer = async (type, id, point) => {
      await gestures.locator(".st-reply-pane").dispatchEvent(type, {
        pointerId: id,
        pointerType: "touch",
        isPrimary: id === 61,
        button: 0,
        clientX: point.x,
        clientY: point.y,
        bubbles: true,
      });
    };
    const firstWord = async () =>
      gestures
        .locator("[data-reply-text]")
        .first()
        .evaluate((el) => {
          const text = el.firstChild,
            range = document.createRange();
          range.setStart(text, 0);
          range.setEnd(text, 3);
          const box = range.getBoundingClientRect();
          return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
        });
    await gestures.goto(origin + "/preview?interaction");
    await gestures.locator("[data-reply-text]").first().waitFor();
    let touch = await firstWord();
    await pointer("pointerdown", 61, touch);
    await pointer("pointermove", 61, { x: touch.x + 30, y: touch.y + 15 });
    await gestures.waitForTimeout(300);
    await pointer("pointerup", 61, touch);
    assert.equal(
      await gestures.locator("#st-fx-reply .b").count(),
      0,
      "a swipe before hold leaves scrolling available",
    );
    assert.equal(await gestures.evaluate(() => window.qaAudio.length), 0);
    await pointer("pointerdown", 61, touch);
    await gestures.waitForTimeout(300);
    await gestures.waitForFunction(() => document.querySelectorAll("#st-fx-reply .b").length > 0);
    const other = await gestures.locator("[data-reply-text]").nth(1).boundingBox();
    await pointer("pointermove", 61, {
      x: other.x + other.width / 2,
      y: other.y + other.height / 2,
    });
    await pointer("pointerup", 61, touch);
    assert.ok(
      !/مع الفاعل/.test(await gestures.evaluate(() => getSelection().toString())),
      "touch selection cannot cross into another answer",
    );
    await gestures.reload();
    await gestures.locator("[data-reply-text]").first().waitFor();
    touch = await firstWord();
    await pointer("pointerdown", 61, touch);
    await pointer("pointerdown", 62, { x: touch.x + 60, y: touch.y });
    await gestures.waitForTimeout(300);
    await pointer("pointerup", 62, touch);
    await pointer("pointerup", 61, touch);
    assert.equal(
      await gestures.locator("#st-fx-reply .b").count(),
      0,
      "second touch yields to zoom",
    );
    assert.equal(await gestures.evaluate(() => window.qaAudio.length), 0);
    await pointer("pointerdown", 61, touch);
    await gestures.waitForTimeout(300);
    const beforeCancel = await gestures.evaluate(
      () => window.qaAudio.filter((e) => e.event === "start").length,
    );
    await pointer("pointercancel", 61, touch);
    assert.equal(await gestures.locator("#st-fx-reply .b").count(), 0);
    assert.equal(
      await gestures.evaluate(() => window.qaAudio.filter((e) => e.event === "start").length),
      beforeCancel,
      "cancel does not chirp",
    );
    await gestures.close();
    findings.push({
      touchSwipe: "passed",
      touchHold: "passed",
      singleAnswer: "passed",
      secondTouch: "passed",
      pointerCancel: "passed",
    });
    const failure = await browser.newPage({ viewport: { width: 390, height: 900 } });
    await failure.goto(origin + "/preview?fail");
    await failure.frameLocator("iframe").locator("[data-seg]").first().waitFor();
    await selectPhrase(failure);
    await choose(failure, "فلاش كاردز");
    await failure.getByRole("alert").waitFor();
    await failure.evaluate(() => history.replaceState(null, "", "/preview"));
    await failure.getByRole("button", { name: "جرّب مرة ثانية", exact: true }).click();
    await failure.locator(".st-practice-front").waitFor();
    await failure.close();
    await writeFile(resolve(out, `${engine}-checks.json`), JSON.stringify(findings, null, 2));
    console.log(`${engine}: seven services, cards, answers, reopen and retry passed`);
  } finally {
    await browser.close();
    await new Promise((done) => server.close(done));
  }
} else server.close();
