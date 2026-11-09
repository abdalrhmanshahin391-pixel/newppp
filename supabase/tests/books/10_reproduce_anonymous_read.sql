-- The regression must fail for the same reason as the real project before applying the fix.
set role anon;
do $$
begin
  begin
    perform id from public.books;
    raise exception 'Expected original anonymous SELECT to fail';
  exception when insufficient_privilege then
    if sqlerrm not like '%function has_role%' then raise; end if;
  end;
end $$;
reset role;
