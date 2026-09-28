-- Make Rita's key upsert target explicit and idempotent on fresh Lovable projects.
alter table public.admin_ai_keys
  add column if not exists purpose text not null default 'shared';

create unique index if not exists admin_ai_keys_provider_slot_purpose_uidx
  on public.admin_ai_keys (provider, slot, purpose);

grant select, insert, update, delete on public.admin_ai_keys to authenticated;
grant all on public.admin_ai_keys to service_role;

alter table public.admin_ai_keys enable row level security;

drop policy if exists "Admins manage AI keys" on public.admin_ai_keys;
drop policy if exists "admins manage ai keys" on public.admin_ai_keys;
create policy "Admins manage AI keys"
  on public.admin_ai_keys
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));
