-- Uzyra's circle on a reader's own private books (user_books). The pages of a private book are
-- read on the reader's device, so the text comes with each request; this only counts the
-- request, with the same limits as library books and in the same table (one allowance for both),
-- and only when the book is the caller's own and ready. Safe to run more than once.

alter table public.book_study_requests
  add column if not exists user_book_id uuid references public.user_books (id) on delete cascade;

alter table public.book_study_requests alter column book_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'book_study_requests_one_book'
      and conrelid = 'public.book_study_requests'::regclass
  ) then
    alter table public.book_study_requests
      add constraint book_study_requests_one_book
      check ((book_id is null) <> (user_book_id is null));
  end if;
end;
$$;

create or replace function public.books_take_my_study_quota(
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
  pages integer;
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
  -- Only the caller's own book, uploaded in full, and a page inside it.
  select b.page_count into pages
  from public.user_books b
  where b.id = p_book and b.user_id = uid and b.status = 'ready';
  if not found or (pages is not null and p_page > pages) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  admin := public.has_role(uid, 'admin'::public.app_role);

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
    -- The same lock as the library books: one reader's requests are counted one at a time.
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

  insert into public.book_study_requests
    (request_id, user_id, user_book_id, page, action, quota_group, selection_len)
  values (p_request, uid, p_book, p_page, p_action, p_group,
          greatest(0, least(coalesce(p_selection_len, 0), 4000)))
  on conflict (request_id) do nothing;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.books_take_my_study_quota(uuid, uuid, integer, text, text, integer) from public;
grant execute on function public.books_take_my_study_quota(uuid, uuid, integer, text, text, integer) to authenticated;
