// Switching learning language in a real browser: the real hooks behind the flashcards page and
// the conversation word tray, with English and German content saved side by side. Each language
// must see only its own cards, subjects and tray words; nothing is lost on a switch; a tray save
// never sends another language's word; and the flashcards page line names the language.
// Needs Playwright with Chromium (CI installs it; locally set PLAYWRIGHT_MODULE to an installed
// copy if `playwright` is not in node_modules). The account, Supabase and the server are stubbed.
import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build, type Plugin } from "esbuild";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const ORIGIN = "http://uzyra.test";

type Route = {
  request: () => { url: () => string; method: () => string; postData: () => string | null };
  fulfill: (options: { status?: number; contentType: string; body: string }) => Promise<void>;
};
type Page = {
  route: (url: string, handler: (route: Route) => unknown) => Promise<void>;
  goto: (url: string) => Promise<unknown>;
  evaluate: <T>(fn: (arg: never) => T, arg?: unknown) => Promise<T>;
  waitForFunction: (fn: (arg: never) => boolean, arg?: unknown) => Promise<unknown>;
  textContent: (selector: string) => Promise<string | null>;
};
type Browser = { newPage: () => Promise<Page>; close: () => Promise<void> };

async function launch(): Promise<Browser> {
  const name = process.env.PLAYWRIGHT_MODULE || "playwright";
  const { chromium } = (await import(name)) as { chromium: { launch: () => Promise<Browser> } };
  return chromium.launch();
}

// The account and database are not part of this check: a signed-in token, and the learner's
// language straight from the scope the page sets.
const STUBS: Record<string, string> = {
  "@/integrations/supabase/client": `export const supabase = { auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) } };`,
  "@/hooks/useLearningLanguage": `
    import { useActiveLanguage } from "@/lib/language-scope";
    import { BUILT_IN_LANGUAGES } from "@/lib/learning-language";
    export function useLearningLanguage() {
      const code = useActiveLanguage();
      return { language: BUILT_IN_LANGUAGES.find((l) => l.code === code) ?? null };
    }`,
};

const stubs: Plugin = {
  name: "stubs",
  setup(b) {
    b.onResolve(
      { filter: /^@\/(integrations\/supabase\/client|hooks\/useLearningLanguage)$/ },
      (a) => ({
        path: a.path,
        namespace: "stub",
      }),
    );
    b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({
      contents: STUBS[a.path],
      loader: "ts",
      resolveDir: ROOT,
    }));
  },
};

