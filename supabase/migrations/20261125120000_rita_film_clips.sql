-- Film clips as a library the admin manages from its own page (/admin/clips), instead of 20
-- Sintel lines written into the code. A clip is a short video with sound (uploaded, optionally
-- trimmed to a start and end second) or a GIF found through GIPHY (shown from GIPHY, never copied).
-- Exercises are made from the clip's own words, so nothing else is stored per exercise.
-- Path exercise stops point at clips by id (clip_ids); the old film_lines column stays as it was.

create table if not exists public.rita_film_clips (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'video' check (kind in ('video', 'gif')),
  en text not null check (char_length(en) between 1 and 300),
  ar text not null default '' check (char_length(ar) <= 300),
  target text not null default '' check (char_length(target) <= 80),
  target_ar text not null default '' check (char_length(target_ar) <= 80),
  context_ar text not null default '' check (char_length(context_ar) <= 300),
  -- A video: its public address (an uploaded file, or a file shipped with the site) and its cover.
  video_url text,
  video_path text,
  poster_url text,
  poster_path text,
  -- Only this part of the video plays (seconds); null means from the start / to the end.
  start_s numeric(8, 2) check (start_s is null or start_s >= 0),
  end_s numeric(8, 2) check (end_s is null or end_s > coalesce(start_s, 0)),
  -- A GIF from GIPHY: shown from GIPHY's own addresses, with GIPHY's attribution.
  gif_id text,
  gif_mp4 text,
  gif_still text,
  gif_page text,
  source text not null default '' check (char_length(source) <= 120),
  credit text not null default '' check (char_length(credit) <= 200),
  credit_url text not null default '' check (char_length(credit_url) <= 500),
  -- The Sintel line number this clip came from (the stops made before the library use it).
  legacy_id smallint unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rita_film_clips_media check (
    (kind = 'video' and video_url is not null) or (kind = 'gif' and gif_mp4 is not null)
  )
);

alter table public.rita_film_clips enable row level security;

drop policy if exists "film clips are readable" on public.rita_film_clips;
create policy "film clips are readable" on public.rita_film_clips
  for select to authenticated using (true);
drop policy if exists "admins manage film clips" on public.rita_film_clips;
create policy "admins manage film clips" on public.rita_film_clips
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop trigger if exists rita_film_clips_updated_at on public.rita_film_clips;
create trigger rita_film_clips_updated_at before update on public.rita_film_clips
  for each row execute function public.set_updated_at();

-- Videos and covers: a public bucket (learners stream them), written only by admins. 25 MB a file.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rita-film-clips', 'rita-film-clips', true, 26214400,
  array['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg', 'image/webp', 'image/png']
)
on conflict (id) do nothing;

