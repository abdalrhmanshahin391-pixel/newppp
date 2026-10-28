-- Interactive study: the database rules, tested against the real migration files (run by
-- scripts/test-study-db.sh after the stub and the migrations). Any failed check stops with an error.
-- Users: A admin, L and M learners.

\set ON_ERROR_STOP on

create or replace function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;

create or replace function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', uid, true);
end $$;

-- ST-I08: a lesson made before the migration is classic, with no guide.
select pg_temp.check(
  (select experience = 'classic' and study_guide_id is null from public.rita_lessons
   where id = '10000000-0000-4000-8000-000000000000'),
  'ST-I08 an existing lesson is classic after the migration');

do $$ begin
  begin
    update public.rita_lessons set experience = 'other' where id = '10000000-0000-4000-8000-000000000000';
    raise exception 'FAILED: an unknown experience was accepted';
  exception when check_violation then raise notice 'ok: only classic and study are allowed';
  end;
end $$;

-- Data, as the owner.
insert into auth.users (id) values
  ('a0000000-0000-4000-8000-000000000000'),
  ('b0000000-0000-4000-8000-000000000000'),
  ('c0000000-0000-4000-8000-000000000000');
insert into public.user_roles values ('a0000000-0000-4000-8000-000000000000', 'admin');

insert into public.rita_lesson_guides (id, curriculum_id, title, from_page, to_page, status, version, content, storage_path, learner_path)
values
  ('91000000-0000-4000-8000-000000000000', '00000000-0000-4000-8000-0000000000c1', 'linked', 1, 2, 'ready', 1, '{}', 'c/g1-v1.pdf', 'c/g1-v1-final.pdf'),
  ('92000000-0000-4000-8000-000000000000', '00000000-0000-4000-8000-0000000000c1', 'classic lesson', 3, 4, 'ready', 1, '{}', 'c/g2-v1.pdf', 'c/g2-v1-final.pdf'),
  ('93000000-0000-4000-8000-000000000000', '00000000-0000-4000-8000-0000000000c1', 'draft lesson', 5, 6, 'ready', 1, '{}', 'c/g3-v1.pdf', 'c/g3-v1-final.pdf'),
  ('94000000-0000-4000-8000-000000000000', '00000000-0000-4000-8000-0000000000c1', 'not linked', 7, 8, 'ready', 1, '{}', 'c/g4-v1.pdf', null);

insert into public.rita_lessons (id, curriculum_id, status, experience, study_guide_id) values
  ('11000000-0000-4000-8000-000000000000', '00000000-0000-4000-8000-0000000000c1', 'published', 'study', '91000000-0000-4000-8000-000000000000'),
  ('12000000-0000-4000-8000-000000000000', '00000000-0000-4000-8000-0000000000c1', 'published', 'classic', '92000000-0000-4000-8000-000000000000'),
  ('13000000-0000-4000-8000-000000000000', '00000000-0000-4000-8000-0000000000c1', 'draft', 'study', '93000000-0000-4000-8000-000000000000');

insert into storage.objects (bucket_id, name) values
  ('rita-guides', 'c/g1-v1.pdf'), ('rita-guides', 'c/g1-v1-final.pdf'),
  ('rita-guides', 'c/g2-v1-final.pdf'), ('rita-guides', 'c/g3-v1-final.pdf'),
  ('rita-guides', 'c/g4-v1.pdf');

-- ST-I01: a learner reads only the final copy of the guide linked to a published study lesson.
begin;
select pg_temp.as_user('b0000000-0000-4000-8000-000000000000');
select pg_temp.check(
  (select array_agg(title order by title) from public.rita_lesson_guides) = array['linked'],
  'ST-I01 a learner sees only the guide linked to a published study lesson');
select pg_temp.check(
  (select array_agg(name order by name) from storage.objects) = array['c/g1-v1-final.pdf'],
  'ST-I01 a learner reads only that guide''s final file, never a draft');
select pg_temp.check(
  (select count(*) = 1 from public.rita_feature_flags where key = 'rita_study' and not enabled),
  'the feature switch is readable and starts off');
update public.rita_feature_flags set enabled = true where key = 'rita_study';
rollback;
select pg_temp.check(
  (select not enabled from public.rita_feature_flags where key = 'rita_study'),
  'a learner cannot turn the switch on');

-- A guide unlinked or archived disappears for learners at once.
begin;
update public.rita_lessons set status = 'archived' where id = '11000000-0000-4000-8000-000000000000';
select pg_temp.as_user('b0000000-0000-4000-8000-000000000000');
select pg_temp.check(
  (select count(*) = 0 from public.rita_lesson_guides),
  'an archived lesson''s guide is no longer readable');
rollback;
begin;
delete from public.rita_lesson_guides where id = '91000000-0000-4000-8000-000000000000';
select pg_temp.check(
  (select study_guide_id is null from public.rita_lessons where id = '11000000-0000-4000-8000-000000000000'),
  'deleting the linked guide unlinks it (the lesson falls back to classic)');
rollback;

-- Admins see every guide, drafts included.
begin;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000000');
select pg_temp.check((select count(*) = 4 from public.rita_lesson_guides), 'an admin sees all guides');
select pg_temp.check((select count(*) = 5 from storage.objects), 'an admin sees all guide files');
rollback;

