-- Library, phase 1 (administration and data foundation). Additive only: it builds on
-- 20261108120000_books_library.sql, keeps every row, and can be run again.
--
--   * books: a status (draft / published / archived) kept in step with the old `published` flag,
--     an alternate title, an ISBN (one book per ISBN), a rights check, an import key, and the
--     period of the book of the week.
--   * A book is published only when it is ready (title, primary category, rights checked); a
--     missing ISBN or year never blocks it.
--   * Tags and optional secondary categories; names are unique whatever their case.
--   * A category with books cannot be deleted: books_delete_category moves them first.
--   * Manual shelves with an order and a display period (judged by the server's clock).
--   * One atomic call changes the book of the week; the unique index from the first migration
--     still guarantees there is never two.
--   * Bulk actions in one call; a file-cleanup list for replaced files that could not be removed
--     (retried by the admin, no scheduler); and a CSV import with a dry run that writes nothing
--     and an operation id that makes a retried import a no-op.
-- Every function runs with the caller's rights (security invoker) and checks the admin role.
-- Nothing runs on a timer.

-- ---------------------------------------------------------------------------------------------
-- Helpers

-- A loose key for "is this the same book": lower case, no Arabic diacritics or tatweel, no
-- Latin accents (Brontë = Bronte), no punctuation, single spaces. (The taa marbuta is kept.)
create or replace function public.book_key(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select btrim(regexp_replace(
    translate(
      lower(regexp_replace(coalesce(p, ''), '[ً-ٰٟـ]', '', 'g')),
      'àáâãäåāèéêëēìíîïīòóôõöøōùúûüūýÿñçćčšžł',
      'aaaaaaaeeeeeiiiiiooooooouuuuuyyncccszl'),
    '[\s[:punct:]«»،؛؟–—]+', ' ', 'g'))
$$;

-- An ISBN with only its digits (and a final X), or null when it is empty.
create or replace function public.book_isbn(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(regexp_replace(upper(coalesce(p, '')), '[^0-9X]', '', 'g'), '')
$$;

-- ---------------------------------------------------------------------------------------------
-- Books: new columns

alter table public.books add column if not exists status text not null default 'draft';
alter table public.books add column if not exists alt_title text not null default '';
alter table public.books add column if not exists isbn text;
alter table public.books add column if not exists rights_checked boolean not null default false;
alter table public.books add column if not exists import_key text;
alter table public.books add column if not exists featured_from timestamptz;
alter table public.books add column if not exists featured_until timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'books_status_check') then
    alter table public.books
      add constraint books_status_check check (status in ('draft', 'published', 'archived'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'books_alt_title_length') then
    alter table public.books
      add constraint books_alt_title_length check (char_length(alt_title) <= 200);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'books_isbn_shape') then
    alter table public.books
      add constraint books_isbn_shape check (isbn is null or isbn ~ '^([0-9]{9}[0-9X]|97[89][0-9]{10})$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'books_featured_period') then
    alter table public.books
      add constraint books_featured_period
      check (featured_until is null or featured_from is null or featured_until > featured_from);
  end if;
end $$;

-- Rows from before: published books become "published" and count as reviewed (they were already
-- public); everything else stays a draft.
update public.books set status = 'published' where published and status = 'draft';
update public.books set rights_checked = true where status = 'published' and not rights_checked;

create unique index if not exists books_isbn_unique on public.books (isbn) where isbn is not null;
create index if not exists books_import_key on public.books (import_key) where import_key is not null;
create index if not exists books_status on public.books (status, created_at desc);

-- What stops a book from being published (empty when it is ready).
create or replace function public.book_publish_issues(b public.books)
returns text[]
language sql
stable
set search_path = public
as $$
  select array_remove(array[
    case when btrim(coalesce(b.title, '')) = '' then 'title' end,
    case when b.category_id is null then 'category' end,
    case when not coalesce(b.rights_checked, false) then 'rights' end
  ], null)
$$;

-- Keeps status and the old `published` flag in step (older pages still send `published`),
-- refuses to publish a book that is not ready, and takes the book-of-the-week mark off a book
-- that is no longer published.
create or replace function public.books_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  issues text[];
begin
  if tg_op = 'INSERT' then
    if new.published and new.status = 'draft' then
      new.status := 'published';
    end if;
  elsif new.status is not distinct from old.status and new.published is distinct from old.published then
    new.status := case
      when new.published then 'published'
      when old.status = 'archived' then 'archived'
      else 'draft'
    end;
  end if;
  new.published := new.status = 'published';
  new.isbn := public.book_isbn(new.isbn);

  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    issues := public.book_publish_issues(new);
    if cardinality(issues) > 0 then
      raise exception 'book_not_ready:%', array_to_string(issues, ',')
        using errcode = 'P0001', hint = 'A book needs a title, a primary category and a rights check.';
    end if;
  end if;

  if new.status <> 'published' then
    new.featured := false;
    new.featured_from := null;
    new.featured_until := null;
  end if;
  return new;
end;
$$;

drop trigger if exists books_before_write on public.books;
create trigger books_before_write before insert or update on public.books
  for each row execute function public.books_before_write();

-- Readers see published books only (admins see all). Replaces the policy of the first migration.
drop policy if exists "published books are readable" on public.books;
create policy "published books are readable" on public.books
  for select to anon, authenticated
  using (status = 'published' or public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "readers open published book files" on storage.objects;
create policy "readers open published book files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'book-files'
    and exists (
      select 1 from public.books b
      where b.file_path = storage.objects.name and b.status = 'published'
    )
  );

-- ---------------------------------------------------------------------------------------------
-- Categories: unique names, and no deletion while books use them

do $$
begin
  if not exists (
    select 1 from public.book_categories group by public.book_key(name_ar) having count(*) > 1
  ) then
    create unique index if not exists book_categories_name_ar_unique
      on public.book_categories (public.book_key(name_ar));
  else
    raise notice 'book_categories has duplicate Arabic names: unique index not created yet';
  end if;
  if not exists (
    select 1 from public.book_categories group by public.book_key(name_en) having count(*) > 1
  ) then
    create unique index if not exists book_categories_name_en_unique
      on public.book_categories (public.book_key(name_en));
  else
    raise notice 'book_categories has duplicate English names: unique index not created yet';
  end if;
end $$;

alter table public.books drop constraint if exists books_category_id_fkey;
alter table public.books
  add constraint books_category_id_fkey
  foreign key (category_id) references public.book_categories (id) on delete restrict;

-- ---------------------------------------------------------------------------------------------
-- Tags and secondary categories

create table if not exists public.book_tags (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null check (char_length(btrim(name_ar)) between 1 and 40),
  name_en text not null check (char_length(btrim(name_en)) between 1 and 40),
  created_at timestamptz not null default now()
);
create unique index if not exists book_tags_name_ar_unique on public.book_tags (public.book_key(name_ar));
create unique index if not exists book_tags_name_en_unique on public.book_tags (public.book_key(name_en));

create table if not exists public.book_tag_links (
  book_id uuid not null references public.books (id) on delete cascade,
  tag_id uuid not null references public.book_tags (id) on delete cascade,
  primary key (book_id, tag_id)
);
create index if not exists book_tag_links_tag on public.book_tag_links (tag_id);

create table if not exists public.book_secondary_categories (
  book_id uuid not null references public.books (id) on delete cascade,
  category_id uuid not null references public.book_categories (id) on delete cascade,
  primary key (book_id, category_id)
);
create index if not exists book_secondary_categories_category
  on public.book_secondary_categories (category_id);

-- ---------------------------------------------------------------------------------------------
-- Manual shelves

create table if not exists public.book_shelves (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null check (char_length(btrim(name_ar)) between 1 and 60),
  name_en text not null check (char_length(btrim(name_en)) between 1 and 60),
  visible boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  constraint book_shelves_period check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.book_shelf_items (
  shelf_id uuid not null references public.book_shelves (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  position integer not null default 0,
  primary key (shelf_id, book_id)
);
create index if not exists book_shelf_items_order on public.book_shelf_items (shelf_id, position);

-- ---------------------------------------------------------------------------------------------
-- Imports and the file-cleanup list (admins only)

create table if not exists public.book_imports (
  id uuid primary key,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  file_name text not null default '' check (char_length(file_name) <= 200),
  on_duplicate text not null default 'skip' check (on_duplicate in ('skip', 'update', 'create')),
  result jsonb
);

create table if not exists public.book_file_trash (
  id uuid primary key default gen_random_uuid(),
  bucket text not null check (bucket in ('book-covers', 'book-files')),
  path text not null check (char_length(path) between 1 and 300),
  reason text not null default '' check (char_length(reason) <= 300),
  created_at timestamptz not null default now(),
  unique (bucket, path)
);

-- ---------------------------------------------------------------------------------------------
-- Row-level security for the new tables

alter table public.book_tags enable row level security;
alter table public.book_tag_links enable row level security;
alter table public.book_secondary_categories enable row level security;
alter table public.book_shelves enable row level security;
alter table public.book_shelf_items enable row level security;
alter table public.book_imports enable row level security;
alter table public.book_file_trash enable row level security;

drop policy if exists "book tags are readable" on public.book_tags;
create policy "book tags are readable" on public.book_tags
  for select to anon, authenticated using (true);
drop policy if exists "book tag links are readable" on public.book_tag_links;
create policy "book tag links are readable" on public.book_tag_links
  for select to anon, authenticated using (true);
drop policy if exists "secondary categories are readable" on public.book_secondary_categories;
create policy "secondary categories are readable" on public.book_secondary_categories
  for select to anon, authenticated using (true);
drop policy if exists "visible shelves are readable" on public.book_shelves;
create policy "visible shelves are readable" on public.book_shelves
  for select to anon, authenticated
  using (visible or public.has_role(auth.uid(), 'admin'::public.app_role));
drop policy if exists "shelf items are readable" on public.book_shelf_items;
create policy "shelf items are readable" on public.book_shelf_items
  for select to anon, authenticated using (true);

do $$
declare
  t text;
begin
  foreach t in array array[
    'book_tags', 'book_tag_links', 'book_secondary_categories', 'book_shelves',
    'book_shelf_items', 'book_imports', 'book_file_trash'
  ] loop
    execute format('drop policy if exists "admins manage %1$s" on public.%1$I', t);
    execute format(
      'create policy "admins manage %1$s" on public.%1$I for all to authenticated '
      'using (public.has_role(auth.uid(), ''admin''::public.app_role)) '
      'with check (public.has_role(auth.uid(), ''admin''::public.app_role))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------
-- What is on show right now, by the server's clock

create or replace view public.book_shelves_now
with (security_invoker = true) as
  select s.*
  from public.book_shelves s
  where s.visible
    and (s.starts_at is null or s.starts_at <= now())
    and (s.ends_at is null or s.ends_at > now());

create or replace view public.book_featured_now
with (security_invoker = true) as
  select b.id
  from public.books b
  where b.featured
    and b.status = 'published'
    and (b.featured_from is null or b.featured_from <= now())
    and (b.featured_until is null or b.featured_until > now());

grant select on public.book_shelves_now, public.book_featured_now to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Admin calls

create or replace function public.books_require_admin()
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'admin only' using errcode = '42501';
  end if;
end;
$$;

-- The book of the week, in one step: the mark leaves the old book and reaches the new one in the
-- same transaction (null clears it). Concurrent calls queue on one lock.
create or replace function public.books_set_featured(
  p_book uuid,
  p_from timestamptz default null,
  p_until timestamptz default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.books_require_admin();
  if p_until is not null and p_from is not null and p_until <= p_from then
    raise exception 'featured_period' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('public.books.featured'));
  update public.books
    set featured = false, featured_from = null, featured_until = null
    where featured and (p_book is null or id <> p_book);
  if p_book is not null then
    update public.books
      set featured = true, featured_from = p_from, featured_until = p_until
      where id = p_book and status = 'published';
    if not found then
      raise exception 'featured_not_published' using errcode = 'P0001';
    end if;
  end if;
end;
$$;

-- Deletes a category; its books (and secondary links) move to p_move_to first. Without a target
-- a category that still has books is refused.
create or replace function public.books_delete_category(p_category uuid, p_move_to uuid default null)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  moved integer := 0;
begin
  perform public.books_require_admin();
  if p_move_to = p_category then
    raise exception 'move_to_same' using errcode = '22023';
  end if;
  if exists (select 1 from public.books where category_id = p_category) then
    if p_move_to is null then
      raise exception 'category_has_books' using errcode = 'P0001';
    end if;
    update public.books set category_id = p_move_to where category_id = p_category;
    get diagnostics moved = row_count;
  end if;
  if p_move_to is not null then
    insert into public.book_secondary_categories (book_id, category_id)
      select book_id, p_move_to from public.book_secondary_categories where category_id = p_category
      on conflict do nothing;
    delete from public.book_secondary_categories
      where category_id = p_move_to
        and book_id in (select id from public.books where category_id = p_move_to);
  end if;
  delete from public.book_categories where id = p_category;
  if not found then
    raise exception 'category_not_found' using errcode = 'P0002';
  end if;
  return moved;
end;
$$;

-- One action on many books in one transaction. A book that cannot be published is skipped and
-- named in the result; anything else wrong stops the whole call.
create or replace function public.books_bulk_update(
  p_ids uuid[],
  p_action text,
  p_category uuid default null,
  p_tag uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_count integer;
  v_done integer := 0;
  v_skipped jsonb := '[]'::jsonb;
begin
  perform public.books_require_admin();
  if coalesce(cardinality(p_ids), 0) = 0 then
    return jsonb_build_object('updated', 0, 'skipped', v_skipped);
  end if;
  if cardinality(p_ids) > 500 then
    raise exception 'too_many_books' using errcode = '22023';
  end if;
  if p_action not in ('publish', 'draft', 'archive', 'set_category', 'add_tag', 'remove_tag') then
    raise exception 'unknown_action' using errcode = '22023';
  end if;
  if p_action = 'set_category' and p_category is null then
    raise exception 'category_required' using errcode = '22023';
  end if;
  if p_action in ('add_tag', 'remove_tag') and p_tag is null then
    raise exception 'tag_required' using errcode = '22023';
  end if;

  foreach v_id in array p_ids loop
    begin
      v_count := 0;
      if p_action = 'publish' then
        update public.books set status = 'published' where id = v_id and status <> 'published';
        get diagnostics v_count = row_count;
      elsif p_action = 'draft' then
        update public.books set status = 'draft' where id = v_id and status <> 'draft';
        get diagnostics v_count = row_count;
      elsif p_action = 'archive' then
        update public.books set status = 'archived' where id = v_id and status <> 'archived';
        get diagnostics v_count = row_count;
      elsif p_action = 'set_category' then
        update public.books set category_id = p_category where id = v_id;
        get diagnostics v_count = row_count;
        delete from public.book_secondary_categories where book_id = v_id and category_id = p_category;
      elsif p_action = 'add_tag' then
        insert into public.book_tag_links (book_id, tag_id) values (v_id, p_tag) on conflict do nothing;
        get diagnostics v_count = row_count;
      else
        delete from public.book_tag_links where book_id = v_id and tag_id = p_tag;
        get diagnostics v_count = row_count;
      end if;
      v_done := v_done + v_count;
    exception when sqlstate 'P0001' then
      v_skipped := v_skipped || jsonb_build_object('id', v_id, 'reason', sqlerrm);
    end;
  end loop;
  return jsonb_build_object('updated', v_done, 'skipped', v_skipped);
end;
$$;

-- CSV import (metadata only). p_rows is a JSON array of objects with: title, alt_title, author,
-- isbn, year, pages, level, language, category (Arabic or English name), tags (a list, or text
-- split by , ; ،), description. A row matches an existing book by ISBN, or by title + author.
-- p_on_duplicate decides what happens to a match: skip, update, or create anyway (never with a
-- taken ISBN). New books are drafts. A dry run reads only. A real run is recorded under
-- p_operation: calling again with the same id returns the first result and writes nothing.
create or replace function public.books_import(
  p_operation uuid,
  p_rows jsonb,
  p_on_duplicate text default 'skip',
  p_dry_run boolean default true,
  p_file_name text default ''
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  r jsonb;
  i integer := 0;
  v_rows jsonb := '[]'::jsonb;
  v_errors text[];
  v_warnings text[];
  v_title text;
  v_alt text;
  v_author text;
  v_isbn_raw text;
  v_isbn text;
  v_year_raw text;
  v_year integer;
  v_pages_raw text;
  v_pages integer;
  v_level text;
  v_lang text;
  v_level_given boolean;
  v_lang_given boolean;
  v_desc text;
  v_cat_name text;
  v_cat uuid;
  v_tags text[];
  v_tag text;
  v_tag_id uuid;
  v_key text;
  v_existing uuid;
  v_action text;
  v_book uuid;
  v_seen_keys text[] := '{}';
  v_seen_isbns text[] := '{}';
  n_create integer := 0;
  n_update integer := 0;
  n_skip integer := 0;
  n_error integer := 0;
  v_result jsonb;
  v_previous jsonb;
begin
  perform public.books_require_admin();
  if p_operation is null then
    raise exception 'operation_required' using errcode = '22023';
  end if;
  if p_on_duplicate not in ('skip', 'update', 'create') then
    raise exception 'unknown_on_duplicate' using errcode = '22023';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'rows_must_be_an_array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 2000 then
    raise exception 'too_many_rows' using errcode = '22023';
  end if;

  if not p_dry_run then
    insert into public.book_imports (id, file_name, on_duplicate)
      values (p_operation, left(coalesce(p_file_name, ''), 200), p_on_duplicate)
      on conflict (id) do nothing;
    if not found then
      select result into v_previous from public.book_imports where id = p_operation;
      if v_previous is null then
        raise exception 'import_in_progress' using errcode = '55P03';
      end if;
      return v_previous || jsonb_build_object('replayed', true);
    end if;
  end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    i := i + 1;
    v_errors := '{}';
    v_warnings := '{}';
    v_book := null;
    v_existing := null;
    v_cat := null;

    if jsonb_typeof(r) is distinct from 'object' then
      v_rows := v_rows || jsonb_build_object('row', i, 'action', 'error', 'errors', jsonb_build_array('row_not_object'));
      n_error := n_error + 1;
      continue;
    end if;

    v_title := btrim(coalesce(r->>'title', ''));
    v_alt := btrim(coalesce(r->>'alt_title', ''));
    v_author := btrim(coalesce(r->>'author', ''));
    v_desc := btrim(coalesce(r->>'description', ''));
    v_isbn_raw := btrim(coalesce(r->>'isbn', ''));
    v_year_raw := btrim(coalesce(r->>'year', ''));
    v_pages_raw := btrim(coalesce(r->>'pages', ''));
    v_level_given := btrim(coalesce(r->>'level', '')) <> '';
    v_lang_given := btrim(coalesce(r->>'language', '')) <> '';
    v_level := case when v_level_given then upper(btrim(r->>'level')) else 'B1' end;
    v_lang := case when v_lang_given then lower(btrim(r->>'language')) else 'en' end;
    v_cat_name := btrim(coalesce(r->>'category', ''));

    if v_title = '' then v_errors := v_errors || 'title_missing'::text; end if;
    if char_length(v_title) > 200 then v_errors := v_errors || 'title_too_long'::text; end if;
    if char_length(v_alt) > 200 then v_errors := v_errors || 'alt_title_too_long'::text; end if;
    if char_length(v_author) > 160 then v_errors := v_errors || 'author_too_long'::text; end if;
    if char_length(v_desc) > 1200 then v_errors := v_errors || 'description_too_long'::text; end if;
    if v_level not in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2') then v_errors := v_errors || 'level_invalid'::text; end if;
    if v_lang !~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$' then v_errors := v_errors || 'language_invalid'::text; end if;

    v_year := null;
    if v_year_raw <> '' then
      if v_year_raw ~ '^-?[0-9]{1,4}$' and v_year_raw::integer between -3000 and 2100 then
        v_year := v_year_raw::integer;
      else
        v_errors := v_errors || 'year_invalid'::text;
      end if;
    end if;
    v_pages := null;
    if v_pages_raw <> '' then
      if v_pages_raw ~ '^[0-9]{1,4}$' and v_pages_raw::integer between 1 and 5000 then
        v_pages := v_pages_raw::integer;
      else
        v_errors := v_errors || 'pages_invalid'::text;
      end if;
    end if;
    v_isbn := public.book_isbn(v_isbn_raw);
    if v_isbn is not null and v_isbn !~ '^([0-9]{9}[0-9X]|97[89][0-9]{10})$' then
      v_errors := v_errors || 'isbn_invalid'::text;
      v_isbn := null;
    end if;

    if v_cat_name <> '' then
      select id into v_cat from public.book_categories
        where public.book_key(name_ar) = public.book_key(v_cat_name)
           or public.book_key(name_en) = public.book_key(v_cat_name)
        limit 1;
      if v_cat is null then v_errors := v_errors || 'category_unknown'::text; end if;
    else
      v_warnings := v_warnings || 'no_category'::text;
    end if;

    if jsonb_typeof(r->'tags') = 'array' then
      select coalesce(array_agg(btrim(x)), '{}') into v_tags
        from jsonb_array_elements_text(r->'tags') as x where btrim(x) <> '';
    else
      select coalesce(array_agg(btrim(x)), '{}') into v_tags
        from regexp_split_to_table(coalesce(r->>'tags', ''), '[,;،]') as x where btrim(x) <> '';
    end if;
    foreach v_tag in array v_tags loop
      if char_length(v_tag) > 40 then
        v_errors := v_errors || 'tag_too_long'::text;
      elsif not exists (
        select 1 from public.book_tags
        where public.book_key(name_ar) = public.book_key(v_tag) or public.book_key(name_en) = public.book_key(v_tag)
      ) then
        v_warnings := v_warnings || ('new_tag:' || v_tag);
      end if;
    end loop;

    v_key := public.book_key(v_title) || '|' || public.book_key(v_author);
    if v_title <> '' and (v_key = any (v_seen_keys) or (v_isbn is not null and v_isbn = any (v_seen_isbns))) then
      v_errors := v_errors || 'duplicate_in_file'::text;
    end if;

    if cardinality(v_errors) = 0 then
      select id into v_existing from public.books
        where (v_isbn is not null and isbn = v_isbn) or import_key = v_key
           or (public.book_key(title) = public.book_key(v_title) and public.book_key(author) = public.book_key(v_author))
        order by (v_isbn is not null and isbn = v_isbn) desc, created_at
        limit 1;
      if v_existing is null then
        v_action := 'create';
      else
        v_action := p_on_duplicate;
        if v_action = 'create' and v_isbn is not null and exists (select 1 from public.books where isbn = v_isbn) then
          v_errors := v_errors || 'isbn_taken'::text;
        end if;
      end if;
    end if;
    if cardinality(v_errors) > 0 then
      v_action := 'error';
    end if;

    if not p_dry_run and v_action in ('create', 'update') then
      if v_action = 'create' then
        insert into public.books (
          title, alt_title, author, isbn, year, pages, level, language, description,
          category_id, status, import_key
        ) values (
          v_title, v_alt, v_author, v_isbn, v_year, v_pages, v_level, v_lang, v_desc,
          v_cat, 'draft', v_key
        ) returning id into v_book;
      else
        update public.books set
          title = v_title,
          alt_title = case when v_alt <> '' then v_alt else alt_title end,
          author = case when v_author <> '' then v_author else author end,
          isbn = coalesce(v_isbn, isbn),
          year = coalesce(v_year, year),
          pages = coalesce(v_pages, pages),
          level = case when v_level_given then v_level else level end,
          language = case when v_lang_given then v_lang else language end,
          description = case when v_desc <> '' then v_desc else description end,
          category_id = coalesce(v_cat, category_id),
          import_key = coalesce(import_key, v_key)
        where id = v_existing;
        v_book := v_existing;
      end if;
      foreach v_tag in array v_tags loop
        insert into public.book_tags (name_ar, name_en) values (v_tag, v_tag) on conflict do nothing;
        select id into v_tag_id from public.book_tags
          where public.book_key(name_ar) = public.book_key(v_tag) or public.book_key(name_en) = public.book_key(v_tag)
          limit 1;
        insert into public.book_tag_links (book_id, tag_id) values (v_book, v_tag_id) on conflict do nothing;
      end loop;
    end if;

    if v_action = 'create' then n_create := n_create + 1;
    elsif v_action = 'update' then n_update := n_update + 1;
    elsif v_action = 'skip' then n_skip := n_skip + 1;
    else n_error := n_error + 1;
    end if;
    if v_title <> '' then
      v_seen_keys := v_seen_keys || v_key;
      if v_isbn is not null then v_seen_isbns := v_seen_isbns || v_isbn; end if;
    end if;

    v_rows := v_rows || jsonb_build_object(
      'row', i,
      'action', v_action,
      'title', v_title,
      'existing_id', v_existing,
      'book_id', v_book,
      'errors', to_jsonb(v_errors),
      'warnings', to_jsonb(v_warnings)
    );
  end loop;

  v_result := jsonb_build_object(
    'dry_run', p_dry_run,
    'total', i,
    'create', n_create,
    'update', n_update,
    'skip', n_skip,
    'errors', n_error,
    'rows', v_rows
  );
  if not p_dry_run then
    update public.book_imports set result = v_result where id = p_operation;
  end if;
  return v_result;
end;
$$;

revoke all on function public.books_set_featured(uuid, timestamptz, timestamptz) from public, anon;
revoke all on function public.books_delete_category(uuid, uuid) from public, anon;
revoke all on function public.books_bulk_update(uuid[], text, uuid, uuid) from public, anon;
revoke all on function public.books_import(uuid, jsonb, text, boolean, text) from public, anon;
revoke all on function public.books_require_admin() from public, anon;
grant execute on function public.books_set_featured(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.books_delete_category(uuid, uuid) to authenticated;
grant execute on function public.books_bulk_update(uuid[], text, uuid, uuid) to authenticated;
grant execute on function public.books_import(uuid, jsonb, text, boolean, text) to authenticated;
grant execute on function public.books_require_admin() to authenticated;
