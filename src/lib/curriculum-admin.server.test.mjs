// Executes the real placement handler against an isolated catalog fixture; no network or database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
const { outputFiles } = await build({
  entryPoints: ["src/lib/rita-path-items.functions.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  plugins: [
    {
      name: "server-boundary",
      setup(b) {
        b.onResolve({ filter: /^@tanstack\/react-start$/ }, () => ({
          path: "server",
          namespace: "fixture",
        }));
        b.onResolve({ filter: /legacy-auth-middleware$/ }, () => ({
          path: "auth",
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
          contents:
            path === "auth"
              ? "export const requireSupabaseAuth = {};"
              : "export const createServerFn=()=>{const chain={middleware:()=>chain,inputValidator:fn=>{chain.parse=fn;return chain},handler:fn=>args=>fn({...args,data:chain.parse(args.data)})};return chain};",
        }));
      },
    },
  ],
  logLevel: "silent",
});
const { adminPlacePathLesson } = await import(
  "data:text/javascript;base64," + Buffer.from(outputFiles[0].text).toString("base64")
);
const a = "11111111-1111-4111-8111-111111111111",
  draft = "22222222-2222-4222-8222-222222222222",
  hidden = "33333333-3333-4333-8333-333333333333",
  stop = "44444444-4444-4444-8444-444444444444";
function fixture(admin = true, selected = true) {
  const writes = [],
    reads = [];
  const lessons = [
    { id: a, path_order: 1, curriculum: { level: "A1" } },
    { id: hidden, path_order: 2, curriculum: { level: "A1" } },
    ...(selected ? [{ id: draft, path_order: null, curriculum: { level: "A1" } }] : []),
  ];
  const ctx = {
    userId: "admin",
    supabase: {
      rpc: async (name, args) => {
        if (name === "has_role") return { data: admin, error: null };
        writes.push({ name, args });
        return { error: null };
      },
      from: (table) => {
        reads.push(table);
        let subset =
          table === "rita_lessons"
            ? lessons
            : [{ id: stop, path_order: 1.5, kind: "resources", title: "Files" }];
        const chain = {
          select: () => chain,
          neq: () => chain,
          eq: () => chain,
          order: () => chain,
          in: (_, ids) => {
            subset = subset.filter((r) => ids.includes(r.id));
            return chain;
          },
          then: (resolve) => Promise.resolve({ data: subset, error: null }).then(resolve),
        };
        return chain;
      },
    },
  };
  return { ctx, writes, reads };
}
test("non-admin access is rejected before reading curriculum data", async () => {
  const f = fixture(false);
  await assert.rejects(
    adminPlacePathLesson({ context: f.ctx, data: { lessonId: draft, language: "en" } }),
    /Forbidden/,
  );
  assert.equal(f.reads.length, 0);
  assert.equal(f.writes.length, 0);
});
test("placing a draft preserves other hidden draft placements and resource stations", async () => {
  const f = fixture();
  await adminPlacePathLesson({
    context: f.ctx,
    data: { lessonId: draft, language: "en", level: "A1", before: a, after: stop },
  });
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].name, "rita_set_path_layout");
  assert.deepEqual(
    f.writes[0].args.p_lessons.map((r) => r.id),
    [a, draft, hidden],
  );
  assert.equal(f.writes[0].args.p_items[0].id, stop);
});
test("unknown or wrong-level lessons cannot be placed", async () => {
  const missing = fixture(true, false);
  await assert.rejects(
    adminPlacePathLesson({ context: missing.ctx, data: { lessonId: draft, language: "en" } }),
  );
  assert.equal(missing.writes.length, 0);
  const level = fixture();
  await assert.rejects(
    adminPlacePathLesson({
      context: level.ctx,
      data: { lessonId: draft, language: "en", level: "B2" },
    }),
  );
  assert.equal(level.writes.length, 0);
});
