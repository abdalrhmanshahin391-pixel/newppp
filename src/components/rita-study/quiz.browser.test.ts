// The practice questions in a real browser: answering plays the right or wrong sound, colours the
// options, shows why (and why a wrong pick is wrong), fills the progress dots, and at the end shows
// the score and "try the wrong ones again"; "explain it more" hands the question to Uzyra.
// The sounds are recorded instead of played. Needs Playwright with Chromium (CI installs it; locally
// set PLAYWRIGHT_MODULE to an installed copy if `playwright` is not in node_modules).
import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build, type Plugin } from "esbuild";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const ORIGIN = "http://uzyra.test";

type Locator = {
  click: () => Promise<void>;
  textContent: () => Promise<string | null>;
  getAttribute: (name: string) => Promise<string | null>;
  count: () => Promise<number>;
  nth: (index: number) => Locator;
  waitFor: () => Promise<void>;
};
type Page = {
  route: (url: string, handler: (route: Route) => unknown) => Promise<void>;
  goto: (url: string) => Promise<unknown>;
  evaluate: <T>(fn: () => T) => Promise<T>;
  getByRole: (role: string, options: { name: string | RegExp }) => Locator;
  getByText: (text: string | RegExp) => Locator;
  locator: (selector: string) => Locator;
};
type Route = { fulfill: (options: { contentType: string; body: string }) => Promise<void> };
type Browser = { newPage: () => Promise<Page>; close: () => Promise<void> };

async function launch(): Promise<Browser> {
  const name = process.env.PLAYWRIGHT_MODULE || "playwright";
  const { chromium } = (await import(name)) as { chromium: { launch: () => Promise<Browser> } };
  return chromium.launch();
}

const STUBS: Record<string, string> = {
  "@/integrations/supabase/client": `export const supabase = { auth: { getSession: async () => ({ data: { session: null } }) } };`,
  "@tanstack/react-start": `export const useServerFn = (fn) => fn;`,
  "@tanstack/react-router": `
    import { createElement } from "react";
    export const Link = ({ to, children, ...rest }) => createElement("a", { href: to, ...rest }, children);`,
  "@/lib/lecture-lab.functions": `
    export const lqBoard = async () => ({ subjects: [], subtopics: [] });
    export const lqAddSubject = async () => ({ id: "s" });
    export const lqAddSubtopic = async () => ({ id: "t" });
    export const lqSaveStudyQuestions = async () => ({ lectureId: "l", saved: 0 });`,
  "./tech-sound": `
    const said = (name) => () => (window.__sounds = [...(window.__sounds || []), name]);
    export const rightAnswerSound = said("right");
    export const wrongAnswerSound = said("wrong");
    export const quizDoneSound = said("done");`,
};

const stubs: Plugin = {
  name: "stubs",
  setup(b) {
    const names = Object.keys(STUBS).map((n) => n.replace(/[/@.-]/g, "\\$&"));
    b.onResolve({ filter: new RegExp(`^(${names.join("|")})$`) }, (a) => ({
      path: a.path,
      namespace: "stub",
    }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({
      contents: STUBS[a.path],
      loader: "tsx",
      resolveDir: ROOT,
    }));
  },
};

const ENTRY = `
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { StudyPracticeBody } from "@/components/rita-study/StudyPracticePanel";

const questions = [
  { question: "She ___ at night.", options: ["study", "studies", "studys", "studying"], answer: 1,
    why: "مع she بتصير y ‏ies.", whyNot: ["مع she لازم ending.", "", "y قبلها ساكن: ies مش ys.", "هاي مش زمن الحاضر البسيط."] },
  { question: "He ___ a book.", options: ["has", "have", "haves", "having"], answer: 0,
    why: "have مع he بتصير has.", whyNot: ["", "have للـ I/you/we/they.", "haves مش موجودة.", "having مش هون."] },
];
const view = { id: "q", action: "make_mcq", status: "ready", cards: [], questions, message: "" };
createRoot(document.getElementById("root")).render(
  h("div", { dir: "rtl" },
    h(StudyPracticeBody, {
      view, onRetry() {}, onSwitch() {}, onClose() {},
      onExplain(question, chosen) { window.__explained = { question: question.question, chosen }; },
    })),
);
`;

async function bundle(): Promise<string> {
  const result = await build({
    stdin: { contents: ENTRY, resolveDir: ROOT, loader: "tsx" },
    bundle: true,
    format: "iife",
    jsx: "automatic",
    alias: { "@": `${ROOT}src` },
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [stubs],
    loader: { ".css": "empty" },
    write: false,
    logLevel: "silent",
  });
  return result.outputFiles[0].text;
}

test("questions: sounds, colours, why and why-not, dots, score, retry, explain more", async (t) => {
  let browser: Browser;
  try {
    browser = await launch();
  } catch (error) {
    if (process.env.CI) throw error;
    t.skip(`Playwright is not available here: ${String(error).slice(0, 120)}`);
    return;
  }
  try {
    const script = await bundle();
    const page = await browser.newPage();
    await page.route(`${ORIGIN}/**`, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><meta charset="utf-8"><div id="root"></div><script>${script.replace(/<\/script/g, "<\\/script")}</script>`,
      }),
    );
    await page.goto(`${ORIGIN}/`);
    const sounds = () => page.evaluate(() => (window as unknown as { __sounds?: string[] }).__sounds ?? []);
    const option = (n: number) => page.locator(".st-quiz-option").nth(n);
    const dot = (n: number) => page.locator(".st-quiz-dot").nth(n);

    // A wrong pick: the wrong sound, red on the pick, green on the right one, both reasons.
    await option(2).click();
    assert.deepEqual(await sounds(), ["wrong"]);
    assert.equal(await option(2).getAttribute("data-state"), "wrong");
    assert.equal(await option(1).getAttribute("data-state"), "right");
    assert.equal(await option(0).getAttribute("data-state"), "rest");
    await page.getByText("ليش؟").waitFor();
    await page.getByText(/ليش «studys» غلط؟/).waitFor();
    await page.getByText("y قبلها ساكن: ies مش ys.").waitFor();
    assert.equal(await dot(0).getAttribute("data-state"), "wrong");

    // "Explain it more" hands the question and the pick to Uzyra.
    await page.getByRole("button", { name: /اشرحلي أكثر/ }).click();
    const explained = await page.evaluate(
      () => (window as unknown as { __explained: unknown }).__explained,
    );
    assert.deepEqual(explained, { question: "She ___ at night.", chosen: 2 });

    // The second question, right: the right sound, then the end tune; the score and retry.
    await page.getByRole("button", { name: "التالي" }).click();
    await option(0).click();
    assert.equal(await option(0).getAttribute("data-state"), "right");
    await page.getByText("صح، برافو!").waitFor();
    assert.equal(await dot(1).getAttribute("data-state"), "right");
    assert.match((await page.locator(".st-quiz-score").textContent()) ?? "", /1 من 2/);
    await new Promise((resolve) => setTimeout(resolve, 700));
    assert.deepEqual(await sounds(), ["wrong", "right", "done"]);

    // Try the wrong ones again: back on the first question, unanswered; the right one stays.
    await page.getByRole("button", { name: /عيد اللي غلطت فيهم/ }).click();
    assert.equal(await dot(0).getAttribute("data-state"), "open");
    assert.equal(await dot(1).getAttribute("data-state"), "right");
    assert.equal(await option(1).getAttribute("data-state"), null);
    assert.equal(await page.locator(".st-quiz-score").count(), 0);
  } finally {
    await browser.close();
  }
});
