alter table public.plans
  add column if not exists billing_kind text not null default 'monthly',
  add column if not exists once_cents integer not null default 0,
  add column if not exists paddle_price_monthly text,
  add column if not exists paddle_price_yearly text,
  add column if not exists paddle_price_once text;

do $$ begin
  alter table public.plans add constraint plans_billing_kind_chk check (billing_kind in ('monthly','lifetime'));
exception when duplicate_object then null; end $$;

create table if not exists public.plan_credit_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  plan_slug text not null,
  transaction_id text not null unique,
  environment text not null default 'sandbox',
  flashcards integer not null default 0,
  ai_questions integer not null default 0,
  summaries integer not null default 0,
  todo_tasks integer not null default 0,
  calendar_items integer not null default 0,
  all_in_one_lectures integer not null default 0,
  all_in_one_questions integer not null default 0,
  archive_questions integer not null default 0,
  rita_questions integer not null default 0,
  groups integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_plan_credit_grants_user on public.plan_credit_grants(user_id);

grant select on public.plan_credit_grants to authenticated;
grant all on public.plan_credit_grants to service_role;

alter table public.plan_credit_grants enable row level security;

do $$ begin
  create policy "Students read their own credit grants"
    on public.plan_credit_grants for select
    to authenticated
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  paddle_subscription_id text not null unique,
  paddle_customer_id text,
  product_id text,
  price_id text,
  plan_slug text,
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  environment text not null default 'sandbox',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_user_id on public.subscriptions(user_id);

grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;

alter table public.subscriptions enable row level security;

do $$ begin
  create policy "Students read their own subscriptions"
    on public.subscriptions for select
    to authenticated
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

create or replace function public.my_plan_usage()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
DECLARE
  _uid uuid := auth.uid();
  _slug text;
  _plan public.plans%ROWTYPE;
  _usage public.usage_counters%ROWTYPE;
  _admin boolean;
  _g jsonb;
BEGIN
  IF _uid IS NULL THEN
    RETURN NULL;
  END IF;

  _admin := public.has_role(_uid, 'admin');

  SELECT plan_slug INTO _slug FROM public.user_plans WHERE user_id = _uid;
  IF _slug IS NULL THEN
    _slug := 'starter';
  END IF;

  SELECT * INTO _plan FROM public.plans WHERE slug = _slug;
  IF _plan.slug IS NULL THEN
    SELECT * INTO _plan FROM public.plans WHERE published ORDER BY sort LIMIT 1;
  END IF;

  SELECT * INTO _usage FROM public.usage_counters
   WHERE user_id = _uid AND period = 'lifetime';

  SELECT jsonb_build_object(
    'summaries', COALESCE(SUM(summaries),0),
    'ai_questions', COALESCE(SUM(ai_questions),0),
    'flashcards', COALESCE(SUM(flashcards),0),
    'todo_tasks', COALESCE(SUM(todo_tasks),0),
    'calendar_items', COALESCE(SUM(calendar_items),0),
    'all_in_one_lectures', COALESCE(SUM(all_in_one_lectures),0),
    'all_in_one_questions', COALESCE(SUM(all_in_one_questions),0),
    'archive_questions', COALESCE(SUM(archive_questions),0),
    'rita_questions', COALESCE(SUM(rita_questions),0),
    'groups', COALESCE(SUM(groups),0)
  ) INTO _g
  FROM public.plan_credit_grants WHERE user_id = _uid;

  RETURN jsonb_build_object(
    'plan', to_jsonb(_plan),
    'grants', COALESCE(_g, '{}'::jsonb),
    'usage', jsonb_build_object(
      'summaries', COALESCE(_usage.summaries, 0),
      'ai_questions', COALESCE(_usage.ai_questions, 0),
      'flashcards', COALESCE(_usage.flashcards, 0),
      'todo_tasks', COALESCE(_usage.todo_tasks, 0),
      'calendar_items', COALESCE(_usage.calendar_items, 0),
      'all_in_one_lectures', COALESCE(_usage.all_in_one_lectures, 0),
      'all_in_one_questions', COALESCE(_usage.all_in_one_questions, 0),
      'archive_questions', COALESCE(_usage.archive_questions, 0),
      'rita_questions', COALESCE(_usage.rita_questions, 0),
      'groups', COALESCE(_usage.groups, 0)
    ),
    'is_admin', _admin
  );
END;
$fn$;