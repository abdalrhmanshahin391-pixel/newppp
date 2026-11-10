-- Library, the reader (page-pane plan, phase 2): more sizes of each page picture, an instant
-- blurred placeholder, and one small "manifest" per book, all made once when the admin prepares
-- the book.
--
--   book_pages.thumb_path / mid_path / zoom_path   160 / 900 / 2200 px pictures beside the
--                                                  existing 1400 px one (image_path)
--   book_pages.thumbhash                           a ~25-byte blurred preview (base64)
--   book_pages.color                               the page's main colour (#rrggbb)
--   book_manifests                                 one row per book: every page's size, sizes
--                                                  available and preview, the outline (chapters)
--                                                  and the reading direction, read in one request
--
-- The manifest lives in its own table, not on `books`: book cards are built from the whole books
-- row (to_jsonb), and a manifest can be 200 KB. Same readers as the pages: signed-in readers of
-- published books, and admins. Replacing a book's PDF removes its manifest with its pages.
-- Everything here only adds, and the file can be run again safely.

alter table public.book_pages add column if not exists thumb_path text;
alter table public.book_pages add column if not exists mid_path text;
alter table public.book_pages add column if not exists zoom_path text;
alter table public.book_pages add column if not exists thumbhash text;
alter table public.book_pages add column if not exists color text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'book_pages_tier_paths') then
    alter table public.book_pages add constraint book_pages_tier_paths check (
      (thumb_path is null or char_length(thumb_path) between 3 and 300)
      and (mid_path is null or char_length(mid_path) between 3 and 300)
      and (zoom_path is null or char_length(zoom_path) between 3 and 300)
      and (thumbhash is null or thumbhash ~ '^[A-Za-z0-9+/=]{4,64}$')
      and (color is null or color ~ '^#[0-9a-f]{6}$')
    );
  end if;
end;
$$;

create table if not exists public.book_manifests (
  book_id uuid primary key references public.books (id) on delete cascade,
  -- [[width, height, flags, ext, thumbhash, color], …] for pages 1..n (flags: 1 words,
  -- 2 thumb, 4 phone size, 8 zoom size; ext "w" WebP or "j" JPEG).
  pages jsonb not null check (jsonb_typeof(pages) = 'array'),
  -- [[title, page, level], …] from the PDF's own outline, or [].
  outline jsonb not null default '[]'::jsonb check (jsonb_typeof(outline) = 'array'),
  dir text not null default 'ltr' check (dir in ('ltr', 'rtl')),
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.book_manifests enable row level security;

drop policy if exists "readers read manifests of published books" on public.book_manifests;
create policy "readers read manifests of published books" on public.book_manifests
  for select to authenticated
  using (public.book_is_published(book_id) or public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "admins manage book manifests" on public.book_manifests;
create policy "admins manage book manifests" on public.book_manifests
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

revoke all on public.book_manifests from anon;
grant select, insert, update, delete on public.book_manifests to authenticated;

-- A new PDF means new pages: the old pages and manifest go, and the book waits to be prepared.
create or replace function public.books_reader_reset()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.file_path is distinct from old.file_path then
    delete from public.book_pages where book_id = new.id;
    delete from public.book_manifests where book_id = new.id;
    new.prepared_at := null;
    new.page_count := null;
  end if;
  return new;
end;
$$;
