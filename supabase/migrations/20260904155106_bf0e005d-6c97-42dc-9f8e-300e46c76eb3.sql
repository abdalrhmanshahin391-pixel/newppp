create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
revoke all on function public.set_updated_at() from public, anon, authenticated;

alter table public.profiles add column if not exists display_name text;

alter table public.card_reviews
  add column if not exists difficulty numeric,
  add column if not exists stability numeric,
  add column if not exists step integer not null default 0,
  add column if not exists suspended boolean not null default false,
  add column if not exists last_review_at timestamptz;

alter table public.review_events
  add column if not exists sub_subject text not null default '',
  add column if not exists elapsed_days numeric,
  add column if not exists prev jsonb;

alter table public.study_prefs
  add column if not exists retention numeric not null default 0.9,
  add column if not exists new_per_day integer not null default 12,
  add column if not exists review_cap integer not null default 150;

create table if not exists public.study_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);
grant select, insert, update, delete on public.study_state to authenticated;
grant all on public.study_state to service_role;
alter table public.study_state enable row level security;
drop policy if exists "study own" on public.study_state;
create policy "study own" on public.study_state for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop trigger if exists study_state_updated_at on public.study_state;
create trigger study_state_updated_at before update on public.study_state
  for each row execute function public.set_updated_at();

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  join_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.class_members (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (class_id, user_id)
);
create table if not exists public.class_decks (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  subtopic text not null,
  cards jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.classes, public.class_members, public.class_decks to authenticated;
grant all on public.classes, public.class_members, public.class_decks to service_role;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.class_decks enable row level security;

create or replace function public.is_class_member(_class_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.class_members where class_id = _class_id and user_id = _user_id)
      or exists (select 1 from public.classes where id = _class_id and owner_id = _user_id)
$$;
revoke all on function public.is_class_member(uuid, uuid) from public, anon;
grant execute on function public.is_class_member(uuid, uuid) to authenticated, service_role;

drop policy if exists "classes create" on public.classes;
create policy "classes create" on public.classes for insert to authenticated with check (auth.uid() = owner_id);
drop policy if exists "classes read member" on public.classes;
create policy "classes read member" on public.classes for select to authenticated using (public.is_class_member(id, auth.uid()));
drop policy if exists "classes owner update" on public.classes;
create policy "classes owner update" on public.classes for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "classes owner delete" on public.classes;
create policy "classes owner delete" on public.classes for delete to authenticated using (auth.uid() = owner_id);

drop policy if exists "members join self" on public.class_members;
create policy "members join self" on public.class_members for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "members read" on public.class_members;
create policy "members read" on public.class_members for select to authenticated using (public.is_class_member(class_id, auth.uid()));
drop policy if exists "members leave self" on public.class_members;
create policy "members leave self" on public.class_members for delete to authenticated
  using (auth.uid() = user_id or exists (select 1 from public.classes c where c.id = class_members.class_id and c.owner_id = auth.uid()));

drop policy if exists "class decks read" on public.class_decks;
create policy "class decks read" on public.class_decks for select to authenticated using (public.is_class_member(class_id, auth.uid()));
drop policy if exists "class decks share" on public.class_decks;
create policy "class decks share" on public.class_decks for insert to authenticated
  with check (auth.uid() = user_id and public.is_class_member(class_id, auth.uid()));
drop policy if exists "class decks update own" on public.class_decks;
create policy "class decks update own" on public.class_decks for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "class decks delete own" on public.class_decks;
create policy "class decks delete own" on public.class_decks for delete to authenticated
  using (auth.uid() = user_id or exists (select 1 from public.classes c where c.id = class_decks.class_id and c.owner_id = auth.uid()));

drop trigger if exists classes_updated_at on public.classes;
create trigger classes_updated_at before update on public.classes for each row execute function public.set_updated_at();
drop trigger if exists class_decks_updated_at on public.class_decks;
create trigger class_decks_updated_at before update on public.class_decks for each row execute function public.set_updated_at();

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Untitled announcement',
  status text not null default 'draft',
  layout text not null default 'modal',
  theme text not null default 'cream',
  accent text,
  eyebrow text,
  title text not null default '',
  body text,
  image_url text,
  emoji text,
  confetti boolean not null default false,
  countdown_to timestamptz,
  primary_label text,
  primary_href text,
  secondary_label text,
  secondary_href text,
  audience text not null default 'all',
  pages jsonb not null default '[]'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  frequency text not null default 'once',
  priority integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.announcement_events (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  kind text not null,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select on public.announcements to anon, authenticated;
grant insert, update, delete on public.announcements to authenticated;
grant all on public.announcements to service_role;
grant insert on public.announcement_events to anon, authenticated;
grant select on public.announcement_events to authenticated;
grant all on public.announcement_events to service_role;
alter table public.announcements enable row level security;
alter table public.announcement_events enable row level security;
drop policy if exists "announcements read live" on public.announcements;
create policy "announcements read live" on public.announcements for select to anon, authenticated using (status = 'live');
drop policy if exists "announcements admin read" on public.announcements;
create policy "announcements admin read" on public.announcements for select to authenticated using (public.has_role(auth.uid(), 'admin'));
drop policy if exists "announcements admin write" on public.announcements;
create policy "announcements admin write" on public.announcements for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
drop policy if exists "events insert" on public.announcement_events;
create policy "events insert" on public.announcement_events for insert to anon, authenticated with check (true);
drop policy if exists "events admin read" on public.announcement_events;
create policy "events admin read" on public.announcement_events for select to authenticated using (public.has_role(auth.uid(), 'admin'));
drop trigger if exists announcements_updated_at on public.announcements;
create trigger announcements_updated_at before update on public.announcements for each row execute function public.set_updated_at();

create or replace function public.grant_owner_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if lower(coalesce(new.email,'')) = 'klory.shaheen3@icloud.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end; $$;
revoke all on function public.grant_owner_admin() from public, anon, authenticated;
drop trigger if exists grant_owner_admin_trigger on public.profiles;
create trigger grant_owner_admin_trigger after insert on public.profiles
  for each row execute function public.grant_owner_admin();
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role from public.profiles where lower(email) = 'klory.shaheen3@icloud.com'
on conflict (user_id, role) do nothing;