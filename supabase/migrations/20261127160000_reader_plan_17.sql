-- Books Reader: a plan for readers, apart from the four Uzyra plans.
--   $17 a month, 10,000 Groq requests a month (reset on the 1st, Amman time), no voice calls.
-- It starts as a copy of Uzyra (every column), then gets its own price, allowance and wording.
-- Opening Admin → Plans afterwards creates its monthly price in Paddle. Safe to run again.
begin;

create temp table books_reader_plan on commit drop as
  select * from public.plans where slug = 'uzyra';

update pg_temp.books_reader_plan set
  slug = 'books_reader',
  name = 'Books Reader',
  tagline = 'For readers: Uzyra beside every page, 10,000 times a month.',
  price_cents = 1700,
  yearly_cents = 0,
  once_cents = 0,
  sort = 6,
  highlight = false,
  published = true,
  billing_months = 1,
  free_talk_seconds = 0,
  free_talk_period = 'daily',
  rita_voice_minutes_monthly = 0,
  max_groq_requests = 10000,
  perks = array['Book study with Uzyra', 'Explain any line', 'Meaning and pronunciation', 'Flashcards from any page'],
  paddle_price_monthly = null,
  paddle_price_yearly = null,
  paddle_price_once = null,
  created_at = now(),
  updated_at = now();

insert into public.plans select * from pg_temp.books_reader_plan
on conflict (slug) do update set
  name = excluded.name,
  tagline = excluded.tagline,
  price_cents = excluded.price_cents,
  yearly_cents = 0,
  billing_months = 1,
  published = true,
  sort = excluded.sort,
  free_talk_seconds = 0,
  free_talk_period = 'daily',
  rita_voice_minutes_monthly = 0,
  max_groq_requests = excluded.max_groq_requests,
  perks = excluded.perks;

commit;
