-- The few parts of a Supabase database the study migrations rely on, for a plain Postgres test
-- database (CI and local). Never applied to the real project.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end $$;

create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create type public.app_role as enum ('admin', 'user');
create table public.user_roles (user_id uuid not null, role public.app_role not null);
create or replace function public.has_role(_user_id uuid, _role public.app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create schema if not exists storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null
);
alter table storage.objects enable row level security;

-- The two lesson tables, with the columns and learner rules the study migrations depend on.
create table public.rita_curricula (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'draft'
);
alter table public.rita_curricula enable row level security;
create policy "read published books" on public.rita_curricula for select to authenticated
  using (status = 'published' or public.has_role(auth.uid(), 'admin'));

create table public.rita_lessons (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.rita_curricula (id) on delete cascade,
  title text not null default 'Lesson',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived'))
);
alter table public.rita_lessons enable row level security;
create policy "read published lessons" on public.rita_lessons for select to authenticated
  using (
    (status = 'published' and exists (
      select 1 from public.rita_curricula c where c.id = curriculum_id and c.status = 'published'
    ))
    or public.has_role(auth.uid(), 'admin')
  );
create policy "admins manage lessons" on public.rita_lessons for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
