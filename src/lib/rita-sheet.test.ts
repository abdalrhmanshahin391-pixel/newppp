import assert from "node:assert/strict";
import test from "node:test";
import { boldParts, joinSheet, parseSheet, splitSheet } from "./rita-sheet.ts";

test("a reply without a sheet is all speech", () => {
  assert.deepEqual(splitSheet("هلا كيفك؟"), { speech: "هلا كيفك؟", sheet: "" });
});

test("the sheet after the marker is split off, in any case", () => {
  assert.deepEqual(splitSheet("Add -s. [[SHEET]]\n- a"), { speech: "Add -s. ", sheet: "- a" });
  assert.deepEqual(splitSheet("x [[ sheet ]] - b"), { speech: "x ", sheet: "- b" });
});

test("a half-written marker at the end is hidden while streaming", () => {
  assert.equal(splitSheet("Add -s. [[SHE").speech, "Add -s. ");
  assert.equal(splitSheet("Add -s. [").speech, "Add -s. ");
  assert.equal(splitSheet("see [[x]]").speech, "see [[x]]");
});

test("join keeps the sheet on its own line", () => {
  assert.equal(joinSheet(" Hi ", " - a "), "Hi\n[[SHEET]]\n- a");
  assert.equal(joinSheet("Hi", ""), "Hi");
});

test("the sheet's lines become blocks", () => {
  const blocks = parseSheet(
    [
      "# Third person -s",
      "| The verb ends in | What you do | Example |",
      "|---|---|---|",
      "| most verbs | add -s | work → works |",
      "| ch, sh | add -es | watch → **watches** |",
      "- one",
      "- two",
      "= She **studies** at night.",
      "! Watch out: have → has",
      "plain words",
    ].join("\n"),
  );
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ["title", "table", "points", "example", "watch", "line"],
  );
  const table = blocks[1] as { head: string[]; rows: string[][] };
  assert.deepEqual(table.head, ["The verb ends in", "What you do", "Example"]);
  assert.equal(table.rows.length, 2);
  assert.deepEqual((blocks[2] as { items: string[] }).items, ["one", "two"]);
  assert.equal((blocks[4] as { text: string }).text, "have → has");
});

test("a broken sheet still shows", () => {
  assert.deepEqual(parseSheet("| only a head |"), [{ kind: "line", text: "only a head" }]);
  assert.deepEqual(parseSheet("-\n#\n"), []);
});

test("bold parts", () => {
  assert.deepEqual(boldParts("She **studies** now"), [
    { text: "She ", bold: false },
    { text: "studies", bold: true },
    { text: " now", bold: false },
  ]);
});