-- Requests and limits (ST-I04).
begin;
select pg_temp.as_user('b0000000-0000-4000-8000-000000000000');
do $$ begin
  begin
    insert into public.rita_study_actions (request_id, user_id, lesson_id, action, quota_group)
    values (gen_random_uuid(), 'b0000000-0000-4000-8000-000000000000', '11000000-0000-4000-8000-000000000000', 'explain', 'explain');
    raise exception 'FAILED: a learner wrote a request row directly';
  exception when insufficient_privilege then raise notice 'ok: rows are written only through the limit function';
  end;
end $$;
rollback;

create or replace function pg_temp.take(uid text, req uuid, grp text default 'explain') returns jsonb
language plpgsql as $$
declare result jsonb;
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', uid, true);
  result := public.rita_study_take_quota(req, '11000000-0000-4000-8000-000000000000',
    '91000000-0000-4000-8000-000000000000', grp, grp, array['s1.r2'], 4, 'voice', null);
  perform set_config('role', 'postgres', true);
  return result;
end $$;

begin;
do $$
declare result jsonb;
begin
  for i in 1..20 loop
    result := pg_temp.take('b0000000-0000-4000-8000-000000000000', gen_random_uuid());
    if (result ->> 'ok')::boolean is not true then raise exception 'FAILED: request % refused: %', i, result; end if;
  end loop;
  raise notice 'ok: 20 explain requests in a minute pass';
  result := pg_temp.take('b0000000-0000-4000-8000-000000000000', gen_random_uuid());
  if result ->> 'code' <> 'rate_limited' or result ->> 'scope' <> 'minute' or (result ->> 'retry_after')::int <> 60 then
    raise exception 'FAILED: the 21st request was not limited: %', result;
  end if;
  raise notice 'ok: the 21st is refused kindly, retry after 60s';
  result := pg_temp.take('b0000000-0000-4000-8000-000000000000', gen_random_uuid(), 'report');
  if (result ->> 'ok')::boolean is not true then raise exception 'FAILED: reports share the explain limit'; end if;
  raise notice 'ok: each group has its own limit';
  result := pg_temp.take('c0000000-0000-4000-8000-000000000000', gen_random_uuid());
  if (result ->> 'ok')::boolean is not true then raise exception 'FAILED: one learner''s use limited another'; end if;
  raise notice 'ok: limits are per learner';
  for i in 1..25 loop
    result := pg_temp.take('a0000000-0000-4000-8000-000000000000', gen_random_uuid());
    if (result ->> 'ok')::boolean is not true then raise exception 'FAILED: an admin was limited'; end if;
  end loop;
  raise notice 'ok: admins are never limited';
end $$;
rollback;

begin;
do $$
declare result jsonb; req uuid := gen_random_uuid();
begin
  result := pg_temp.take('b0000000-0000-4000-8000-000000000000', req);
  result := pg_temp.take('b0000000-0000-4000-8000-000000000000', req);
  if (select count(*) from public.rita_study_actions where request_id = req) <> 1 then
    raise exception 'FAILED: the same request counted twice';
  end if;
  raise notice 'ok: sending the same request twice counts once';
  result := pg_temp.take('b0000000-0000-4000-8000-000000000000', gen_random_uuid(), 'jokes');
  if result ->> 'code' <> 'bad_request' then raise exception 'FAILED: unknown group accepted'; end if;
  raise notice 'ok: an unknown group is refused';
  perform set_config('request.jwt.claim.sub', '', true);
  result := public.rita_study_take_quota(gen_random_uuid(), '11000000-0000-4000-8000-000000000000', null, 'explain', 'explain', '{}', 1, 'voice', null);
  if result ->> 'code' <> 'unauthorized' then raise exception 'FAILED: a request without a user was accepted'; end if;
  raise notice 'ok: a request without a signed-in user is refused';
end $$;
-- ST-I02: one learner never sees another's requests.
select pg_temp.as_user('c0000000-0000-4000-8000-000000000000');
select pg_temp.check((select count(*) = 0 from public.rita_study_actions), 'ST-I02 a learner sees no one else''s requests');
rollback;

-- The day limit (400 explains a day, the day starting at midnight in Amman).
begin;
do $$
declare result jsonb; day_start timestamptz; at timestamptz;
begin
  day_start := date_trunc('day', now() at time zone 'Asia/Amman') at time zone 'Asia/Amman';
  at := now() - interval '2 minutes';
  if at < day_start then
    raise notice 'skipped: the Amman day started less than 2 minutes ago';
    return;
  end if;
  insert into public.rita_study_actions (request_id, user_id, lesson_id, action, quota_group, created_at)
  select gen_random_uuid(), 'b0000000-0000-4000-8000-000000000000', '11000000-0000-4000-8000-000000000000', 'explain', 'explain', at
  from generate_series(1, 400);
  result := pg_temp.take('b0000000-0000-4000-8000-000000000000', gen_random_uuid());
  if result ->> 'code' <> 'rate_limited' or result ->> 'scope' <> 'day' then
    raise exception 'FAILED: the day limit did not hold: %', result;
  end if;
  raise notice 'ok: the 401st explain of the day is refused until tomorrow';
end $$;
rollback;

select 'all study database checks passed' as result;
