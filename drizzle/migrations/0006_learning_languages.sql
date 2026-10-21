-- Learning languages: a registry an admin can extend, and each learner's active language.
--
-- Everything language specific (flashcards, lessons, free conversations, community decks)
-- carries a `language` that points at this registry, so each language is a separate space
-- and switching never deletes anything.
--
-- A NULL language on a learner's own rows means "made before languages existed". Those rows
-- belong to the language the learner picked first (profiles.legacy_language); set_learning_language
-- stamps them once, and readers treat NULL as that language until then.

create table if not exists public.learning_languages (
  code text primary key check (code ~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$'),
  name_en text not null check (char_length(name_en) between 1 and 60),
  name_native text not null check (char_length(name_native) between 1 and 60),
  name_ar text not null check (char_length(name_ar) between 1 and 60),
  direction text not null default 'ltr' check (direction in ('ltr', 'rtl')),
  -- Code the speech services use for this language (usually the same as `code`).
  speech_code text not null check (char_length(speech_code) between 2 and 12),
  -- Rita's voice conversation is only offered once an admin has tried the language.
  voice_enabled boolean not null default false,
  -- Disabled languages disappear from the chooser; their content stays saved.
  enabled boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists learning_languages_set_updated_at on public.learning_languages;
create trigger learning_languages_set_updated_at
  before update on public.learning_languages
  for each row execute function public.set_updated_at();

insert into public.learning_languages
  (code, name_en, name_native, name_ar, direction, speech_code, voice_enabled, enabled, sort)
values
  ('en', 'English', 'English', 'الإنجليزية', 'ltr', 'en', true, true, 10),
  ('de', 'German', 'Deutsch', 'الألمانية', 'ltr', 'de', true, true, 20)
on conflict (code) do nothing;

-- Everyone signed in may read the list; only admins change it. There is no delete policy on
-- purpose: a language that has content is disabled, not removed.
alter table public.learning_languages enable row level security;
drop policy if exists "signed in read languages" on public.learning_languages;
create policy "signed in read languages" on public.learning_languages
  for select to authenticated using (true);
drop policy if exists "admins add languages" on public.learning_languages;
create policy "admins add languages" on public.learning_languages
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));
drop policy if exists "admins edit languages" on public.learning_languages;
create policy "admins edit languages" on public.learning_languages
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

-- The learner's choice. legacy_language is the language that received their pre-existing content.
alter table public.profiles
  add column if not exists learning_language text
    references public.learning_languages (code) on update cascade on delete restrict,
  add column if not exists legacy_language text
    references public.learning_languages (code) on update cascade on delete restrict;

-- Whatever path writes the profile (the RPC below or a direct update), a learner can only
-- choose a language that is enabled, and the legacy language is fixed once set.
create or replace function public.profiles_check_learning_language() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.learning_language is not null
       and new.learning_language is distinct from old.learning_language
       and not exists (
         select 1 from public.learning_languages l where l.code = new.learning_language and l.enabled
       ) then
      raise exception 'learning language % is not available', new.learning_language using errcode = '22023';
    end if;
    if old.legacy_language is not null then
      new.legacy_language := old.legacy_language;
    end if;
  elsif new.learning_language is not null
        and not exists (
          select 1 from public.learning_languages l where l.code = new.learning_language and l.enabled
        ) then
    raise exception 'learning language % is not available', new.learning_language using errcode = '22023';
  end if;
  return new;
end $$;

drop trigger if exists profiles_check_learning_language on public.profiles;
create trigger profiles_check_learning_language
  before insert or update of learning_language, legacy_language on public.profiles
  for each row execute function public.profiles_check_learning_language();

-- Language on the learner-facing content. NULL = made before languages existed (see above).
alter table public.flash_subjects
  add column if not exists language text references public.learning_languages (code) on update cascade;
alter table public.card_reviews
  add column if not exists language text references public.learning_languages (code) on update cascade;
alter table public.review_events
  add column if not exists language text references public.learning_languages (code) on update cascade;
alter table public.card_flags
  add column if not exists language text references public.learning_languages (code) on update cascade;
alter table public.shared_decks
  add column if not exists language text references public.learning_languages (code) on update cascade;
alter table public.shared_question_sets
  add column if not exists language text references public.learning_languages (code) on update cascade;
-- (not `language_preference`: that one is the speech language/dialect of the conversation)
alter table public.rita_free_conversations
  add column if not exists learning_language text references public.learning_languages (code) on update cascade;

create index if not exists flash_subjects_user_language_idx on public.flash_subjects (user_id, language);
create index if not exists card_reviews_user_language_idx on public.card_reviews (user_id, language);
create index if not exists review_events_user_language_idx on public.review_events (user_id, language);
create index if not exists shared_decks_language_idx on public.shared_decks (language);
create index if not exists shared_question_sets_language_idx on public.shared_question_sets (language);
create index if not exists rita_free_conversations_user_language_idx
  on public.rita_free_conversations (user_id, learning_language);

-- Lessons already know their language through the book they come from. Enforce it for new
-- and edited books; books saved earlier are not re-checked.
alter table public.rita_curricula drop constraint if exists rita_curricula_target_language_fkey;
alter table public.rita_curricula
  add constraint rita_curricula_target_language_fkey
  foreign key (target_language) references public.learning_languages (code) on update cascade not valid;

-- The only way the app changes a learner's language. Returns the active language and whether
-- this was the learner's first choice (the moment pre-existing content is assigned to it).
create or replace function public.set_learning_language(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  legacy text;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if not exists (select 1 from public.learning_languages where code = p_code and enabled) then
    raise exception 'learning language % is not available', p_code using errcode = '22023';
  end if;

  select legacy_language into legacy from public.profiles where id = uid for update;
  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  update public.profiles
     set learning_language = p_code,
         legacy_language = coalesce(legacy_language, p_code)
   where id = uid;

  if legacy is null then
    update public.flash_subjects set language = p_code where user_id = uid and language is null;
    update public.card_reviews set language = p_code where user_id = uid and language is null;
    update public.review_events set language = p_code where user_id = uid and language is null;
    update public.card_flags set language = p_code where user_id = uid and language is null;
    update public.shared_decks set language = p_code where owner_id = uid and language is null;
    update public.shared_question_sets set language = p_code where owner_id = uid and language is null;
    update public.rita_free_conversations
       set learning_language = p_code where user_id = uid and learning_language is null;
  end if;

  return jsonb_build_object('language', p_code, 'first_pick', legacy is null);
end $$;

revoke all on function public.set_learning_language(text) from public;
grant execute on function public.set_learning_language(text) to authenticated;
