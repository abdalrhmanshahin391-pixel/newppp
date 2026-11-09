-- Test database only: extend the existing small Supabase stub with library dependencies.
alter table storage.buckets add column file_size_limit bigint;
alter table storage.buckets add column allowed_mime_types text[];
create function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
-- Match production: anon must not gain permission to call the protected role function.
revoke all on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant usage on schema public, auth, storage to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
insert into auth.users(id) values
 ('00000000-0000-4000-8000-0000000000a1'),
 ('00000000-0000-4000-8000-0000000000b1');
insert into public.user_roles(user_id, role) values
 ('00000000-0000-4000-8000-0000000000a1','admin'),
 ('00000000-0000-4000-8000-0000000000b1','user');
