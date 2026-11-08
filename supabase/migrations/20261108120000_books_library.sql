-- The library (/books): books an admin adds, grouped into categories the admin manages.
--   book_categories: a shelf (Romance, Science, ...) with its colour and icon from fixed sets.
--   books: a book's details, its cover picture (public bucket "book-covers") and its PDF (private
--   bucket "book-files", opened with a short signed link).
-- Everyone may read the categories and the published books (the page works for visitors too);
-- only admins write. Nothing here runs on a timer.

create table if not exists public.book_categories (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null check (char_length(btrim(name_ar)) between 1 and 60),
  name_en text not null check (char_length(btrim(name_en)) between 1 and 60),
  color text not null default 'slate'
    check (color in ('rose', 'teal', 'amber', 'violet', 'slate', 'indigo', 'green', 'sky')),
  icon text not null default 'book'
    check (icon in ('book', 'heart', 'flask', 'mountain', 'search', 'rocket', 'landmark', 'brain', 'globe', 'feather')),
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  author text not null default '' check (char_length(author) <= 160),
  description text not null default '' check (char_length(description) <= 1200),
  category_id uuid references public.book_categories (id) on delete set null,
  level text not null default 'B1' check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  language text not null default 'en' check (language ~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$'),
  pages integer check (pages is null or pages between 1 and 5000),
  year integer check (year is null or year between -3000 and 2100),
  cover_path text check (cover_path is null or char_length(cover_path) <= 300),
  file_path text check (file_path is null or char_length(file_path) <= 300),
  featured boolean not null default false,
  published boolean not null default false,
  sort integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists books_category on public.books (category_id, sort);
create index if not exists books_published on public.books (published, created_at desc);
-- One "book of the week" at most.
create unique index if not exists books_one_featured on public.books ((true)) where featured;

drop trigger if exists books_updated_at on public.books;
create trigger books_updated_at before update on public.books
  for each row execute function public.set_updated_at();

alter table public.book_categories enable row level security;
alter table public.books enable row level security;

drop policy if exists "book categories are readable" on public.book_categories;
create policy "book categories are readable" on public.book_categories
  for select to anon, authenticated using (true);
drop policy if exists "admins manage book categories" on public.book_categories;
create policy "admins manage book categories" on public.book_categories
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "published books are readable" on public.books;
create policy "published books are readable" on public.books
  for select to anon, authenticated
  using (published or public.has_role(auth.uid(), 'admin'::public.app_role));
drop policy if exists "admins manage books" on public.books;
create policy "admins manage books" on public.books
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Covers: public pictures (5 MB, JPEG / PNG / WebP). Files: private PDFs (50 MB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-covers', 'book-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-files', 'book-files', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists "admins manage book covers and files" on storage.objects;
create policy "admins manage book covers and files" on storage.objects
  for all to authenticated
  using (bucket_id in ('book-covers', 'book-files') and public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (bucket_id in ('book-covers', 'book-files') and public.has_role(auth.uid(), 'admin'::public.app_role));

-- A signed-in reader may open the PDF of a published book (the signed link is made with their
-- own session, so this is checked against the book row).
drop policy if exists "readers open published book files" on storage.objects;
create policy "readers open published book files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'book-files'
    and exists (select 1 from public.books b where b.file_path = storage.objects.name and b.published)
  );
