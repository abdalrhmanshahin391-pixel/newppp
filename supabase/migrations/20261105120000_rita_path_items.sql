-- Extra stops on a learner's lesson path, placed by an admin between the lessons:
--   'exercises' — a practice stop (only its look for now: opening it does nothing yet);
--   'resources' — a stop holding files (PDF) and links the learner opens.
--
-- Lessons keep their integer rita_lessons.path_order. An item sits in the same number space with
-- a fractional order (between two lessons, e.g. 3.5), so adding or moving items never renumbers
-- lessons of other books. One function applies a whole new layout atomically.

create table if not exists public.rita_path_items (
  id uuid primary key default gen_random_uuid(),
  language text not null default 'en' check (language ~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$'),
  kind text not null check (kind in ('exercises', 'resources')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  path_order numeric not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rita_path_items_language
  on public.rita_path_items (language, path_order);

alter table public.rita_path_items enable row level security;

drop policy if exists "path items are readable" on public.rita_path_items;
create policy "path items are readable" on public.rita_path_items
  for select to authenticated using (true);
drop policy if exists "admins manage path items" on public.rita_path_items;
create policy "admins manage path items" on public.rita_path_items
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop trigger if exists rita_path_items_updated_at on public.rita_path_items;
create trigger rita_path_items_updated_at before update on public.rita_path_items
  for each row execute function public.set_updated_at();

-- The files and links of a 'resources' stop. Same shape as rita_lesson_resources; PDFs live in the
-- same private bucket under path-items/<item id>/ and reach learners only as signed links.
create table if not exists public.rita_path_item_resources (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.rita_path_items (id) on delete cascade,
  kind text not null check (kind in ('pdf', 'link', 'video')),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  url text check (url is null or (char_length(url) <= 2000 and url ~* '^https://')),
  file_path text check (file_path is null or char_length(file_path) <= 300),
  file_name text check (file_name is null or char_length(file_name) <= 200),
  file_size integer check (file_size is null or file_size between 1 and 15728640),
  position integer not null default 0 check (position >= 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint rita_path_item_resources_shape check (
    (kind = 'pdf' and file_path is not null and url is null)
    or (kind in ('link', 'video') and url is not null and file_path is null)
  )
);
create index if not exists rita_path_item_resources_item
  on public.rita_path_item_resources (item_id, position);

alter table public.rita_path_item_resources enable row level security;

drop policy if exists "path item resources are readable" on public.rita_path_item_resources;
create policy "path item resources are readable" on public.rita_path_item_resources
  for select to authenticated using (true);
drop policy if exists "admins manage path item resources" on public.rita_path_item_resources;
create policy "admins manage path item resources" on public.rita_path_item_resources
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Learners may read the stored files of path items (signed links are made with their session).
drop policy if exists "learners read path item files" on storage.objects;
create policy "learners read path item files" on storage.objects
  for select to authenticated
  using (bucket_id = 'rita-lesson-resources' and name like 'path-items/%');

-- Applies a whole path layout at once: integer orders for published lessons, fractional ones for
-- path items. Admins only; any unknown id rolls the whole change back.
create or replace function public.rita_set_path_layout(p_lessons jsonb, p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  item jsonb;
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'admin only';
  end if;
  if jsonb_typeof(p_lessons) <> 'array' or jsonb_typeof(p_items) <> 'array' then
    raise exception 'layout must be two jsonb arrays';
  end if;
  for item in select * from jsonb_array_elements(p_lessons) loop
    if (item->>'path_order')::int < 1 then raise exception 'invalid path order'; end if;
    update public.rita_lessons set path_order = (item->>'path_order')::int
    where id = (item->>'id')::uuid and status = 'published';
    if not found then
      raise exception 'lesson % is not a published lesson', item->>'id';
    end if;
  end loop;
  for item in select * from jsonb_array_elements(p_items) loop
    update public.rita_path_items set path_order = (item->>'path_order')::numeric
    where id = (item->>'id')::uuid;
    if not found then
      raise exception 'path item % does not exist', item->>'id';
    end if;
  end loop;
end;
$$;

revoke all on function public.rita_set_path_layout(jsonb, jsonb) from public, anon;
grant execute on function public.rita_set_path_layout(jsonb, jsonb) to authenticated;
