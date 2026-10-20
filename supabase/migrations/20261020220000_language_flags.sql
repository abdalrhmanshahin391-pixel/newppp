-- The flag shown next to a learning language: a country (ISO 3166-1 alpha-2, lower case), chosen
-- by the admin because a language is not a country (English can be the UK or the US). The images
-- are served from public/flags; a language with no country shows its code instead.

alter table public.learning_languages
  add column if not exists flag_country text
    check (flag_country is null or flag_country ~ '^[a-z]{2}$');

update public.learning_languages set flag_country = 'gb' where code = 'en' and flag_country is null;
update public.learning_languages set flag_country = 'de' where code = 'de' and flag_country is null;
