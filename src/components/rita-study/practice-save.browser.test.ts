// Saving practice in a real browser: the real save panel (cards to the flashcards board, questions
// to Lecture Lab) and the real word tray saving onto the same board. Lecture Lab's server
// functions are stubbed (an in-memory shelf that records what was saved); the board is the real
// browser storage the flashcards page reads. Needs Playwright with Chromium (CI installs it; locally
// set PLAYWRIGHT_MODULE to an installed copy if `playwright` is not in node_modules).
import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build, type Plugin } from "esbuild";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const ORIGIN = "http://uzyra.test";

type Finder = {
  getByRole: (role: string, options: { name: string | RegExp }) => Locator;
  getByLabel: (label: string | RegExp) => Locator;
  getByPlaceholder: (text: string | RegExp) => Locator;
  getByText: (text: string | RegExp) => Locator;
  locator: (selector: string) => Locator;
};
type Page = Finder & {
  route: (url: string, handler: (route: Route) => unknown) => Promise<void>;
  goto: (url: string) => Promise<unknown>;
  evaluate: <T>(fn: (arg: never) => T, arg?: unknown) => Promise<T>;
  waitForFunction: (fn: (arg: never) => boolean, arg?: unknown) => Promise<unknown>;
};
type Locator = Finder & {
  click: () => Promise<void>;
  fill: (value: string) => Promise<void>;
  selectOption: (value: string | { label: string }) => Promise<unknown>;
  uncheck: () => Promise<void>;
  textContent: () => Promise<string | null>;
  first: () => Locator;
  nth: (index: number) => Locator;
  waitFor: () => Promise<void>;
};
type Route = { fulfill: (options: { contentType: string; body: string }) => Promise<void> };
type Browser = { newPage: () => Promise<Page>; close: () => Promise<void> };

async function launch(): Promise<Browser> {
  const name = process.env.PLAYWRIGHT_MODULE || "playwright";
  const { chromium } = (await import(name)) as { chromium: { launch: () => Promise<Browser> } };
  return chromium.launch();
}

const STUBS: Record<string, string> = {
  "@/integrations/supabase/client": `export const supabase = { auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) } };`,
  "@tanstack/react-start": `export const useServerFn = (fn) => fn;`,
  "@tanstack/react-router": `
    import { createElement } from "react";
    export const Link = ({ to, children, ...rest }) => createElement("a", { href: to, ...rest }, children);`,
  // Lecture Lab on the server: an in-memory shelf that records every save.
  "@/lib/lecture-lab.functions": `
    const shelf = window.__lq = { subjects: [{ id: "ex", name: "Example", is_example: true }], subtopics: [], saves: [] };
    let n = 0;
    export const lqBoard = async () => ({ subjects: shelf.subjects, subtopics: shelf.subtopics });
    export const lqAddSubject = async ({ data }) => { const id = "s" + ++n; shelf.subjects.push({ id, name: data.name }); return { id }; };
    export const lqAddSubtopic = async ({ data }) => { const id = "t" + ++n; shelf.subtopics.push({ id, subject_id: data.subjectId, name: data.name }); return { id }; };
    export const lqSaveStudyQuestions = async ({ data }) => { shelf.saves.push(data); return { lectureId: "l1", saved: data.questions.length }; };`,
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
import { createElement as h, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { setLanguageScope } from "@/lib/language-scope";
import { PracticeSave } from "@/components/rita-study/PracticeSave";
import { useLearningTray } from "@/components/rita/useLearningTray";
import { useStudySubjects } from "@/lib/use-study-subjects";

const cards = [
  { front: "der Hund", back: "الكلب", note: "die Hunde" },
  { front: "die Katze", back: "القطة", note: "" },
  { front: "das Pferd", back: "الحصان", note: "" },
];
const questions = [
  { question: "Which is right?", options: ["I is", "I am", "I are", "I be"], answer: 1, why: "With I we use am." },
  { question: "She ___ a teacher.", options: ["am", "are", "is", "be"], answer: 2, why: "He, she, it: is." },
];
const source = { title: "Present simple", quote: "I am happy" };

function Tray() {
  const tray = useLearningTray("u1");
  const watcher = useStudySubjects(); // another copy of the board on the same page
  useEffect(() => { window.tray = tray; window.watcher = watcher.subjects; });
  return null;
}

function App() {
  return h("div", { dir: "rtl" },
    h("section", { id: "cards" }, h(PracticeSave, { kind: "cards", cards, questions: [], source })),
    h("section", { id: "questions" }, h(PracticeSave, { kind: "questions", cards: [], questions, source })),
    h(Tray));
}
setLanguageScope({ active: "de", legacy: "de" });
createRoot(document.getElementById("root")).render(h(App));
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
    write: false,
    logLevel: "silent",
  });
  return result.outputFiles[0].text;
}

