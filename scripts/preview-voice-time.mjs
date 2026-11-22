import { build } from "esbuild";
import { compile } from "@tailwindcss/node";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
const root = process.cwd();
const entry = `import React from 'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{CreditsMeter}from'./src/components/CreditsMeter';import{VoiceTime}from'./src/components/VoiceTime';const p=new URLSearchParams(location.search);document.documentElement.dir=p.get('lang')==='ar'?'rtl':'ltr';window.fixture={state:p.get('state'),lang:p.get('lang')};createRoot(document.getElementById('app')).render(<QueryClientProvider client={new QueryClient()}><header style={{height:78,background:'#111116',color:'white',padding:'16px 28px',display:'flex',alignItems:'center',justifyContent:'space-between'}}><b>UZYRA</b><CreditsMeter/></header><main style={{maxWidth:560,margin:'48px auto',padding:20}}><h1 style={{fontSize:24,marginBottom:20}}>{p.get('lang')==='ar'?'المحادثة الحرة':'Free conversation'}</h1><VoiceTime/><p style={{marginTop:16,color:'#72727c'}}>Offline interface check · no real calls or account data</p></main></QueryClientProvider>);`;
const bundle = await build({
  stdin: { contents: entry, loader: "tsx", resolveDir: root },
  bundle: true,
  write: false,
  outfile: "client.js",
  format: "iife",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [
    {
      name: "fixtures",
      setup(b) {
        b.onResolve({ filter: /^\.\/useAuth$/ }, () => ({
          path: "@/hooks/useAuth",
          namespace: "fixtures",
        }));
        b.onResolve({ filter: /^@\// }, (a) => ({ path: a.path, namespace: "fixtures" }));
        b.onResolve({ filter: /^@tanstack\/react-(start|router)$/ }, (a) => ({
          path: a.path,
          namespace: "fixtures",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixtures" }, async ({ path }) => {
          if (path.endsWith("useAuth"))
            return { contents: `export const useAuth=()=>({user:{id:'offline'}})` };
          if (path.endsWith("useUiLanguage"))
            return {
              contents: `export const useUiLanguage=()=>window.fixture.lang==='ar'?'ar':'en'`,
            };
          if (path.endsWith("usePlan"))
            return {
              contents: `export const usePlan=()=>({data:{plan:{max_flashcards:100,max_ai_questions:50,max_summaries:10,max_todo_tasks:10,max_calendar_items:10,max_groups:2},usage:{flashcards:0,ai_questions:0,summaries:0,todo_tasks:0,calendar_items:0,groups:0}},isAdmin:false,planName:'Study'})`,
            };
          if (path.endsWith("free-talk.functions"))
            return {
              contents: `export const myFreeTalkBudget=async()=>{if(window.fixture.state==='error')throw Error('Offline error');if(window.fixture.state==='loading')await new Promise(r=>setTimeout(r,30000));const now=new Date();return{unlimited:window.fixture.state==='admin',remainingSeconds:window.fixture.state==='empty'?0:75,activeSessionId:window.fixture.state==='idle'?null:'session',activeDeadline:new Date(+now+75000).toISOString(),serverNow:now.toISOString(),enabled:true,limitSeconds:7200,period:'2026-11',resetsAt:'2026-12-01T00:00:00Z'}}`,
            };
          if (path === "@tanstack/react-start")
            return { contents: `export const useServerFn=fn=>fn` };
          if (path === "@tanstack/react-router")
            return {
              contents: `import React from 'react';export const Link=({children,to,...props})=><a href={to} {...props}>{children}</a>`,
              loader: "tsx",
              resolveDir: root,
            };
          return {
            contents: await readFile(
              resolve(
                root,
                "src",
                path.slice(2) +
                  (path.includes("/hooks/")
                    ? ".ts"
                    : path.endsWith("useDismiss")
                      ? ".ts"
                      : path.endsWith("free-talk-time")
                        ? ".ts"
                        : ".tsx"),
              ),
              "utf8",
            ),
            loader: "tsx",
            resolveDir: root,
          };
        });
      },
    },
  ],
});
const source = await readFile("src/styles.css", "utf8");
const compiler = await compile(source, { base: root, onDependency: () => {} });
const tokens = new Set();
for (const file of ["src/components/VoiceTime.tsx", "src/components/CreditsMeter.tsx"])
  for (const token of (await readFile(file, "utf8")).match(/[\w!:/.[\]#%(),+-]+/g) ?? [])
    tokens.add(token);
const css = compiler.build([...tokens]);
const server = createServer((req, res) => {
  if (req.url === "/client.js") {
    res.setHeader("Content-Type", "text/javascript");
    return res.end(bundle.outputFiles[0].text);
  }
  if (req.url === "/client.css") {
    res.setHeader("Content-Type", "text/css");
    return res.end(css);
  }
  res.setHeader("Content-Type", "text/html;charset=utf-8");
  res.end(
    '<!doctype html><html class="rita-app"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/client.css"></head><body><div id="app"></div><script src="/client.js"></script></body></html>',
  );
});
server.listen(4186, "127.0.0.1", () => console.log("Offline quota UI: http://127.0.0.1:4186"));
