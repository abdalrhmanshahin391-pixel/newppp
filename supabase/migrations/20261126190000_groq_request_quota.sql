-- Groq requests a month, by plan.
-- Every written answer from Uzyra's model on Groq counts as one request: explaining a line or
-- translating a page in a book, checking an exercise, a word game round, a whiteboard step.
-- Voice calls do not count here: they are measured in minutes (free_talk_*).
-- * plans.max_groq_requests: the monthly cap (null = no cap).
-- * groq_request_usage: one row per learner and month (Amman time).
-- * groq_request_take(): the signed-in learner takes one request, or gets 'groq_requests_used'.
begin;

alter table public.plans add column if not exists max_groq_requests integer;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'plans_max_groq_requests_check') then
    alter table public.plans add constraint plans_max_groq_requests_check
      check (max_groq_requests is null or max_groq_requests >= 0);
  end if;
end $$;

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
    -- A paid plan counts only with server-checked payment or grant evidence; else the free cap.
    select exists(select 1 from public.manual_plan_grants g where g.user_id=p_user and g.plan_slug=v_plan.slug and g.revoked_at is null and g.starts_at<=v_now and (g.expires_at is null or g.expires_at>v_now))
      or exists(select 1 from public.subscriptions s where s.user_id=p_user and s.plan_slug=v_plan.slug and s.status in ('active','trialing') and s.current_period_end>v_now and s.environment='live')
      or exists(select 1 from public.plan_credit_grants g where g.user_id=p_user and g.plan_slug=v_plan.slug and g.environment='live') into v_proof;
    if not v_proof then
      select * into v_plan from public.plans where slug = 'starter';
    end if;
  elsif not found then
    select * into v_plan from public.plans where slug = 'starter';
  end if;
  v_cap := v_plan.max_groq_requests;
  if v_cap is not null and v_cap <= 0 then raise exception 'groq_requests_used'; end if;
  insert into public.groq_request_usage as u (user_id, period, used) values (p_user, v_period, 1)
  on conflict (user_id, period) do update set used = u.used + 1, updated_at = clock_timestamp()
    where v_cap is null or u.used < v_cap
  returning u.used into v_used;
  if v_used is null then raise exception 'groq_requests_used'; end if;
  return jsonb_build_object('unlimited', false, 'used', v_used, 'limit', v_cap, 'period', v_period, 'resetsAt', v_reset);
end $$;

-- The signed-in learner's own request: the website calls this with the learner's session.
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
commit;
