-- Isolated fixture for the quota migration; NEVER run this fixture on a real project.
create schema auth;
create role anon;
create role authenticated;
create role service_role bypassrls;
create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
create table public.plans(slug text primary key,price_cents int default 0,yearly_cents int default 0,once_cents int default 0,billing_kind text default 'monthly');
create table public.user_plans(user_id uuid primary key,plan_slug text);
create table public.user_roles(user_id uuid,role text);
create table public.manual_plan_grants(user_id uuid,plan_slug text,revoked_at timestamptz,starts_at timestamptz default now(),expires_at timestamptz);
create table public.subscriptions(user_id uuid,plan_slug text,status text,current_period_end timestamptz,environment text);
create table public.plan_credit_grants(user_id uuid,plan_slug text,environment text);
create table public.rita_v3_sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade);
create function public.has_role(uuid,text) returns boolean language sql as $$ select exists(select 1 from public.user_roles where user_id=$1 and role=$2) $$;
create function public.effective_plan_slug(uuid) returns text language sql as $$ select coalesce((select plan_slug from public.user_plans where user_id=$1),'starter') $$;
create function public.activate_user_plan(uuid,text) returns void language sql security definer as $$ insert into public.user_plans values($1,$2) on conflict(user_id) do update set plan_slug=excluded.plan_slug $$;
grant execute on function public.activate_user_plan(uuid,text) to authenticated;
insert into public.plans(slug,price_cents) values('starter',0),('toolkit',300),('study',600),('boost',500),('pro',1500),('ultimate',2000);