drop policy if exists "admins manage film clip files" on storage.objects;
create policy "admins manage film clip files" on storage.objects
  for all to authenticated
  using (bucket_id = 'rita-film-clips' and public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (bucket_id = 'rita-film-clips' and public.has_role(auth.uid(), 'admin'::public.app_role));

-- The 20 Sintel lines become the first clips (their files ship with the site).
insert into public.rita_film_clips
  (legacy_id, en, ar, target, target_ar, context_ar, video_url, poster_url)
values
  (1, 'This blade has a dark past.', 'لهذا النصل ماضٍ مظلم.', 'past', 'ماضٍ', 'تصف الجملة تاريخ النصل.', '/media/sintel/1.mp4', '/media/sintel/1.jpg'),
  (2, 'It has shed much innocent blood.', 'لقد سفك الكثير من دماء الأبرياء.', 'innocent', 'الأبرياء', 'يتحدّث الراوي عن ضحايا النصل.', '/media/sintel/2.mp4', '/media/sintel/2.jpg'),
  (3, 'You''re a fool for traveling alone, so completely unprepared.', 'من الحماقة أن تسافري وحدك وأنت غير مستعدة إطلاقًا.', 'alone', 'وحدك', 'يحذّرها من السفر بلا رفيق.', '/media/sintel/3.mp4', '/media/sintel/3.jpg'),
  (4, 'You''re lucky your blood''s still flowing.', 'من حسن حظك أن دمك ما زال يجري في عروقك.', 'lucky', 'حسن حظك', 'نجت سينتل من الخطر.', '/media/sintel/4.mp4', '/media/sintel/4.jpg'),
  (5, 'Thank you.', 'شكرًا لك.', 'Thank', 'شكرًا', 'تردّ بكلمة امتنان قصيرة.', '/media/sintel/5.mp4', '/media/sintel/5.jpg'),
  (7, 'What brings you to the land of the gatekeepers?', 'ما الذي أتى بك إلى أرض حرّاس البوابات؟', 'gatekeepers', 'حرّاس البوابات', 'يسألها عن سبب مجيئها.', '/media/sintel/7.mp4', '/media/sintel/7.jpg'),
  (8, 'I''m searching for someone.', 'أنا أبحث عن شخص ما.', 'searching', 'أبحث', 'تشرح سينتل سبب رحلتها.', '/media/sintel/8.mp4', '/media/sintel/8.jpg'),
  (9, 'Someone very dear? A kindred spirit?', 'هل هو شخص عزيز جدًا؟ روح تشبه روحك؟', 'dear', 'عزيز', 'يسأل عن الشخص الذي تفتقده.', '/media/sintel/9.mp4', '/media/sintel/9.jpg'),
  (10, 'A dragon.', 'تنين.', 'dragon', 'تنين', 'تكشف هوية من تبحث عنه.', '/media/sintel/10.mp4', '/media/sintel/10.jpg'),
  (11, 'A dangerous quest for a lone hunter.', 'مهمة خطيرة لصيّادة وحيدة.', 'dangerous', 'خطيرة', 'يصف صعوبة الرحلة.', '/media/sintel/11.mp4', '/media/sintel/11.jpg'),
  (12, 'I''ve been alone for as long as I can remember.', 'عشت وحدي منذ أبعد ما أتذكر.', 'remember', 'أتذكر', 'تتحدّث عن وحدتها منذ الصغر.', '/media/sintel/12.mp4', '/media/sintel/12.jpg'),
  (13, 'We''re almost done. Shhh...', 'أوشكنا على الانتهاء. هشش...', 'almost', 'أوشكنا', 'لم يبقَ سوى القليل.', '/media/sintel/13.mp4', '/media/sintel/13.jpg'),
  (14, 'Hey, sit still.', 'مهلًا، ابقَ ساكنًا.', 'still', 'ساكنًا', 'تطلب منه أن يتوقّف عن الحركة.', '/media/sintel/14.mp4', '/media/sintel/14.jpg'),
  (15, 'Good night, Scales.', 'تصبح على خير يا سكيلز.', 'night', 'خير', 'تودّع سكيلز قبل النوم.', '/media/sintel/15.mp4', '/media/sintel/15.jpg'),
  (16, 'Get him, Scales! Come on!', 'أمسك به يا سكيلز! هيا!', 'Get', 'أمسك', 'تشجّع سكيلز على المطاردة.', '/media/sintel/16.mp4', '/media/sintel/16.jpg'),
  (18, 'Yeah! Come on!', 'أجل! هيا!', 'Come', 'هيا', 'هتاف قصير للتشجيع.', '/media/sintel/18.mp4', '/media/sintel/18.jpg'),
  (20, 'I have failed.', 'لقد فشلت.', 'failed', 'فشلت', 'تعبّر عن خيبة أملها.', '/media/sintel/20.mp4', '/media/sintel/20.jpg'),
  (21, 'You''ve only failed to see...', 'كل ما أخفقت فيه هو أن ترى...', 'see', 'ترى', 'يلفت انتباهها إلى ما فاتها.', '/media/sintel/21.mp4', '/media/sintel/21.jpg'),
  (22, 'These are dragon lands, Sintel.', 'هذه أراضي التنانين يا سينتل.', 'lands', 'أراضي', 'يصف المكان الذي وصلت إليه.', '/media/sintel/22.mp4', '/media/sintel/22.jpg'),
  (23, 'You are closer than you know.', 'أنتِ أقرب مما تظنين.', 'closer', 'أقرب', 'يطمئنها بشأن المسافة المتبقّية.', '/media/sintel/23.mp4', '/media/sintel/23.jpg')
on conflict (legacy_id) do nothing;

update public.rita_film_clips
set source = 'Sintel',
    credit = 'Sintel · © Blender Foundation · CC BY 3.0',
    credit_url = 'https://durian.blender.org/sharing/'
where legacy_id is not null and source = '';

-- Path exercise stops point at clips. The stops made with Sintel lines keep their clips, in order.
alter table public.rita_path_items
  add column if not exists clip_ids uuid[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'path_clip_ids_valid') then
    alter table public.rita_path_items
      add constraint path_clip_ids_valid check (
        cardinality(clip_ids) <= 40 and (kind = 'exercises' or cardinality(clip_ids) = 0)
      );
  end if;
end $$;

update public.rita_path_items item
set clip_ids = coalesce((
  select array_agg(clip.id order by line.ord)
  from unnest(item.film_lines) with ordinality as line(legacy_id, ord)
  join public.rita_film_clips clip on clip.legacy_id = line.legacy_id
), '{}')
where cardinality(item.film_lines) > 0 and cardinality(item.clip_ids) = 0;
