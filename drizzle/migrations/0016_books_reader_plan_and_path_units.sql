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

alter table public.rita_path_items drop constraint if exists rita_path_items_kind_check;
alter table public.rita_path_items
  add constraint rita_path_items_kind_check
  check (kind in ('exercises', 'resources', 'finish', 'unit'));