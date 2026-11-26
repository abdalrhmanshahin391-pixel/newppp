-- Four paid plans, all monthly, each with the same profit share as Uzyra:
--   Uzyra $23: 30 min of calls a day, 1,000 Groq requests a month
--   Plus  $30: 40 min a day, 1,500 requests
--   Pro   $40: 50 min a day, 2,000 requests
--   Max   $50: 60 min a day, 3,000 requests
-- The free plan: 10 minutes of calls once, 30 requests a month.
-- Plus, Pro and Max start as copies of Uzyra (every column), then get their own price and time.
-- Opening Admin → Plans afterwards creates their monthly prices in Paddle.
begin;

update public.plans set
  max_groq_requests = 1000,
  perks = array['Free conversation with Uzyra', 'Path lessons by voice', 'Book study with Uzyra', 'Path exercises']
where slug = 'uzyra';
update public.plans set max_groq_requests = 30 where slug = 'starter';

create temp table uzyra_ladder on commit drop as select * from public.plans where slug = 'uzyra';

create or replace function pg_temp.add_rung(p_slug text, p_name text, p_tagline text, p_cents integer,
  p_sort integer, p_seconds integer, p_requests integer) returns void language plpgsql as $$
begin
  truncate pg_temp.uzyra_ladder;
  insert into pg_temp.uzyra_ladder select * from public.plans where slug = 'uzyra';
  update pg_temp.uzyra_ladder set
    slug = p_slug, name = p_name, tagline = p_tagline, price_cents = p_cents, yearly_cents = 0,
    once_cents = 0, sort = p_sort, highlight = false, published = true, billing_months = 1,
    free_talk_seconds = p_seconds, free_talk_period = 'daily', max_groq_requests = p_requests,
    rita_voice_minutes_monthly = p_seconds / 60 * 30,
    paddle_price_monthly = null, paddle_price_yearly = null, paddle_price_once = null,
    created_at = now(), updated_at = now();
  insert into public.plans select * from pg_temp.uzyra_ladder
  on conflict (slug) do update set
    price_cents = excluded.price_cents, yearly_cents = 0, billing_months = 1, published = true,
    free_talk_seconds = excluded.free_talk_seconds, free_talk_period = 'daily',
    max_groq_requests = excluded.max_groq_requests, sort = excluded.sort;
end $$;

select pg_temp.add_rung('uzyra_plus', 'Uzyra Plus', 'More time with Uzyra every day.', 3000, 3, 2400, 1500);
select pg_temp.add_rung('uzyra_pro', 'Uzyra Pro', 'For learners who talk every day.', 4000, 4, 3000, 2000);
select pg_temp.add_rung('uzyra_max', 'Uzyra Max', 'A full hour with Uzyra every day.', 5000, 5, 3600, 3000);

commit;
