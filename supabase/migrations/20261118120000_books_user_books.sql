-- Library: "Your books". A signed-in reader may keep up to two PDFs of their own to read in the
-- library; nobody else can see them, and they never appear in the public library, its search or
-- its numbers (they live in their own table, not in public.books).
--
-- Storage is protected from abuse in the database itself:
--   - two books per person at most: each book takes slot 1 or 2, unique per person, so a third
--     book is refused even when two requests arrive together;
--   - one file per book, at the one path that belongs to it (<user>/<book>/book.pdf), PDF only,
--     50 MB at most (the bucket's own limit), so one person stores 100 MB at most;
--   - no more than 10 books added per person in 24 hours (adding and deleting again and again).
-- Covers are not stored: the site draws them from page 1 in the browser. Safe to run twice.

create table if not exists public.user_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slot smallint not null check (slot in (1, 2)),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  page_count integer check (page_count is null or page_count between 1 and 5000),
  size_bytes bigint not null check (size_bytes between 1 and 52428800),
  file_path text not null,
  status text not null default 'uploading' check (status in ('uploading', 'ready')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_books_one_per_slot unique (user_id, slot),
  constraint user_books_own_path check (file_path = user_id::text || '/' || id::text || '/book.pdf')
);
create index if not exists user_books_user on public.user_books (user_id);

drop trigger if exists user_books_updated_at on public.user_books;
create trigger user_books_updated_at before update on public.user_books
  for each row execute function public.set_updated_at();

-- Who owns a book, which slot and which file it has never change; the reader may rename it,
-- set its page count and mark it uploaded.
create or replace function public.user_books_fixed_columns()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.slot is distinct from old.slot
    or new.file_path is distinct from old.file_path
    or new.size_bytes is distinct from old.size_bytes
    or new.created_at is distinct from old.created_at then
    raise exception 'only the title, page count and status of a book can change'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists user_books_fixed on public.user_books;
create trigger user_books_fixed before update on public.user_books
  for each row execute function public.user_books_fixed_columns();

-- Adding and deleting over and over: at most 10 books added per person in 24 hours. The log
-- keeps one row per added book (no titles, no files) and is not readable by anyone but the owner.
create table if not exists public.user_book_adds (
  user_id uuid not null references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
create index if not exists user_book_adds_recent on public.user_book_adds (user_id, added_at desc);
alter table public.user_book_adds enable row level security;
drop policy if exists "readers see their own adds" on public.user_book_adds;
create policy "readers see their own adds" on public.user_book_adds
  for select to authenticated using (user_id = auth.uid());

create or replace function public.user_books_count_add()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    raise exception 'sign in to add a book' using errcode = '42501';
  end if;
  -- One person at a time, so two adds at once are counted one after the other.
  perform pg_advisory_xact_lock(hashtextextended('user_books:' || new.user_id::text, 0));
  if (select count(*) from public.user_book_adds a
      where a.user_id = new.user_id and a.added_at > now() - interval '24 hours') >= 10 then
    raise exception 'too many books added today' using errcode = 'P0001', hint = 'user_books_daily_limit';
  end if;
  insert into public.user_book_adds (user_id) values (new.user_id);
  delete from public.user_book_adds a
    where a.user_id = new.user_id and a.added_at < now() - interval '2 days';
  return new;
end;
$$;
drop trigger if exists user_books_count on public.user_books;
create trigger user_books_count before insert on public.user_books
  for each row execute function public.user_books_count_add();

alter table public.user_books enable row level security;

drop policy if exists "readers see their own books" on public.user_books;
create policy "readers see their own books" on public.user_books
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "readers add their own books" on public.user_books;
create policy "readers add their own books" on public.user_books
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "readers change their own books" on public.user_books;
create policy "readers change their own books" on public.user_books
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "readers delete their own books" on public.user_books;
create policy "readers delete their own books" on public.user_books
  for delete to authenticated using (user_id = auth.uid());

-- The files: a private bucket, PDF only, 50 MB a file.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-books', 'user-books', false, 52428800, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = 52428800, allowed_mime_types = array['application/pdf'];

-- A file may be written and read only at the path of one of the reader's own books.
drop policy if exists "readers upload their own book files" on storage.objects;
create policy "readers upload their own book files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'user-books'
    and exists (select 1 from public.user_books b where b.file_path = storage.objects.name and b.user_id = auth.uid())
  );
drop policy if exists "readers replace their own book files" on storage.objects;
create policy "readers replace their own book files" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'user-books'
    and exists (select 1 from public.user_books b where b.file_path = storage.objects.name and b.user_id = auth.uid())
  )
  with check (
    bucket_id = 'user-books'
    and exists (select 1 from public.user_books b where b.file_path = storage.objects.name and b.user_id = auth.uid())
  );
drop policy if exists "readers open their own book files" on storage.objects;
create policy "readers open their own book files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'user-books'
    and exists (select 1 from public.user_books b where b.file_path = storage.objects.name and b.user_id = auth.uid())
  );
-- Deleting works anywhere in the reader's own folder, so a file whose book row is already gone
-- can still be cleared away.
drop policy if exists "readers delete their own book files" on storage.objects;
create policy "readers delete their own book files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'user-books' and split_part(storage.objects.name, '/', 1) = auth.uid()::text);
