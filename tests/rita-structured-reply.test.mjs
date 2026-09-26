import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/rita-structured-reply.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
const { parseRitaReply, plainRitaReply, speechForRitaPart } = await import(moduleUrl);

test("parses one German phrase with a silent breakdown", () => {
  const parts = parseRitaReply("AR:صباح الخير معناها بالألماني\nDE:Guten Morgen||صباح الخير||Guten=صباح;Morgen=خير");
  assert.equal(parts.length, 2);
  assert.deepEqual(parts[1].breakdown, [
    { german: "Guten", meaning: "صباح" },
    { german: "Morgen", meaning: "خير" },
  ]);
  assert.deepEqual(speechForRitaPart(parts[1]), { text: "Guten Morgen", voiceRole: "german" });
});

test("keeps written notes out of speech", () => {
  const parts = parseRitaReply("DE:Gute Nacht||تصبح على خير||\nNOTE:تتغير نهاية الصفة حسب الاسم.");
  assert.equal(speechForRitaPart(parts[1]), null);
  assert.equal(plainRitaReply("DE:Gute Nacht||تصبح على خير||"), "Gute Nacht — تصبح على خير");
});

test("safely displays an unformatted model line as speech", () => {
  const parts = parseRitaReply("جواب عادي بدون ترميز");
  assert.equal(parts[0].type, "speech");
});
test("repairs wrong separators from the model (dash and single pipe)", () => {
  const [card] = parseRitaReply("DE:Gute Nacht — تصبح على خير || Gute=تصبح;Nacht=على خير");
  assert.equal(card.text, "Gute Nacht");
  assert.equal(card.meaning, "تصبح على خير");
  assert.equal(card.breakdown.length, 2);
  const [second] = parseRitaReply("DE:Ich sehe dich morgen — بشوفك بكرة — |Ich=أنا;sehe=أرى;dich=ك;morgen=بكرة");
  assert.deepEqual(speechForRitaPart(second), { text: "Ich sehe dich morgen", voiceRole: "german" });
  assert.equal(second.breakdown.length, 4);
});

test("lifts a quoted German sentence out of Arabic speech into its own card", () => {
  const parts = parseRitaReply('AR:في ألمانيا، للذهاب للحمام، نقول "Ich möchte zur Toilette gehen"');
  assert.equal(parts.at(-1).type, "german");
  assert.equal(parts.at(-1).text, "Ich möchte zur Toilette gehen");
  assert.ok(!parts[0].text.includes("Toilette"));
});