test("practice saves to Lecture Lab and the flashcards board, and the tray saves onto the same board", async (t) => {
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
    const storage = (key: string) =>
      page.evaluate((k: string) => JSON.parse(localStorage.getItem(k) || "null"), key as never);

    // Cards: untick one, make a subject and a sub-subject right here, save.
    const cards = page.locator("#cards");
    await cards.getByRole("button", { name: /احفظ البطاقات في الفلاش كاردز/ }).click();
    await cards.getByLabel(/das Pferd/).uncheck();
    await cards.getByRole("button", { name: /مادة جديدة/ }).click();
    await cards.getByPlaceholder(/Vocabulary/).fill("Wörter");
    await cards.getByRole("button", { name: "أضف" }).click();
    await cards.getByRole("button", { name: /فرعية جديدة/ }).click();
    await cards.getByPlaceholder(/Animals/).fill("Tiere");
    await cards.getByRole("button", { name: "أضف" }).click();
    await cards.getByRole("button", { name: /احفظ 2 بطاقات/ }).click();
    await cards.getByText(/انحفظ 2 بطاقات في «Wörter \/ Tiere»/).waitFor();
    const saved = (await storage("rita_@de_fc_wörter_tiere")) as { front: string; back: string }[];
    assert.deepEqual(
      saved.map((c) => [c.front, c.back]),
      [
        ["der Hund", "الكلب\ndie Hunde"],
        ["die Katze", "القطة"],
      ],
    );
    const board = (await storage("rita_@de_study_subjects")) as {
      name: string;
      subs: { name: string }[];
    }[];
    assert.ok(board.some((s) => s.name === "Wörter" && s.subs.some((x) => x.name === "Tiere")));

    // Saving the same cards again adds nothing twice.
    await cards.getByRole("button", { name: /احفظ بمكان ثاني/ }).click();
    await cards.locator("select").first().selectOption({ label: "Wörter" });
    await cards.locator("select").nth(1).selectOption({ label: "Tiere" });
    await cards.getByRole("button", { name: /احفظ 3 بطاقات/ }).click();
    await cards.getByText(/انحفظ بطاقة في «Wörter \/ Tiere» · 2 كانت موجودة/).waitFor();
    assert.equal(((await storage("rita_@de_fc_wörter_tiere")) as unknown[]).length, 3);

    // Questions: the example shelf is not offered; a new subject and sub-subject, then save.
    const qs = page.locator("#questions");
    await qs.getByRole("button", { name: /احفظ الأسئلة في مختبر المحاضرات/ }).click();
    await qs.getByRole("button", { name: /مادة جديدة/ }).waitFor();
    const offered = await qs.locator("select").first().textContent();
    assert.ok(!offered?.includes("Example"), "the read-only example shelf is not a place to save");
    await qs.getByRole("button", { name: /مادة جديدة/ }).click();
    await qs.getByPlaceholder(/English Grammar/).fill("English Grammar");
    await qs.getByRole("button", { name: "أضف" }).click();
    await qs.getByRole("button", { name: /فرعية جديدة/ }).click();
    await qs.getByPlaceholder(/Present simple/).fill("To be");
    await qs.getByRole("button", { name: "أضف" }).click();
    await qs.getByRole("button", { name: /احفظ 2 أسئلة/ }).click();
    await qs.getByText(/انحفظ 2 أسئلة في «English Grammar \/ To be»/).waitFor();
    const lq = (await page.evaluate(() => (window as never as { __lq: unknown }).__lq)) as {
      saves: {
        subtopicId: string;
        title: string;
        questions: { stem: string; options: { is_correct: boolean }[]; point_ref: string }[];
      }[];
    };
    assert.equal(lq.saves.length, 1);
    assert.equal(lq.saves[0].title, "Present simple · «I am happy»");
    for (const q of lq.saves[0].questions) {
      assert.equal(q.options.length, 4);
      assert.equal(q.options.filter((o) => o.is_correct).length, 1);
      assert.equal(q.point_ref, "I am happy");
    }

    // The word tray saves onto the same board, and another copy of the board on the page sees it.
    await page.evaluate(async () => {
      const w = window as never as { tray: Record<string, (...a: unknown[]) => unknown> };
      w.tray.add(
        [
          {
            term: "Hund",
            meaning: "كلب",
            language: "de",
            kind: "word",
            article: "der",
            plural: null,
          },
        ],
        "asked",
      );
    });
    await page.waitForFunction(
      () => (window as never as { tray: { entries: unknown[] } }).tray.entries.length === 1,
    );
    const id = (await page.evaluate(() => {
      const w = window as never as { tray: { flashOptions: { id: string; label: string }[] } };
      return w.tray.flashOptions.find((o) => o.label === "Wörter / Tiere")?.id;
    })) as string;
    assert.ok(id, "the tray offers the flashcards board's sub-subjects");
    await page.evaluate(async (target: string) => {
      const w = window as never as { tray: { saveNamed: (...a: unknown[]) => Promise<void> } };
      await w.tray.saveNamed("flashcards", target, "Wörter / Tiere", [
        {
          term: "Hund",
          meaning: "كلب",
          language: "de",
          kind: "word",
          article: "der",
          plural: null,
        },
        {
          term: "Maus",
          meaning: "فأر",
          language: "de",
          kind: "word",
          article: "die",
          plural: null,
        },
      ]);
    }, id as never);
    await page.waitForFunction(() => {
      const raw = localStorage.getItem("rita_@de_fc_wörter_tiere");
      return Boolean(raw && JSON.parse(raw).length === 4);
    });
    const after = (await storage("rita_@de_fc_wörter_tiere")) as { front: string }[];
    assert.deepEqual(
      after.map((c) => c.front),
      ["der Hund", "die Katze", "das Pferd", "die Maus"],
      "der Hund was already there; die Maus is added once",
    );
    await page.evaluate(async () => {
      const w = window as never as { tray: { create: (...a: unknown[]) => Promise<unknown> } };
      await w.tray.create("flash_subject", "Verben", null);
    });
    await page.waitForFunction(() =>
      ((window as never as { watcher: { name: string }[] }).watcher ?? []).some(
        (s) => s.name === "Verben",
      ),
    );
    const final = (await storage("rita_@de_study_subjects")) as { name: string }[];
    assert.ok(final.some((s) => s.name === "Wörter") && final.some((s) => s.name === "Verben"));
  } finally {
    await browser.close();
  }
});
