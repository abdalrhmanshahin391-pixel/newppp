import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));

test("every recorded line the study circle plays is in the site", () => {
  const source = readFileSync(`${root}src/components/rita-study/voice-lines.ts`, "utf8");
  const block = /const LINES: Record<string, number> = \{([\s\S]*?)\};/.exec(source)?.[1] ?? "";
  const lines = [...block.matchAll(/(\w+):\s*(\d+)/g)].map((m) => [m[1], Number(m[2])] as const);
  assert.ok(lines.length >= 13, "the list of lines was found");
  assert.ok(
    lines.some(([action]) => action === "translate"),
    "the book's «ترجملي» has its lines",
  );
  for (const [action, count] of lines)
    for (let n = 1; n <= count; n++) {
      const file = `${root}public/sounds/uzyra/${action}-${n}.mp3`;
      assert.ok(existsSync(file), `${action}-${n}.mp3 is missing`);
      assert.ok(statSync(file).size > 1000, `${action}-${n}.mp3 is too small`);
    }
});
