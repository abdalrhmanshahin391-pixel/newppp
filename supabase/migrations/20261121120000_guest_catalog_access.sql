begin;

-- An anonymous SELECT must not reference the administrator-only has_role function
-- in its applicable policies, even when another term of an OR would allow the row.
alter policy "published plans are readable" on public.plans to authenticated;
drop policy if exists "visitors read published plans" on public.plans;
create policy "visitors read published plans" on public.plans
  for select to anon using (published = true);

-- Reassert the library visitor policies for deployments where the previous
-- visitor-access migration is pending. Authenticated policies keep their predicates.
alter policy "published books are readable" on public.books to authenticated;
drop policy if exists "visitors read published books" on public.books;
create policy "visitors read published books" on public.books
  for select to anon using (status = 'published');

alter policy "visible shelves are readable" on public.book_shelves to authenticated;
drop policy if exists "visitors read visible shelves" on public.book_shelves;
create policy "visitors read visible shelves" on public.book_shelves
  for select to anon using (visible);

alter policy "readers see rules in force" on public.book_editorial to authenticated;
drop policy if exists "visitors read rules in force" on public.book_editorial;
create policy "visitors read rules in force" on public.book_editorial
  for select to anon using (
    (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())
  );

alter policy "numbers of published books are public" on public.book_stats to authenticated;
drop policy if exists "visitors read published book numbers" on public.book_stats;
create policy "visitors read published book numbers" on public.book_stats
  for select to anon using (public.book_is_published(book_id));

alter policy "daily numbers of published books are public" on public.book_daily to authenticated;
drop policy if exists "visitors read published daily numbers" on public.book_daily;
create policy "visitors read published daily numbers" on public.book_daily
  for select to anon using (public.book_is_published(book_id));

-- PL/pgSQL never plans the administrator check for the anonymous request.
-- A SQL function's CASE can still require execute permission during planning.
create or replace function public.books_read_at(p_as_of timestamptz)
returns timestamptz
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if p_as_of is null then
    return now();
  end if;
  if auth.uid() is null then
    return least(p_as_of, now());
  end if;
  if public.has_role(auth.uid(), 'admin'::public.app_role) then
    return p_as_of;
  end if;
  return least(p_as_of, now());
end;
$$;

commit;
