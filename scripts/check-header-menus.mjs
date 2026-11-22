// The real header (ProHeader) with its menus, on a plain page. Account, plan, voice-time and
// language data are fixtures: no account, voice provider or database is contacted.
// Checks: the shared panel opens, follows the pointer and the keys, switches between menus, hangs
// from the right edge (also right-to-left), the grey highlight finds its item, and nothing in the
// bar or its menus has a colour (only ink, white and grey).
import assert from "node:assert/strict";
import { build } from "esbuild";
import { compile } from "@tailwindcss/node";
import { readFile, readdir, mkdir } from "node:fs/promises";
import { resolve, relative, extname } from "node:path";
import { createServer } from "node:http";

const root = process.cwd();
const out = resolve(root, "output/header-menus");
await mkdir(out, { recursive: true });

const STUBS = {
  "@/hooks/useAuth": `export const useAuth=()=>({user:window.__anon?null:{id:'u1',email:'sara@example.com'},profile:{username:'sara',full_name:'Sara Ahmad'},isAdmin:true,isGolden:false,loading:false});`,
  "@/integrations/supabase/client": `export const supabase={auth:{signOut:async()=>{}}};`,
  "@/lib/auth-dialog": `export const openWelcome=()=>{};`,
  "@/hooks/usePlan": `export const usePlan=()=>({data:{plan:{max_flashcards:200,max_ai_questions:50,max_summaries:10,max_todo_tasks:100,max_calendar_items:100,max_groups:3},usage:{flashcards:150,ai_questions:48,summaries:10,todo_tasks:5,calendar_items:3,groups:0},grants:{},offer_name:'Study offer',offer_expires_at:new Date(Date.now()+5*86400000).toISOString()},planName:'Free',isAdmin:false});`,
  "@/hooks/useVoiceTime": `export const useVoiceTime=()=>({seconds:240,isError:false,data:{resetsAt:'2026-12-01T00:00:00Z'}});`,
  "@/hooks/useLearningLanguage": `export const VOICE_SESSION_ERROR='voice-session';
const languages=[{code:'en',name_native:'English',name_ar:'الإنجليزية'},{code:'de',name_native:'Deutsch',name_ar:'الألمانية'},{code:'ar',name_native:'العربية',name_ar:'العربية'},{code:'fr',name_native:'Français',name_ar:'الفرنسية'}];
export const useLearningLanguage=()=>({code:'en',language:languages[0],languages,ready:true,pending:null,error:null,setLanguage:async()=>true});`,
  "@/components/language/useUiLanguage": `export const useUiLanguage=()=>window.__lang==='ar'?'ar':'en';`,
  "@/lib/avatars": `export const avatarTone=()=>'#5b6b8c';export const useAvatarUrl=()=>null;`,
  "react-i18next": `export const useTranslation=()=>({t:(k)=>({'nav.settings':'Settings','cms.header.logout':'Log out','cms.header.roleAdmin':'Admin','cms.header.roleUser':'Member'}[k]||k),i18n:{language:window.__lang||'en'}});`,
  "@tanstack/react-router": `import {createElement} from 'react';export const Link=({to,search,onClick,children,...r})=>createElement('a',{href:typeof to==='string'?to:'/',onClick:(e)=>{e.preventDefault();onClick&&onClick(e)},...r},children);export const useNavigate=()=>()=>{};export const useRouterState=({select})=>select({location:{pathname:window.__path||'/games'}});`,
  "@/components/StartLearningLink": `import {createElement} from 'react';export const StartLearningLink=({children,onOpen,...r})=>createElement('a',{href:'/start',onClick:(e)=>{e.preventDefault();onOpen&&onOpen()},...r},children);`,
  "@/components/InstallAppButton": `export const InstallAppButton=()=>null;`,
};

