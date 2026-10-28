create or replace function public.wake_rita_post_call()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare k text;
begin
  select trim(value) into k from public.site_secrets where key = 'worker_cron_key';
  if k is null then return new; end if;
  perform net.http_post(
    url := 'https://aeawoexywnyankbeqkmz.supabase.co/functions/v1/rita-review',
    headers := jsonb_build_object('Content-Type','application/json','x-worker-key',k),
    body := '{}'::jsonb, timeout_milliseconds := 150000);
  perform net.http_post(
    url := 'https://project--84f9560d-cda3-444b-b692-31491571e090.lovable.app/api/public/rita-replay',
    headers := jsonb_build_object('Content-Type','application/json','x-worker-key',k),
    body := '{}'::jsonb, timeout_milliseconds := 290000);
  return new;
exception when others then
  return new;
end;
$$;

revoke execute on function public.wake_rita_post_call() from public, anon, authenticated;

drop trigger if exists rita_v3_sessions_wake_post_call on public.rita_v3_sessions;
create trigger rita_v3_sessions_wake_post_call
after update of ended_at on public.rita_v3_sessions
for each row
when (old.ended_at is null and new.ended_at is not null)
execute function public.wake_rita_post_call();