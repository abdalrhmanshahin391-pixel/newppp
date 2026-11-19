import assert from "node:assert/strict";
import test from "node:test";
import {
  GuideContentSchema,
  guideSlides,
  normalizeGuideReply,
  slideOfSection,
} from "./guide-content.ts";
import { guideSystemPrompt, reviewSystemPrompt } from "./guide-prompts.ts";
import { renderGuideHtml } from "./guide-html.ts";

const rules = (heading: string) => ({
  kind: "rules",
  heading,
  items: [{ rule: `${heading} rule`, examples: ["I work."] }],
});

const reply = {
  title: "Present simple",
  intro: "We use the [[present simple]] for habits.",
  slides: [
    { title: "Form", sections: [rules("Form")] },
    { title: "Spelling", sections: [rules("Spelling"), rules("Exceptions")] },
    { title: "Usage", sections: [rules("Usage")] },
  ],
  callout: "Add -s after he, she, it.",
  arabic_note: "نضيف -s مع he و she و it.",
};

test("the writer's slides become one list of sections and a slide split", () => {
  const guide = GuideContentSchema.parse(normalizeGuideReply(reply));
  assert.equal(guide.sections.length, 4);
  assert.deepEqual(guide.slides, [
    { title: "Form", count: 1 },
    { title: "Spelling", count: 2 },
    { title: "Usage", count: 1 },
  ]);
  assert.deepEqual(
    guideSlides(guide).map((slide) => slide.sections),
    [[0], [1, 2], [3]],
  );
  assert.equal(slideOfSection(guide, 2), 1);
  assert.equal(slideOfSection(guide, 3), 2);
});

test("an old guide (one page, no slides) is one slide holding every section", () => {
  const old = GuideContentSchema.parse({
    title: "Plurals",
    intro: "Most nouns add -s.",
    sections: [rules("Form"), rules("Spelling")],
  });
  assert.equal(old.slides, undefined);
  assert.deepEqual(guideSlides(old), [{ title: "Plurals", sections: [0, 1] }]);
  assert.equal(slideOfSection(old, 1), 0);
});

test("a guide without slides still fits one page (at most 4 sections)", () => {
  const tooMany = {
    title: "X",
    intro: "Y",
    sections: [rules("a"), rules("b"), rules("c"), rules("d"), rules("e")],
  };
  assert.equal(GuideContentSchema.safeParse(tooMany).success, false);
});

test("slides must share out every section, and no slide holds more than 4", () => {
  const guide = normalizeGuideReply({
    ...reply,
    slides: [{ title: "Big", sections: [1, 2, 3, 4, 5, 6].map((n) => rules(`r${n}`)) }],
  }) as { sections: unknown[]; slides: { count: number }[] };
  assert.equal(guide.sections.length, 4);
  assert.equal(guide.slides[0].count, 4);
  const broken = {
    ...GuideContentSchema.parse(normalizeGuideReply(reply)),
    slides: [{ title: "A", count: 1 }],
  };
  assert.equal(GuideContentSchema.safeParse(broken).success, false);
});

test("the writer is asked to cover the topic completely, across slides", () => {
  const prompt = guideSystemPrompt();
  assert.match(prompt, /Cover the topic completely/);
  assert.match(prompt, /1 to 6 slides/);
  assert.doesNotMatch(prompt, /fits one printed page: "table"/);
  assert.match(reviewSystemPrompt(), /no slide shows/);
});

test("printed: each slide starts a new page; on screen each slide is marked for the slide switcher", () => {
  const guide = GuideContentSchema.parse(normalizeGuideReply(reply));
  const print = renderGuideHtml(guide);
  assert.equal((print.match(/class="slide"/g) ?? []).length, 3);
  assert.equal((print.match(/class="slide-title"/g) ?? []).length, 3);
  const screen = renderGuideHtml(guide, { anchors: true, screen: true });
  assert.match(screen, /data-slide="0"/);
  assert.match(screen, /data-slide="2"/);
  // Section names stay global across slides: the wheel and Uzyra keep finding them.
  assert.match(screen, /data-section="s4"/);
  // The intro sits on the first slide, the callout and the Arabic note on the last one.
  const last = screen.slice(screen.indexOf('data-slide="2"'));
  assert.match(last, /class="card callout"/);
  assert.match(last, /class="ar"/);
});

test("an old one-page guide renders as before, with no slide titles", () => {
  const old = GuideContentSchema.parse({
    title: "Plurals",
    intro: "Most nouns add -s.",
    sections: [rules("Form")],
  });
  const html = renderGuideHtml(old);
  assert.equal((html.match(/class="slide-title"/g) ?? []).length, 0);
  assert.equal((html.match(/class="slide"/g) ?? []).length, 1);
});
