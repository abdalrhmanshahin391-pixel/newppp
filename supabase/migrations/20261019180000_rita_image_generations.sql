-- Private image endpoint (/api/admin/generate-image): a usage log that enforces the hourly and
-- daily caps, and a private bucket for pictures the caller asked to keep.

create table if not exists public.rita_image_generations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'running' check (status in ('running', 'ok', 'error')),
  size text not null check (size in ('1024x1024', '1536x1024', '1024x1536')),
  quality text not null check (quality in ('medium', 'high')),
  style text not null check (style in ('raw', 'lesson')),
  prompt_preview text not null default '' check (char_length(prompt_preview) <= 120),
  bytes integer check (bytes is null or bytes >= 0),
  storage_path text,
  error text check (error is null or char_length(error) <= 300)
);

create index if not exists rita_image_generations_recent_idx
  on public.rita_image_generations (created_at desc);

-- Only the service role (the endpoint) writes; admins may read the log.
alter table public.rita_image_generations enable row level security;
drop policy if exists "admins read image log" on public.rita_image_generations;
create policy "admins read image log" on public.rita_image_generations
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

insert into storage.buckets (id, name, public)
values ('generated-images', 'generated-images', false)
on conflict (id) do nothing;

drop policy if exists "admins read generated images" on storage.objects;
create policy "admins read generated images" on storage.objects
  for select to authenticated
  using (bucket_id = 'generated-images' and public.has_role(auth.uid(), 'admin'::public.app_role));
