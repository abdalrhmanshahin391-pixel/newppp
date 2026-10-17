-- Slides for Rita's curriculum lessons.
--
-- One row per lesson holds its slide deck (an ordered JSON array). Slides are
-- authoring material for admins: students do not read this table yet, and the
-- voice lesson itself does not depend on it. Keeping decks in their own table
-- means the existing lesson columns and queries stay exactly as they are.

create table if not exists public.rita_lesson_slides (
  lesson_id uuid primary key references public.rita_lessons (id) on delete cascade,
  slides jsonb not null default '[]'::jsonb,
  source text not null default 'ai' check (source in ('ai', 'manual')),
  model text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rita_lesson_slides_array check (jsonb_typeof(slides) = 'array')
);

alter table public.rita_lesson_slides enable row level security;

drop policy if exists "admins manage lesson slides" on public.rita_lesson_slides;
create policy "admins manage lesson slides" on public.rita_lesson_slides
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop trigger if exists rita_lesson_slides_updated_at on public.rita_lesson_slides;
create trigger rita_lesson_slides_updated_at before update on public.rita_lesson_slides
  for each row execute function public.set_updated_at();
