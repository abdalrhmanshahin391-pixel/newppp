// Actual StudyPage, selection, radial menu, request hook and PhraseDialog.
// Server/voice/auth boundaries return explicit fixtures. No account or remote AI is used.
import { build } from "esbuild";
import { compile } from "@tailwindcss/node";
import { readFile, readdir, mkdir } from "node:fs/promises";
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
const lang=new URLSearchParams(location.search).get('lang')==='en'?'en':'ar';
i18n.use(initReactI18next).init({lng:lang,fallbackLng:'en',resources:{ar:{translation:{}},en:{translation:{}}},interpolation:{escapeValue:false}});
SAMPLE_THIRD_PERSON.sections.push({kind:'usage',heading:'In context',items:[{label:'Care',example:'She {{looks after}} her little brother.'},{label:'River',example:'We sat on the river {{bank}}.'},{label:'Money',example:'She went to the {{bank}}.'}]});
SAMPLE_THIRD_PERSON.sections.push({kind:'usage',heading:'Sentence structure',items:[{label:'Reading',example:'She is reading a book.'}]});
const data={lesson:{id:'question-design-preview',title:'Present simple',title_ar:'المضارع البسيط',topic:'sample',objectives:[]},guide:{id:'sample',title:'Present simple',version:1,content:SAMPLE_THIRD_PERSON,learner_path:'',allow_download:false},preview:true};
const r=createRootRoute({component:()=> <Outlet/>});
const p=createRoute({getParentRoute:()=>r,path:'/preview',component:()=> <StudyPage data={data}/>});
const router=createRouter({routeTree:r.addChildren([p])});
if(new URLSearchParams(location.search).has('fresh')) for(const key of Object.keys(localStorage)) if(key.startsWith('rita.phrase.'))localStorage.removeItem(key);
localStorage.setItem('uzyra-study-sound','off');
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
              contents: `import React,{useEffect,useState} from 'react'; import {UzyraWordmark} from '@/components/brand/UzyraWordmark'; export function RitaRealtimeV3({study}){const [messages,setMessages]=useState([]);useEffect(()=>{study.bridge.post=(role,text)=>setMessages(m=>[...m,{role,text}]);return()=>{study.bridge.post=undefined}},[study.bridge]);return <div className="qa-rita"><UzyraWordmark size={13} withMark={false}/>{messages.length?messages.map((m,i)=><p className="qa-message" key={i} dir="auto">{m.text}</p>):<><div className="qa-cube"><i/><i/></div><p>معاينة محلية · الردود التجريبية ليست اتصالًا بالخادم</p></>}{study.children}</div>}`,
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
                  `export async function ${name}({data}){await new Promise(r=>setTimeout(r,new URLSearchParams(location.search).has('slow')?6000:900));if(new URLSearchParams(location.search).has('fail')) return {ok:false,reason:'failed',message:'تعذّر تنفيذ الطلب. جرّب مرة ثانية.'};if('${name}'==='explainPhrase')return {ok:true,explanation:{lang:'en',translation_ar:data.text==='bank'?(data.context.includes('Selected (example): We sat')?'ضفة النهر':'بنك'):'يعتني بـ',pronunciation_ar:'',tip_ar:''}};if(data.action==='word_by_word')return {ok:true,text:['She: مين عم يعمل الفعل.','is reading: الفعل عم يصير الآن؛ الجزآن بيشتغلوا مع بعض.','a book: الشي اللي عم تقرأه.'].join(String.fromCharCode(10))};if(data.action==='why_form')return {ok:true,text:'استخدمنا studies لأن الفاعل She. مع study، قبل y حرف ساكن، فبنحوّل y إلى ies.'};return {ok:true,text:'لما نحكي عن he أو she أو it بالمضارع البسيط، غالبًا بنضيف s للفعل. مثال: He works.'}}`,
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

server.close();
