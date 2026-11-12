// Writes Wordcraft's level packs (src/lib/wordcraft/packs.json). Run after changing the word
// list or the generator:  node scripts/wordcraft-generate.ts
// A test fails when packs.json differs from what the generator makes.
import { writeFileSync } from "node:fs";
import { generateAll } from "../src/lib/wordcraft/generate.ts";

const started = performance.now();
const packs = generateAll();
const file = new URL("../src/lib/wordcraft/packs.json", import.meta.url);
writeFileSync(file, JSON.stringify(packs) + "\n");
const byPack: Record<string, number> = {};
for (const p of packs.puzzles) byPack[p.pack] = (byPack[p.pack] ?? 0) + 1;
console.log(
  `${packs.puzzles.length} puzzles ${JSON.stringify(byPack)} in ${Math.round(performance.now() - started)} ms`,
);
