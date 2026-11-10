-- Owner-controlled conversation titles and account-synced pins. Existing owner RLS applies.
alter table public.rita_free_conversations
  add column if not exists pinned_at timestamptz,
  add column if not exists title_is_custom boolean not null default false;

create or replace function public.refresh_rita_free_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_conversation uuid;
  first_user_text text;
begin
  if tg_op = 'DELETE' then
    target_conversation := old.conversation_id;
  else
    target_conversation := new.conversation_id;
  end if;

  select left(regexp_replace(btrim(message.content), '\s+', ' ', 'g'), 72)
    into first_user_text
  from public.rita_free_conversation_messages message
  where message.conversation_id = target_conversation
    and message.role = 'user'
  order by message.created_at, message.id
  limit 1;

  update public.rita_free_conversations conversation
  set message_count = (
        select count(*)::integer
        from public.rita_free_conversation_messages message
        where message.conversation_id = target_conversation
      ),
      last_message_at = (
        select max(message.created_at)
        from public.rita_free_conversation_messages message
        where message.conversation_id = target_conversation
      ),
      title = case
        when not conversation.title_is_custom and conversation.title = 'New conversation' and first_user_text is not null
          then first_user_text
        else conversation.title
      end,
      updated_at = now()
  where conversation.id = target_conversation;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

