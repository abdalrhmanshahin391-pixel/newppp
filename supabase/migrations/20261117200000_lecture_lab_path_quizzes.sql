begin;

alter table public.rita_path_items add column if not exists quiz_count integer not null default 0;
create table if not exists public.rita_path_quizzes (
  item_id uuid primary key references public.rita_path_items(id) on delete cascade,
  version uuid not null default gen_random_uuid(),
  questions jsonb not null check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) between 1 and 50)
);
alter table public.rita_path_quizzes enable row level security;
revoke all on public.rita_path_quizzes from public, anon, authenticated;
-- The snapshot contains the marking key. Only the RPCs below can read or write it.
-- Sample on the server so a large bank never needs to be downloaded for a small quiz.
create or replace function public.preview_path_quiz(p_topics uuid[],p_count integer)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Admin access required'; end if;
  if p_count is null or p_count not between 1 and 50 then raise exception 'Invalid quiz size'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(sample) - 'rank' order by sample.rank),'[]'::jsonb) from (
    select q.id,q.stem,q.options,q.explanation,random() as rank
    from public.lq_questions q join public.lq_lectures l on l.id=q.lecture_id
    where l.subtopic_id=any(p_topics) and (q.user_id=auth.uid() or l.is_example)
    order by rank limit p_count
  ) sample);
end $$;

create or replace function public.publish_path_quiz(p_item uuid, p_title text, p_questions jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare draft jsonb; snapshot jsonb := '[]'; source jsonb; k integer;
begin
  if auth.uid() is null or not public.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Admin access required'; end if;
  if p_title is null or length(trim(p_title)) not between 1 and 120 or p_questions is null or jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) not between 1 and 50 then raise exception 'Invalid quiz'; end if;
  if (select count(distinct q->>'id') from jsonb_array_elements(p_questions) q) <> jsonb_array_length(p_questions) then raise exception 'Duplicate or missing questions'; end if;
  perform 1 from public.rita_path_items where id=p_item and kind='exercises' for update;
  if not found then raise exception 'Exercise stop not found'; end if;
  for draft in select value from jsonb_array_elements(p_questions) loop
    select jsonb_build_object('id',q.id,'stem',q.stem,'options',q.options,'explanation',q.explanation)
      into source from public.lq_questions q join public.lq_lectures l on l.id=q.lecture_id where q.id=(draft->>'id')::uuid and (q.user_id=auth.uid() or l.is_example);
    if source is distinct from draft then raise exception 'Question changed or unavailable. Preview again.'; end if;
    if jsonb_typeof(source->'options') <> 'array' or jsonb_array_length(source->'options') not between 2 and 8 then raise exception 'Invalid options'; end if;
    select count(*) into k from jsonb_array_elements(source->'options') o where o->'is_correct'='true'::jsonb;
    if k<>1 then raise exception 'Invalid answer key'; end if;
    snapshot := snapshot || jsonb_build_array(source);
  end loop;
  insert into public.rita_path_quizzes(item_id,questions) values(p_item,snapshot)
  on conflict(item_id) do update set questions=excluded.questions,version=gen_random_uuid();
  update public.rita_path_items set title=trim(p_title),quiz_count=jsonb_array_length(snapshot) where id=p_item;
end $$;

create or replace function public.read_path_quiz(p_item uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('version',s.version,'questions',(
   select jsonb_agg(jsonb_build_object('stem',q->>'stem','options',(
     select jsonb_agg(o->>'body' order by j) from jsonb_array_elements(q->'options') with ordinality opts(o,j)
   )) order by i) from jsonb_array_elements(s.questions) with ordinality entries(q,i)
 )) from public.rita_path_quizzes s where s.item_id=p_item and auth.uid() is not null
$$;

create or replace function public.answer_path_quiz(p_item uuid,p_version uuid,p_index integer,p_choice integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare q jsonb; answer integer;
begin
  select questions->p_index into q from public.rita_path_quizzes where item_id=p_item and version=p_version and auth.uid() is not null;
  if q is null or p_index is null or p_index<0 then raise exception 'Quiz changed. Reopen the quiz.'; end if;
  if p_choice is null or p_choice<0 or p_choice>=jsonb_array_length(q->'options') then raise exception 'Invalid choice'; end if;
  select i-1 into answer from jsonb_array_elements(q->'options') with ordinality opts(o,i) where o->'is_correct'='true'::jsonb;
  return jsonb_build_object('answer',answer,'explanation',q->>'explanation');
end $$;
revoke all on function public.preview_path_quiz(uuid[],integer), public.publish_path_quiz(uuid,text,jsonb), public.read_path_quiz(uuid), public.answer_path_quiz(uuid,uuid,integer,integer) from public, anon;
grant execute on function public.preview_path_quiz(uuid[],integer), public.publish_path_quiz(uuid,text,jsonb), public.read_path_quiz(uuid), public.answer_path_quiz(uuid,uuid,integer,integer) to authenticated;
commit;
