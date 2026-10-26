// Copies the lesson engine files into the Edge Function's shared folder, byte for byte.
// The Edge Function runs outside the app bundle, so it cannot import from src/lib. The files are pure
// TypeScript (zod and a type-only supabase import), so a copy is the same code. A test fails when a
// copy drifts: run `node scripts/sync-lesson-edge.mjs` after editing any of them.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const SHARED_FILES = [
  "rita-lesson-content.ts",
  "rita-lesson-engine.ts",
  "rita-lesson-grader.ts",
  "rita-lesson-samples.ts",
  "rita-lesson-run.ts",
  "rita-lesson-run.core.ts",
];

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "src", "lib");
const to = join(root, "supabase", "functions", "_shared");

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(to, { recursive: true });
  for (const name of SHARED_FILES) copyFileSync(join(from, name), join(to, name));
  console.log(`Copied ${SHARED_FILES.length} files to supabase/functions/_shared`);
}
