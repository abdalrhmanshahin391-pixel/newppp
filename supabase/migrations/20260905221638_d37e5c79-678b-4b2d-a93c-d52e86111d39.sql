-- Private helpers: remove the implicit "anyone may run this" grant
revoke execute on function public.get_email_by_username(text) from public, anon, authenticated;
revoke execute on function public.admin_users_with_plans() from public, anon;
revoke execute on function public.can_manage_committee(uuid) from public, anon;
revoke execute on function public.deck_in_my_space(uuid, uuid) from public, anon;
revoke execute on function public.effective_plan(uuid) from public, anon;

-- Leftover migration-replay helpers: fixed search path
alter function zz.replay() set search_path = public;
alter function zz.replay(text, text) set search_path = public;
alter function zz.replay_stmts() set search_path = public;