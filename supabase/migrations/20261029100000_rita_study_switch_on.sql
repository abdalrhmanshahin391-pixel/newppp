-- Interactive study is the normal lesson now: the book page's "make" button links each lesson's
-- guide, so the site-wide switch starts on. A lesson still opens as study only when its guide is
-- ready and linked; anything else stays the classic lesson. The switch remains as an emergency off
-- (lesson editor, «دليل PDF»).
insert into public.rita_feature_flags (key, enabled)
values ('rita_study', true)
on conflict (key) do update set enabled = true, updated_at = now();