const ENTRY = `
import { createElement as h, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { setLanguageScope, useActiveLanguage } from "@/lib/language-scope";
import { useFlashcards } from "@/lib/use-flashcards";
import { useStudySubjects } from "@/lib/use-study-subjects";
import { useLearningTray } from "@/components/rita/useLearningTray";
import { LanguageScopeNote } from "@/components/language/LanguageScopeNote";

function Harness() {
  const language = useActiveLanguage();
  const cards = useFlashcards("Words", "Basics");
  const board = useStudySubjects();
  const tray = useLearningTray("u1");
  useEffect(() => {
    window.kit = { cards, tray, setLanguage: (code) => setLanguageScope({ active: code, legacy: "en" }) };
  });
  window.view = {
    language,
    cards: cards.cards.map((c) => c.front),
    subjects: board.subjects.map((s) => s.name),
    tray: tray.entries.map((e) => e.term),
    notice: tray.notice?.text ?? "",
    latest: tray.latest,
    destination: tray.destinationId,
  };
  return h("div", null, h(LanguageScopeNote), h("pre", { id: "view" }, JSON.stringify(window.view)));
}
setLanguageScope({ active: "en", legacy: "en" });
createRoot(document.getElementById("root")).render(h(Harness));
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

const word = (term: string, language: string) => ({
  term,
  meaning: "-",
  language,
  kind: "word",
  article: null,
  plural: null,
});

type View = {
  language: string;
  cards: string[];
  subjects: string[];
  tray: string[];
  notice: string;
  latest: string;
  destination: string;
};

test("English and German keep their own cards, subjects and tray words", async (t) => {
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
    const saves: { language: string }[][] = [];
    await page.route(`${ORIGIN}/**`, async (route) => {
      const request = route.request();
      if (request.url().endsWith("/api/rita/learning") && request.method() === "POST") {
        const body = JSON.parse(request.postData() || "{}") as { items: { language: string }[] };
        saves.push(body.items);
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ saved: body.items.length, skipped: 0 }),
        });
        return;
      }
      if (request.url().endsWith("/api/rita/learning")) {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ flashSubjects: [], germanSubjects: [], germanSubtopics: [] }),
        });
        return;
      }
      if (request.url().endsWith("?blank")) {
        await route.fulfill({
          contentType: "text/html",
          body: "<!doctype html><title>blank</title>",
        });
        return;
      }
      await route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><meta charset="utf-8"><div id="root"></div><script>${script.replace(/<\/script/g, "<\\/script")}</script>`,
      });
    });

    // Each language's subjects board is already saved (a German learner's own board).
    await page.goto(`${ORIGIN}/?blank`);
    await page.evaluate(() => {
      localStorage.setItem(
        "rita_@en_study_subjects",
        JSON.stringify([{ name: "English words", subs: [{ name: "Basics" }] }]),
      );
      localStorage.setItem(
        "rita_@de_study_subjects",
        JSON.stringify([{ name: "Deutsch", subs: [{ name: "Basics" }] }]),
      );
    });
    await page.goto(`${ORIGIN}/`);

    const view = () => page.evaluate(() => (window as unknown as { view: View }).view);
    const until = (check: string) =>
      page.waitForFunction((source: string) => {
        const v = (window as unknown as { view?: View }).view;
        if (!v) return false;
        return (new Function("v", `return ${source}`) as (v: View) => boolean)(v);
      }, check);
    const kit = (fn: string, ...args: unknown[]) =>
      page.evaluate(
        ([name, rest]: [string, unknown[]]) => {
          const k = (window as unknown as { kit: Record<string, unknown> }).kit;
          const [owner, method] = name.split(".");
          const target = method ? (k[owner] as Record<string, (...a: unknown[]) => unknown>) : k;
          return (target[method ?? owner] as (...a: unknown[]) => unknown)(...rest);
        },
        [fn, args] as never,
      );

    // English: one card, one tray word.
    await until(`v.language === "en" && v.subjects.includes("English words")`);
    await kit("cards.addCard", "apple", "تفاحة");
    await kit("tray.add", [word("Hello", "en")], "asked in English");
    await until(`v.cards.join() === "apple" && v.tray.join() === "Hello"`);
    assert.match(
      (await page.textContent("[data-testid=language-scope-note]")) ?? "",
      /English cards/,
    );

    // German: none of the English content shows; its own board does.
    await kit("setLanguage", "de");
    await until(`v.language === "de"`);
    await until(`v.cards.length === 0 && v.tray.length === 0 && v.subjects.join() === "Deutsch"`);
    assert.match(
      (await page.textContent("[data-testid=language-scope-note]")) ?? "",
      /German cards/,
    );
    await kit("cards.addCard", "der Hund", "الكلب");
    await kit("tray.add", [word("Hund", "de"), word("Goodbye", "en")], "asked in German");
    await until(`v.cards.join() === "der Hund" && v.tray.join() === "Hund"`);
    assert.match((await view()).latest, /Kept for its own language: Goodbye/);

    // Saving the German tray sends only German words, and the English one stays for later.
    await kit("tray.setDestinationId", "deck-1");
    await until(`v.destination === "deck-1"`);
    await kit("tray.save");
    await until(`v.tray.length === 0`);
    assert.equal(saves.length, 1);
    assert.deepEqual(
      saves[0].map((item) => item.language),
      ["de"],
      "a German save carries no English word",
    );

    // Back to English: its card and both English tray words are where they were.
    await kit("setLanguage", "en");
    await until(`v.language === "en"`);
    await until(`v.cards.join() === "apple" && v.subjects.includes("English words")`);
    await until(`v.tray.join() === "Hello,Goodbye"`);

    // Clearing the English tray leaves German untouched (nothing German was left after saving,
    // so add one first).
    await kit("setLanguage", "de");
    await until(`v.language === "de" && v.cards.join() === "der Hund"`);
    await kit("tray.add", [word("Katze", "de")], "asked in German");
    await until(`v.tray.join() === "Katze"`);
    await kit("setLanguage", "en");
    await until(`v.language === "en" && v.tray.length === 2`);
    await kit("tray.clearAll");
    await until(`v.tray.length === 0`);
    await kit("setLanguage", "de");
    await until(`v.language === "de" && v.tray.join() === "Katze"`);
  } finally {
    await browser.close();
  }
});
