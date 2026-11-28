-- Plan quotas, one rule for both allowances (Nov 2026):
-- * Emith (Groq) requests a month and call minutes come from the same plan: the learner's plan when
--   it is free, or when it is paid and the payment or an admin grant is proven; otherwise the free
--   plan. (Before, an unproven paid plan gave the free requests but made the voice time fail.)
-- * Proof: an admin grant in force, a live Paddle subscription that is active or trialing (one day
--   of grace after its period end, for a late renewal message), or a live one-time purchase.
--   Sandbox (test) payments never count.
-- * Admins have no limit on either.
-- * groq_request_status(): what the signed-in learner has left this month, without taking any.
-- * Plans with no request number get one (only where it is empty; numbers set in Admin → Plans
--   are kept): Free 30, Uzyra 1,000, Plus 1,500, Pro 2,000, Max 3,000, Books Reader 10,000; any
--   other plan 30 when free and 1,000 when paid.
-- Needs 20261127200000_voice_board_time.sql (one voice time for calls and the whiteboard).
-- Idempotent: safe to run more than once.
begin;

alter table public.plans add column if not exists max_groq_requests integer;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'plans_max_groq_requests_check') then
    alter table public.plans add constraint plans_max_groq_requests_check
      check (max_groq_requests is null or max_groq_requests >= 0);
  end if;
end $$;

update public.plans set max_groq_requests = case slug
    when 'starter' then 30
    when 'uzyra' then 1000
    when 'uzyra_plus' then 1500
    when 'uzyra_pro' then 2000
    when 'uzyra_max' then 3000
    when 'books_reader' then 10000
    else case
      when coalesce(price_cents, 0) > 0 or coalesce(yearly_cents, 0) > 0 or coalesce(once_cents, 0) > 0
        then 1000
      else 30
    end
  end
where max_groq_requests is null;

create table if not exists public.groq_request_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null,
  used integer not null default 0 check (used >= 0),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, period)
);
alter table public.groq_request_usage enable row level security;
revoke all on public.groq_request_usage from public, anon, authenticated;
grant all on public.groq_request_usage to service_role;

