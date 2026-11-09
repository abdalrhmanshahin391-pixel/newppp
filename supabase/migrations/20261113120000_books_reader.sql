-- Library, the reader: a book is read page by page, never as one big PDF download.
--
-- When the admin prepares a book («جهّز الكتاب للقراءة»), their own browser opens the PDF once,
-- turns every page into a light picture (WebP, or JPEG where the browser cannot make WebP) and
-- reads the page's words with where each one sits. The pictures go to the private bucket
-- book-pages under "<book id>/", one row per page goes to book_pages. A reader then loads only
-- the page they look at (and the next one), and the words lie over the picture so they can be
-- chosen and sent to Rita's circle.
--
--   book_pages            one row per prepared page (picture, size, words and their places)
--   books.page_count      how many pages the PDF has (set when preparing starts)
--   books.prepared_at     set once every page is in; the reader opens only then
--   book_reading_progress the page each reader stopped at (their own rows only)
--   book_study_requests   what readers asked the circle, written only by books_take_study_quota
--
-- Replacing a book's PDF clears its pages and prepared_at (the old pages belong to the old PDF).
-- Everything here only adds, and the file can be run again safely.

-- ---------------------------------------------------------------------------------------------
-- The book's own numbers

alter table public.books add column if not exists page_count integer;
alter table public.books add column if not exists prepared_at timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'books_page_count_range') then
    alter table public.books add constraint books_page_count_range
      check (page_count is null or page_count between 1 and 5000);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- The pages

create table if not exists public.book_pages (
  book_id uuid not null references public.books (id) on delete cascade,
  page integer not null check (page between 1 and 5000),
  -- The picture's size in pixels (its shape is the page's shape).
  width integer not null check (width between 16 and 6000),
  height integer not null check (height between 16 and 6000),
  image_path text not null check (char_length(image_path) between 3 and 300),
  -- The page's words in reading order, and each piece of text with its place on the page:
  -- [text, left, top, width, height], the four numbers as parts of the page (0 to 1).
  text text not null default '' check (char_length(text) <= 60000),
  runs jsonb not null default '[]'::jsonb check (jsonb_typeof(runs) = 'array'),
  has_text boolean generated always as (char_length(btrim(text)) > 0) stored,
  created_at timestamptz not null default now(),
  primary key (book_id, page)
);

alter table public.book_pages enable row level security;

drop policy if exists "readers read pages of published books" on public.book_pages;
create policy "readers read pages of published books" on public.book_pages
  for select to authenticated
  using (public.book_is_published(book_id) or public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "admins manage book pages" on public.book_pages;
create policy "admins manage book pages" on public.book_pages
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

revoke all on public.book_pages from anon;
grant select, insert, update, delete on public.book_pages to authenticated;

-- A new PDF means new pages: the old ones go, and the book waits to be prepared again.
create or replace function public.books_reader_reset()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.file_path is distinct from old.file_path then
    delete from public.book_pages where book_id = new.id;
    new.prepared_at := null;
    new.page_count := null;
  end if;
  return new;
end;
$$;

drop trigger if exists books_reader_reset on public.books;
create trigger books_reader_reset
  before update of file_path on public.books
  for each row execute function public.books_reader_reset();

-- ---------------------------------------------------------------------------------------------
-- The pictures: a private bucket, read with links made from the reader's own session

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-pages', 'book-pages', false, 5242880, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "admins manage book pages pictures" on storage.objects;
create policy "admins manage book pages pictures" on storage.objects
  for all to authenticated
  using (bucket_id = 'book-pages' and public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (bucket_id = 'book-pages' and public.has_role(auth.uid(), 'admin'::public.app_role));

-- A signed-in reader may open the pictures under "<book id>/" of a published book.
drop policy if exists "readers open pages of published books" on storage.objects;
create policy "readers open pages of published books" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'book-pages'
    and exists (
      select 1 from public.books b
      where b.id::text = split_part(storage.objects.name, '/', 1) and b.status = 'published'
    )
  );

-- ---------------------------------------------------------------------------------------------
-- Where each reader stopped

create table if not exists public.book_reading_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  page integer not null check (page between 1 and 5000),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

alter table public.book_reading_progress enable row level security;

drop policy if exists "readers read their place" on public.book_reading_progress;
create policy "readers read their place" on public.book_reading_progress
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "readers keep their place" on public.book_reading_progress;
create policy "readers keep their place" on public.book_reading_progress
  for insert to authenticated
  with check (user_id = auth.uid() and public.book_is_published(book_id));

drop policy if exists "readers move their place" on public.book_reading_progress;
create policy "readers move their place" on public.book_reading_progress
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.book_is_published(book_id));

