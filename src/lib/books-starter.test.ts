// The starter library (20 well-known books): the data, the covers and the migration built from it.
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import test from "node:test";
import {
  BOOK_LEVELS,
  CATEGORY_COLOR_KEYS,
  CATEGORY_ICONS,
  isSiteCover,
  searchText,
} from "./books.ts";
import {
  buildStarterBooksSql,
  coverPathOf,
  DATA_FILE,
  MIGRATION_FILE,
} from "../../scripts/build-starter-books-sql.mjs";

const data = JSON.parse(readFileSync(DATA_FILE, "utf8"));
type Entry = (typeof data.books)[number];
const books: Entry[] = data.books;
const root = new URL("../../", import.meta.url);

test("twenty books in six categories, each with what the page needs", () => {
  assert.equal(books.length, 20);
  assert.equal(data.categories.length, 6);
  const keys = new Set<string>(data.categories.map((c: { key: string }) => c.key));
  assert.equal(new Set(books.map((b) => b.slug)).size, 20, "slugs are unique");
  assert.equal(new Set(books.map((b) => searchText(`${b.title} ${b.author}`))).size, 20);
  for (const b of books) {
    assert.ok(keys.has(b.category), `${b.slug}: a known category`);
    assert.ok(/^[a-z0-9-]+$/.test(b.slug), `${b.slug}: a plain slug`);
    assert.ok(b.title.length >= 1 && b.title.length <= 200, `${b.slug}: title length`);
    assert.ok(b.author.length >= 1 && b.author.length <= 160, `${b.slug}: author length`);
    assert.ok(b.alt_title.length >= 1 && b.alt_title.length <= 200, `${b.slug}: alt title`);
    assert.ok(BOOK_LEVELS.includes(b.level), `${b.slug}: a CEFR level`);
    assert.ok(
      b.description.length >= 120 && b.description.length <= 1200,
      `${b.slug}: description length ${b.description.length}`,
    );
    assert.ok(b.pages === null || (b.pages >= 1 && b.pages <= 5000), `${b.slug}: pages`);
    assert.ok(b.year === null || (b.year >= -3000 && b.year <= 2100), `${b.slug}: year`);
    assert.ok(["published", "draft"].includes(b.status), `${b.slug}: status`);
  }
  for (const c of data.categories) {
    assert.ok(CATEGORY_COLOR_KEYS.includes(c.color), `${c.key}: colour`);
    assert.ok(CATEGORY_ICONS.includes(c.icon), `${c.key}: icon`);
    assert.ok(c.name_ar.length <= 60 && c.name_en.length <= 60, `${c.key}: name length`);
    assert.ok(
      books.some((b) => b.category === c.key),
      `${c.key}: has books`,
    );
  }
});

test("the mix is balanced: no single kind is most of the shelf", () => {
  const count = (key: string) => books.filter((b) => b.category === key).length;
  const wisdom = count("wisdom");
  assert.ok(wisdom <= 6, `philosophy and strategy are at most 6 (are ${wisdom})`);
  assert.ok(wisdom / books.length <= 0.3, "and at most 30% of the twenty");
  for (const c of data.categories) assert.ok(count(c.key) <= 6, `${c.key} is not crowded`);
  const fiction = books.filter((b) => b.category !== "wisdom").length;
  assert.ok(fiction >= 14, "most of the books are stories");
});

test("only the book with no public-domain text is a draft", () => {
  const drafts = books.filter((b) => b.status === "draft").map((b) => b.slug);
  assert.deepEqual(drafts, ["the-book-of-five-rings"]);
  const rings = books.find((b) => b.slug === "the-book-of-five-rings")!;
  assert.equal(rings.pages, null, "its page count is unknown until a file is added");
});

test("every book has a real WebP cover the page can show", () => {
  for (const b of books) {
    const path = coverPathOf(b.slug);
    assert.ok(isSiteCover(path), `${b.slug}: ${path} is a site cover`);
    const file = new URL(`public${path}`, root);
    assert.ok(existsSync(file), `${b.slug}: ${path} exists`);
    const bytes = readFileSync(file);
    assert.equal(bytes.subarray(0, 4).toString(), "RIFF", `${b.slug}: a RIFF container`);
    assert.equal(bytes.subarray(8, 12).toString(), "WEBP", `${b.slug}: WebP`);
    assert.ok(statSync(file).size <= 200 * 1024, `${b.slug}: a light cover`);
  }
});

test("the migration is the one the data builds (run scripts/build-starter-books-sql.mjs)", () => {
  assert.equal(readFileSync(MIGRATION_FILE, "utf8"), buildStarterBooksSql(data));
});

test("the migration only adds: no deletes, no schema changes, no timers", () => {
  const sql = readFileSync(MIGRATION_FILE, "utf8").replace(/--.*$/gm, "");
  assert.doesNotMatch(sql, /\b(delete|drop|truncate|alter)\b/i);
  assert.doesNotMatch(sql, /\bcron\b|pg_sleep|http_post/i);
  assert.match(sql, /book_key\(x\.title\) = public\.book_key\(b->>'title'\)/);
});