-- The plan whose allowances apply right now (see the rule above).
create or replace function public.quota_plan_slug(p_user uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := clock_timestamp();
  v_plan public.plans%rowtype;
begin
  select * into v_plan from public.plans where slug = public.effective_plan_slug(p_user);
  if not found then return 'starter'; end if;
  if coalesce(v_plan.price_cents, 0) <= 0 and coalesce(v_plan.yearly_cents, 0) <= 0
     and coalesce(v_plan.once_cents, 0) <= 0 then
    return v_plan.slug;
  end if;
  if exists (select 1 from public.manual_plan_grants g
             where g.user_id = p_user and g.plan_slug = v_plan.slug and g.revoked_at is null
               and g.starts_at <= v_now and (g.expires_at is null or g.expires_at > v_now))
     or exists (select 1 from public.subscriptions s
                where s.user_id = p_user and s.plan_slug = v_plan.slug
                  and s.status in ('active', 'trialing') and s.environment = 'live'
                  and s.current_period_end > v_now - interval '1 day')
     or exists (select 1 from public.plan_credit_grants g
                where g.user_id = p_user and g.plan_slug = v_plan.slug and g.environment = 'live') then
    return v_plan.slug;
  end if;
  return 'starter';
end $$;

-- Voice time (calls and the whiteboard), from the same plan as the requests.
create or replace function public.free_talk_budget(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.plans%rowtype; v_key text; v_cap integer; v_used bigint; v_board bigint;
  v_active public.free_talk_sessions%rowtype; v_now timestamptz := clock_timestamp();
  v_admin boolean; v_reset timestamptz;
begin
  v_admin := coalesce(public.has_role(p_user, 'admin'), false);
  if not v_admin and not exists (select 1 from auth.users where id = p_user and email_confirmed_at is not null) then
    raise exception 'free_talk_email_unverified';
  end if;
  if v_admin then
    v_key := 'admin'; v_cap := null;
  else
    select * into v_plan from public.plans where slug = public.quota_plan_slug(p_user);
    if not found then raise exception 'free_talk_plan_unavailable'; end if;
    v_cap := v_plan.free_talk_seconds;
    if v_plan.free_talk_period = 'lifetime' then
      v_key := 'lifetime';
    elsif v_plan.free_talk_period = 'daily' then
      -- A day in Amman; the key is the date, so a new day starts with the whole allowance.
      v_key := to_char(v_now at time zone 'Asia/Amman', 'YYYY-MM-DD');
      v_reset := (date_trunc('day', v_now at time zone 'Asia/Amman') + interval '1 day') at time zone 'Asia/Amman';
    else
      v_key := to_char(v_now at time zone 'UTC', 'YYYY-MM');
      v_reset := (date_trunc('month', v_now at time zone 'UTC') + interval '1 month') at time zone 'UTC';
    end if;
  end if;
  -- Calls: the whole call by the server's clock (an open call counts all it reserved).
  select coalesce(sum(coalesce(charged_seconds, reserved_seconds)), 0) into v_used
    from public.free_talk_sessions where user_id = p_user and period_key = v_key;
  -- Whiteboard clips: their exact lengths, counted up to the next whole second.
  select coalesce(sum(milliseconds), 0) into v_board
    from public.voice_board_charges where user_id = p_user and period_key = v_key;
  v_used := v_used + ceil(v_board / 1000.0)::bigint;
  select * into v_active from public.free_talk_sessions
    where user_id = p_user and state <> 'closed' and deadline > v_now order by created_at desc limit 1;
  return jsonb_build_object(
    'unlimited', v_admin,
    'plan', case when v_admin then 'admin' else v_plan.slug end,
    'limitSeconds', v_cap,
    'availableSeconds', case when v_admin then null else greatest(0, v_cap - v_used) end,
    'remainingSeconds', case when v_admin then null else greatest(0, v_cap - v_used)
      + case when v_active.period_key = v_key
          then greatest(0, floor(extract(epoch from v_active.deadline - v_now))::integer) else 0 end end,
    'boardSeconds', ceil(v_board / 1000.0)::bigint,
    'enabled', coalesce((select enabled from public.free_talk_config where id), false),
    'period', v_key, 'resetsAt', v_reset, 'serverNow', v_now,
    'activeSessionId', v_active.id, 'activeDeadline', v_active.deadline);
end $$;

-- One Emith request: taken before the model is asked, never past the plan's number.
create or replace function public.groq_request_take_for(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := clock_timestamp();
  v_period text := to_char(v_now at time zone 'Asia/Amman', 'YYYY-MM');
  v_reset timestamptz := (date_trunc('month', v_now at time zone 'Asia/Amman') + interval '1 month') at time zone 'Asia/Amman';
  v_slug text; v_cap integer; v_used integer;
begin
  if p_user is null then raise exception 'groq_requests_signed_out'; end if;
  if coalesce(public.has_role(p_user, 'admin'), false) then
    return jsonb_build_object('unlimited', true, 'plan', 'admin', 'used', null, 'limit', null,
      'left', null, 'period', v_period, 'resetsAt', v_reset);
  end if;
  v_slug := public.quota_plan_slug(p_user);
  select max_groq_requests into v_cap from public.plans where slug = v_slug;
  if not found then raise exception 'groq_requests_unavailable'; end if;
  if v_cap is not null and v_cap <= 0 then raise exception 'groq_requests_used'; end if;
  insert into public.groq_request_usage as u (user_id, period, used) values (p_user, v_period, 1)
  on conflict (user_id, period) do update set used = u.used + 1, updated_at = clock_timestamp()
    where v_cap is null or u.used < v_cap
  returning u.used into v_used;
  if v_used is null then raise exception 'groq_requests_used'; end if;
  return jsonb_build_object('unlimited', false, 'plan', v_slug, 'used', v_used, 'limit', v_cap,
    'left', case when v_cap is null then null else greatest(0, v_cap - v_used) end,
    'period', v_period, 'resetsAt', v_reset);
end $$;

create or replace function public.groq_request_take() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'groq_requests_signed_out'; end if;
  return public.groq_request_take_for(auth.uid());
end $$;

-- What is left this month, without taking any.
create or replace function public.groq_request_status_for(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := clock_timestamp();
  v_period text := to_char(v_now at time zone 'Asia/Amman', 'YYYY-MM');
  v_reset timestamptz := (date_trunc('month', v_now at time zone 'Asia/Amman') + interval '1 month') at time zone 'Asia/Amman';
  v_slug text; v_cap integer; v_used integer;
begin
  if p_user is null then raise exception 'groq_requests_signed_out'; end if;
  if coalesce(public.has_role(p_user, 'admin'), false) then
    return jsonb_build_object('unlimited', true, 'plan', 'admin', 'used', null, 'limit', null,
      'left', null, 'period', v_period, 'resetsAt', v_reset);
  end if;
  v_slug := public.quota_plan_slug(p_user);
  select max_groq_requests into v_cap from public.plans where slug = v_slug;
  if not found then raise exception 'groq_requests_unavailable'; end if;
  select used into v_used from public.groq_request_usage where user_id = p_user and period = v_period;
  v_used := coalesce(v_used, 0);
  return jsonb_build_object('unlimited', false, 'plan', v_slug, 'used', v_used, 'limit', v_cap,
    'left', case when v_cap is null then null else greatest(0, v_cap - v_used) end,
    'period', v_period, 'resetsAt', v_reset);
end $$;

create or replace function public.groq_request_status() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'groq_requests_signed_out'; end if;
  return public.groq_request_status_for(auth.uid());
end $$;

-- Server only, except the two that act for the signed-in learner on their own account.
revoke all on function public.quota_plan_slug(uuid) from public, anon, authenticated;
grant execute on function public.quota_plan_slug(uuid) to service_role;
revoke all on function public.free_talk_budget(uuid) from public, anon, authenticated;
grant execute on function public.free_talk_budget(uuid) to service_role;
revoke all on function public.groq_request_take_for(uuid) from public, anon, authenticated;
grant execute on function public.groq_request_take_for(uuid) to service_role;
revoke all on function public.groq_request_status_for(uuid) from public, anon, authenticated;
grant execute on function public.groq_request_status_for(uuid) to service_role;
revoke all on function public.groq_request_take() from public, anon;
grant execute on function public.groq_request_take() to authenticated, service_role;
revoke all on function public.groq_request_status() from public, anon;
grant execute on function public.groq_request_status() to authenticated, service_role;

commit;
