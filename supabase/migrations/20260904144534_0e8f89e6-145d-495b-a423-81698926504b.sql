-- ============ roles ============
create type public.app_role as enum ('admin', 'moderator', 'user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles read own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles insert own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles update own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  )
$$;

create policy "roles read own" on public.user_roles for select to authenticated using (auth.uid() = user_id);
create policy "admins read roles" on public.user_roles for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admins manage roles" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============ personal study kit ============
create table public.study_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);
create index study_state_user_idx on public.study_state (user_id);
grant select, insert, update, delete on public.study_state to authenticated;
grant all on public.study_state to service_role;
alter table public.study_state enable row level security;
create policy "study own" on public.study_state for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger study_state_updated_at before update on public.study_state
  for each row execute function public.set_updated_at();

-- ============ classes ============
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  join_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.class_members (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (class_id, user_id)
);
create table public.class_decks (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  subtopic text not null,
  cards jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index class_members_user_idx on public.class_members (user_id);
create index class_decks_class_idx on public.class_decks (class_id);

grant select, insert, update, delete on public.classes to authenticated;
grant select, insert, update, delete on public.class_members to authenticated;
grant select, insert, update, delete on public.class_decks to authenticated;
grant all on public.classes to service_role;
grant all on public.class_members to service_role;
grant all on public.class_decks to service_role;

alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.class_decks enable row level security;

create or replace function public.is_class_member(_class_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.class_members where class_id = _class_id and user_id = _user_id
  ) or exists (
    select 1 from public.classes where id = _class_id and owner_id = _user_id
  )
$$;

create policy "classes read member" on public.classes for select to authenticated
  using (public.is_class_member(id, auth.uid()));
create policy "classes create" on public.classes for insert to authenticated
  with check (auth.uid() = owner_id);
create policy "classes owner update" on public.classes for update to authenticated
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "classes owner delete" on public.classes for delete to authenticated
  using (auth.uid() = owner_id);

create policy "members read" on public.class_members for select to authenticated
  using (public.is_class_member(class_id, auth.uid()));
create policy "members join self" on public.class_members for insert to authenticated
  with check (auth.uid() = user_id);
create policy "members leave self" on public.class_members for delete to authenticated
  using (auth.uid() = user_id or exists (select 1 from public.classes c where c.id = class_id and c.owner_id = auth.uid()));

create policy "class decks read" on public.class_decks for select to authenticated
  using (public.is_class_member(class_id, auth.uid()));
create policy "class decks share" on public.class_decks for insert to authenticated
  with check (auth.uid() = user_id and public.is_class_member(class_id, auth.uid()));
create policy "class decks update own" on public.class_decks for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "class decks delete own" on public.class_decks for delete to authenticated
  using (auth.uid() = user_id or exists (select 1 from public.classes c where c.id = class_id and c.owner_id = auth.uid()));

create trigger classes_updated_at before update on public.classes
  for each row execute function public.set_updated_at();
create trigger class_decks_updated_at before update on public.class_decks
  for each row execute function public.set_updated_at();

-- ============ RitaX announcements ============
create table public.announcements (
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
grant select on public.announcements to anon, authenticated;
grant insert, update, delete on public.announcements to authenticated;
grant all on public.announcements to service_role;
alter table public.announcements enable row level security;
create policy "announcements read live" on public.announcements for select to anon, authenticated
  using (status = 'live');
create policy "announcements admin read" on public.announcements for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "announcements admin write" on public.announcements for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create trigger announcements_updated_at before update on public.announcements
  for each row execute function public.set_updated_at();

create table public.announcement_events (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  kind text not null,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index announcement_events_idx on public.announcement_events (announcement_id, kind);
grant insert on public.announcement_events to anon, authenticated;
grant select on public.announcement_events to authenticated;
grant all on public.announcement_events to service_role;
alter table public.announcement_events enable row level security;
create policy "events insert" on public.announcement_events for insert to anon, authenticated with check (true);
create policy "events admin read" on public.announcement_events for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));