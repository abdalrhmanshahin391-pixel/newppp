// Actual Settings routes/components. Auth, storage and provider calls use explicit offline fixtures.
import { build } from "esbuild";
import { compile } from "@tailwindcss/node";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { createServer } from "node:http";
import assert from "node:assert/strict";

const root = process.cwd(),
  out = resolve(root, "output/settings-preview");
await mkdir(out, { recursive: true });
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {createRootRoute,createRoute,createRouter,RouterProvider,Outlet} from '@tanstack/react-router';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {LanguageProvider} from './src/components/LanguageProvider';
import {Route as Settings} from './src/routes/settings';
import {Route as Profile} from './src/routes/profile';
import {Route as MyPlan} from './src/routes/my-plan';
const params=new URLSearchParams(location.search), lang=params.get('lang')==='ar'?'ar':'en', scenario=params.get('scenario');
const user={id:'11111111-1111-4111-8111-111111111111',email:'laith@example.com',user_metadata:{},app_metadata:{provider:'email',providers:['email']}};
const profile={id:user.id,full_name:scenario==='long'?'Laith اسم طويل '.repeat(20):'Laith Ahmad',username:'laith',phone:'+962790000000',email:user.email,bio:'Learning English and German.',avatar_url:null};
const plan={id:'plan',name:scenario==='long'?'Student membership '.repeat(24):'Student Plus',price_cents:1200,billing_kind:'monthly',rich_cards:true,todo_full:true,feature_lecture_qgen:true,feature_archive_qgen:true,feature_all_in_one:true,max_flashcards:100,max_summaries:0,max_ai_questions:100,max_archive_questions:null,max_all_in_one_lectures:20};
window.qaData={user,profile,signedOut:scenario==='signedout',delay:scenario==='loading'?1200:40,fail:scenario==='error'?['myPlanUsage','getMySubscription','getMySavedPaymentMethods']:[],calls:[],authCalls:0,saveFailed:false,billingFailure:null,plan:{plan,usage:{flashcards:40,summaries:0,ai_questions:12,archive_questions:5,all_in_one_lectures:3,todo_tasks:0,calendar_items:0,all_in_one_questions:0,groups:0},grants:{flashcards:20},offer_name:'Extra study credits',offer_expires_at:'2030-12-01T00:00:00Z'},subscription:{id:'sub-row',user_id:user.id,paddle_subscription_id:'sub_fixture',paddle_customer_id:'ctm_fixture',status:'active',current_period_end:'2030-12-01T00:00:00Z',cancel_at_period_end:false},cards:[{id:'22222222-2222-4222-8222-222222222222',user_id:user.id,card_brand:'visa',card_last4:'4242',card_exp_month:12,card_exp_year:2030}]};
if(scenario==='free'){window.qaData.subscription=null;window.qaData.cards=[];plan.name='Free';plan.price_cents=0;window.qaData.plan.offer_name=null;}
if(scenario==='oauth')user.app_metadata={provider:'google',providers:['google']};
const client=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}});
const rootRoute=createRootRoute({component:()=> <LanguageProvider initialLang={lang}><QueryClientProvider client={client}><Outlet/></QueryClientProvider></LanguageProvider>});
const settings=Settings.update({id:'/settings',path:'/settings',getParentRoute:()=>rootRoute});
const profileRoute=Profile.update({id:'/profile',path:'/profile',getParentRoute:()=>rootRoute});
const planRoute=MyPlan.update({id:'/my-plan',path:'/my-plan',getParentRoute:()=>rootRoute});
const home=createRoute({getParentRoute:()=>rootRoute,path:'/',component:()=> <h1>Preview home</h1>});
const login=createRoute({getParentRoute:()=>rootRoute,path:'/login',component:()=> <h1>Preview sign in</h1>});
const router=createRouter({routeTree:rootRoute.addChildren([settings,profileRoute,planRoute,home,login])});
createRoot(document.getElementById('app')).render(<RouterProvider router={router}/>);
`;
const bundle = await build({
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
      name: "offline-settings-boundaries",
      setup(b) {
        b.onResolve(
          {
            filter:
              /(^@tanstack\/react-start$|[\\/]useAuth$|[\\/]useSiteSettings$|[\\/]SiteHeader$|[\\/]avatars$|[\\/]legacy-client$|\.functions$)/,
          },
          (args) => ({ path: args.path, namespace: "fixture" }),
        );
        b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => {
          if (path === "@tanstack/react-start")
            return { contents: "export const useServerFn=f=>f;" };
          if (path.endsWith("useAuth"))
            return {
              contents: `export function useAuth(){const q=window.qaData;return {user:q.signedOut?null:q.user,profile:q.signedOut?null:q.profile,loading:false,isRealAdmin:false,isGolden:false,isCommittee:false}};export const refreshAuthProfile=async()=>{};`,
            };
          if (path.endsWith("useSiteSettings"))
            return { contents: "export const useSiteSettings=()=>({offers_page_enabled:true});" };
          if (path.endsWith("SiteHeader"))
            return {
              loader: "tsx",
              resolveDir: root,
              contents: `import React from 'react';export function SiteHeader(){return <header className="qa-settings-header"><strong>UZYRA</strong><span>Offline design preview</span></header>}`,
            };
          if (path.endsWith("avatars"))
            return {
              contents: `export const useAvatarUrl=path=>path?'/avatar.svg':null;export const uploadAvatar=async()=> 'fixture/avatar.png';export const removeAvatar=async()=>{};`,
            };
          if (path.endsWith("legacy-client"))
            return {
              contents: `export const supabase={from(){let field,value,payload;const chain={select(){return chain},eq(f,v){field=f;value=v;return chain},neq(){return chain},maybeSingle:async()=>({data:field==='username'&&value==='taken'?{id:'someone-else'}:null,error:null}),upsert:async data=>{if(window.qaData.saveFailed)return {error:{message:'offline failure'}};window.qaData.profile={...window.qaData.profile,...data};return {error:null}},update(data){payload=data;return chain},single:async()=>{window.qaData.profile={...window.qaData.profile,...payload};return {data:{id:window.qaData.user.id},error:null}}};return chain},auth:{updateUser:async data=>{window.qaData.authCalls++;return data.current_password==='wrong'?{error:{message:'current password incorrect'}}:{error:null}}}};`,
            };
          const names = [
            "myPlanUsage",
            "getMySubscription",
            "getMySavedPaymentMethods",
            "cancelSubscription",
            "removeSavedPaymentMethod",
            "createCustomerPortalSession",
          ];
          return {
            contents: names
              .map(
                (name) =>
                  `export async function ${name}(input){const q=window.qaData;q.calls.push('${name}');await new Promise(r=>setTimeout(r,q.delay));if(q.fail.includes('${name}'))throw Error('Offline fixture failure');if('${name}'==='myPlanUsage')return structuredClone(q.plan);if('${name}'==='getMySubscription')return structuredClone(q.subscription);if('${name}'==='getMySavedPaymentMethods')return structuredClone(q.cards);if('${name}'==='createCustomerPortalSession')return {url:'/portal-fixture'};if(q.billingFailure)return {ok:false,code:q.billingFailure,renewalStopped:false,cardRemoved:false};if(q.subscription)q.subscription.cancel_at_period_end=true;if('${name}'==='removeSavedPaymentMethod'){q.lastRemoveInput=input.data;q.cards=q.cards.filter(c=>c.id!==input.data.cardId);return {ok:true,renewalStopped:!!q.subscription,cardRemoved:true}}return {ok:true,renewalStopped:true,cardRemoved:false}}`,
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
const candidates = new Set();
for (const name of await readdir(resolve(root, "src/components/settings")))
  if (name.endsWith(".tsx"))
    for (const token of (
      await readFile(resolve(root, "src/components/settings", name), "utf8")
    ).match(/[\w!:/.[\]#%(),+-]+/g) ?? [])
      candidates.add(token);
const css =
  compiler.build([...candidates]) +
  bundle.outputFiles.find((file) => file.path.endsWith(".css")).text +
  ".qa-settings-header{position:fixed;inset:0 0 auto;z-index:20;height:60px;display:flex;align-items:center;justify-content:space-between;padding:0 32px;background:#121117;color:#f2f2f5;font:14px Figtree,sans-serif}.qa-settings-header strong{letter-spacing:.2em}.qa-settings-header span{font-size:12px}";
if (process.argv.includes("--build-only")) {
  console.log("Offline Settings bundle compiled.");
  process.exit(0);
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/client.js") {
    res.setHeader("Content-Type", "text/javascript");
    return res.end(bundle.outputFiles.find((file) => file.path.endsWith(".js")).text);
  }
  if (url.pathname === "/client.css") {
    res.setHeader("Content-Type", "text/css");
    return res.end(css);
  }
  if (url.pathname === "/portal-fixture") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end("<h1>Offline payment portal</h1>");
  }
  if (url.pathname === "/avatar.svg") {
    res.setHeader("Content-Type", "image/svg+xml");
    return res.end(
      '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"><rect width="56" height="56" fill="#e7eefd"/><text x="28" y="36" text-anchor="middle" fill="#121117" font-size="24">L</text></svg>',
    );
  }
  if (
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname.startsWith("/images/")
  ) {
    const base = resolve(root, "public"),
      path = resolve(base, "." + url.pathname);
    if (!path.startsWith(base + sep)) {
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
    '<!doctype html><html class="rita-app"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/client.css"></head><body><div id="app"></div><script src="/client.js"></script></body></html>',
  );
});
await new Promise((done) =>
  server.listen(process.argv.includes("--serve") ? 4179 : 0, "127.0.0.1", done),
);
const origin = "http://127.0.0.1:" + server.address().port;
if (process.argv.includes("--serve")) {
  console.log("Offline Settings preview: " + origin + "/settings");
  await new Promise(() => {});
}
const pw = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const engine = process.env.BROWSER || "chromium";
const browser = await pw[engine].launch({ headless: true });
const names = {
  account: ["Profile", "الملف الشخصي"],
  security: ["Security", "الأمان"],
  plan: ["My plan", "خطتي"],
  usage: ["Usage", "الاستخدام"],
  billing: ["Billing & invoices", "الدفع والفواتير"],
};
const findings = [];
async function section(page, key, lang = "en") {
  if (page.viewportSize().width < 900)
    await page.locator(".settings-mobile-picker select").selectOption(key);
  else
    await page
      .locator(".settings-nav-link")
      .filter({ hasText: names[key][lang === "ar" ? 1 : 0] })
      .click();
  await page
    .getByRole("heading", { level: 2, name: names[key][lang === "ar" ? 1 : 0], exact: true })
    .waitFor();
  await page.waitForFunction(
    () => document.querySelectorAll(".settings-content .settings-loading").length === 0,
  );
}
async function screenshot(page, name) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(out, engine + "-" + name + ".png"), fullPage: true });
}
try {
  for (const width of [390, 768, 1280])
    for (const lang of ["en", "ar"]) {
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        reducedMotion: "reduce",
      });
      const errors = [],
        remote = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (req) => {
        if (!req.url().startsWith(origin) && !req.url().startsWith("data:")) remote.push(req.url());
      });
      await page.goto(origin + "/settings?section=account&lang=" + lang);
      await page.locator("#settings-name").waitFor();
      for (const key of Object.keys(names)) {
        if (key !== "account") await section(page, key, lang);
        assert.equal(
          await page.locator(".settings-content").getAttribute("dir"),
          lang === "ar" ? "rtl" : "ltr",
        );
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
          false,
          `${engine} ${lang} ${width} ${key} overflow`,
        );
        if (width >= 900) {
          const side = await page.locator(".settings-sidebar").boundingBox(),
            main = await page.locator(".settings-content").boundingBox();
          assert.ok(side.x < main.x, "sidebar stays left in both languages");
        }
        await screenshot(page, `${lang}-${width}-${key}`);
        if (key === "billing" && width === 390) {
          await page
            .getByRole("button", { name: lang === "ar" ? "إزالة" : "Remove", exact: true })
            .click();
          await page.getByRole("alertdialog").waitFor();
          await screenshot(page, `${lang}-${width}-confirmation`);
          await page
            .getByRole("alertdialog")
            .getByRole("button", { name: lang === "ar" ? "رجوع" : "Go back", exact: true })
            .click();
        }
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(remote, [], "fixtures stay offline");
      findings.push({ width, lang, errors });
      await page.close();
    }
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(origin + "/profile");
  await page.locator("#settings-name").waitFor();
  assert.match(page.url(), /settings\?section=account/);
  await page.locator("#settings-name").fill("Unsaved draft");
  await section(page, "usage");
  await section(page, "account");
  assert.equal(await page.locator("#settings-name").inputValue(), "Unsaved draft");
  await page.getByRole("link", { name: "Back to site", exact: true }).click();
  await page.getByRole("alertdialog").waitFor();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  assert.match(page.url(), /settings/);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Your profile has been saved." }).waitFor();
  await page.locator("#settings-username").fill("taken");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "That username is already taken" }).waitFor();
  await page.locator("#settings-username").fill("laith");
  assert.equal(
    await page.getByRole("button", { name: "Save changes", exact: true }).isDisabled(),
    true,
  );
  await section(page, "security");
  await page.locator("#settings-current-password").fill("fixture-current");
  await page.locator("#settings-new-password").fill("fixture-password");
  await page.locator("#settings-confirm-password").fill("different-password");
  await page.getByRole("button", { name: "Change password", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "don’t match" }).waitFor();
  assert.equal(await page.evaluate(() => window.qaData.authCalls), 0);
  await page.locator("#settings-confirm-password").fill("fixture-password");
  await page.getByRole("button", { name: "Change password", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Your password has been changed." }).waitFor();
  assert.equal(await page.locator("#settings-new-password").inputValue(), "");
  await section(page, "billing");
  await page.evaluate(() => {
    window.qaData.billingFailure = "provider_failed";
  });
  await page.getByRole("button", { name: "Stop auto-renewal", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Stop renewal", exact: true })
    .click();
  await page.getByRole("alert").filter({ hasText: "did not confirm" }).waitFor();
  await screenshot(page, "billing-provider-failure");
  assert.equal(await page.evaluate(() => window.qaData.subscription.cancel_at_period_end), false);
  await page.evaluate(() => {
    window.qaData.billingFailure = null;
  });
  await page.getByRole("button", { name: "Stop auto-renewal", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Stop renewal", exact: true })
    .click();
  await page.getByRole("status").filter({ hasText: "Auto-renewal has stopped." }).waitFor();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Remove card", exact: true })
    .click();
  await page.getByRole("status").filter({ hasText: "Your card was removed" }).waitFor();
  assert.deepEqual(await page.evaluate(() => Object.keys(window.qaData.lastRemoveInput)), [
    "cardId",
  ]);
  await page.getByRole("button", { name: "Open payment portal", exact: true }).click();
  await page.getByRole("heading", { name: "Offline payment portal", exact: true }).waitFor();
  await page.close();
  const search = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await search.goto(origin + "/settings");
  await search.locator("#settings-search").fill("فاتورة");
  await search.locator(".settings-search input").press("Enter");
  await search
    .getByRole("heading", { level: 2, name: "Billing & invoices", exact: true })
    .waitFor();
  await search.close();
  const free = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await free.goto(origin + "/settings?section=billing&scenario=free");
  await free.getByText("No cards saved for future purchases.", { exact: false }).waitFor();
  assert.equal(
    await free.getByRole("button", { name: "Stop auto-renewal", exact: true }).count(),
    0,
  );
  await screenshot(free, "free-empty");
  await free.close();
  const failure = await browser.newPage();
  await failure.goto(origin + "/settings?section=usage&scenario=error");
  await failure.getByRole("alert").waitFor();
  await screenshot(failure, "error");
  await failure.evaluate(() => {
    window.qaData.fail = [];
  });
  await failure.getByRole("button", { name: "Try again", exact: true }).click();
  await failure.locator(".settings-usage-row").first().waitFor();
  await failure.close();
  const loading = await browser.newPage();
  await loading.goto(origin + "/settings?section=usage&scenario=loading");
  await loading.locator(".settings-loading").waitFor();
  assert.equal(await loading.locator(".settings-usage-row").count(), 0);
  await screenshot(loading, "loading");
  await loading.close();
  const long = await browser.newPage({
    viewport: { width: 390, height: 900 },
    reducedMotion: "reduce",
  });
  await long.goto(origin + "/settings?section=plan&scenario=long&lang=ar");
  await long.locator(".settings-plan-summary").waitFor();
  assert.equal(
    await long.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
    false,
  );
  await screenshot(long, "long-ar");
  await long.close();
  const signedOut = await browser.newPage();
  await signedOut.goto(origin + "/settings?section=billing&scenario=signedout");
  await signedOut.getByRole("heading", { name: "Preview sign in", exact: true }).waitFor();
  assert.deepEqual(await signedOut.evaluate(() => window.qaData.calls), []);
  await signedOut.close();
  const alias = await browser.newPage();
  await alias.goto(origin + "/my-plan");
  await alias.getByRole("heading", { level: 2, name: "My plan", exact: true }).waitFor();
  assert.match(alias.url(), /section=plan/);
  await alias.close();
  await writeFile(resolve(out, engine + "-checks.json"), JSON.stringify(findings, null, 2));
  console.log(
    engine + ": Settings sections, RTL, drafts, search, aliases and safe billing feedback passed.",
  );
} catch (error) {
  for (const context of browser.contexts())
    for (const page of context.pages()) {
      await screenshot(page, "failure").catch(() => {});
      console.error(
        await page
          .locator("body")
          .innerText()
          .catch(() => "Page closed"),
      );
    }
  throw error;
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
