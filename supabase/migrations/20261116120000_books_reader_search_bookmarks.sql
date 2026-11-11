-- Library, the reader (page-pane plan, phase 3): search inside a book, and bookmarks.
--
--   book_pages.fts             the page's words for searching, made by the database from
--                              book_pages.text ('simple': no language rules, so Arabic and English
--                              both work; words match whole, upper/lower case aside)
--   books_search_pages(b, q)   up to 50 pages of book b whose words match q (as a web search box
--                              reads it), each with a short line around the match; the match is
--                              wrapped in ⟦ ⟧ for the reader to bold. It runs as the caller, so
--                              the pages' own rules apply: signed-in readers of published books,
--                              and admins.
--   book_bookmarks             the pages each reader marked (their own rows only; published books)
--
-- Adding the generated column rewrites book_pages once (seconds per thousand pages). Everything
-- here only adds, and the file can be run again safely. No Edge Function, no scheduled work.

alter table public.book_pages
  add column if not exists fts tsvector
  generated always as (to_tsvector('simple', coalesce(text, ''))) stored;

create index if not exists book_pages_fts on public.book_pages using gin (fts);

create or replace function public.books_search_pages(p_book uuid, p_query text)
returns table (page integer, snippet text)
language sql
stable
set search_path = public
as $$
  with q as (
    select websearch_to_tsquery('simple', left(coalesce(p_query, ''), 200)) as tsq
  )
  select p.page,
         ts_headline(
           'simple',
           p.text,
           q.tsq,
           'StartSel=⟦, StopSel=⟧, MaxWords=16, MinWords=6, MaxFragments=1, ShortWord=1'
         )
  from public.book_pages p, q
  where p.book_id = p_book
    and numnode(q.tsq) > 0
    and p.fts @@ q.tsq
  order by p.page
  limit 50
$$;

revoke all on function public.books_search_pages(uuid, text) from public, anon;
grant execute on function public.books_search_pages(uuid, text) to authenticated;

create table if not exists public.book_bookmarks (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  page integer not null check (page between 1 and 5000),
  created_at timestamptz not null default now(),
  primary key (user_id, book_id, page)
);

alter table public.book_bookmarks enable row level security;

drop policy if exists "readers read their bookmarks" on public.book_bookmarks;
create policy "readers read their bookmarks" on public.book_bookmarks
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "readers add bookmarks" on public.book_bookmarks;
create policy "readers add bookmarks" on public.book_bookmarks
  for insert to authenticated
  with check (user_id = auth.uid() and public.book_is_published(book_id));

drop policy if exists "readers remove their bookmarks" on public.book_bookmarks;
create policy "readers remove their bookmarks" on public.book_bookmarks
  for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.book_bookmarks from anon;
grant select, insert, delete on public.book_bookmarks to authenticated;