drop policy if exists "readers forget their place" on public.book_reading_progress;
create policy "readers forget their place" on public.book_reading_progress
  for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.book_reading_progress from anon;
grant select, insert, update, delete on public.book_reading_progress to authenticated;

-- ---------------------------------------------------------------------------------------------
-- What readers ask Rita's circle about a page (limits like the lessons' study page)

create table if not exists public.book_study_requests (
  request_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  page integer not null check (page between 1 and 5000),
  action text not null check (char_length(action) between 1 and 40),
  quota_group text not null check (quota_group in ('explain', 'practice', 'cards')),
  selection_len integer not null default 0 check (selection_len between 0 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists book_study_requests_quota
  on public.book_study_requests (user_id, quota_group, created_at desc);

alter table public.book_study_requests enable row level security;

drop policy if exists "readers read their book requests" on public.book_study_requests;
create policy "readers read their book requests" on public.book_study_requests
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::public.app_role));

revoke all on public.book_study_requests from anon;
revoke insert, update, delete on public.book_study_requests from authenticated;
grant select on public.book_study_requests to authenticated;

-- The same generous limits as rita_study_take_quota (src/lib/study/study-limits.ts; a test keeps
-- them equal). A day starts at midnight in Amman. Admins are never limited.
create or replace function public.books_take_study_quota(
  p_request uuid,
  p_book uuid,
  p_page integer,
  p_action text,
  p_group text,
  p_selection_len integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  admin boolean;
  per_min integer;
  per_day integer;
  used_min integer;
  used_day integer;
  day_start timestamptz;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  if p_request is null or p_book is null or p_page is null or p_page not between 1 and 5000
    or char_length(coalesce(p_action, '')) not between 1 and 40 then
    return jsonb_build_object('ok', false, 'code', 'bad_request');
  end if;
  admin := public.has_role(uid, 'admin'::public.app_role);
  if not admin and not public.book_is_published(p_book) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  case p_group
    when 'explain' then
      per_min := 20;
      per_day := 400;
    when 'practice' then
      per_min := 4;
      per_day := 40;
    when 'cards' then
      per_min := 6;
      per_day := 60;
    else
      return jsonb_build_object('ok', false, 'code', 'bad_request');
  end case;

  if not admin then
    -- One reader's requests are counted one at a time.
    perform pg_advisory_xact_lock(hashtext('books_study_quota:' || uid::text));
    day_start := date_trunc('day', now() at time zone 'Asia/Amman') at time zone 'Asia/Amman';
    select
      count(*) filter (where created_at > now() - interval '1 minute'),
      count(*) filter (where created_at >= day_start)
    into used_min, used_day
    from public.book_study_requests
    where user_id = uid
      and quota_group = p_group
      and created_at >= least(day_start, now() - interval '1 minute');
    if used_day >= per_day then
      return jsonb_build_object(
        'ok', false, 'code', 'rate_limited', 'scope', 'day',
        'retry_after', ceil(extract(epoch from (day_start + interval '1 day' - now())))::integer
      );
    end if;
    if used_min >= per_min then
      return jsonb_build_object('ok', false, 'code', 'rate_limited', 'scope', 'minute', 'retry_after', 60);
    end if;
  end if;

  insert into public.book_study_requests (request_id, user_id, book_id, page, action, quota_group, selection_len)
  values (p_request, uid, p_book, p_page, p_action, p_group,
          greatest(0, least(coalesce(p_selection_len, 0), 4000)))
  on conflict (request_id) do nothing;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.books_take_study_quota(uuid, uuid, integer, text, text, integer) from public;
grant execute on function public.books_take_study_quota(uuid, uuid, integer, text, text, integer) to authenticated;
