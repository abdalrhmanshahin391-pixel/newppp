-- Isolated synthetic users and conversations only, in conversation_management_test.
begin;
insert into auth.users values ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002');
insert into public.rita_free_conversations(id,user_id) values
 ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
update public.rita_free_conversations set title='New conversation', title_is_custom=true, pinned_at=now()
where id='10000000-0000-4000-8000-000000000001';
insert into public.rita_free_conversation_messages(client_message_id,conversation_id,user_id,role,content)
values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','user','First learner message');
do $$
declare affected integer;
begin
  if not exists(select 1 from public.rita_free_conversations where title='New conversation' and title_is_custom and pinned_at is not null and message_count=1) then
    raise exception 'Custom placeholder title or pin was overwritten by a message';
  end if;
  if exists(select 1 from public.rita_free_conversations where user_id='00000000-0000-4000-8000-000000000002') then raise exception 'Foreign conversation exposed'; end if;
  update public.rita_free_conversations set title='Foreign write' where id='10000000-0000-4000-8000-000000000002';
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Foreign rename allowed'; end if;
  update public.rita_free_conversations set pinned_at=now() where id='10000000-0000-4000-8000-000000000002';
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Foreign pin allowed'; end if;
  delete from public.rita_free_conversations where id='10000000-0000-4000-8000-000000000002';
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Foreign delete allowed'; end if;
  begin
    update public.rita_free_conversations set title='' where id='10000000-0000-4000-8000-000000000001';
    raise exception 'Empty title accepted';
  exception when check_violation then null;
  end;
end $$;
update public.rita_free_conversations set title='مراجعة الجامعة',pinned_at=null where id='10000000-0000-4000-8000-000000000001';
do $$ begin
  if not exists(select 1 from public.rita_free_conversations where title='مراجعة الجامعة' and pinned_at is null) then raise exception 'Owner rename/unpin failed'; end if;
end $$;
delete from public.rita_free_conversations where id='10000000-0000-4000-8000-000000000001';
do $$ begin
  if exists(select 1 from public.rita_free_conversation_messages) then raise exception 'Messages did not cascade'; end if;
end $$;
reset role;
do $$ begin
  if not exists(select 1 from public.rita_free_conversations where id='10000000-0000-4000-8000-000000000002' and title='New conversation' and pinned_at is null) then raise exception 'Foreign data changed'; end if;
end $$;
rollback;
