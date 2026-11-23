// Every page a visitor can *use* needs an account. This walks src/routes and fails when a route
// is neither on the public list below nor guarded: by RequireAuth / SignedOutPanel, a redirect to
// /login, a redirect elsewhere, an admin check, or a guarded parent layout. The guard may sit in
// the route file or in a component it imports from "@/…" (one level deep).
//
// It reads the code, so it cannot tell a page-wide redirect to /login from one that only runs when a
// button is pressed; a page guarded only that way passes here. Wrap such pages in RequireAuth.
//
// Run: node scripts/check-guest-routes.mjs
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const routesDir = resolve(root, "src/routes");

/** Pages that only describe Uzyra or let you in, so they stay open. Keep this list short. */
const PUBLIC = new Map([
  ["__root", "the app shell"],
  ["index", "home page"],
  ["about", "about Uzyra"],
  ["blog.index", "blog"],
  ["blog.from-page-to-practice", "blog post"],
  ["books", "library list (reading needs an account)"],
  ["games", "games list (playing needs an account)"],
  ["learn.index", "learning hub (each tool needs an account)"],
  ["pricing", "prices"],
  ["offers", "offers (buying needs an account)"],
  ["privacy-policy", "legal"],
  ["refund-policy", "legal"],
  ["terms", "legal"],
  ["support", "help and contact"],
  ["login", "sign in"],
  ["register", "create an account"],
  ["start", "sign in or create an account"],
  ["forgot-password", "password reset"],
  ["reset-password", "password reset"],
  ["locked", "account locked notice"],
  ["checkout.success", "after payment"],
  ["join.$code", "invite link: shows the class and asks to sign in to join"],
]);

const GUARD =
  /RequireAuth|SignedOutPanel|ProtectedContent|to: "\/login"|location\.replace\("\/login"\)|location\.href = "\/login"|throw redirect\(|isAdmin|AdminGuard/;

async function guardedFile(path, depth = 0) {
  const text = await readFile(path, "utf8");
  if (GUARD.test(text)) return true;
  if (depth > 0) return false;
  for (const [, spec] of text.matchAll(/from "@\/([^"]+)"/g)) {
    for (const ext of [".tsx", ".ts", "/index.tsx"]) {
      const file = resolve(root, "src", spec + ext);
      if (existsSync(file) && (await guardedFile(file, depth + 1))) return true;
    }
  }
  return false;
}

const names = (await readdir(routesDir))
  .filter((f) => /\.tsx?$/.test(f) && !f.startsWith("["))
  .map((f) => f.replace(/\.tsx?$/, ""));
const known = new Set(names);
const guarded = new Map();
for (const name of names) {
  const file = resolve(
    routesDir,
    name + (existsSync(resolve(routesDir, name + ".tsx")) ? ".tsx" : ".ts"),
  );
  const text = await readFile(file, "utf8");
  // Server-only routes (API handlers, sitemap) render no page.
  if (!/createFileRoute/.test(text) || /server:\s*\{|createServerFileRoute/.test(text)) {
    guarded.set(name, "no page");
    continue;
  }
  // A bare layout (`return <Outlet />`) shows nothing itself; its child routes are checked one by one.
  if (/return <Outlet \/>;/.test(text) && !/<main|<section|<div/.test(text)) {
    guarded.set(name, "layout");
    continue;
  }
  guarded.set(name, (await guardedFile(file)) ? "guarded" : null);
}

const open = [];
for (const name of names) {
  if (guarded.get(name) || PUBLIC.has(name)) continue;
  // A child of a guarded layout (a parent route file that renders <Outlet/>) is covered by it.
  const parts = name.split(".");
  let covered = false;
  for (let i = parts.length - 1; i > 0 && !covered; i--) {
    const parent = parts.slice(0, i).join(".");
    if (!known.has(parent)) continue;
    const text = await readFile(resolve(routesDir, parent + ".tsx"), "utf8");
    if (/<Outlet/.test(text) && guarded.get(parent) === "guarded") covered = true;
  }
  if (!covered) open.push(name);
}

const stale = [...PUBLIC.keys()].filter((name) => !known.has(name));
if (stale.length) console.error("Public list names routes that no longer exist:", stale);
if (open.length) {
  console.error(
    "These pages open without an account. Wrap them in <RequireAuth> (or add them to PUBLIC with a reason):",
  );
  for (const name of open) console.error("  /" + name.replaceAll(".", "/"));
  process.exit(1);
}
if (stale.length) process.exit(1);
console.log(`All ${names.length} routes are public by choice or need an account.`);
