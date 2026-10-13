import assert from "node:assert/strict";
import test from "node:test";
import { detectLatinLang, inferDirection, parseRitaText, spokenTextOf } from "./rita-message.ts";

const segmentsOf = (raw: string) => {
  const block = parseRitaText(raw).blocks[0];
  assert.equal(block.type, "paragraph");
  return block.type === "paragraph" ? block.segments : [];
};

test("markdown marks never reach the display or the spoken text", () => {
  const raw = "**Ich will einen Shawarma** أو **Ich möchte einen Shawarma**. استخدم *einen*.";
  const parsed = parseRitaText(raw);
  assert.ok(!parsed.plain.includes("*"));
  assert.equal(spokenTextOf(raw), parsed.plain);
});

test("an unclosed bold mark in a streaming reply is dropped", () => {
  assert.equal(spokenTextOf("قول **Ich will"), "قول Ich will");
});

test("a German phrase inside Arabic is one isolated left-to-right segment", () => {
  const segments = segmentsOf("الأفضل أن تقول: Ich möchte einen Döner. ثم كمل");
  const latin = segments.filter((segment) => segment.dir === "ltr");
  assert.equal(latin.length, 1);
  assert.equal(latin[0].text, "Ich möchte einen Döner.");
  assert.equal(latin[0].lang, "de");
  assert.ok(
    segments.filter((segment) => segment.dir === "rtl").every((segment) => segment.lang !== "de"),
  );
});

test("a comma between two German words does not split the phrase", () => {
  const latin = segmentsOf("قول Guten Morgen, wie geht's? بعدين").filter((s) => s.dir === "ltr");
  assert.equal(latin.length, 1);
  assert.equal(latin[0].text, "Guten Morgen, wie geht's?");
});

test("a German phrase in quotes keeps its quotes and the Arabic comma stays outside", () => {
  const latin = segmentsOf("قول “Guten Morgen”، وبعدين").filter((s) => s.dir === "ltr");
  assert.equal(latin.length, 1);
  assert.equal(latin[0].text, "“Guten Morgen”");
});

test("emphasis inside a phrase keeps the phrase in one segment", () => {
  const latin = segmentsOf("قول Ich will **einen** Shawarma").filter((s) => s.dir === "ltr");
  assert.equal(latin.length, 1);
  assert.deepEqual(
    latin[0].parts.map((part) => [part.text, part.emphasis]),
    [
      ["Ich will ", false],
      ["einen", true],
      [" Shawarma", false],
    ],
  );
});

test("numbered points that arrive on one line become a list with an intro", () => {
  const parsed = parseRitaText(
    "أكيد! هلق تعلمنا: 1. الجملة الصحيحة هي Ich will einen Shawarma. 2. لازم نكتب Shawarma بدون c. 3. نستخدم einen.",
  );
  assert.equal(parsed.blocks.length, 2);
  assert.equal(parsed.blocks[0].type, "paragraph");
  const list = parsed.blocks[1];
  assert.equal(list.type, "list");
  assert.equal(list.type === "list" && list.ordered, true);
  assert.equal(list.type === "list" && list.items.length, 3);
});

test("a year or a lone number is not treated as a list", () => {
  const parsed = parseRitaText("في سنة 2026. هاد الدرس 1. مفيد");
  assert.equal(parsed.blocks.length, 1);
  assert.equal(parsed.blocks[0].type, "paragraph");
});

test("bullet lines and headings are cleaned", () => {
  const parsed = parseRitaText("## عنوان\n- كلمة أولى\n- كلمة ثانية");
  assert.equal(parsed.blocks[0].type, "paragraph");
  const list = parsed.blocks[1];
  assert.equal(list.type === "list" && list.ordered, false);
  assert.ok(!parsed.plain.includes("#"));
});

test("direction follows the first letter, like dir=auto", () => {
  assert.equal(inferDirection("Ich will einen Shawarma."), "ltr");
  assert.equal(inferDirection("قول Guten Morgen لما تصحى"), "rtl");
  assert.equal(inferDirection("123"), "rtl");
  assert.equal(inferDirection("123", "ltr"), "ltr");
  assert.equal(inferDirection("الجملة الصحيحة هي Ich möchte einen Shawarma."), "rtl");
  assert.equal(inferDirection("“Guten Morgen” heißt صباح الخير"), "ltr");
});

test("a full punctuation mark stays with a phrase of several words but not with a single word", () => {
  const sentence = segmentsOf("الأفضل أن تقول: Ich möchte einen Döner.").filter(
    (s) => s.dir === "ltr",
  );
  assert.equal(sentence[0].text, "Ich möchte einen Döner.");
  const single = segmentsOf("لازم نكتب حرف c.").filter((s) => s.dir === "ltr");
  assert.equal(single[0].text, "c");
  const rest = segmentsOf("لازم نكتب حرف c.").filter((s) => s.dir === "rtl");
  assert.ok(rest[rest.length - 1].text.endsWith("."));
});

test("German and English phrases get the right language tag", () => {
  assert.equal(detectLatinLang("Wie geht es dir?"), "de");
  assert.equal(detectLatinLang("Döner"), "de");
  assert.equal(detectLatinLang("How are you? Thank you"), "en");
});

test("empty and whitespace input produce no blocks", () => {
  assert.deepEqual(parseRitaText("   \n \n").blocks, []);
  assert.equal(spokenTextOf(""), "");
});
