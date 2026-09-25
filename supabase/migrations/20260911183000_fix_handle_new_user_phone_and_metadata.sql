create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_name text;
  meta_username text;
  meta_phone text;
begin
  meta_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(coalesce(new.email, ''), '@', 1)
  );

  meta_username := coalesce(
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    split_part(coalesce(new.email, ''), '@', 1),
    new.id::text
  );

  meta_phone := coalesce(
    nullif(trim(new.raw_user_meta_data->>'phone'), ''),
    new.phone
  );

  insert into public.profiles (
    id,
    display_name,
    full_name,
    username,
    email,
    phone,
    avatar_url
  )
  values (
    new.id,
    meta_name,
    meta_name,
    meta_username,
    new.email,
    meta_phone,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    full_name = coalesce(nullif(trim(excluded.full_name), ''), profiles.full_name),
    username = coalesce(nullif(trim(excluded.username), ''), profiles.username),
    phone = coalesce(nullif(trim(excluded.phone), ''), profiles.phone),
    email = coalesce(excluded.email, profiles.email),
    avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url);

  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
