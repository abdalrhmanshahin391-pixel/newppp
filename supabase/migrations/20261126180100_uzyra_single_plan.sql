-- One paid plan: Uzyra, $23 a month, 30 minutes of voice calls every day.
-- * plans.billing_months says how often a subscription renews: 3 (the older plans) or 1 (Uzyra).
--   The Paddle sync makes the plan's price with that cycle, so opening Admin → Plans after this
--   creates Uzyra's monthly $23 price in Paddle by itself.
-- * The older paid plans are hidden, not deleted: anyone subscribed to one keeps it until it ends,
--   and nobody new can buy it. The free plan stays as the start for every account.
begin;

alter table public.plans add column if not exists billing_months integer not null default 3;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'plans_billing_months_check') then
    alter table public.plans add constraint plans_billing_months_check check (billing_months in (1, 3));
  end if;
end $$;

-- Uzyra starts as a copy of Pro (every column, so nothing required is missed), then gets its own
-- name, price, billing and voice time. The admin can change the rest in Admin → Plans.
create temp table uzyra_plan on commit drop as select * from public.plans where slug = 'pro';
update uzyra_plan set
  slug = 'uzyra', name = 'Uzyra', tagline = 'Talk with Uzyra every day, and every study tool.',
  price_cents = 2300, yearly_cents = 0, once_cents = 0, currency = 'USD', sort = 2,
  published = true, highlight = true, billing_kind = 'monthly', billing_months = 1, cta_label = '',
  todo_full = true, rich_cards = true, max_flashcards = null, max_todo_tasks = null,
  max_calendar_items = null, max_groups = null,
  feature_ai_import = true, feature_review = true, feature_lecture_qgen = true, feature_all_in_one = true,
  perks = array[
    'Free conversation, path lessons and book study share it',
    'Path exercises: questions and film clips',
    'Lecture questions, PDF summaries and All-in-One',
    'Unlimited flashcards and word games',
    'Unlimited to-do, calendar and classrooms'
  ],
  free_talk_seconds = 1800, free_talk_period = 'daily', rita_voice_minutes_monthly = 900,
  paddle_price_monthly = null, paddle_price_yearly = null, paddle_price_once = null,
  ribbon_label = null, ribbon_color = null, compare_cents = null, offer_ends_at = null,
  created_at = now(), updated_at = now();
insert into public.plans select * from uzyra_plan
on conflict (slug) do update set
  price_cents = 2300, yearly_cents = 0, billing_months = 1, published = true,
  free_talk_seconds = 1800, free_talk_period = 'daily';

update public.plans set published = false
where slug in ('toolkit', 'study', 'boost', 'pro', 'ultimate');

-- The free plan: 10 minutes of calls to try Uzyra, once per account.
update public.plans set free_talk_seconds = 600, free_talk_period = 'lifetime', sort = 1
where slug = 'starter';

commit;