const entry = `
import React from 'react';import {createRoot} from 'react-dom/client';
import {ProHeader} from './src/components/home/procreate/ProHeader';
function Page(){return <><ProHeader variant="solid"/><main style={{padding:'120px 40px',height:'160vh',fontFamily:'sans-serif'}}><h1 style={{fontSize:40}}>Page under the bar</h1><p>Some text under the header so the menus open over real content.</p></main></>}
createRoot(document.getElementById('app')).render(<Page/>);
`;
const result = await build({
  stdin: { contents: entry, loader: "tsx", resolveDir: root },
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  outdir: resolve(out, "bundle"),
  alias: { "@": resolve(root, "src") },
  loader: { ".webp": "file", ".jpg": "file", ".png": "file", ".svg": "file" },
  assetNames: "assets/[name]-[hash]",
  publicPath: "/",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "fixtures",
      setup(b) {
        const names = Object.keys(STUBS).map((n) => n.replace(/[/@.-]/g, "\\$&"));
        b.onResolve({ filter: new RegExp(`^(${names.join("|")})$`) }, (args) => ({
          path: args.path,
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
          contents: STUBS[args.path],
          loader: "tsx",
          resolveDir: root,
        }));
      },
    },
  ],
});
const bundledCss = result.outputFiles.find((f) => f.path.endsWith(".css"))?.text ?? "";
const source = await readFile(resolve(root, "src/styles.css"), "utf8");
const compiler = await compile(source, { base: root, onDependency: () => {} });
const tokens = new Set(entry.match(/[\w!:/.[\]#%(),+-]+/g));
for (const directory of [
  "src/components/header",
  "src/components/home/procreate",
  "src/components/language",
  "src/components/brand",
  "src/components",
]) {
  for (const name of await readdir(resolve(root, directory))) {
    if (!name.endsWith(".tsx")) continue;
    const text = await readFile(resolve(root, directory, name), "utf8");
    for (const token of text.match(/[\w!:/.[\]#%(),+-]+/g) || []) tokens.add(token);
  }
}
const css = compiler.build([...tokens]) + bundledCss + `body{margin:0;background:#fff}`;

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
    res.setHeader("Content-Type", extname(asset.path) === ".svg" ? "image/svg+xml" : "image/webp");
    return res.end(asset.contents);
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  const ar = url.searchParams.get("lang") === "ar";
  const anon = url.searchParams.get("anon") === "1";
  res.end(
    `<!doctype html><html lang="${ar ? "ar" : "en"}" dir="${ar ? "rtl" : "ltr"}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/client.css"><body><div id="app"></div><script>window.__lang="${ar ? "ar" : "en"}";window.__anon=${anon};</script><script src="/client.js"></script></body></html>`,
  );
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = "http://127.0.0.1:" + server.address().port;
if (process.argv.includes("--serve")) {
  console.log(origin);
  await new Promise(() => {});
}

const pw = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const engine = process.env.BROWSER || "chromium";
const browser = await pw[engine].launch({ headless: true });
const errors = [];
const results = [];

/** Every element of the bar and its menus that is not ink, white or grey. */
async function colourOffenders(page) {
  return page.evaluate(() => {
    const parse = (value) => {
      const m = value.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = 1] = m[1]
        .split(/[ ,/]+/)
        .filter(Boolean)
        .map(Number);
      return { r, g, b, a };
    };
    const coloured = (c) =>
      c && c.a > 0.02 && Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) > 12;
    const bad = [];
    const roots = [...document.querySelectorAll(".rh-bar, .uz-mp-host, dialog.rh-sheet-wrap")];
    for (const rootEl of roots) {
      for (const el of [rootEl, ...rootEl.querySelectorAll("*")]) {
        if (el.closest(".rh-avatar")) continue; // a person's picture or initial colour
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none") continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        const tag =
          el.tagName.toLowerCase() +
          (el.className && typeof el.className === "string"
            ? "." + el.className.trim().split(/\s+/).join(".")
            : "");
        if (
          el.childNodes.length &&
          [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
        ) {
          if (coloured(parse(cs.color))) bad.push(tag + " text " + cs.color);
        }
        if (coloured(parse(cs.backgroundColor)))
          bad.push(tag + " background " + cs.backgroundColor);
        for (const side of ["Top", "Right", "Bottom", "Left"]) {
          if (
            parseFloat(cs["border" + side + "Width"]) > 0 &&
            cs["border" + side + "Style"] !== "none" &&
            coloured(parse(cs["border" + side + "Color"]))
          ) {
            bad.push(tag + " border " + cs["border" + side + "Color"]);
          }
        }
        if (
          cs.outlineStyle !== "none" &&
          parseFloat(cs.outlineWidth) > 0 &&
          coloured(parse(cs.outlineColor))
        )
          bad.push(tag + " outline " + cs.outlineColor);
        if (
          el instanceof SVGElement &&
          el.closest("svg") &&
          coloured(parse(cs.color)) &&
          cs.stroke !== "none"
        )
          bad.push(tag + " svg " + cs.color);
      }
    }
    return [...new Set(bad)];
  });
}

// Two groups (navigation, account tools) each have a panel; these look at the open one.
const state = (page) =>
  page.evaluate(() => {
    const hosts = [...document.querySelectorAll(".uz-mp-host")];
    const host = hosts.find((h) => h.dataset.state === "open") ?? hosts[0];
    return {
      open: host?.dataset.state,
      panes: [...host.querySelectorAll(".uz-mp-pane")].map(
        (p) => p.dataset.mpPane + (p.dataset.active ? "*" : ""),
      ),
    };
  });
const surfaceBox = (page) =>
  page.evaluate(() => {
    const hosts = [...document.querySelectorAll(".uz-mp-host")];
    const host = hosts.find((h) => h.dataset.state === "open") ?? hosts[0];
    const el = host.querySelector(".uz-mp-surface");
    const r = el.getBoundingClientRect();
    return {
      left: r.left,
      right: r.right,
      top: r.top,
      width: el.offsetWidth,
      height: el.offsetHeight,
    };
  });
const OPEN = '.uz-mp-host[data-state="open"]';

async function openPage(
  viewport,
  { lang = "en", anon = false, touch = false, reduced = false, video = false } = {},
) {
  const context = await browser.newContext({
    viewport,
    hasTouch: touch,
    isMobile: touch && viewport.width < 800,
    reducedMotion: reduced ? "reduce" : "no-preference",
    recordVideo: video ? { dir: resolve(out, engine + "-video"), size: viewport } : undefined,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${origin}/?lang=${lang}${anon ? "&anon=1" : ""}`);
  await page.locator(".rh-bar").waitFor();
  await page.waitForTimeout(300);
  return { context, page };
}

try {
  // ---- Desktop, English: the whole story with a mouse and the keys.
  {
    const { context, page } = await openPage({ width: 1280, height: 800 });
    await page.screenshot({ path: resolve(out, engine + "-bar.png") });
    assert.deepEqual(await colourOffenders(page), [], "the closed bar has no colour");
    // The page you are on is ink and underlined, never coloured.
    const current = await page.locator('.rh-link[aria-current="page"]').evaluate((el) => {
      const cs = getComputedStyle(el);
      return { color: cs.color, line: cs.textDecorationLine };
    });
    assert.equal(current.line, "underline");

    // Resources opens when the pointer rests on it, and closes when it leaves.
    const resources = page.locator(".ub-menu button");
    await resources.hover();
    await page.waitForTimeout(500);
    assert.equal((await state(page)).open, "open", "resources opens on hover");
    assert.ok(
      await page
        .locator('.uz-mp-pane[data-mp-pane="resources"] a', { hasText: "Blog" })
        .isVisible(),
    );
    const scale = await page
      .locator(".uz-mp-surface")
      .first()
      .evaluate((el) => getComputedStyle(el).scale);
    assert.ok(scale === "1" || scale === "none", "full size once open (" + scale + ")");
    // The grey highlight finds the item under the pointer.
    const blog = page.locator('.uz-mp-pane[data-mp-pane="resources"] a', { hasText: "Blog" });
    const blogBox = await blog.boundingBox();
    await page.mouse.move(blogBox.x + 30, blogBox.y + blogBox.height / 2, { steps: 6 });
    await page.waitForTimeout(300);
    const hl = await page.locator(OPEN + " .uz-mp-hl").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        opacity: getComputedStyle(el).opacity,
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      };
    });
    assert.equal(hl.opacity, "1", "highlight shows");
    assert.ok(
      Math.abs(hl.left - blogBox.x) < 3 &&
        Math.abs(hl.top - blogBox.y) < 3 &&
        Math.abs(hl.width - blogBox.width) < 3,
      "highlight sits on the item",
    );
    await page.screenshot({ path: resolve(out, engine + "-resources.png") });
    assert.deepEqual(await colourOffenders(page), [], "the resources menu has no colour");
    await page.mouse.move(640, 500, { steps: 8 });
    await page.waitForTimeout(500);
    assert.equal((await state(page)).open, "closed", "resources closes when the pointer leaves");

    // Clicking keeps a hover-opened menu open; clicking again closes it.
    await resources.hover();
    await page.waitForTimeout(400);
    await resources.click();
    await page.mouse.move(640, 500, { steps: 8 });
    await page.waitForTimeout(500);
    assert.equal((await state(page)).open, "open", "a click keeps it open");
    await resources.click();
    await page.waitForTimeout(400);
    assert.equal((await state(page)).open, "closed", "a second click closes it");

    // Credits opens by a click; then pointing at the other triggers switches the panel.
    await page.locator(".rh-credits-chip").click();
    await page.waitForTimeout(600);
    let now = await state(page);
    assert.equal(now.open, "open");
    assert.ok(now.panes.includes("credits*"));
    assert.equal((await surfaceBox(page)).width, 320, "credits is 320 wide");
    await page.screenshot({ path: resolve(out, engine + "-credits.png") });
    assert.deepEqual(await colourOffenders(page), [], "the credits menu has no colour");
    await page.locator(".uz-mp-group .rh-language-tool").hover();
    await page.waitForTimeout(900);
    now = await state(page);
    assert.deepEqual(now.panes, ["language*"], "only the language pane is left after the switch");
    assert.equal((await surfaceBox(page)).width, 288, "the panel resized to the language menu");
    await page.screenshot({ path: resolve(out, engine + "-language.png") });
    assert.deepEqual(await colourOffenders(page), [], "the language menu has no colour");
    await page.locator(".rh-avatar-btn").hover();
    await page.waitForTimeout(900);
    assert.deepEqual((await state(page)).panes, ["account*"]);
    const trigger = await page.locator(".rh-avatar-btn").boundingBox();
    const account = await surfaceBox(page);
    assert.ok(
      Math.abs(account.right - (trigger.x + trigger.width)) < 3,
      "hangs from the trigger's right edge",
    );
    await page.screenshot({ path: resolve(out, engine + "-account.png") });
    assert.deepEqual(await colourOffenders(page), [], "the account menu has no colour");

    // Pressing outside closes it.
    await page.mouse.click(200, 600);
    await page.waitForTimeout(400);
    assert.equal((await state(page)).open, "closed", "a press outside closes");

    // Keys: ↓ opens and focuses the first item, ↓ ↑ Home End move, ← → switch, Esc closes.
    const avatarButton = page.locator(".rh-avatar-btn");
    await avatarButton.focus();
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(500);
    const active = () =>
      page.evaluate(
        () => document.activeElement?.textContent?.trim() || document.activeElement?.className,
      );
    assert.match(await active(), /Settings/, "first item focused");
    await page.keyboard.press("ArrowDown");
    assert.match(await active(), /Plans & pricing/);
    await page.keyboard.press("End");
    assert.match(await active(), /Log out/);
    await page.keyboard.press("Home");
    assert.match(await active(), /Settings/);
    await page.keyboard.press("ArrowUp");
    assert.match(await active(), /Log out/, "up from the first wraps to the last");
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(700);
    assert.deepEqual(
      (await state(page)).panes,
      ["language*"],
      "left switches to the menu on the left",
    );
    assert.equal(
      await page.evaluate(() => document.activeElement?.className.includes("rh-language-tool")),
      true,
      "focus follows to the trigger",
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    assert.equal((await state(page)).open, "closed");
    assert.equal(
      await page.evaluate(() => document.activeElement?.className.includes("rh-language-tool")),
      true,
      "focus returns to the trigger",
    );
    await context.close();
  }

  // ---- Right to left: the panel hangs from the other edge.
  {
    const { context, page } = await openPage({ width: 1280, height: 800 }, { lang: "ar" });
    assert.deepEqual(await colourOffenders(page), [], "the Arabic bar has no colour");
    await page.locator(".rh-avatar-btn").click();
    await page.waitForTimeout(700);
    const trigger = await page.locator(".rh-avatar-btn").boundingBox();
    const box = await surfaceBox(page);
    // The account button sits at the far left in right-to-left pages; the panel's left edge is under it.
    assert.ok(
      Math.abs(box.left - trigger.x) < 3 || box.left <= 9,
      "hangs from the trigger's left edge (or the margin)",
    );
    assert.ok(box.right <= 1280, "inside the screen");
    await page.screenshot({ path: resolve(out, engine + "-rtl-account.png") });
    assert.deepEqual(await colourOffenders(page), [], "the Arabic account menu has no colour");
    await page.locator(".rh-credits-chip").hover();
    await page.waitForTimeout(900);
    assert.deepEqual((await state(page)).panes, ["credits*"]);
    await page.screenshot({ path: resolve(out, engine + "-rtl-credits.png") });
    await context.close();
  }

  // ---- A touch screen at laptop width: a tap opens, another tap switches.
  {
    const { context, page } = await openPage(
      { width: 1180, height: 820 },
      { touch: true, video: true },
    );
    await page.locator(".rh-avatar-btn").tap();
    await page.waitForTimeout(700);
    assert.deepEqual((await state(page)).panes, ["account*"]);
    await page.locator(".rh-credits-chip").tap();
    await page.waitForTimeout(900);
    assert.deepEqual((await state(page)).panes, ["credits*"], "a second tap switches");
    await page.screenshot({ path: resolve(out, engine + "-touch-credits.png") });
    await page.mouse.click(100, 500);
    await page.waitForTimeout(400);
    assert.equal((await state(page)).open, "closed");
    await context.close();
  }

  // ---- Reduced motion: still opens, with no travelling.
  {
    const { context, page } = await openPage({ width: 1280, height: 800 }, { reduced: true });
    await page.locator(".rh-credits-chip").click();
    await page.waitForTimeout(500);
    assert.equal((await state(page)).open, "open");
    const scale = await page
      .locator(".uz-mp-surface")
      .first()
      .evaluate((el) => getComputedStyle(el).scale);
    assert.ok(scale === "1" || scale === "none");
    await context.close();
  }

  // ---- Signed out: the bar has no menus apart from Resources, and no errors.
  {
    const { context, page } = await openPage({ width: 1280, height: 800 }, { anon: true });
    assert.equal(
      await page
        .locator(".rh-avatar-btn, .rh-credits-chip, .uz-mp-group .rh-language-tool")
        .count(),
      0,
    );
    assert.deepEqual(await colourOffenders(page), [], "the signed-out bar has no colour");
    await context.close();
  }

  // ---- Phone: the sheet is ink and grey too.
  {
    const { context, page } = await openPage(
      { width: 390, height: 844 },
      { touch: true, video: true },
    );
    await page.locator(".rh-burger").tap();
    await page.locator("dialog.rh-sheet-wrap[open]").waitFor();
    await page.waitForTimeout(500);
    await page.screenshot({ path: resolve(out, engine + "-phone-sheet.png") });
    assert.deepEqual(await colourOffenders(page), [], "the phone sheet has no colour");
    await context.close();
  }

  results.push({ engine, acceptance: "passed", errors });
  assert.deepEqual(errors, [], "no page errors");
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify(results, null, 2));
