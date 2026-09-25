create or replace function public.grant_owner_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(new.email) = 'klory.shaheen3@icloud.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.grant_owner_admin() from public, anon, authenticated;

create trigger on_auth_user_created_owner_admin
  after insert on auth.users
  for each row execute function public.grant_owner_admin();

insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where lower(email) = 'klory.shaheen3@icloud.com'
on conflict (user_id, role) do nothing;