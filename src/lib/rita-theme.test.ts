import assert from "node:assert/strict";
import test from "node:test";
import { LESSON_THEMES, contrastRatio, themeStyle, type ThemeName } from "./rita-theme.ts";

const pairs = (t: (typeof LESSON_THEMES)[ThemeName]) =>
  [
    ["ink on bg", t.ink, t.bg, 7],
    ["ink on surface", t.ink, t.surface, 7],
    ["muted on bg", t.muted, t.bg, 4.5],
    ["muted on surface", t.muted, t.surface, 4.5],
    ["muted on surface2", t.muted, t.surface2, 4.5],
    ["accent text on surface", t.accent, t.surface, 4.5],
    ["accent text on bg", t.accent, t.bg, 4.5],
    ["button label on accent", t.accentInk, t.accent, 4.5],
    ["learner bubble text", t.youInk, t.you, 7],
    ["ok on okSoft", t.ok, t.okSoft, 4.5],
    ["warn on warnSoft", t.warn, t.warnSoft, 4.5],
    ["danger on dangerSoft", t.danger, t.dangerSoft, 4.5],
    ["accent on accentSoft", t.accent, t.accentSoft, 4.5],
    ["ink on accentSoft", t.ink, t.accentSoft, 7],
    ["accent on surface2", t.accent, t.surface2, 4.5],
    ["ok on surface2", t.ok, t.surface2, 4.5],
    ["warn on surface2", t.warn, t.surface2, 4.5],
    ["warn on surface", t.warn, t.surface, 4.5],
    ["danger on surface", t.danger, t.surface, 4.5],
  ] as const;

for (const name of ["dark", "light"] as const) {
  test(`${name} lesson theme meets WCAG AA for text`, () => {
    for (const [label, fg, bg, min] of pairs(LESSON_THEMES[name])) {
      const ratio = contrastRatio(fg, bg);
      assert.ok(ratio >= min, `${name}: ${label} is ${ratio.toFixed(2)}:1, needs ${min}:1`);
    }
  });

  test(`${name} lesson theme separates surfaces and borders from the page`, () => {
    const t = LESSON_THEMES[name];
    assert.ok(contrastRatio(t.line, t.surface) >= 1.25);
    assert.ok(contrastRatio(t.surface, t.bg) >= 1.03);
  });
}

test("contrast ratio is symmetric and known values hold", () => {
  assert.equal(contrastRatio("#000000", "#ffffff").toFixed(1), "21.0");
  assert.equal(contrastRatio("#ffffff", "#000000").toFixed(1), "21.0");
});

test("every token becomes a custom property", () => {
  const style = themeStyle("dark");
  assert.equal(style["--l-bg"], LESSON_THEMES.dark.bg);
  assert.equal(Object.keys(style).length, Object.keys(LESSON_THEMES.dark).length);
});
