-- One voice time for calls and the whiteboard (Nov 2026). Safe to run more than once.
-- * Installs (again) everything voice time needs, so a project where the earlier voice-time files
--   were never applied gets all of it: the tables, free_talk_budget / reserve / claim / bind /
--   close / settle, and their permissions (server only).
-- * Calls keep counting the whole call, silence included, by the server's clock (unchanged).
-- * New: the whiteboard's spoken explanations (Cartesia) take from the same time, by the exact
--   length of each clip in milliseconds (voice_board_charges, voice_board_charge). A clip is only
--   charged while time is left; the total counts up to the next whole second.
-- * Free conversation is switched on (free_talk_config.enabled).
begin;

alter table public.plans add column if not exists free_talk_seconds integer not null default 0;
alter table public.plans add column if not exists free_talk_period text not null default 'monthly';
alter table public.plans drop constraint if exists plans_free_talk_budget_check;
alter table public.plans add constraint plans_free_talk_budget_check
  check (free_talk_seconds between 0 and 3600000 and free_talk_period in ('monthly','lifetime','daily'));

create table if not exists public.free_talk_config (id boolean primary key default true check(id), enabled boolean not null default false);
insert into public.free_talk_config(id,enabled) values(true,true) on conflict(id) do update set enabled=true;
alter table public.free_talk_config enable row level security;
revoke all on public.free_talk_config from public,anon,authenticated;
grant all on public.free_talk_config to service_role;

