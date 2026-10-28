-- Interactive study: one row per request a learner makes on the study page (explain, simplify, a
-- report...). Used for the generous limits and for diagnostics. It holds lengths and piece names,
-- never the conversation, and a report's note only when the learner wrote one.
-- Rows are written only through rita_study_take_quota, which checks the limits and writes in one
-- step, so two taps at the same moment can never pass a limit together.

create table if not exists public.rita_study_actions (
  request_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.rita_lessons (id) on delete cascade,
  guide_id uuid references public.rita_lesson_guides (id) on delete set null,
  action text not null check (char_length(action) between 1 and 40),
  quota_group text not null check (quota_group in ('explain', 'practice', 'cards', 'report')),
  block_ids text[] not null default '{}',
  selection_len integer not null default 0 check (selection_len between 0 and 4000),
  channel text check (channel in ('voice', 'text')),
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists rita_study_actions_quota
  on public.rita_study_actions (user_id, quota_group, created_at desc);
create index if not exists rita_study_actions_reports
  on public.rita_study_actions (lesson_id, created_at desc) where quota_group = 'report';

alter table public.rita_study_actions enable row level security;

drop policy if exists "learners read their study actions" on public.rita_study_actions;
create policy "learners read their study actions" on public.rita_study_actions
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::public.app_role));

-- Generous limits (the same numbers are in src/lib/study/study-limits.ts; a test keeps them equal).
-- A day starts at midnight in Amman. Admins are never limited.
create or replace function public.rita_study_take_quota(
  _request_id uuid,
  _lesson_id uuid,
  _guide_id uuid,
  _action text,
  _quota_group text,
  _block_ids text[],
  _selection_len integer,
  _channel text,
  _note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  per_min integer;
  per_day integer;
  used_min integer;
  used_day integer;
  day_start timestamptz;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  if _request_id is null or _lesson_id is null
    or char_length(coalesce(_action, '')) not between 1 and 40
    or coalesce(array_length(_block_ids, 1), 0) > 12
    or char_length(coalesce(_note, '')) > 1000 then
    return jsonb_build_object('ok', false, 'code', 'bad_request');
  end if;

  case _quota_group
    when 'explain' then
      per_min := 20;
      per_day := 400;
    when 'practice' then
      per_min := 4;
      per_day := 40;
    when 'cards' then
      per_min := 6;
      per_day := 60;
    when 'report' then
      per_min := 5;
      per_day := 30;
    else
      return jsonb_build_object('ok', false, 'code', 'bad_request');
  end case;

  if not public.has_role(uid, 'admin'::public.app_role) then
    -- One learner's requests are counted one at a time.
    perform pg_advisory_xact_lock(hashtext('rita_study_quota:' || uid::text));
    day_start := date_trunc('day', now() at time zone 'Asia/Amman') at time zone 'Asia/Amman';
    select
      count(*) filter (where created_at > now() - interval '1 minute'),
      count(*) filter (where created_at >= day_start)
    into used_min, used_day
    from public.rita_study_actions
    where user_id = uid
      and quota_group = _quota_group
      and created_at >= least(day_start, now() - interval '1 minute');
    if used_day >= per_day then
      return jsonb_build_object(
        'ok', false, 'code', 'rate_limited', 'scope', 'day',
        'retry_after', ceil(extract(epoch from (day_start + interval '1 day' - now())))::integer
      );
    end if;
    if used_min >= per_min then
      return jsonb_build_object('ok', false, 'code', 'rate_limited', 'scope', 'minute', 'retry_after', 60);
    end if;
  end if;

  insert into public.rita_study_actions (
    request_id, user_id, lesson_id, guide_id, action, quota_group, block_ids, selection_len,
    channel, note
  ) values (
    _request_id, uid, _lesson_id, _guide_id, _action, _quota_group, coalesce(_block_ids, '{}'),
    greatest(0, least(coalesce(_selection_len, 0), 4000)),
    case when _channel in ('voice', 'text') then _channel else null end,
    nullif(btrim(coalesce(_note, '')), '')
  )
  on conflict (request_id) do nothing;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.rita_study_take_quota(uuid, uuid, uuid, text, text, text[], integer, text, text) from public;
grant execute on function public.rita_study_take_quota(uuid, uuid, uuid, text, text, text[], integer, text, text) to authenticated;
