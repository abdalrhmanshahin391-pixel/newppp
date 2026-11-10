// Offline design fixture. Mutations update fixture state, never a real account.
import { build } from "esbuild";
import { compile } from "@tailwindcss/node";
import { readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "node:http";
const root = process.cwd();
const out = resolve(root, "output/conversations-preview");
await mkdir(out, { recursive: true });
const entry = `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {createRootRoute,createRoute,createRouter,RouterProvider} from '@tanstack/react-router';
import i18n from 'i18next';import {initReactI18next} from 'react-i18next';
import {ConversationLibrary} from './src/components/rita/ConversationLibrary';
const lang=new URLSearchParams(location.search).get('lang')==='ar'?'ar':'en';
await i18n.use(initReactI18next).init({lng:lang,resources:{ar:{translation:{}},en:{translation:{}}}});
const fixtures=['Planning my next trip','English practice · present simple','مراجعة مفردات الجامعة'];
function Preview(){const [rows,setRows]=useState(new URLSearchParams(location.search).has('empty')?[]:fixtures.map((title,i)=>({id:String(i),title,message_count:12-i,created_at:'2026-11-10T10:00:00Z',last_message_at:'2026-11-10T10:00:00Z',pinned_at:i===1?'2026-11-10T10:00:00Z':null})));return <main className="edith-premium mx-auto max-w-5xl bg-white px-5 py-8 text-[var(--pp-ink)]" dir={lang==='ar'?'rtl':'ltr'}><header className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl font-semibold">{lang==='ar'?'محادثاتي':'My conversations'}</h1><button className="rita-btn rita-btn-primary">{lang==='ar'?'محادثة جديدة':'New conversation'}</button></header><ConversationLibrary userId="offline-fixture" conversations={rows} busy={new URLSearchParams(location.search).has('loading')} isAdmin={false} pendingId="" renderDetails={()=>null} onTranscript={()=>{}} onExport={()=>{}} onRename={async(c,title)=>{if(title==='fail')throw Error('Fixture save failure');setRows(r=>r.map(x=>x.id===c.id?{...x,title}:x));}} onPin={async c=>setRows(r=>r.map(x=>x.id===c.id?{...x,pinned_at:x.pinned_at?null:new Date().toISOString()}:x))} onDelete={async c=>setRows(r=>r.filter(x=>x.id!==c.id))}/></main>}
const base=createRootRoute();const page=createRoute({getParentRoute:()=>base,path:'/',component:Preview});const router=createRouter({routeTree:base.addChildren([page])});createRoot(document.getElementById('root')).render(<RouterProvider router={router}/>);`;
const bundle = await build({
  stdin: { contents: entry, loader: "tsx", resolveDir: root },
  bundle: true,
  format: "esm",
  write: false,
  alias: { "@": resolve(root, "src") },
  define: { "process.env.NODE_ENV": '"production"' },
});
const compiler = await compile(await readFile(resolve(root, "src/styles.css"), "utf8"), {
  base: root,
  onDependency: () => {},
});
const sources = await Promise.all(
  [
    "src/components/rita/ConversationLibrary.tsx",
    "src/components/rita/ConversationMenu.tsx",
    "src/components/ui/dialog.tsx",
  ].map((p) => readFile(resolve(root, p), "utf8")),
);
const css = compiler.build([...new Set((sources.join(" ") + entry).match(/[\w!:/.[\]#%(),+-]+/g))]);
const server = createServer((req, res) => {
  if (req.url?.startsWith("/client.js")) {
    res.setHeader("Content-Type", "text/javascript");
    res.end(bundle.outputFiles[0].text);
  } else if (req.url?.startsWith("/client.css")) {
    res.setHeader("Content-Type", "text/css");
    res.end(css);
  } else {
    res.setHeader("Content-Type", "text/html;charset=utf-8");
    res.end(
      '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/client.css"></head><body><div id="root"></div><script type="module" src="/client.js"></script></body></html>',
    );
  }
});
server.listen(0, "127.0.0.1", () =>
  console.log("Conversation fixture " + `http://127.0.0.1:${server.address().port}/`),
);
