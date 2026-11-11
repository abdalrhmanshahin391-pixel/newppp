// Builds the starter-library migration from supabase/starter-books/books.json (the one place the
// 20 books are written: title, author, level, description, category). A test fails when the
// migration file drifts from this output: run `node scripts/build-starter-books-sql.mjs` after
// editing the data. Covers are files in public/book-covers, named <slug>.webp.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DATA_FILE = join(root, "supabase", "starter-books", "books.json");
export const MIGRATION_FILE = join(
  root,
  "supabase",
  "migrations",
  "20261117120000_books_starter_library.sql",
);

/** The address a cover has on the site (the page serves public/ from the root). */
export const coverPathOf = (slug) => `/book-covers/${slug}.webp`;

export function buildStarterBooksSql(data) {
  const cats = data.categories.map((c) => ({
    key: c.key,
    name_ar: c.name_ar,
    name_en: c.name_en,
    color: c.color,
    icon: c.icon,
  }));
  const books = data.books.map((b) => ({
    slug: b.slug,
    title: b.title,
    alt_title: b.alt_title,
    author: b.author,
    year: b.year,
    pages: b.pages,
    level: b.level,
    category: b.category,
    status: b.status,
    description: b.description,
    cover_path: coverPathOf(b.slug),
  }));
  const json = (value) => JSON.stringify(value, null, 2);
  for (const text of [json(cats), json(books)])
    if (text.includes("$json$")) throw new Error("the data must not contain $json$");

  return `-- Library: a starter shelf of 20 well-known books (a balanced mix: strategy and wisdom, classic
-- novels, mystery, gothic and horror, adventure and science fiction, fantasy).
--
-- Source of every text: Standard Ebooks (standardebooks.org), whose editions are in the public
-- domain; their covers are adapted from public-domain paintings. The covers are files of the site
-- itself (public/book-covers/<slug>.webp), so \`cover_path\` holds the address "/book-covers/<slug>.webp"
-- (the page serves an address that starts with "/" as it is, not from the covers bucket).
-- The descriptions are written for Uzyra.
--
-- The 19 books with a public-domain text are added published, and marked as rights-checked. Their
-- PDFs are not here: the admin adds each file from the book's page («ارفع ملف الكتاب»).
-- «The Book of Five Rings» is added as a DRAFT without the rights check: the English translations
-- in circulation are protected, so it stays hidden from readers until the admin uploads a file
-- they have the right to use and ticks the rights check.
--
-- Safe to run again: a book that is already there (same import key, or the same title and author)
-- is left as it is, and a category is reused when its Arabic or English name exists. Needs the
-- library updates (status, import key) from before. Nothing runs on a timer.

do $starter$
declare
  v_cats  jsonb := $json$${json(cats)}$json$::jsonb;
  v_books jsonb := $json$${json(books)}$json$::jsonb;
  c       jsonb;
  b       jsonb;
  v_ids   jsonb := '{}'::jsonb;
  v_id    uuid;
  v_sort  integer;
  v_key   text;
  v_added integer := 0;
  v_kept  integer := 0;
  v_pos   jsonb := '{}'::jsonb;
  v_n     integer;
begin
  if to_regprocedure('public.book_key(text)') is null
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'books' and column_name = 'import_key'
     ) then
    raise exception 'starter_library_needs_library_updates'
      using hint = 'Apply the library database updates (status, import key) first.';
  end if;

  for c in select * from jsonb_array_elements(v_cats) loop
    select id into v_id from public.book_categories
      where public.book_key(name_en) = public.book_key(c->>'name_en')
         or public.book_key(name_ar) = public.book_key(c->>'name_ar')
      order by created_at
      limit 1;
    if v_id is null then
      select coalesce(max(sort), -1) + 1 into v_sort from public.book_categories;
      insert into public.book_categories (name_ar, name_en, color, icon, sort)
      values (c->>'name_ar', c->>'name_en', c->>'color', c->>'icon', v_sort)
      returning id into v_id;
    end if;
    v_ids := v_ids || jsonb_build_object(c->>'key', v_id);
  end loop;

  for b in select * from jsonb_array_elements(v_books) loop
    v_key := public.book_key(b->>'title') || '|' || public.book_key(b->>'author');
    v_n := coalesce((v_pos->>(b->>'category'))::integer, 0);
    v_pos := v_pos || jsonb_build_object(b->>'category', v_n + 1);
    if exists (
      select 1 from public.books x
      where x.import_key = v_key
         or (public.book_key(x.title) = public.book_key(b->>'title')
             and public.book_key(x.author) = public.book_key(b->>'author'))
    ) then
      v_kept := v_kept + 1;
      continue;
    end if;
    insert into public.books (
      title, alt_title, author, description, category_id, level, language, pages, year,
      cover_path, status, rights_checked, import_key, sort
    ) values (
      b->>'title',
      b->>'alt_title',
      b->>'author',
      b->>'description',
      (v_ids->>(b->>'category'))::uuid,
      b->>'level',
      'en',
      (b->>'pages')::integer,
      (b->>'year')::integer,
      b->>'cover_path',
      b->>'status',
      b->>'status' = 'published',
      v_key,
      v_n
    );
    v_added := v_added + 1;
  end loop;

  raise notice 'starter library: % books added, % already there', v_added, v_kept;
end
$starter$;
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const data = JSON.parse(readFileSync(DATA_FILE, "utf8"));
  writeFileSync(MIGRATION_FILE, buildStarterBooksSql(data));
  console.log(`Wrote ${MIGRATION_FILE}`);
}
