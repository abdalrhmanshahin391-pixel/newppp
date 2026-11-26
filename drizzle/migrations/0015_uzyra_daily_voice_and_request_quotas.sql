alter table public.plans drop constraint if exists plans_free_talk_budget_check;
alter table public.plans add constraint plans_free_talk_budget_check check (free_talk_seconds between 0 and 3600000 and free_talk_period in ('monthly','lifetime','daily'));
create or replace function public.free_talk_budget(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.plans%rowtype; v_key text; v_cap integer; v_used bigint; v_active public.free_talk_sessions%rowtype;
  v_now timestamptz := clock_timestamp(); v_admin boolean; v_reset timestamptz; v_proof boolean;
begin
  v_admin := coalesce(public.has_role(p_user,'admin'),false);
  if not coalesce(v_admin,false) and not exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null) then raise exception 'free_talk_email_unverified'; end if;
  if v_admin then v_key := 'admin'; v_cap := null;
  else
    select * into v_plan from public.plans where slug=public.effective_plan_slug(p_user);
    if not found then raise exception 'free_talk_plan_unavailable'; end if;
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
      v_key := to_char(v_now at time zone 'Asia/Amman','YYYY-MM-DD');
      v_reset := (date_trunc('day',v_now at time zone 'Asia/Amman')+interval '1 day') at time zone 'Asia/Amman';
    else
      v_key := to_char(v_now at time zone 'UTC','YYYY-MM');
      v_reset := (date_trunc('month',v_now at time zone 'UTC')+interval '1 month') at time zone 'UTC';
    end if;
  end if;
  select coalesce(sum(coalesce(charged_seconds,reserved_seconds)),0) into v_used from public.free_talk_sessions where user_id=p_user and period_key=v_key;
  select * into v_active from public.free_talk_sessions where user_id=p_user and state<>'closed' and deadline>v_now order by created_at desc limit 1;
  return jsonb_build_object('unlimited',v_admin,'limitSeconds',v_cap,'availableSeconds',case when v_admin then null else greatest(0,v_cap-v_used) end,
    'remainingSeconds',case when v_admin then null else greatest(0,v_cap-v_used)+case when v_active.period_key=v_key then greatest(0,floor(extract(epoch from v_active.deadline-v_now))::integer) else 0 end end,
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
  if v_budget->>'resetsAt' is not null and length(v_budget->>'period')=7 then v_seconds := least(v_seconds,floor(extract(epoch from (v_budget->>'resetsAt')::timestamptz-v_now))::integer); end if;
  if v_seconds <= 0 then raise exception 'free_talk_exhausted'; end if;
  v_deadline := date_trunc('second',v_now+make_interval(secs=>v_seconds));
  insert into public.free_talk_sessions(id,user_id,period_key,reserved_seconds,created_at,deadline,room_name)
    values(p_session,p_user,v_budget->>'period',v_seconds,v_now,v_deadline,'uzq-'||replace(p_session::text,'-',''));
  return v_budget || jsonb_build_object('sessionId',p_session,'deadline',v_deadline,'reservedSeconds',v_seconds,'roomName','uzq-'||replace(p_session::text,'-',''));
end $$;
do $$ declare f record; begin
  for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname in ('free_talk_budget','free_talk_reserve') loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
alter table public.plans add column if not exists billing_months integer not null default 3;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'plans_billing_months_check') then
    alter table public.plans add constraint plans_billing_months_check check (billing_months in (1, 3));
  end if;
end $$;
alter table public.plans add column if not exists max_groq_requests integer;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'plans_max_groq_requests_check') then
    alter table public.plans add constraint plans_max_groq_requests_check check (max_groq_requests is null or max_groq_requests >= 0);
  end if;
end $$;
create table if not exists public.groq_request_usage (
  user_id uuid not null,
  period text not null,
  used integer not null default 0 check (used >= 0),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, period)
);
revoke all on public.groq_request_usage from public, anon, authenticated;
grant all on public.groq_request_usage to service_role;
alter table public.groq_request_usage enable row level security;
create or replace function public.groq_request_take_for(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := clock_timestamp();
  v_period text := to_char(v_now at time zone 'Asia/Amman', 'YYYY-MM');
  v_reset timestamptz := (date_trunc('month', v_now at time zone 'Asia/Amman') + interval '1 month') at time zone 'Asia/Amman';
  v_plan public.plans%rowtype; v_cap integer; v_used integer; v_proof boolean;
begin
  if coalesce(public.has_role(p_user, 'admin'), false) then
    return jsonb_build_object('unlimited', true, 'used', null, 'limit', null, 'period', v_period, 'resetsAt', v_reset);
  end if;
  select * into v_plan from public.plans where slug = public.effective_plan_slug(p_user);
  if found and (v_plan.price_cents > 0 or v_plan.yearly_cents > 0 or coalesce(v_plan.once_cents, 0) > 0) then
    select exists(select 1 from public.manual_plan_grants g where g.user_id=p_user and g.plan_slug=v_plan.slug and g.revoked_at is null and g.starts_at<=v_now and (g.expires_at is null or g.expires_at>v_now))
      or exists(select 1 from public.subscriptions s where s.user_id=p_user and s.plan_slug=v_plan.slug and s.status in ('active','trialing') and s.current_period_end>v_now and s.environment='live')
      or exists(select 1 from public.plan_credit_grants g where g.user_id=p_user and g.plan_slug=v_plan.slug and g.environment='live') into v_proof;
    if not v_proof then select * into v_plan from public.plans where slug = 'starter'; end if;
  elsif not found then select * into v_plan from public.plans where slug = 'starter'; end if;
  v_cap := v_plan.max_groq_requests;
  if v_cap is not null and v_cap <= 0 then raise exception 'groq_requests_used'; end if;
  insert into public.groq_request_usage as u (user_id, period, used) values (p_user, v_period, 1)
  on conflict (user_id, period) do update set used = u.used + 1, updated_at = clock_timestamp()
    where v_cap is null or u.used < v_cap
  returning u.used into v_used;
  if v_used is null then raise exception 'groq_requests_used'; end if;
  return jsonb_build_object('unlimited', false, 'used', v_used, 'limit', v_cap, 'period', v_period, 'resetsAt', v_reset);
end $$;
create or replace function public.groq_request_take() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'groq_requests_signed_out'; end if;
  return public.groq_request_take_for(auth.uid());
end $$;
revoke all on function public.groq_request_take_for(uuid) from public, anon, authenticated;
grant execute on function public.groq_request_take_for(uuid) to service_role;
revoke all on function public.groq_request_take() from public, anon;
grant execute on function public.groq_request_take() to authenticated, service_role;