create table if not exists public.free_talk_sessions (
  id uuid primary key references public.rita_v3_sessions(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  period_key text not null,
  reserved_seconds integer not null check(reserved_seconds between 1 and 3600),
  charged_seconds integer check(charged_seconds between 0 and reserved_seconds),
  created_at timestamptz not null default clock_timestamp(),
  deadline timestamptz not null,
  state text not null default 'reserved' check(state in ('reserved','claimed','active','closing','closed')),
  active_at timestamptz,
  closed_at timestamptz,
  room_name text not null unique,
  provider_call_id text,
  check(deadline > created_at and deadline <= created_at + interval '1 hour')
);
create index if not exists free_talk_user_period on public.free_talk_sessions(user_id,period_key);
create index if not exists free_talk_user_active on public.free_talk_sessions(user_id,deadline) where state <> 'closed';
alter table public.free_talk_sessions enable row level security;
revoke all on public.free_talk_sessions from public,anon,authenticated;
grant all on public.free_talk_sessions to service_role;

-- Each spoken whiteboard clip, once (ref is unique), in milliseconds.
create table if not exists public.voice_board_charges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_key text not null,
  milliseconds integer not null check (milliseconds between 1 and 600000),
  ref text not null unique check (length(ref) between 8 and 120),
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists voice_board_user_period on public.voice_board_charges(user_id,period_key);
alter table public.voice_board_charges enable row level security;
revoke all on public.voice_board_charges from public,anon,authenticated;
grant all on public.voice_board_charges to service_role;

create or replace function public.free_talk_budget(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.plans%rowtype; v_key text; v_cap integer; v_used bigint; v_board bigint;
  v_active public.free_talk_sessions%rowtype; v_now timestamptz := clock_timestamp();
  v_admin boolean; v_reset timestamptz; v_proof boolean;
begin
  v_admin := coalesce(public.has_role(p_user,'admin'),false);
  if not coalesce(v_admin,false) and not exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null) then raise exception 'free_talk_email_unverified'; end if;
  if v_admin then v_key := 'admin'; v_cap := null;
  else
    select * into v_plan from public.plans where slug=public.effective_plan_slug(p_user);
    if not found then raise exception 'free_talk_plan_unavailable'; end if;
    -- Paid access must have server-authenticated purchase or grant evidence.
    if v_plan.price_cents > 0 or v_plan.yearly_cents > 0 or coalesce(v_plan.once_cents,0)>0 then
      select exists(select 1 from public.manual_plan_grants g where g.user_id=p_user and g.plan_slug=v_plan.slug and g.revoked_at is null and g.starts_at<=v_now and (g.expires_at is null or g.expires_at>v_now))
        or exists(select 1 from public.subscriptions s where s.user_id=p_user and s.plan_slug=v_plan.slug and s.status in ('active','trialing') and s.current_period_end>v_now and s.environment='live')
        or exists(select 1 from public.plan_credit_grants g where g.user_id=p_user and g.plan_slug=v_plan.slug and g.environment='live') into v_proof;
      if not v_proof then raise exception 'free_talk_payment_unverified'; end if;
    end if;
    v_cap := v_plan.free_talk_seconds;
    if v_plan.free_talk_period='lifetime' then
      v_key := 'lifetime';
    elsif v_plan.free_talk_period='daily' then
      -- A day in Amman; the key is the date, so a new day starts with the whole allowance.
      v_key := to_char(v_now at time zone 'Asia/Amman','YYYY-MM-DD');
      v_reset := (date_trunc('day',v_now at time zone 'Asia/Amman')+interval '1 day') at time zone 'Asia/Amman';
    else
      v_key := to_char(v_now at time zone 'UTC','YYYY-MM');
      v_reset := (date_trunc('month',v_now at time zone 'UTC')+interval '1 month') at time zone 'UTC';
    end if;
  end if;
  -- Calls: the whole call by the server's clock (an open call counts all it reserved).
  select coalesce(sum(coalesce(charged_seconds,reserved_seconds)),0) into v_used from public.free_talk_sessions where user_id=p_user and period_key=v_key;
  -- Whiteboard clips: their exact lengths, counted up to the next whole second.
  select coalesce(sum(milliseconds),0) into v_board from public.voice_board_charges where user_id=p_user and period_key=v_key;
  v_used := v_used + ceil(v_board/1000.0)::bigint;
  select * into v_active from public.free_talk_sessions where user_id=p_user and state<>'closed' and deadline>v_now order by created_at desc limit 1;
  return jsonb_build_object('unlimited',v_admin,'limitSeconds',v_cap,'availableSeconds',case when v_admin then null else greatest(0,v_cap-v_used) end,
    'remainingSeconds',case when v_admin then null else greatest(0,v_cap-v_used)+case when v_active.period_key=v_key then greatest(0,floor(extract(epoch from v_active.deadline-v_now))::integer) else 0 end end,
    'boardSeconds',ceil(v_board/1000.0)::bigint,
    'enabled',coalesce((select enabled from public.free_talk_config where id),false),'period',v_key,'resetsAt',v_reset,'serverNow',v_now,'activeSessionId',v_active.id,'activeDeadline',v_active.deadline);
end $$;

drop function if exists public.free_talk_reserve(uuid,uuid);
create or replace function public.free_talk_reserve(p_user uuid,p_session uuid,p_free boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_now timestamptz := clock_timestamp(); v_budget jsonb; v_seconds integer; v_deadline timestamptz;
begin
  if coalesce(p_free,true) and not coalesce((select enabled from public.free_talk_config where id=true),false) then raise exception 'free_talk_not_enabled'; end if;
  perform pg_advisory_xact_lock(hashtextextended('free-talk:'||p_user::text,0));
  if not exists(select 1 from public.rita_v3_sessions where id=p_session and user_id=p_user) then raise exception 'free_talk_session_owner'; end if;
  if exists(select 1 from public.free_talk_sessions where id=p_session) then raise exception 'free_talk_session_replayed'; end if;
  update public.free_talk_sessions set charged_seconds=reserved_seconds,state='closed',closed_at=deadline where user_id=p_user and state<>'closed' and deadline<=v_now;
  if exists(select 1 from public.free_talk_sessions where user_id=p_user and state<>'closed') then raise exception 'free_talk_already_active'; end if;
  if (select count(*) from public.free_talk_sessions where user_id=p_user and created_at>v_now-interval '1 minute')>=6 then raise exception 'free_talk_start_rate_limit'; end if;
  v_budget := public.free_talk_budget(p_user);
  v_seconds := case when (v_budget->>'unlimited')::boolean then 3600 else least(3600,(v_budget->>'availableSeconds')::integer) end;
  -- A monthly allowance ends at the month's end; a daily call counts on the day it started.
  if v_budget->>'resetsAt' is not null and length(v_budget->>'period')=7 then v_seconds := least(v_seconds,floor(extract(epoch from (v_budget->>'resetsAt')::timestamptz-v_now))::integer); end if;
  if v_seconds <= 0 then raise exception 'free_talk_exhausted'; end if;
  v_deadline := date_trunc('second',v_now+make_interval(secs=>v_seconds));
  insert into public.free_talk_sessions(id,user_id,period_key,reserved_seconds,created_at,deadline,room_name)
    values(p_session,p_user,v_budget->>'period',v_seconds,v_now,v_deadline,'uzq-'||replace(p_session::text,'-',''));
  return v_budget || jsonb_build_object('sessionId',p_session,'deadline',v_deadline,'reservedSeconds',v_seconds,'roomName','uzq-'||replace(p_session::text,'-',''));
end $$;

create or replace function public.free_talk_claim(p_session uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_row public.free_talk_sessions%rowtype;
begin
  select * into v_row from public.free_talk_sessions where id=p_session for update;
  if not found or v_row.state<>'reserved' or v_row.deadline<=clock_timestamp() then raise exception 'free_talk_invalid_lease'; end if;
  update public.free_talk_sessions set state='claimed' where id=p_session;
  return jsonb_build_object('sessionId',v_row.id,'userId',v_row.user_id,'deadline',v_row.deadline,'roomName',v_row.room_name);
end $$;

create or replace function public.free_talk_bind(p_session uuid,p_call text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.free_talk_sessions set state='active',active_at=clock_timestamp(),provider_call_id=p_call where id=p_session and state='claimed' and deadline>clock_timestamp();
  return found;
end $$;

create or replace function public.free_talk_close(p_user uuid,p_session uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_row public.free_talk_sessions%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('free-talk:'||p_user::text,0));
  select * into v_row from public.free_talk_sessions where id=p_session and user_id=p_user for update;
  if not found then return null; end if;
  -- Claim and close share the row lock: an unclaimed lease can never create a room afterwards.
  if v_row.state='reserved' then
    update public.free_talk_sessions set state='closed',charged_seconds=0,closed_at=clock_timestamp() where id=p_session;
    return jsonb_build_object('state','closed','active',false);
  end if;
  if v_row.state<>'closed' then update public.free_talk_sessions set state='closing' where id=p_session; end if;
  return jsonb_build_object('state',v_row.state,'roomName',v_row.room_name,'providerCallId',v_row.provider_call_id,'active',v_row.active_at is not null);
end $$;

create or replace function public.free_talk_settle(p_session uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v_row public.free_talk_sessions%rowtype;
begin
  select user_id into v_user from public.free_talk_sessions where id=p_session;
  if v_user is null then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended('free-talk:'||v_user::text,0));
  select * into v_row from public.free_talk_sessions where id=p_session for update;
  if v_row.state='closed' then return true; end if;
  update public.free_talk_sessions set state='closed',closed_at=clock_timestamp(),charged_seconds=case when v_row.active_at is null then 0 else least(v_row.reserved_seconds,greatest(0,ceil(extract(epoch from clock_timestamp()-v_row.created_at))::integer)) end where id=p_session;
  return true;
end $$;

-- Charge one spoken whiteboard clip. Same lock as calls, so a call and a clip never both take the
-- last seconds. Returns charged=false (and why) instead of going below zero.
create or replace function public.voice_board_charge(p_user uuid,p_ms integer,p_ref text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_budget jsonb; v_key text; v_cap bigint; v_calls bigint; v_board bigint; v_left bigint;
begin
  if p_ms is null or p_ms < 1 or p_ms > 600000 or p_ref is null or length(p_ref) not between 8 and 120 then
    raise exception 'voice_board_invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('free-talk:'||p_user::text,0));
  -- The same clip is never charged twice.
  if exists(select 1 from public.voice_board_charges where ref=p_ref and user_id=p_user) then
    return jsonb_build_object('charged',true,'repeat',true);
  end if;
  if exists(select 1 from public.voice_board_charges where ref=p_ref) then raise exception 'voice_board_invalid'; end if;
  v_budget := public.free_talk_budget(p_user);
  v_key := v_budget->>'period';
  if coalesce((v_budget->>'unlimited')::boolean,false) then
    insert into public.voice_board_charges(user_id,period_key,milliseconds,ref) values(p_user,v_key,p_ms,p_ref);
    return jsonb_build_object('charged',true,'unlimited',true);
  end if;
  v_cap := coalesce((v_budget->>'limitSeconds')::bigint,0)*1000;
  select coalesce(sum(coalesce(charged_seconds,reserved_seconds)),0)*1000 into v_calls from public.free_talk_sessions where user_id=p_user and period_key=v_key;
  select coalesce(sum(milliseconds),0) into v_board from public.voice_board_charges where user_id=p_user and period_key=v_key;
  v_left := v_cap - v_calls - v_board;
  if v_left < p_ms then
    return jsonb_build_object('charged',false,'leftMs',greatest(0,v_left),
      'reason',case when v_budget->>'activeSessionId' is not null then 'call' when v_cap=0 then 'none' else 'exhausted' end);
  end if;
  insert into public.voice_board_charges(user_id,period_key,milliseconds,ref) values(p_user,v_key,p_ms,p_ref);
  return jsonb_build_object('charged',true,'leftMs',v_left-p_ms);
end $$;

do $$ declare f record; begin
  for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace
    and proname in ('free_talk_budget','free_talk_reserve','free_talk_claim','free_talk_bind','free_talk_close','free_talk_settle','voice_board_charge') loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
commit;
