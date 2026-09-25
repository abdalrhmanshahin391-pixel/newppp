-- Fresh Supabase bootstrap generated from the canonical migration sequence.
-- Duplicate snapshots, Lovable-only grants, obsolete users, and expired remote imports are excluded.
begin;

-- Local migration bookkeeping retained without the expired Lovable imports.
create table if not exists public._mig_log (
  id serial primary key,
  chunk text,
  err text,
  at timestamptz default now()
);

-- Compatibility helper used by post-snapshot tables and triggers.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- >>> 20260807145528_73d7d61a-9ef0-48bf-bfdf-e4a94e29b57f.sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  phone TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, username, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.id::text),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'phone', '')
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
create type public.app_role as enum ('admin', 'user');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamp with time zone not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users can view their own roles"
  on public.user_roles for select
  to authenticated
  using (auth.uid() = user_id);
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;
create policy "Admins can view all profiles"
  on public.profiles for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role from public.profiles where username = 'Kloryx1'
on conflict do nothing;
create or replace function public.grant_admin_to_kloryx()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.username = 'Kloryx1' then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin'::public.app_role)
    on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger grant_admin_kloryx_trigger
after insert on public.profiles
for each row execute function public.grant_admin_to_kloryx();
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_admin_to_kloryx() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  year smallint NOT NULL CHECK (year BETWEEN 1 AND 6),
  price numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage courses"
ON public.courses FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Authenticated can view courses"
ON public.courses FOR SELECT TO authenticated
USING (true);
CREATE TABLE public.user_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_courses TO authenticated;
GRANT ALL ON public.user_courses TO service_role;
ALTER TABLE public.user_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage user_courses"
ON public.user_courses FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Users view own enrollments"
ON public.user_courses FOR SELECT TO authenticated
USING (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER courses_touch_updated_at
BEFORE UPDATE ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'major',
  ADD COLUMN IF NOT EXISTS exam_type text NOT NULL DEFAULT 'MINI-OSCE',
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS subjects_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS questions_count_mid integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS questions_count_final integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false;
ALTER TABLE public.courses
  DROP CONSTRAINT IF EXISTS courses_category_check;
ALTER TABLE public.courses
  ADD CONSTRAINT courses_category_check CHECK (category IN ('major','minor'));
DROP POLICY IF EXISTS "Anyone can view published courses" ON public.courses;
CREATE POLICY "Anyone can view published courses"
  ON public.courses FOR SELECT
  TO anon, authenticated
  USING (published = true);
GRANT SELECT ON public.courses TO anon;
DROP POLICY IF EXISTS "Public can view course images" ON storage.objects;
CREATE POLICY "Public can view course images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'course-images');
DROP POLICY IF EXISTS "Admins can upload course images" ON storage.objects;
CREATE POLICY "Admins can upload course images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'course-images' AND public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can update course images" ON storage.objects;
CREATE POLICY "Admins can update course images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'course-images' AND public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can delete course images" ON storage.objects;
CREATE POLICY "Admins can delete course images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'course-images' AND public.has_role(auth.uid(), 'admin'));
CREATE TABLE public.subject_groups (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_groups TO authenticated;
GRANT ALL ON public.subject_groups TO service_role;
ALTER TABLE public.subject_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage subject_groups" ON public.subject_groups FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "View subject_groups if enrolled or admin" ON public.subject_groups FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.user_courses uc WHERE uc.course_id = subject_groups.course_id AND uc.user_id = auth.uid())
  );
CREATE TRIGGER subject_groups_touch BEFORE UPDATE ON public.subject_groups FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TABLE public.subjects (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.subject_groups(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage subjects" ON public.subjects FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "View subjects if enrolled or admin" ON public.subjects FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin')
    OR EXISTS (
      SELECT 1 FROM public.subject_groups sg
      JOIN public.user_courses uc ON uc.course_id = sg.course_id
      WHERE sg.id = subjects.group_id AND uc.user_id = auth.uid()
    )
  );
CREATE TRIGGER subjects_touch BEFORE UPDATE ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TABLE public.questions (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  stem text not null,
  explanation text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage questions" ON public.questions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "View questions if enrolled or admin" ON public.questions FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin')
    OR EXISTS (
      SELECT 1 FROM public.subjects s
      JOIN public.subject_groups sg ON sg.id = s.group_id
      JOIN public.user_courses uc ON uc.course_id = sg.course_id
      WHERE s.id = questions.subject_id AND uc.user_id = auth.uid()
    )
  );
CREATE TRIGGER questions_touch BEFORE UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TABLE public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  label text not null,
  text text not null,
  is_correct boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_options TO authenticated;
GRANT ALL ON public.question_options TO service_role;
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage question_options" ON public.question_options FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "View question_options if enrolled or admin" ON public.question_options FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin')
    OR EXISTS (
      SELECT 1 FROM public.questions q
      JOIN public.subjects s ON s.id = q.subject_id
      JOIN public.subject_groups sg ON sg.id = s.group_id
      JOIN public.user_courses uc ON uc.course_id = sg.course_id
      WHERE q.id = question_options.question_id AND uc.user_id = auth.uid()
    )
  );
DO $$
DECLARE
  c record;
  g_id uuid;
  s_id uuid;
  q_id uuid;
BEGIN
  FOR c IN SELECT id FROM public.courses WHERE published = true LOOP
    SELECT id INTO g_id FROM public.subject_groups WHERE course_id = c.id AND name = 'GENERAL' LIMIT 1;
    IF g_id IS NULL THEN
      INSERT INTO public.subject_groups (course_id, name, sort_order) VALUES (c.id, 'GENERAL', 0) RETURNING id INTO g_id;
    END IF;
    SELECT id INTO s_id FROM public.subjects WHERE group_id = g_id AND name = 'Cardiopulmonary' LIMIT 1;
    IF s_id IS NULL THEN
      INSERT INTO public.subjects (group_id, name, sort_order) VALUES (g_id, 'Cardiopulmonary', 0) RETURNING id INTO s_id;
    END IF;
    SELECT id INTO q_id FROM public.questions WHERE subject_id = s_id AND stem LIKE 'A 58-year-old man%' LIMIT 1;
    IF q_id IS NULL THEN
      INSERT INTO public.questions (subject_id, stem, explanation, sort_order) VALUES (
        s_id,
        'A 58-year-old man presents to the emergency department with severe crushing chest pain radiating to his left arm, diaphoresis, and nausea for the past 45 minutes. ECG shows ST-segment elevation in leads II, III, and aVF. Which of the following is the most likely diagnosis?',
        'ST-elevation in leads II, III, and aVF is characteristic of an inferior wall myocardial infarction, most commonly caused by occlusion of the right coronary artery.',
        0
      ) RETURNING id INTO q_id;
      INSERT INTO public.question_options (question_id, label, text, is_correct, sort_order) VALUES
        (q_id, 'A', 'Stable angina pectoris', false, 0),
        (q_id, 'B', 'Pulmonary embolism', false, 1),
        (q_id, 'C', 'Inferior wall myocardial infarction', true, 2),
        (q_id, 'D', 'Pericarditis', false, 3),
        (q_id, 'E', 'Aortic dissection', false, 4);
    END IF;
  END LOOP;
END $$;
GRANT SELECT ON public.subject_groups TO anon, authenticated;
GRANT SELECT ON public.subjects TO anon, authenticated;
GRANT SELECT ON public.questions TO anon, authenticated;
GRANT SELECT ON public.question_options TO anon, authenticated;
GRANT ALL ON public.subject_groups TO service_role;
GRANT ALL ON public.subjects TO service_role;
GRANT ALL ON public.questions TO service_role;
GRANT ALL ON public.question_options TO service_role;
CREATE POLICY "Anyone can view published subject groups"
ON public.subject_groups
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id = subject_groups.course_id
      AND c.published = true
  )
);
CREATE POLICY "Anyone can view published subjects"
ON public.subjects
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.subject_groups sg
    JOIN public.courses c ON c.id = sg.course_id
    WHERE sg.id = subjects.group_id
      AND c.published = true
  )
);
CREATE POLICY "Anyone can view published questions"
ON public.questions
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.subjects s
    JOIN public.subject_groups sg ON sg.id = s.group_id
    JOIN public.courses c ON c.id = sg.course_id
    WHERE s.id = questions.subject_id
      AND c.published = true
  )
);
CREATE POLICY "Anyone can view published question options"
ON public.question_options
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.questions q
    JOIN public.subjects s ON s.id = q.subject_id
    JOIN public.subject_groups sg ON sg.id = s.group_id
    JOIN public.courses c ON c.id = sg.course_id
    WHERE q.id = question_options.question_id
      AND c.published = true
  )
);
CREATE TABLE public.question_flags (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, question_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_flags TO authenticated;
GRANT ALL ON public.question_flags TO service_role;
ALTER TABLE public.question_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own flags select" ON public.question_flags FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own flags insert" ON public.question_flags FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own flags delete" ON public.question_flags FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TABLE public.question_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_label text,
  is_correct boolean NOT NULL DEFAULT false,
  mode text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX question_attempts_user_idx ON public.question_attempts(user_id, attempted_at DESC);
GRANT SELECT, INSERT ON public.question_attempts TO authenticated;
GRANT ALL ON public.question_attempts TO service_role;
ALTER TABLE public.question_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attempts select" ON public.question_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own attempts insert" ON public.question_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE TABLE public.user_sessions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_sessions TO authenticated;
GRANT ALL ON public.user_sessions TO service_role;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own session select" ON public.user_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own session upsert" ON public.user_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own session update" ON public.user_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE TABLE public.user_login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_login_events_time_idx ON public.user_login_events(occurred_at DESC);
GRANT SELECT, INSERT ON public.user_login_events TO authenticated;
GRANT ALL ON public.user_login_events TO service_role;
ALTER TABLE public.user_login_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own logins insert" ON public.user_login_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own logins select" ON public.user_login_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read logins" ON public.user_login_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admins read sessions" ON public.user_sessions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE OR REPLACE FUNCTION public.admin_marketing_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'logins_last_month', (SELECT count(*) FROM public.user_login_events WHERE occurred_at >= now() - interval '1 month'),
    'logins_last_2_months', (SELECT count(*) FROM public.user_login_events WHERE occurred_at >= now() - interval '2 months'),
    'logins_last_3_months', (SELECT count(*) FROM public.user_login_events WHERE occurred_at >= now() - interval '3 months'),
    'logins_this_year', (SELECT count(*) FROM public.user_login_events WHERE occurred_at >= date_trunc('year', now())),
    'logins_all_time', (SELECT count(*) FROM public.user_login_events),
    'active_now', (SELECT count(*) FROM public.user_sessions WHERE last_seen_at >= now() - interval '5 minutes'),
    'opened_today', (SELECT count(*) FROM public.user_sessions WHERE last_seen_at >= date_trunc('day', now()))
  ) INTO result;
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_marketing_stats() TO authenticated;
CREATE OR REPLACE FUNCTION public.get_email_by_username(_username text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.profiles WHERE username = _username LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon, authenticated;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS paddle_price_id text;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'usd';
UPDATE public.courses
SET price = 10, paddle_price_id = 'course_anatomy', currency = 'usd'
WHERE title = 'anatomy';
DROP POLICY IF EXISTS "Users view own enrollments" ON public.user_courses;
CREATE POLICY "Users view own enrollments"
  ON public.user_courses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_courses TO authenticated;
GRANT ALL ON public.user_courses TO service_role;
CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paddle_event_id text UNIQUE,
  paddle_transaction_id text,
  user_id uuid,
  course_id uuid,
  amount_cents integer,
  currency text,
  environment text NOT NULL DEFAULT 'sandbox',
  status text NOT NULL,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_events TO authenticated;
GRANT ALL ON public.payment_events TO service_role;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own payment events"
  ON public.payment_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins view all payment events"
  ON public.payment_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  question_id uuid REFERENCES public.questions(id) ON DELETE SET NULL,
  snippet_html text NOT NULL,
  snippet_text text NOT NULL DEFAULT '',
  user_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notes" ON public.notes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notes" ON public.notes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notes" ON public.notes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own notes" ON public.notes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX notes_user_created_idx ON public.notes (user_id, created_at DESC);
CREATE INDEX notes_user_subject_idx ON public.notes (user_id, subject_id);
CREATE TRIGGER notes_touch_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TYPE public.subject_access AS ENUM ('paid','free_logged_in','free_public');
ALTER TABLE public.subjects ADD COLUMN access_level public.subject_access NOT NULL DEFAULT 'paid';
do $$ begin
  create type public.package_type as enum ('individual', 'group');
exception when duplicate_object then null; end $$;
CREATE TABLE IF NOT EXISTS public.packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  currency text NOT NULL DEFAULT 'usd',
  package_type public.package_type NOT NULL DEFAULT 'individual',
  group_size integer NOT NULL DEFAULT 1 CHECK (group_size >= 1),
  paddle_price_id text,
  published boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.packages TO anon, authenticated;
GRANT ALL ON public.packages TO service_role;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view published packages"
  ON public.packages FOR SELECT
  USING (published = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage packages"
  ON public.packages FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER touch_packages_updated_at
  BEFORE UPDATE ON public.packages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TABLE IF NOT EXISTS public.package_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  note text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (package_id, course_id)
);
GRANT SELECT ON public.package_courses TO anon, authenticated;
GRANT ALL ON public.package_courses TO service_role;
ALTER TABLE public.package_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view courses of published packages"
  ON public.package_courses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.packages p
      WHERE p.id = package_courses.package_id
      AND (p.published = true OR public.has_role(auth.uid(), 'admin'))
    )
  );
CREATE POLICY "Admins manage package_courses"
  ON public.package_courses FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TABLE IF NOT EXISTS public.package_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.packages(id) ON DELETE RESTRICT,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_user_ids uuid[] NOT NULL DEFAULT '{}',
  paddle_transaction_id text UNIQUE,
  paddle_event_id text UNIQUE,
  environment text NOT NULL DEFAULT 'sandbox',
  amount_cents bigint,
  currency text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.package_purchases TO authenticated;
GRANT ALL ON public.package_purchases TO service_role;
ALTER TABLE public.package_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyer or member can view own purchase"
  ON public.package_purchases FOR SELECT
  TO authenticated
  USING (
    auth.uid() = buyer_id
    OR auth.uid() = ANY(member_user_ids)
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE OR REPLACE FUNCTION public.search_users_for_group(_query text, _exclude uuid)
RETURNS TABLE(id uuid, username text, full_name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.username, p.full_name, p.email
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id <> COALESCE(_exclude, '00000000-0000-0000-0000-000000000000'::uuid)
    AND (
      p.username ILIKE _query || '%'
      OR p.email ILIKE _query || '%'
      OR p.full_name ILIKE '%' || _query || '%'
    )
  ORDER BY p.username
  LIMIT 8;
$$;
REVOKE ALL ON FUNCTION public.search_users_for_group(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_users_for_group(text, uuid) TO authenticated;
-- <<< 20260807145528_73d7d61a-9ef0-48bf-bfdf-e4a94e29b57f.sql


-- >>> 20260807145745_ffc062ba-2150-41c9-96ef-58ee653374a2.sql
DROP POLICY IF EXISTS "Authenticated can view courses" ON public.courses;
DROP POLICY IF EXISTS "Anyone can view published questions" ON public.questions;
DROP POLICY IF EXISTS "Anyone can view published question options" ON public.question_options;
DROP POLICY IF EXISTS "Anyone can view published subjects" ON public.subjects;
CREATE POLICY "Authenticated can view subjects of published courses"
ON public.subjects FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.subject_groups sg
  JOIN public.courses c ON c.id = sg.course_id
  WHERE sg.id = subjects.group_id AND c.published = true
));
REVOKE EXECUTE ON FUNCTION public.get_email_by_username(text) FROM anon, PUBLIC;
CREATE OR REPLACE FUNCTION public.search_users_for_group(_query text, _exclude uuid)
RETURNS TABLE(id uuid, username text, full_name text, email text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT p.id, p.username, p.full_name, p.email
  FROM public.profiles p
  WHERE p.id <> COALESCE(_exclude, '00000000-0000-0000-0000-000000000000'::uuid)
    AND (
      p.username ILIKE _query || '%'
      OR p.email ILIKE _query || '%'
      OR p.full_name ILIKE '%' || _query || '%'
    )
  ORDER BY p.username
  LIMIT 8;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.search_users_for_group(text, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_users_for_group(text, uuid) TO authenticated;
CREATE TABLE public.user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  user_agent text,
  platform text,
  ip text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);
CREATE INDEX user_devices_user_id_idx ON public.user_devices(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_devices TO authenticated;
GRANT ALL ON public.user_devices TO service_role;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own devices"
  ON public.user_devices FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Users can insert own devices"
  ON public.user_devices FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own devices"
  ON public.user_devices FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins can delete any device"
  ON public.user_devices FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR auth.uid() = user_id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS device_limit integer NOT NULL DEFAULT 2;
CREATE OR REPLACE FUNCTION public.get_email_by_username(_username text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT email FROM public.profiles
  WHERE lower(username) = lower(trim(_username))
  LIMIT 1;
$function$;
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'questions';
ALTER TABLE public.courses
  DROP CONSTRAINT IF EXISTS courses_kind_check;
ALTER TABLE public.courses
  ADD CONSTRAINT courses_kind_check CHECK (kind IN ('questions','lectures'));
CREATE INDEX IF NOT EXISTS courses_kind_idx ON public.courses(kind);
CREATE TABLE IF NOT EXISTS public.user_lecture_courses (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_id)
);
GRANT SELECT ON public.user_lecture_courses TO authenticated;
GRANT ALL ON public.user_lecture_courses TO service_role;
ALTER TABLE public.user_lecture_courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own lecture access" ON public.user_lecture_courses;
CREATE POLICY "Users read own lecture access"
  ON public.user_lecture_courses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins manage lecture access" ON public.user_lecture_courses;
CREATE POLICY "Admins manage lecture access"
  ON public.user_lecture_courses FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS intro_video_url text,
  ADD COLUMN IF NOT EXISTS intro_video_storage_path text;
CREATE TABLE public.lecture_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lecture_subjects TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.lecture_subjects TO authenticated;
GRANT ALL ON public.lecture_subjects TO service_role;
ALTER TABLE public.lecture_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subjects readable for published courses"
  ON public.lecture_subjects FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.published = true)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );
CREATE POLICY "subjects writable by admin"
  ON public.lecture_subjects FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER touch_lecture_subjects BEFORE UPDATE ON public.lecture_subjects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TABLE public.lecture_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.lecture_subjects(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('lecture','quiz')),
  title text NOT NULL,
  position int NOT NULL DEFAULT 0,
  video_url text,
  video_storage_path text,
  duration_seconds int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lecture_items TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.lecture_items TO authenticated;
GRANT ALL ON public.lecture_items TO service_role;
ALTER TABLE public.lecture_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items readable when subject is readable"
  ON public.lecture_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lecture_subjects s
      JOIN public.courses c ON c.id = s.course_id
      WHERE s.id = subject_id AND (c.published = true OR public.has_role(auth.uid(), 'admin'::public.app_role))
    )
  );
CREATE POLICY "items writable by admin"
  ON public.lecture_items FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER touch_lecture_items BEFORE UPDATE ON public.lecture_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TABLE public.lecture_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL UNIQUE REFERENCES public.lecture_items(id) ON DELETE CASCADE,
  pass_score int NOT NULL DEFAULT 70,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lecture_quizzes TO authenticated;
GRANT ALL ON public.lecture_quizzes TO service_role;
ALTER TABLE public.lecture_quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quizzes writable by admin"
  ON public.lecture_quizzes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TABLE public.lecture_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.lecture_quizzes(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  prompt text NOT NULL,
  explanation text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lecture_quiz_questions TO authenticated;
GRANT ALL ON public.lecture_quiz_questions TO service_role;
ALTER TABLE public.lecture_quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.lecture_quiz_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.lecture_quiz_questions(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  body text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lecture_quiz_options TO authenticated;
GRANT ALL ON public.lecture_quiz_options TO service_role;
ALTER TABLE public.lecture_quiz_options ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.lecture_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id uuid NOT NULL REFERENCES public.lecture_quizzes(id) ON DELETE CASCADE,
  score int NOT NULL,
  total int NOT NULL,
  answers jsonb,
  finished_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lecture_quiz_attempts TO authenticated;
GRANT ALL ON public.lecture_quiz_attempts TO service_role;
ALTER TABLE public.lecture_quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own attempts"
  ON public.lecture_quiz_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "user inserts own attempts"
  ON public.lecture_quiz_attempts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE OR REPLACE FUNCTION public.user_owns_lecture_course(_course_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.user_lecture_courses
        WHERE user_id = auth.uid() AND course_id = _course_id
      );
$$;
REVOKE EXECUTE ON FUNCTION public.user_owns_lecture_course(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_owns_lecture_course(uuid) TO authenticated;
CREATE POLICY "lecture videos readable by owners"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'lecture-videos'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1
        FROM public.lecture_items i
        JOIN public.lecture_subjects s ON s.id = i.subject_id
        JOIN public.user_lecture_courses ulc
          ON ulc.course_id = s.course_id AND ulc.user_id = auth.uid()
        WHERE i.video_storage_path = storage.objects.name
      )
    )
  );
CREATE POLICY "lecture videos writable by admin"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'lecture-videos'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );
CREATE POLICY "lecture videos updatable by admin"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'lecture-videos' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'lecture-videos' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "lecture videos deletable by admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'lecture-videos' AND public.has_role(auth.uid(), 'admin'::public.app_role));
GRANT SELECT ON public.lecture_subjects TO anon;
GRANT SELECT ON public.lecture_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_lecture_courses TO authenticated;
ALTER TABLE public.lecture_items
  ADD COLUMN IF NOT EXISTS is_free boolean NOT NULL DEFAULT false;
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS intro_free boolean NOT NULL DEFAULT false;
ALTER TABLE public.lecture_quiz_questions
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT true;
CREATE POLICY "quizzes readable when item is free or owned"
  ON public.lecture_quizzes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lecture_items i
      JOIN public.lecture_subjects s ON s.id = i.subject_id
      JOIN public.courses c ON c.id = s.course_id
      WHERE i.id = lecture_quizzes.item_id
        AND (
          i.is_free
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
          OR EXISTS (
            SELECT 1 FROM public.user_lecture_courses ulc
            WHERE ulc.user_id = auth.uid() AND ulc.course_id = c.id
          )
        )
        AND (c.published OR public.has_role(auth.uid(), 'admin'::public.app_role))
    )
  );
CREATE POLICY "questions readable"
  ON public.lecture_quiz_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lecture_quizzes q
      JOIN public.lecture_items i ON i.id = q.item_id
      JOIN public.lecture_subjects s ON s.id = i.subject_id
      JOIN public.courses c ON c.id = s.course_id
      WHERE q.id = lecture_quiz_questions.quiz_id
        AND (
          i.is_free
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
          OR EXISTS (
            SELECT 1 FROM public.user_lecture_courses ulc
            WHERE ulc.user_id = auth.uid() AND ulc.course_id = c.id
          )
        )
        AND (c.published OR public.has_role(auth.uid(), 'admin'::public.app_role))
    )
  );
CREATE POLICY "questions writable by admin"
  ON public.lecture_quiz_questions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "options readable"
  ON public.lecture_quiz_options FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lecture_quiz_questions qq
      JOIN public.lecture_quizzes q ON q.id = qq.quiz_id
      JOIN public.lecture_items i ON i.id = q.item_id
      JOIN public.lecture_subjects s ON s.id = i.subject_id
      JOIN public.courses c ON c.id = s.course_id
      WHERE qq.id = lecture_quiz_options.question_id
        AND (
          i.is_free
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
          OR EXISTS (
            SELECT 1 FROM public.user_lecture_courses ulc
            WHERE ulc.user_id = auth.uid() AND ulc.course_id = c.id
          )
        )
        AND (c.published OR public.has_role(auth.uid(), 'admin'::public.app_role))
    )
  );
CREATE POLICY "options writable by admin"
  ON public.lecture_quiz_options FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE OR REPLACE FUNCTION public.admin_grant_lecture_course(_user_id uuid, _course_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO public.user_lecture_courses (user_id, course_id)
  VALUES (_user_id, _course_id)
  ON CONFLICT DO NOTHING;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_grant_lecture_course(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_lecture_course(uuid, uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_revoke_lecture_course(_user_id uuid, _course_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  DELETE FROM public.user_lecture_courses
  WHERE user_id = _user_id AND course_id = _course_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_lecture_course(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_revoke_lecture_course(uuid, uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_list_lecture_course_users(_course_id uuid)
RETURNS TABLE(user_id uuid, username text, full_name text, email text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT ulc.user_id, p.username, p.full_name, p.email
  FROM public.user_lecture_courses ulc
  JOIN public.profiles p ON p.id = ulc.user_id
  WHERE ulc.course_id = _course_id
  ORDER BY p.username;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_lecture_course_users(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_lecture_course_users(uuid) TO authenticated;
CREATE TABLE public.committee_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_number int NOT NULL UNIQUE CHECK (year_number BETWEEN 1 AND 6),
  display_name text NOT NULL,
  icon_key text NOT NULL DEFAULT 'stethoscope',
  color_key text NOT NULL DEFAULT 'indigo',
  shape_key text NOT NULL DEFAULT 'circle',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.committee_years TO authenticated;
GRANT SELECT ON public.committee_years TO anon;
GRANT ALL ON public.committee_years TO service_role;
ALTER TABLE public.committee_years ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read years" ON public.committee_years FOR SELECT USING (true);
CREATE TABLE public.committee_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_id uuid NOT NULL REFERENCES public.committee_years(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon_key text NOT NULL DEFAULT 'book',
  color_key text NOT NULL DEFAULT 'indigo',
  image_url text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.committee_subjects(year_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.committee_subjects TO authenticated;
GRANT SELECT ON public.committee_subjects TO anon;
GRANT ALL ON public.committee_subjects TO service_role;
ALTER TABLE public.committee_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read subjects" ON public.committee_subjects FOR SELECT USING (true);
CREATE TABLE public.committee_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.committee_subjects(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.committee_categories(subject_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.committee_categories TO authenticated;
GRANT SELECT ON public.committee_categories TO anon;
GRANT ALL ON public.committee_categories TO service_role;
ALTER TABLE public.committee_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read categories" ON public.committee_categories FOR SELECT USING (true);
CREATE TABLE public.committee_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.committee_categories(id) ON DELETE CASCADE,
  parent_resource_id uuid REFERENCES public.committee_resources(id) ON DELETE CASCADE,
  title text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('pdf','link','folder')),
  file_path text,
  url text,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.committee_resources(category_id);
CREATE INDEX ON public.committee_resources(parent_resource_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.committee_resources TO authenticated;
GRANT SELECT ON public.committee_resources TO anon;
GRANT ALL ON public.committee_resources TO service_role;
ALTER TABLE public.committee_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read resources" ON public.committee_resources FOR SELECT USING (true);
CREATE TRIGGER touch_committee_years BEFORE UPDATE ON public.committee_years FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_committee_subjects BEFORE UPDATE ON public.committee_subjects FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_committee_categories BEFORE UPDATE ON public.committee_categories FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_committee_resources BEFORE UPDATE ON public.committee_resources FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.committee_years (year_number, display_name, icon_key, color_key, shape_key, sort_order) VALUES
  (1, 'Year 1', 'dna',         'mint',    'circle',   1),
  (2, 'Year 2', 'microscope',  'indigo',  'hexagon',  2),
  (3, 'Year 3', 'heart-pulse', 'rose',    'squircle', 3),
  (4, 'Year 4', 'stethoscope', 'amber',   'diamond',  4),
  (5, 'Year 5', 'brain',       'teal',    'ring',     5),
  (6, 'Year 6', 'cross',       'violet',  'shield',   6);
WITH y AS (SELECT id, year_number FROM public.committee_years)
INSERT INTO public.committee_subjects (year_id, name, icon_key, color_key, sort_order)
SELECT y.id, s.name, s.icon_key, s.color_key, s.sort_order
FROM y
JOIN (VALUES
  (1, 'Anatomy',         'bone',         'rose',    1),
  (1, 'Histology',       'microscope',   'indigo',  2),
  (1, 'Biochemistry',    'flask-conical','amber',   3),
  (1, 'Medical Biology', 'dna',          'mint',    4),
  (1, 'Latin',           'book-open',    'teal',    5),
  (2, 'Physiology',      'heart-pulse',  'rose',    1),
  (2, 'Biochemistry II', 'flask-conical','amber',   2),
  (2, 'Anatomy II',      'bone',         'indigo',  3),
  (2, 'Microbiology',    'bug',          'mint',    4),
  (2, 'Histology II',    'microscope',   'violet',  5),
  (3, 'Pathology',       'virus',        'rose',    1),
  (3, 'Pharmacology',    'pill',         'amber',   2),
  (3, 'Propedeutics',    'stethoscope',  'indigo',  3),
  (3, 'Microbiology II', 'bug',          'mint',    4),
  (4, 'Internal Medicine','stethoscope', 'indigo',  1),
  (4, 'Surgery',         'scissors',     'rose',    2),
  (4, 'OB-GYN',          'baby',         'mint',    3),
  (4, 'Pediatrics',      'baby',         'amber',   4),
  (5, 'Cardiology',      'heart-pulse',  'rose',    1),
  (5, 'Neurology',       'brain',        'violet',  2),
  (5, 'Psychiatry',      'brain',        'teal',    3),
  (5, 'Dermatology',     'sparkles',     'amber',   4),
  (6, 'State Exam Prep', 'graduation-cap','violet', 1),
  (6, 'Clinical Cases',  'clipboard-list','indigo', 2)
) AS s(year_number, name, icon_key, color_key, sort_order)
ON y.year_number = s.year_number;
CREATE POLICY "committee public read" ON storage.objects FOR SELECT
  USING (bucket_id IN ('committee-images','committee-files'));
ALTER TABLE public.committee_categories
  ADD COLUMN IF NOT EXISTS section text NOT NULL DEFAULT 'resources';
ALTER TABLE public.committee_categories
  DROP CONSTRAINT IF EXISTS committee_categories_section_check;
ALTER TABLE public.committee_categories
  ADD CONSTRAINT committee_categories_section_check CHECK (section IN ('resources','books'));
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'committee';
-- <<< 20260807145745_ffc062ba-2150-41c9-96ef-58ee653374a2.sql


-- >>> 20260807150017_6ac762b7-b996-4412-b24c-02589c925f84.sql
CREATE OR REPLACE FUNCTION public.admin_grant_role(_user_id uuid, _role public.app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role)
  ON CONFLICT DO NOTHING;
END; $$;
CREATE OR REPLACE FUNCTION public.admin_revoke_role(_user_id uuid, _role public.app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
END; $$;
CREATE OR REPLACE FUNCTION public.admin_list_role_members(_role public.app_role)
RETURNS TABLE(user_id uuid, username text, full_name text, email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT ur.user_id, p.username, p.full_name, p.email
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = _role
  ORDER BY p.username;
END; $$;
CREATE OR REPLACE FUNCTION public.admin_get_user_roles(_user_id uuid)
RETURNS TABLE(role public.app_role)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = _user_id;
END; $$;
CREATE OR REPLACE FUNCTION public.can_manage_committee(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role)
      OR public.has_role(_user_id, 'committee'::public.app_role);
$$;
REVOKE EXECUTE ON FUNCTION public.can_manage_committee(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_committee(uuid) TO authenticated;
CREATE POLICY "committee manage years" ON public.committee_years
  FOR ALL TO authenticated
  USING (public.can_manage_committee(auth.uid()))
  WITH CHECK (public.can_manage_committee(auth.uid()));
CREATE POLICY "committee manage subjects" ON public.committee_subjects
  FOR ALL TO authenticated
  USING (public.can_manage_committee(auth.uid()))
  WITH CHECK (public.can_manage_committee(auth.uid()));
CREATE POLICY "committee manage categories" ON public.committee_categories
  FOR ALL TO authenticated
  USING (public.can_manage_committee(auth.uid()))
  WITH CHECK (public.can_manage_committee(auth.uid()));
CREATE POLICY "committee manage resources" ON public.committee_resources
  FOR ALL TO authenticated
  USING (public.can_manage_committee(auth.uid()))
  WITH CHECK (public.can_manage_committee(auth.uid()));
CREATE POLICY "committee manage write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = ANY (ARRAY['committee-images','committee-files'])
    AND public.can_manage_committee(auth.uid())
  );
CREATE POLICY "committee manage update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = ANY (ARRAY['committee-images','committee-files'])
    AND public.can_manage_committee(auth.uid())
  )
  WITH CHECK (
    bucket_id = ANY (ARRAY['committee-images','committee-files'])
    AND public.can_manage_committee(auth.uid())
  );
CREATE POLICY "committee manage delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = ANY (ARRAY['committee-images','committee-files'])
    AND public.can_manage_committee(auth.uid())
  );
CREATE OR REPLACE FUNCTION public.admin_grant_committee_role(_username text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT id INTO _uid FROM public.profiles WHERE lower(username) = lower(trim(_username)) LIMIT 1;
  IF _uid IS NULL THEN RAISE EXCEPTION 'user not found'; END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'committee'::public.app_role)
  ON CONFLICT DO NOTHING;
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_revoke_committee_role(_username text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT id INTO _uid FROM public.profiles WHERE lower(username) = lower(trim(_username)) LIMIT 1;
  IF _uid IS NULL THEN RAISE EXCEPTION 'user not found'; END IF;
  DELETE FROM public.user_roles WHERE user_id = _uid AND role = 'committee'::public.app_role;
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_list_committee_members()
RETURNS TABLE(user_id uuid, username text, full_name text, email text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT ur.user_id, p.username, p.full_name, p.email
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'committee'::public.app_role
  ORDER BY p.username;
END;
$$;
CREATE TABLE public.german_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image_path text,
  published boolean NOT NULL DEFAULT false,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.german_courses TO authenticated;
GRANT ALL ON public.german_courses TO service_role;
ALTER TABLE public.german_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "german_courses read auth" ON public.german_courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "german_courses admin write" ON public.german_courses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE TABLE public.german_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.german_courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.german_subjects TO authenticated;
GRANT ALL ON public.german_subjects TO service_role;
ALTER TABLE public.german_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "german_subjects read auth" ON public.german_subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "german_subjects admin write" ON public.german_subjects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE TABLE public.german_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.german_subjects(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('lecture','quiz','words','sentences')),
  title text NOT NULL,
  position int NOT NULL DEFAULT 0,
  video_url text,
  video_storage_path text,
  is_free boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.german_items TO authenticated;
GRANT ALL ON public.german_items TO service_role;
ALTER TABLE public.german_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "german_items read auth" ON public.german_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "german_items admin write" ON public.german_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE TABLE public.german_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL UNIQUE REFERENCES public.german_items(id) ON DELETE CASCADE
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.german_quizzes TO authenticated;
GRANT ALL ON public.german_quizzes TO service_role;
ALTER TABLE public.german_quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "german_quizzes read auth" ON public.german_quizzes FOR SELECT TO authenticated USING (true);
CREATE POLICY "german_quizzes admin write" ON public.german_quizzes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE TABLE public.german_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.german_quizzes(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  prompt text NOT NULL,
  explanation text,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.german_quiz_questions TO authenticated;
GRANT ALL ON public.german_quiz_questions TO service_role;
ALTER TABLE public.german_quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "german_qq read auth" ON public.german_quiz_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "german_qq admin write" ON public.german_quiz_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE TABLE public.german_quiz_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.german_quiz_questions(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  body text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.german_quiz_options TO authenticated;
GRANT ALL ON public.german_quiz_options TO service_role;
ALTER TABLE public.german_quiz_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "german_qo read auth" ON public.german_quiz_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "german_qo admin write" ON public.german_quiz_options FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE TABLE public.german_word_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.german_items(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  german text NOT NULL,
  english text NOT NULL,
  example text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.german_word_entries TO authenticated;
GRANT ALL ON public.german_word_entries TO service_role;
ALTER TABLE public.german_word_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "german_words read auth" ON public.german_word_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "german_words admin write" ON public.german_word_entries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE TABLE public.german_sentence_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.german_items(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  german text NOT NULL,
  english text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.german_sentence_entries TO authenticated;
GRANT ALL ON public.german_sentence_entries TO service_role;
ALTER TABLE public.german_sentence_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "german_sent read auth" ON public.german_sentence_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "german_sent admin write" ON public.german_sentence_entries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE TRIGGER german_courses_touch BEFORE UPDATE ON public.german_courses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TABLE public.german_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.german_items(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL,
  is_correct BOOLEAN NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('study','session','exam','game')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX german_attempts_user_idx ON public.german_attempts (user_id, item_id);
GRANT SELECT, INSERT ON public.german_attempts TO authenticated;
GRANT ALL ON public.german_attempts TO service_role;
ALTER TABLE public.german_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attempts read" ON public.german_attempts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "own attempts insert" ON public.german_attempts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
ALTER TABLE public.german_subjects
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'mixed'
    CHECK (content_type IN ('words', 'sentences', 'mixed'));
CREATE TABLE IF NOT EXISTS public.german_voice_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.german_subjects(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.german_items(id) ON DELETE CASCADE,
  entry_id uuid,
  target_text text NOT NULL,
  transcript text,
  score numeric,
  mode text NOT NULL DEFAULT 'voice',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.german_voice_attempts TO authenticated;
GRANT ALL ON public.german_voice_attempts TO service_role;
ALTER TABLE public.german_voice_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own voice attempts"
  ON public.german_voice_attempts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS german_voice_attempts_user_idx
  ON public.german_voice_attempts (user_id, created_at DESC);
ALTER TABLE public.german_courses
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'mixed'
    CHECK (content_type IN ('words', 'sentences', 'mixed'));
ALTER TABLE public.german_subjects ADD COLUMN IF NOT EXISTS parent_id uuid NULL REFERENCES public.german_subjects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS german_subjects_parent_id_idx ON public.german_subjects(parent_id);
CREATE OR REPLACE FUNCTION public.identity_taken(_username text, _phone text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'username', EXISTS (
      SELECT 1 FROM public.profiles
      WHERE _username IS NOT NULL AND lower(username) = lower(trim(_username))
    ),
    'phone', EXISTS (
      SELECT 1 FROM public.profiles
      WHERE _phone IS NOT NULL AND _phone <> '' AND phone = trim(_phone)
    )
  );
$$;
REVOKE ALL ON FUNCTION public.identity_taken(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.identity_taken(text, text) TO anon, authenticated;
CREATE TABLE public.admin_ai_keys (
  provider TEXT PRIMARY KEY,
  api_key TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_ai_keys TO authenticated;
GRANT ALL ON public.admin_ai_keys TO service_role;
ALTER TABLE public.admin_ai_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage ai keys"
ON public.admin_ai_keys
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TABLE public.site_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  site_name text NOT NULL DEFAULT 'YSMU Vault',
  tagline text NOT NULL DEFAULT 'Yerevan State Medical University Question Bank',
  logo_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read site settings"
  ON public.site_settings FOR SELECT
  USING (true);
CREATE POLICY "admins can update site settings"
  ON public.site_settings FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admins can insert site settings"
  ON public.site_settings FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
INSERT INTO public.site_settings (id, site_name, tagline)
VALUES (true, 'YSMU Vault', 'Yerevan State Medical University Question Bank')
ON CONFLICT (id) DO NOTHING;
CREATE TABLE public.summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  subtitle text,
  author_name text,
  source_type text NOT NULL CHECK (source_type IN ('subject','text','photos','questions')),
  source_ref jsonb NOT NULL DEFAULT '{}'::jsonb,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  cover_scheme text NOT NULL DEFAULT 'aurora',
  length_preset text NOT NULL DEFAULT 'standard',
  tone text NOT NULL DEFAULT 'exam',
  is_public boolean NOT NULL DEFAULT false,
  share_slug text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_summaries_user ON public.summaries(user_id, created_at DESC);
CREATE INDEX idx_summaries_share ON public.summaries(share_slug) WHERE share_slug IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.summaries TO authenticated;
GRANT SELECT ON public.summaries TO anon;
GRANT ALL ON public.summaries TO service_role;
ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read their own summaries"
  ON public.summaries FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "anyone reads public summaries"
  ON public.summaries FOR SELECT
  USING (is_public = true);
CREATE POLICY "admins read all summaries"
  ON public.summaries FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "users insert their own summaries"
  ON public.summaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update their own summaries"
  ON public.summaries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete their own summaries"
  ON public.summaries FOR DELETE
  USING (auth.uid() = user_id);
CREATE TRIGGER trg_summaries_touch
  BEFORE UPDATE ON public.summaries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_site_settings_touch
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.german_courses DROP CONSTRAINT IF EXISTS german_courses_content_type_check;
ALTER TABLE public.german_courses ADD CONSTRAINT german_courses_content_type_check
  CHECK (content_type = ANY (ARRAY['words'::text, 'sentences'::text, 'mixed'::text, 'shadowing'::text]));
CREATE TABLE public.german_shadowing_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.german_courses(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('words','sentences')),
  subject_ids uuid[] NOT NULL DEFAULT '{}',
  total_items integer NOT NULL DEFAULT 0,
  score_avg numeric(5,2) NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.german_shadowing_sessions TO authenticated;
GRANT ALL ON public.german_shadowing_sessions TO service_role;
ALTER TABLE public.german_shadowing_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shadowing own read" ON public.german_shadowing_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "shadowing own insert" ON public.german_shadowing_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "shadowing own delete" ON public.german_shadowing_sessions
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX german_shadowing_sessions_user_idx ON public.german_shadowing_sessions(user_id, created_at DESC);
CREATE INDEX german_shadowing_sessions_course_idx ON public.german_shadowing_sessions(course_id);
CREATE POLICY "Anon can view subjects of published courses"
  ON public.subjects FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.subject_groups sg
      JOIN public.courses c ON c.id = sg.course_id
      WHERE sg.id = subjects.group_id AND c.published = true
    )
  );
GRANT SELECT ON public.subjects TO anon;
CREATE OR REPLACE FUNCTION public.get_subject_question_counts(_subject_ids uuid[])
RETURNS TABLE(subject_id uuid, cnt bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.subject_id, count(*)::bigint
  FROM public.questions q
  WHERE q.subject_id = ANY(_subject_ids)
  GROUP BY q.subject_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_subject_question_counts(uuid[]) TO anon, authenticated;
ALTER TABLE public.committee_years DROP CONSTRAINT IF EXISTS committee_years_year_number_check;
ALTER TABLE public.committee_years ADD CONSTRAINT committee_years_year_number_check CHECK (year_number BETWEEN 0 AND 7);
CREATE TABLE public.universities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.universities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.universities TO authenticated;
GRANT ALL ON public.universities TO service_role;
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER universities_touch BEFORE UPDATE ON public.universities
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TABLE public.universities_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  background_color text NOT NULL DEFAULT '#0B3B3C',
  scroll_speed_seconds int NOT NULL DEFAULT 30,
  is_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.universities_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.universities_settings TO authenticated;
GRANT ALL ON public.universities_settings TO service_role;
ALTER TABLE public.universities_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads slider settings" ON public.universities_settings FOR SELECT USING (true);
CREATE POLICY "admins manage slider settings" ON public.universities_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER universities_settings_touch BEFORE UPDATE ON public.universities_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.universities_settings (id) VALUES (true) ON CONFLICT DO NOTHING;
CREATE POLICY "public read university-logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'university-logos');
CREATE POLICY "admins write university-logos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'university-logos' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admins update university-logos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'university-logos' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admins delete university-logos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'university-logos' AND public.has_role(auth.uid(), 'admin'::public.app_role));
ALTER TABLE public.universities ADD COLUMN storage_path text;
ALTER TABLE public.summaries DROP CONSTRAINT IF EXISTS summaries_source_type_check;
ALTER TABLE public.summaries ADD CONSTRAINT summaries_source_type_check
  CHECK (source_type IN ('subject','text','photos','pdf','questions'));
CREATE OR REPLACE FUNCTION public.get_course_real_counts(_course_ids uuid[])
RETURNS TABLE(course_id uuid, subjects_count bigint, questions_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sg.course_id,
    count(DISTINCT s.id)::bigint AS subjects_count,
    count(q.id)::bigint AS questions_count
  FROM public.subject_groups sg
  LEFT JOIN public.subjects s ON s.group_id = sg.id
  LEFT JOIN public.questions q ON q.subject_id = s.id
  WHERE sg.course_id = ANY(_course_ids)
  GROUP BY sg.course_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_course_real_counts(uuid[]) TO anon, authenticated, service_role;
CREATE TABLE public.german_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('words','sentences')),
  german text NOT NULL,
  english text NOT NULL,
  course_id uuid REFERENCES public.german_courses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entry_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.german_flags TO authenticated;
GRANT ALL ON public.german_flags TO service_role;
ALTER TABLE public.german_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "german_flags own read" ON public.german_flags FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "german_flags own insert" ON public.german_flags FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "german_flags own delete" ON public.german_flags FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX german_flags_user_idx ON public.german_flags(user_id, created_at DESC);
ALTER TABLE public.universities
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS short_name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS cover_path text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
INSERT INTO public.universities (name, slug, short_name, description, city, country, is_visible, is_active, sort_order, logo_url, storage_path)
SELECT 'Yerevan State Medical University', 'ysmu', 'YSMU',
       'The flagship medical university — original content collection.',
       'Yerevan', 'Armenia', true, true, 0, '', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.universities WHERE lower(name) LIKE 'yerevan%' OR slug = 'ysmu');
UPDATE public.universities
SET slug = regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')
WHERE slug IS NULL OR slug = '';
ALTER TABLE public.universities
  ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS universities_slug_unique ON public.universities (slug);
ALTER TABLE public.courses        ADD COLUMN IF NOT EXISTS university_id uuid REFERENCES public.universities(id) ON DELETE RESTRICT;
ALTER TABLE public.lecture_subjects ADD COLUMN IF NOT EXISTS university_id uuid REFERENCES public.universities(id) ON DELETE RESTRICT;
ALTER TABLE public.committee_years ADD COLUMN IF NOT EXISTS university_id uuid REFERENCES public.universities(id) ON DELETE RESTRICT;
DO $$
DECLARE ysmu_id uuid;
BEGIN
  SELECT id INTO ysmu_id FROM public.universities WHERE slug = 'ysmu' LIMIT 1;
  IF ysmu_id IS NULL THEN
    SELECT id INTO ysmu_id FROM public.universities ORDER BY sort_order LIMIT 1;
  END IF;
  IF ysmu_id IS NOT NULL THEN
    UPDATE public.courses          SET university_id = ysmu_id WHERE university_id IS NULL;
    UPDATE public.lecture_subjects SET university_id = ysmu_id WHERE university_id IS NULL;
    UPDATE public.committee_years  SET university_id = ysmu_id WHERE university_id IS NULL;
  END IF;
END $$;
ALTER TABLE public.courses          ALTER COLUMN university_id SET NOT NULL;
ALTER TABLE public.lecture_subjects ALTER COLUMN university_id SET NOT NULL;
ALTER TABLE public.committee_years  ALTER COLUMN university_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS courses_university_idx          ON public.courses(university_id);
CREATE INDEX IF NOT EXISTS lecture_subjects_university_idx ON public.lecture_subjects(university_id);
CREATE INDEX IF NOT EXISTS committee_years_university_idx  ON public.committee_years(university_id);
CREATE POLICY "Authenticated read active universities"
  ON public.universities FOR SELECT
  TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Anon read active universities"
  ON public.universities FOR SELECT
  TO anon
  USING (is_active = true);
CREATE POLICY "Admins manage universities"
  ON public.universities FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE OR REPLACE FUNCTION public.university_id_by_slug(_slug text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.universities WHERE slug = _slug AND is_active = true LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.university_id_by_slug(text) TO anon, authenticated;
ALTER TABLE public.universities
  ADD COLUMN IF NOT EXISTS home_visible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS home_badge text,
  ADD COLUMN IF NOT EXISTS home_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS home_tagline text;
ALTER TABLE public.universities
  DROP CONSTRAINT IF EXISTS universities_home_badge_check;
ALTER TABLE public.universities
  ADD CONSTRAINT universities_home_badge_check
  CHECK (home_badge IS NULL OR home_badge IN ('NEW','POPULAR','COMING_SOON'));
ALTER TABLE public.admin_ai_keys
  ADD COLUMN IF NOT EXISTS slot SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS preferred_model TEXT;
ALTER TABLE public.admin_ai_keys
  DROP CONSTRAINT IF EXISTS admin_ai_keys_pkey;
ALTER TABLE public.admin_ai_keys
  ADD CONSTRAINT admin_ai_keys_pkey PRIMARY KEY (provider, slot);
ALTER TABLE public.admin_ai_keys
  DROP CONSTRAINT IF EXISTS admin_ai_keys_slot_range_chk;
ALTER TABLE public.admin_ai_keys
  ADD CONSTRAINT admin_ai_keys_slot_range_chk CHECK (slot BETWEEN 1 AND 5);
-- <<< 20260807150017_6ac762b7-b996-4412-b24c-02589c925f84.sql


-- >>> 20260807150253_5bb77d6c-2fee-470a-a9c5-68b02d24f7d7.sql
CREATE TABLE public.admin_ai_model_limits (
  model_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  rpm INTEGER NOT NULL DEFAULT 5,
  rpd INTEGER NOT NULL DEFAULT 50,
  supports_vision BOOLEAN NOT NULL DEFAULT true,
  enabled BOOLEAN NOT NULL DEFAULT true,
  smooth_pacing BOOLEAN NOT NULL DEFAULT true,
  cooldown_seconds INTEGER NOT NULL DEFAULT 30,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_ai_model_limits TO authenticated;
GRANT ALL ON public.admin_ai_model_limits TO service_role;
ALTER TABLE public.admin_ai_model_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage ai model limits"
ON public.admin_ai_model_limits
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER touch_admin_ai_model_limits_updated_at
BEFORE UPDATE ON public.admin_ai_model_limits
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.admin_ai_model_limits
  ADD COLUMN IF NOT EXISTS max_concurrent integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS api_model_id text,
  ADD COLUMN IF NOT EXISTS use_json_mime boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz;
INSERT INTO public.admin_ai_model_limits
  (model_id, label, rpm, rpd, supports_vision, enabled, smooth_pacing, cooldown_seconds, sort_order, max_concurrent, api_model_id, use_json_mime)
VALUES
  ('gemini-2.5-flash-lite', 'Gemini 2.5 Flash-Lite', 15, 1000, true, true, false, 30, 10, 4, 'gemini-2.5-flash-lite', true)
ON CONFLICT (model_id) DO NOTHING;
CREATE TABLE public.mentor_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('dua','stoic')),
  title text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentor_categories TO authenticated;
GRANT ALL ON public.mentor_categories TO service_role;
ALTER TABLE public.mentor_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mentor_categories owner admin all"
ON public.mentor_categories FOR ALL TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER trg_mentor_categories_updated BEFORE UPDATE ON public.mentor_categories
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_mentor_categories_user_kind ON public.mentor_categories(user_id, kind, sort_order);
CREATE TABLE public.mentor_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category_id uuid NOT NULL REFERENCES public.mentor_categories(id) ON DELETE CASCADE,
  title text,
  body text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentor_entries TO authenticated;
GRANT ALL ON public.mentor_entries TO service_role;
ALTER TABLE public.mentor_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mentor_entries owner admin all"
ON public.mentor_entries FOR ALL TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER trg_mentor_entries_updated BEFORE UPDATE ON public.mentor_entries
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_mentor_entries_cat ON public.mentor_entries(category_id, sort_order);
CREATE TABLE public.mentor_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('religious','stoic')),
  title text NOT NULL,
  is_daily boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentor_tasks TO authenticated;
GRANT ALL ON public.mentor_tasks TO service_role;
ALTER TABLE public.mentor_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mentor_tasks owner admin all"
ON public.mentor_tasks FOR ALL TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER trg_mentor_tasks_updated BEFORE UPDATE ON public.mentor_tasks
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_mentor_tasks_user_kind ON public.mentor_tasks(user_id, kind, sort_order);
CREATE TABLE public.mentor_task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES public.mentor_tasks(id) ON DELETE CASCADE,
  completed_on date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, task_id, completed_on)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentor_task_completions TO authenticated;
GRANT ALL ON public.mentor_task_completions TO service_role;
ALTER TABLE public.mentor_task_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mentor_task_completions owner admin all"
ON public.mentor_task_completions FOR ALL TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX idx_mentor_completions_task_date ON public.mentor_task_completions(task_id, completed_on);
CREATE TABLE public.mentor_treasures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('dua','stoic')),
  title text,
  body text NOT NULL,
  source text,
  tags text[] NOT NULL DEFAULT '{}',
  is_pinned_today boolean NOT NULL DEFAULT false,
  pinned_on date,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentor_treasures TO authenticated;
GRANT ALL ON public.mentor_treasures TO service_role;
ALTER TABLE public.mentor_treasures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mentor_treasures owner admin all"
ON public.mentor_treasures FOR ALL TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(),'admin'::public.app_role))
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(),'admin'::public.app_role));
CREATE TRIGGER trg_mentor_treasures_updated BEFORE UPDATE ON public.mentor_treasures
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_mentor_treasures_user_kind ON public.mentor_treasures(user_id, kind);
CREATE TABLE public.mentor_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  intention text,
  did_well text,
  fell_short text,
  tomorrow text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entry_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentor_journal TO authenticated;
GRANT ALL ON public.mentor_journal TO service_role;
ALTER TABLE public.mentor_journal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mentor_journal owner admin all"
ON public.mentor_journal FOR ALL TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(),'admin'::public.app_role))
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(),'admin'::public.app_role));
CREATE TRIGGER trg_mentor_journal_updated BEFORE UPDATE ON public.mentor_journal
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_mentor_journal_user_date ON public.mentor_journal(user_id, entry_date DESC);
CREATE OR REPLACE FUNCTION public.grant_admin_to_klory_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.email) = lower('Klory.shaheen3@icloud.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS grant_admin_to_klory_email_trigger ON public.profiles;
CREATE TRIGGER grant_admin_to_klory_email_trigger
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.grant_admin_to_klory_email();
CREATE OR REPLACE FUNCTION public.toggle_self_admin(_enable boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  SELECT lower(email) INTO _email FROM auth.users WHERE id = _uid;
  IF _email IS DISTINCT FROM lower('Klory.shaheen3@icloud.com') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _enable THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_uid, 'admin'::public.app_role)
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _uid AND role = 'admin'::public.app_role;
  END IF;
  RETURN _enable;
END;
$$;
GRANT EXECUTE ON FUNCTION public.toggle_self_admin(boolean) TO authenticated;
CREATE TABLE IF NOT EXISTS public.jarvis_batch_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pdf_name TEXT NOT NULL,
  subject_id UUID NULL,
  auto_sort BOOLEAN NOT NULL DEFAULT false,
  batch_id TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  slice_map JSONB NOT NULL DEFAULT '[]'::jsonb,
  result_summary JSONB NULL,
  last_error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jarvis_batch_jobs TO authenticated;
GRANT ALL ON public.jarvis_batch_jobs TO service_role;
ALTER TABLE public.jarvis_batch_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners and admins can read batch jobs"
ON public.jarvis_batch_jobs FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "owners and admins can insert batch jobs"
ON public.jarvis_batch_jobs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "owners and admins can update batch jobs"
ON public.jarvis_batch_jobs FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "owners and admins can delete batch jobs"
ON public.jarvis_batch_jobs FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER jarvis_batch_jobs_touch
BEFORE UPDATE ON public.jarvis_batch_jobs
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS jarvis_batch_jobs_user_idx
ON public.jarvis_batch_jobs (user_id, created_at DESC);
ALTER TABLE public.jarvis_batch_jobs
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS pending_review jsonb,
  ADD COLUMN IF NOT EXISTS classifier_batch_id text,
  ADD COLUMN IF NOT EXISTS classifier_status text;
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS stem_hash text
  GENERATED ALWAYS AS (md5(lower(regexp_replace(coalesce(stem,''), '\s+', ' ', 'g')))) STORED;
CREATE UNIQUE INDEX IF NOT EXISTS questions_subject_stemhash_uniq
  ON public.questions(subject_id, stem_hash);
CREATE TABLE public.jarvis_batch_v2_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid NOT NULL,
  group_id uuid NOT NULL,
  subject_id uuid,
  pdf_name text NOT NULL,
  total_pages int NOT NULL,
  subject_candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'running',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.jarvis_batch_v2_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jarvis_batch_v2_jobs(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  page_from int NOT NULL,
  page_to int NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  chunk_text text,
  question_blocks jsonb,
  batch_id text,
  results jsonb,
  imported_count int NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, chunk_index)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jarvis_batch_v2_jobs TO authenticated;
GRANT ALL ON public.jarvis_batch_v2_jobs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jarvis_batch_v2_chunks TO authenticated;
GRANT ALL ON public.jarvis_batch_v2_chunks TO service_role;
ALTER TABLE public.jarvis_batch_v2_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jarvis_batch_v2_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage v2 jobs" ON public.jarvis_batch_v2_jobs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admins manage v2 chunks" ON public.jarvis_batch_v2_chunks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER touch_jbv2_jobs BEFORE UPDATE ON public.jarvis_batch_v2_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_jbv2_chunks BEFORE UPDATE ON public.jarvis_batch_v2_chunks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX jbv2_chunks_job_idx ON public.jarvis_batch_v2_chunks(job_id, chunk_index);
CREATE INDEX jbv2_jobs_user_idx ON public.jarvis_batch_v2_jobs(user_id, created_at DESC);
ALTER TABLE public.universities ADD COLUMN IF NOT EXISTS lectures_visible boolean NOT NULL DEFAULT false;
CREATE TABLE public.sonic_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running',
  provider text NOT NULL DEFAULT 'gemini',
  model text NOT NULL DEFAULT 'gemini-2.5-flash-lite',
  hint text,
  skip_duplicates boolean NOT NULL DEFAULT false,
  auto_retry boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sonic_jobs TO authenticated;
GRANT ALL ON public.sonic_jobs TO service_role;
ALTER TABLE public.sonic_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sonic_jobs admin all" ON public.sonic_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER sonic_jobs_touch BEFORE UPDATE ON public.sonic_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TABLE public.sonic_pdfs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.sonic_jobs(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  total_pages integer NOT NULL DEFAULT 0,
  course_id uuid NOT NULL,
  group_id uuid NOT NULL,
  subject_id uuid,
  subject_candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  sort_order integer NOT NULL DEFAULT 0,
  imported_count integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sonic_pdfs TO authenticated;
GRANT ALL ON public.sonic_pdfs TO service_role;
ALTER TABLE public.sonic_pdfs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sonic_pdfs admin all" ON public.sonic_pdfs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER sonic_pdfs_touch BEFORE UPDATE ON public.sonic_pdfs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX sonic_pdfs_job_idx ON public.sonic_pdfs(job_id, sort_order);
CREATE TABLE public.sonic_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdf_id uuid NOT NULL REFERENCES public.sonic_pdfs(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  page_from integer NOT NULL,
  page_to integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  chunk_text text,
  question_blocks jsonb,
  results jsonb,
  imported_count integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sonic_chunks TO authenticated;
GRANT ALL ON public.sonic_chunks TO service_role;
ALTER TABLE public.sonic_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sonic_chunks admin all" ON public.sonic_chunks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER sonic_chunks_touch BEFORE UPDATE ON public.sonic_chunks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX sonic_chunks_pdf_idx ON public.sonic_chunks(pdf_id, chunk_index);
CREATE TABLE public.jarvis_batch_v2_ipad_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid NOT NULL,
  group_id uuid NOT NULL,
  subject_id uuid,
  pdf_name text NOT NULL,
  total_pages int NOT NULL,
  subject_candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'running',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.jarvis_batch_v2_ipad_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jarvis_batch_v2_ipad_jobs(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  page_from int NOT NULL,
  page_to int NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  chunk_text text,
  question_blocks jsonb,
  batch_id text,
  results jsonb,
  imported_count int NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, chunk_index)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jarvis_batch_v2_ipad_jobs TO authenticated;
GRANT ALL ON public.jarvis_batch_v2_ipad_jobs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jarvis_batch_v2_ipad_chunks TO authenticated;
GRANT ALL ON public.jarvis_batch_v2_ipad_chunks TO service_role;
ALTER TABLE public.jarvis_batch_v2_ipad_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jarvis_batch_v2_ipad_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage v2 ipad jobs" ON public.jarvis_batch_v2_ipad_jobs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admins manage v2 ipad chunks" ON public.jarvis_batch_v2_ipad_chunks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER touch_jbv2_ipad_jobs BEFORE UPDATE ON public.jarvis_batch_v2_ipad_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_jbv2_ipad_chunks BEFORE UPDATE ON public.jarvis_batch_v2_ipad_chunks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX jbv2_ipad_chunks_job_idx ON public.jarvis_batch_v2_ipad_chunks(job_id, chunk_index);
CREATE INDEX jbv2_ipad_jobs_user_idx ON public.jarvis_batch_v2_ipad_jobs(user_id, created_at DESC);
ALTER TABLE public.jarvis_batch_v2_ipad_jobs
  ADD COLUMN IF NOT EXISTS queue_order INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS jarvis_batch_v2_ipad_jobs_queue_idx
  ON public.jarvis_batch_v2_ipad_jobs (user_id, queue_order, created_at);
CREATE OR REPLACE FUNCTION public.admin_list_all_users()
RETURNS TABLE (
  id uuid,
  email text,
  phone text,
  full_name text,
  username text,
  device_limit integer,
  created_at timestamptz,
  roles text[]
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    COALESCE(p.phone, u.phone::text) AS phone,
    COALESCE(p.full_name, (u.raw_user_meta_data->>'full_name'), '') AS full_name,
    COALESCE(p.username, (u.raw_user_meta_data->>'username'), split_part(u.email::text, '@', 1)) AS username,
    COALESCE(p.device_limit, 2) AS device_limit,
    u.created_at,
    COALESCE(ARRAY(SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = u.id), ARRAY[]::text[]) AS roles
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_all_users() TO authenticated;
CREATE TABLE public.jarvis_batch_german_ipad_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  course_id UUID NOT NULL,
  subject_id UUID NOT NULL,
  pdf_name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'sentences',
  status TEXT NOT NULL DEFAULT 'pending',
  total_images INTEGER NOT NULL DEFAULT 0,
  processed_images INTEGER NOT NULL DEFAULT 0,
  imported_pairs INTEGER NOT NULL DEFAULT 0,
  queue_order INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jarvis_batch_german_ipad_jobs TO authenticated;
GRANT ALL ON public.jarvis_batch_german_ipad_jobs TO service_role;
ALTER TABLE public.jarvis_batch_german_ipad_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage german ipad jobs" ON public.jarvis_batch_german_ipad_jobs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER trg_german_ipad_jobs_touch
BEFORE UPDATE ON public.jarvis_batch_german_ipad_jobs
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TABLE public.jarvis_batch_german_ipad_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jarvis_batch_german_ipad_jobs(id) ON DELETE CASCADE,
  image_index INTEGER NOT NULL,
  page_number INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  pairs_json JSONB,
  imported_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jarvis_batch_german_ipad_chunks TO authenticated;
GRANT ALL ON public.jarvis_batch_german_ipad_chunks TO service_role;
ALTER TABLE public.jarvis_batch_german_ipad_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage german ipad chunks" ON public.jarvis_batch_german_ipad_chunks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER trg_german_ipad_chunks_touch
BEFORE UPDATE ON public.jarvis_batch_german_ipad_chunks
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_german_ipad_chunks_job ON public.jarvis_batch_german_ipad_chunks(job_id, image_index);
CREATE INDEX idx_german_ipad_jobs_user ON public.jarvis_batch_german_ipad_jobs(user_id, created_at DESC);
ALTER TABLE public.jarvis_batch_german_ipad_jobs
  ADD COLUMN IF NOT EXISTS batch_name TEXT,
  ADD COLUMN IF NOT EXISTS batch_status TEXT;
DROP POLICY IF EXISTS "german_courses read auth" ON public.german_courses;
DROP POLICY IF EXISTS "german_items read auth" ON public.german_items;
DROP POLICY IF EXISTS "german_qo read auth" ON public.german_quiz_options;
DROP POLICY IF EXISTS "german_qq read auth" ON public.german_quiz_questions;
DROP POLICY IF EXISTS "german_quizzes read auth" ON public.german_quizzes;
DROP POLICY IF EXISTS "german_sent read auth" ON public.german_sentence_entries;
DROP POLICY IF EXISTS "german_words read auth" ON public.german_word_entries;
CREATE OR REPLACE FUNCTION public.user_owns_any_german_course(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_courses uc
    JOIN public.courses c ON c.id = uc.course_id
    WHERE uc.user_id = _user_id AND c.kind = 'german'
  );
$$;
REVOKE EXECUTE ON FUNCTION public.user_owns_any_german_course(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_owns_any_german_course(uuid) TO authenticated;
CREATE POLICY "german_courses read enrolled" ON public.german_courses
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.user_owns_any_german_course(auth.uid()));
CREATE POLICY "german_items read enrolled" ON public.german_items
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.user_owns_any_german_course(auth.uid()));
CREATE POLICY "german_quizzes read enrolled" ON public.german_quizzes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.user_owns_any_german_course(auth.uid()));
CREATE POLICY "german_qq read enrolled" ON public.german_quiz_questions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.user_owns_any_german_course(auth.uid()));
CREATE POLICY "german_qo read enrolled" ON public.german_quiz_options
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.user_owns_any_german_course(auth.uid()));
CREATE POLICY "german_sent read enrolled" ON public.german_sentence_entries
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.user_owns_any_german_course(auth.uid()));
CREATE POLICY "german_words read enrolled" ON public.german_word_entries
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.user_owns_any_german_course(auth.uid()));
REVOKE EXECUTE ON FUNCTION public.admin_get_user_roles(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_grant_committee_role(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_grant_lecture_course(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_grant_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_all_users() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_committee_members() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_lecture_course_users(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_role_members(public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_marketing_stats() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_committee_role(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_lecture_course(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_manage_committee(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_users_for_group(text, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.toggle_self_admin(boolean) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_owns_lecture_course(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_admin_to_kloryx() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_admin_to_klory_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_user_roles(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_committee_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_all_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_committee_members() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_role_members(public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_marketing_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_committee_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_committee(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_users_for_group(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_self_admin(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_lecture_course(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_lecture_course(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_lecture_course(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_lecture_course_users(uuid) TO authenticated;
-- <<< 20260807150253_5bb77d6c-2fee-470a-a9c5-68b02d24f7d7.sql


-- >>> 20260807150524_521d7cb5-1115-4d5b-97b5-b04ff353d234.sql
CREATE TYPE public.coupon_discount_type AS ENUM ('percent', 'fixed');
CREATE TABLE public.coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_type public.coupon_discount_type NOT NULL DEFAULT 'percent',
  discount_value NUMERIC(10, 2) NOT NULL DEFAULT 100,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX coupons_code_ci ON public.coupons (lower(code));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage coupons"
  ON public.coupons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER coupons_touch_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TABLE public.coupon_courses (
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  PRIMARY KEY (coupon_id, course_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupon_courses TO authenticated;
GRANT ALL ON public.coupon_courses TO service_role;
ALTER TABLE public.coupon_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage coupon_courses"
  ON public.coupon_courses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TABLE public.coupon_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  amount_before NUMERIC(10, 2),
  amount_after NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coupon_id, user_id, course_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupon_redemptions TO authenticated;
GRANT ALL ON public.coupon_redemptions TO service_role;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own redemptions"
  ON public.coupon_redemptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Users record own redemptions"
  ON public.coupon_redemptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage redemptions"
  ON public.coupon_redemptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE OR REPLACE FUNCTION public.validate_coupon(_code TEXT, _course_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _c public.coupons;
  _price numeric;
  _final numeric;
  _applies boolean;
  _already boolean;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'sign_in_required');
  END IF;
  SELECT * INTO _c FROM public.coupons WHERE lower(code) = lower(trim(_code)) LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;
  IF NOT _c.is_active THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'inactive');
  END IF;
  IF _c.starts_at IS NOT NULL AND _c.starts_at > now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_yet_active');
  END IF;
  IF _c.expires_at IS NOT NULL AND _c.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;
  IF _c.max_uses IS NOT NULL AND _c.used_count >= _c.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'used_up');
  END IF;
  IF EXISTS (SELECT 1 FROM public.coupon_courses WHERE coupon_id = _c.id) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.coupon_courses
      WHERE coupon_id = _c.id AND course_id = _course_id
    ) INTO _applies;
    IF NOT _applies THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'course_excluded');
    END IF;
  END IF;
  SELECT price INTO _price FROM public.courses WHERE id = _course_id LIMIT 1;
  IF _price IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'course_not_found');
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.coupon_redemptions
    WHERE coupon_id = _c.id AND user_id = _uid AND course_id = _course_id
  ) INTO _already;
  IF _already THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'already_redeemed');
  END IF;
  IF _c.discount_type = 'percent' THEN
    _final := GREATEST(0, _price - (_price * _c.discount_value / 100.0));
  ELSE
    _final := GREATEST(0, _price - _c.discount_value);
  END IF;
  RETURN jsonb_build_object(
    'valid', true,
    'coupon_id', _c.id,
    'code', _c.code,
    'discount_type', _c.discount_type,
    'discount_value', _c.discount_value,
    'price_before', _price,
    'price_after', _final
  );
END;
$$;
CREATE OR REPLACE FUNCTION public.apply_coupon(_code TEXT, _course_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _v jsonb;
  _cid uuid;
  _final numeric;
  _before numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'sign_in_required'; END IF;
  _v := public.validate_coupon(_code, _course_id);
  IF NOT (_v->>'valid')::boolean THEN
    RETURN _v;
  END IF;
  _cid := (_v->>'coupon_id')::uuid;
  _final := (_v->>'price_after')::numeric;
  _before := (_v->>'price_before')::numeric;
  INSERT INTO public.coupon_redemptions (coupon_id, user_id, course_id, amount_before, amount_after)
  VALUES (_cid, _uid, _course_id, _before, _final)
  ON CONFLICT (coupon_id, user_id, course_id) DO NOTHING;
  UPDATE public.coupons SET used_count = used_count + 1 WHERE id = _cid;
  IF _final <= 0 THEN
    INSERT INTO public.user_courses (user_id, course_id)
    VALUES (_uid, _course_id)
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END IF;
  RETURN jsonb_set(_v, '{redeemed}', 'true'::jsonb);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.validate_coupon(TEXT, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.apply_coupon(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_coupon(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_coupon(TEXT, UUID) TO authenticated;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.question_options ALTER COLUMN text DROP NOT NULL;
CREATE POLICY "question images insert by admins"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'question-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "question images update by admins"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'question-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "question images delete by admins"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'question-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "question images readable by entitled users"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'question-images'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.questions q
      JOIN public.subjects s ON s.id = q.subject_id
      JOIN public.subject_groups sg ON sg.id = s.group_id
      WHERE q.image_url = storage.objects.name
        AND (
          s.access_level IN ('free_public'::public.subject_access, 'free_logged_in'::public.subject_access)
          OR EXISTS (
            SELECT 1 FROM public.user_courses uc
            WHERE uc.user_id = auth.uid() AND uc.course_id = sg.course_id
          )
        )
    )
  )
);
CREATE TABLE public.site_content (
  key text PRIMARY KEY,
  group_key text NOT NULL,
  group_label text NOT NULL,
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'text',
  sort_order integer NOT NULL DEFAULT 0,
  value_en text NOT NULL DEFAULT '',
  value_ar text NOT NULL DEFAULT '',
  default_en text NOT NULL DEFAULT '',
  default_ar text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_content TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_content TO authenticated;
GRANT ALL ON public.site_content TO service_role;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_content public read"
  ON public.site_content FOR SELECT
  USING (true);
CREATE POLICY "site_content admin write"
  ON public.site_content FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER site_content_touch_updated_at
  BEFORE UPDATE ON public.site_content
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX site_content_group_idx ON public.site_content (group_key, sort_order);
CREATE TABLE public.site_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title_en text NOT NULL DEFAULT '',
  title_ar text NOT NULL DEFAULT '',
  seo_description_en text NOT NULL DEFAULT '',
  seo_description_ar text NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_pages TO authenticated;
GRANT ALL ON public.site_pages TO service_role;
ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published pages are public" ON public.site_pages FOR SELECT USING (published OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage pages" ON public.site_pages FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER site_pages_touch BEFORE UPDATE ON public.site_pages FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TABLE public.site_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.site_pages(id) ON DELETE CASCADE,
  parent_section_id uuid REFERENCES public.site_sections(id) ON DELETE CASCADE,
  builtin_key text,
  title_en text NOT NULL DEFAULT '',
  title_ar text NOT NULL DEFAULT '',
  description_en text NOT NULL DEFAULT '',
  description_ar text NOT NULL DEFAULT '',
  layout text NOT NULL DEFAULT 'stack',
  visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX site_sections_page_idx ON public.site_sections(page_id, sort_order);
GRANT SELECT ON public.site_sections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_sections TO authenticated;
GRANT ALL ON public.site_sections TO service_role;
ALTER TABLE public.site_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sections of published pages are public" ON public.site_sections FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (visible AND EXISTS (SELECT 1 FROM public.site_pages p WHERE p.id = page_id AND p.published))
);
CREATE POLICY "Admins manage sections" ON public.site_sections FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER site_sections_touch BEFORE UPDATE ON public.site_sections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TABLE public.site_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.site_sections(id) ON DELETE CASCADE,
  kind text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX site_blocks_section_idx ON public.site_blocks(section_id, sort_order);
GRANT SELECT ON public.site_blocks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_blocks TO authenticated;
GRANT ALL ON public.site_blocks TO service_role;
ALTER TABLE public.site_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Blocks of published pages are public" ON public.site_blocks FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (visible AND EXISTS (
    SELECT 1 FROM public.site_sections s JOIN public.site_pages p ON p.id = s.page_id
    WHERE s.id = section_id AND s.visible AND p.published
  ))
);
CREATE POLICY "Admins manage blocks" ON public.site_blocks FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER site_blocks_touch BEFORE UPDATE ON public.site_blocks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TABLE public.site_nav_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement text NOT NULL DEFAULT 'header',
  label_en text NOT NULL DEFAULT '',
  label_ar text NOT NULL DEFAULT '',
  target_kind text NOT NULL DEFAULT 'route',
  target_value text NOT NULL DEFAULT '/',
  style text NOT NULL DEFAULT 'link',
  visibility text NOT NULL DEFAULT 'all',
  visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX site_nav_items_placement_idx ON public.site_nav_items(placement, sort_order);
GRANT SELECT ON public.site_nav_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_nav_items TO authenticated;
GRANT ALL ON public.site_nav_items TO service_role;
ALTER TABLE public.site_nav_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Nav items are public" ON public.site_nav_items FOR SELECT USING (true);
CREATE POLICY "Admins manage nav items" ON public.site_nav_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER site_nav_items_touch BEFORE UPDATE ON public.site_nav_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.site_pages (slug, title_en, title_ar, published, is_system, sort_order)
VALUES ('home', 'Home', 'الرئيسية', true, true, 0);
INSERT INTO public.site_sections (page_id, builtin_key, title_en, sort_order)
SELECT p.id, k.key, k.label, k.ord
FROM public.site_pages p,
  (VALUES ('hero','Hero',0),('feature1','Feature row 1',1),('courses','Courses strip',2),
          ('packages','Packages strip',3),('feature2','Feature row 2',4),
          ('universities','Universities strip',5),('footer_cta','Footer call to action',6)) AS k(key,label,ord)
WHERE p.slug = 'home';
CREATE POLICY "site-media readable" ON storage.objects FOR SELECT TO authenticated, anon USING (bucket_id = 'site-media');
CREATE POLICY "site-media admin insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'site-media' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "site-media admin update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'site-media' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "site-media admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'site-media' AND public.has_role(auth.uid(), 'admin'::public.app_role));
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'default';
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_admin_to_kloryx() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_admin_to_klory_email() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM anon, authenticated;
CREATE TABLE public.university_tiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'custom',
  title_en text NOT NULL DEFAULT '',
  title_ar text NOT NULL DEFAULT '',
  subtitle_en text NOT NULL DEFAULT '',
  subtitle_ar text NOT NULL DEFAULT '',
  badge_en text NOT NULL DEFAULT '',
  badge_ar text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'Sparkles',
  href text NOT NULL DEFAULT '',
  visible boolean NOT NULL DEFAULT true,
  highlighted boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT university_tiles_kind_check CHECK (kind IN ('courses','lectures','resources','custom'))
);
CREATE INDEX university_tiles_university_idx ON public.university_tiles (university_id, sort_order);
GRANT SELECT ON public.university_tiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.university_tiles TO authenticated;
GRANT ALL ON public.university_tiles TO service_role;
ALTER TABLE public.university_tiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view university tiles"
  ON public.university_tiles FOR SELECT
  USING (true);
CREATE POLICY "Admins manage university tiles"
  ON public.university_tiles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER university_tiles_touch_updated_at
  BEFORE UPDATE ON public.university_tiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.university_tiles
  (university_id, kind, title_en, title_ar, subtitle_en, subtitle_ar, icon, href, visible, highlighted, sort_order)
SELECT u.id, 'courses', 'Courses', 'الكورسات',
       'Question banks · Year-by-year syllabus', 'بنوك الأسئلة · منهج سنة بسنة',
       'BookOpen', '/courses', true, true, 0
FROM public.universities u;
INSERT INTO public.university_tiles
  (university_id, kind, title_en, title_ar, subtitle_en, subtitle_ar, icon, href, visible, highlighted, sort_order)
SELECT u.id, 'lectures', 'Lectures', 'المحاضرات',
       'Video lectures with quizzes', 'محاضرات مصوّرة مع اختبارات',
       'Video', '/lectures', COALESCE(u.lectures_visible, false), false, 1
FROM public.universities u;
INSERT INTO public.university_tiles
  (university_id, kind, title_en, title_ar, subtitle_en, subtitle_ar, icon, href, visible, highlighted, sort_order)
SELECT u.id, 'resources', 'Resources', 'المصادر',
       'Free books, past papers & study material', 'كتب مجانية وأوراق سابقة ومواد دراسية',
       'Library', '/committee', true, true, 2
FROM public.universities u;
CREATE TABLE public.committee_semesters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_id uuid NOT NULL REFERENCES public.committee_years(id) ON DELETE CASCADE,
  name text NOT NULL,
  number integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.committee_semesters TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.committee_semesters TO authenticated;
GRANT ALL ON public.committee_semesters TO service_role;
ALTER TABLE public.committee_semesters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read semesters" ON public.committee_semesters
FOR SELECT USING (true);
CREATE POLICY "committee manage semesters" ON public.committee_semesters
TO authenticated
USING (public.can_manage_committee(auth.uid()))
WITH CHECK (public.can_manage_committee(auth.uid()));
CREATE INDEX committee_semesters_year_idx ON public.committee_semesters(year_id);
CREATE TRIGGER touch_committee_semesters BEFORE UPDATE ON public.committee_semesters
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.committee_subjects
  ADD COLUMN semester_id uuid REFERENCES public.committee_semesters(id) ON DELETE CASCADE;
CREATE INDEX committee_subjects_semester_idx ON public.committee_subjects(semester_id);
INSERT INTO public.committee_semesters (year_id, name, number, sort_order)
SELECT y.id, 'Semester ' || n, n, n
FROM public.committee_years y
CROSS JOIN generate_series(1, 2) AS n
WHERE y.year_number BETWEEN 1 AND 6;
UPDATE public.committee_subjects s
SET semester_id = sem.id
FROM public.committee_semesters sem
JOIN public.committee_years y ON y.id = sem.year_id
WHERE sem.year_id = s.year_id
  AND sem.number = 1
  AND y.year_number BETWEEN 1 AND 6
  AND s.semester_id IS NULL;
INSERT INTO public.profiles (id, full_name, username, email, phone)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', ''),
  COALESCE(NULLIF(u.raw_user_meta_data->>'username',''), split_part(u.email::text,'@',1), u.id::text),
  COALESCE(u.email::text, ''),
  NULLIF(COALESCE(u.raw_user_meta_data->>'phone', u.phone::text), '')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;
CREATE OR REPLACE FUNCTION public.search_users_for_group(_query text, _exclude uuid)
 RETURNS TABLE(id uuid, username text, full_name text, email text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT
    u.id,
    COALESCE(p.username, u.raw_user_meta_data->>'username', split_part(u.email::text,'@',1)) AS username,
    COALESCE(p.full_name, u.raw_user_meta_data->>'full_name', '') AS full_name,
    COALESCE(p.email, u.email::text) AS email
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id <> COALESCE(_exclude, '00000000-0000-0000-0000-000000000000'::uuid)
    AND (
      COALESCE(p.username, u.raw_user_meta_data->>'username', '') ILIKE '%' || _query || '%'
      OR COALESCE(p.email, u.email::text, '') ILIKE '%' || _query || '%'
      OR COALESCE(p.full_name, u.raw_user_meta_data->>'full_name', '') ILIKE '%' || _query || '%'
    )
  ORDER BY 2
  LIMIT 20;
END;
$function$;
CREATE OR REPLACE FUNCTION public.admin_list_role_members(_role app_role)
 RETURNS TABLE(user_id uuid, username text, full_name text, email text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT
    ur.user_id,
    COALESCE(p.username, u.raw_user_meta_data->>'username', split_part(u.email::text,'@',1)) AS username,
    COALESCE(p.full_name, u.raw_user_meta_data->>'full_name', '') AS full_name,
    COALESCE(p.email, u.email::text) AS email
  FROM public.user_roles ur
  JOIN auth.users u ON u.id = ur.user_id
  LEFT JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = _role
  ORDER BY 2;
END;
$function$;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS lock_reason text;
ALTER TABLE public.user_devices
  ADD COLUMN IF NOT EXISTS nickname text;
CREATE TABLE IF NOT EXISTS public.device_security_settings (
  id boolean NOT NULL PRIMARY KEY DEFAULT true CHECK (id),
  unlock_code text NOT NULL DEFAULT 'Shadyx1234@',
  telegram_url text NOT NULL DEFAULT 'https://t.me/',
  support_url text NOT NULL DEFAULT '',
  default_device_limit integer NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.device_security_settings TO authenticated;
GRANT ALL ON public.device_security_settings TO service_role;
ALTER TABLE public.device_security_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read device security settings" ON public.device_security_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admins insert device security settings" ON public.device_security_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admins update device security settings" ON public.device_security_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER trg_device_security_settings_touch
  BEFORE UPDATE ON public.device_security_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.device_security_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
CREATE TABLE IF NOT EXISTS public.device_unlock_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  success boolean NOT NULL DEFAULT false,
  code_used text,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_device_unlock_attempts_user ON public.device_unlock_attempts(user_id, created_at DESC);
GRANT SELECT ON public.device_unlock_attempts TO authenticated;
GRANT ALL ON public.device_unlock_attempts TO service_role;
ALTER TABLE public.device_unlock_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read unlock attempts" ON public.device_unlock_attempts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS show_signature boolean NOT NULL DEFAULT true;
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS protect_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS protect_watermark_opacity numeric NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS protect_blur_on_blur boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS protect_block_print boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS protect_block_copy boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS protect_consent_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS protect_devtools_guard boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS protect_auto_lock_threshold integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS protect_terms_en text,
  ADD COLUMN IF NOT EXISTS protect_terms_ar text;
CREATE TABLE IF NOT EXISTS public.content_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  context text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  ua text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_events_user_idx ON public.content_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS content_events_created_idx ON public.content_events (created_at DESC);
GRANT SELECT ON public.content_events TO authenticated;
GRANT ALL ON public.content_events TO service_role;
ALTER TABLE public.content_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read all content events"
  ON public.content_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TABLE IF NOT EXISTS public.content_consents (
  user_id uuid NOT NULL,
  scope text NOT NULL DEFAULT 'global',
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip text,
  ua text,
  PRIMARY KEY (user_id, scope)
);
GRANT SELECT ON public.content_consents TO authenticated;
GRANT ALL ON public.content_consents TO service_role;
ALTER TABLE public.content_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own consents"
  ON public.content_consents FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins read all consents"
  ON public.content_consents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
-- <<< 20260807150524_521d7cb5-1115-4d5b-97b5-b04ff353d234.sql


-- >>> 20260808142226_4d14a66b-64b5-48eb-8349-e5ee2e645365.sql
CREATE TABLE public.site_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  href text,
  href_label text,
  style text NOT NULL DEFAULT 'ribbon',
  accent text NOT NULL DEFAULT '#e11d48',
  urgent boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_announcements TO anon;
GRANT SELECT ON public.site_announcements TO authenticated;
GRANT ALL ON public.site_announcements TO service_role;
ALTER TABLE public.site_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view announcements" ON public.site_announcements FOR SELECT USING (true);
CREATE POLICY "Admins manage announcements" ON public.site_announcements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER site_announcements_touch BEFORE UPDATE ON public.site_announcements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS badge text,
  ADD COLUMN IF NOT EXISTS badge_color text,
  ADD COLUMN IF NOT EXISTS badge_expires_at timestamptz;

ALTER TABLE public.committee_resources ADD COLUMN IF NOT EXISTS is_protected boolean NOT NULL DEFAULT true;

CREATE TABLE public.support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_no bigint GENERATED BY DEFAULT AS IDENTITY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'other',
  subject text NOT NULL DEFAULT '',
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  admin_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.support_requests TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.support_requests TO authenticated;
GRANT ALL ON public.support_requests TO service_role;
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can send a support request"
  ON public.support_requests FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(message) BETWEEN 1 AND 4000
    AND length(subject) <= 200
    AND length(name) <= 120
    AND length(email) <= 200
    AND length(category) <= 40
    AND admin_notes = ''
    AND status = 'new'
    AND (user_id IS NULL OR user_id = auth.uid())
  );
CREATE POLICY "Admins can read support requests" ON public.support_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update support requests" ON public.support_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete support requests" ON public.support_requests FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER support_requests_touch BEFORE UPDATE ON public.support_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX support_requests_created_idx ON public.support_requests (created_at DESC);

CREATE TABLE public.support_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'link',
  icon text NOT NULL DEFAULT 'link',
  label_en text NOT NULL DEFAULT '',
  label_ar text NOT NULL DEFAULT '',
  value text NOT NULL DEFAULT '',
  href text NOT NULL DEFAULT '',
  visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.support_channels TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.support_channels TO authenticated;
GRANT ALL ON public.support_channels TO service_role;
ALTER TABLE public.support_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view support channels" ON public.support_channels FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage support channels" ON public.support_channels FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER support_channels_touch BEFORE UPDATE ON public.support_channels
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.support_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  page_enabled boolean NOT NULL DEFAULT true,
  form_enabled boolean NOT NULL DEFAULT true,
  channels_enabled boolean NOT NULL DEFAULT true,
  intro_title_en text NOT NULL DEFAULT 'Need a hand?',
  intro_title_ar text NOT NULL DEFAULT 'تحتاج مساعدة؟',
  intro_text_en text NOT NULL DEFAULT 'Tell us what is going on and our team will get back to you.',
  intro_text_ar text NOT NULL DEFAULT 'أخبرنا بما يحدث وسيتواصل معك فريقنا.',
  response_note_en text NOT NULL DEFAULT 'We usually reply within 24 hours.',
  response_note_ar text NOT NULL DEFAULT 'نرد عادة خلال 24 ساعة.',
  categories jsonb NOT NULL DEFAULT '[{"key":"payment","en":"Payment","ar":"الدفع"},{"key":"access","en":"Course access","ar":"الوصول للدورات"},{"key":"technical","en":"Technical","ar":"مشكلة تقنية"},{"key":"other","en":"Other","ar":"أخرى"}]'::jsonb,
  notify_enabled boolean NOT NULL DEFAULT false,
  notify_email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.support_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.support_settings TO authenticated;
GRANT ALL ON public.support_settings TO service_role;
ALTER TABLE public.support_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view support settings" ON public.support_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage support settings" ON public.support_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER support_settings_touch BEFORE UPDATE ON public.support_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.support_settings (id) VALUES (true);

CREATE TABLE public.about_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'story',
  title_en text NOT NULL DEFAULT '',
  title_ar text NOT NULL DEFAULT '',
  body_en text NOT NULL DEFAULT '',
  body_ar text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  link_url text NOT NULL DEFAULT '',
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.about_blocks TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.about_blocks TO authenticated;
GRANT ALL ON public.about_blocks TO service_role;
ALTER TABLE public.about_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view about blocks" ON public.about_blocks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage about blocks" ON public.about_blocks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER about_blocks_touch BEFORE UPDATE ON public.about_blocks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.about_blocks (kind, title_en, title_ar, body_en, body_ar, sort_order) VALUES
  ('hero', 'About us', 'من نحن', 'Medical study, made clear.', 'دراسة الطب، بوضوح.', 0),
  ('story', 'Our story', 'قصتنا', 'We started as a small group of medical students who wanted a better way to study — organised question banks, real resources, and no wasted time.', 'بدأنا كمجموعة صغيرة من طلاب الطب أرادوا طريقة أفضل للدراسة — بنوك أسئلة منظمة، ومصادر حقيقية، ودون إضاعة للوقت.', 1),
  ('stats', 'By the numbers', 'بالأرقام', '', '', 2),
  ('cta', 'Ready to start?', 'جاهز للبدء؟', 'Browse the courses and pick up where you left off.', 'تصفح الدورات وأكمل من حيث توقفت.', 3);

CREATE TABLE public.user_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#e11d48',
  kind text NOT NULL DEFAULT 'manual',
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.packages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_groups TO authenticated;
GRANT ALL ON public.user_groups TO service_role;
ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage user groups" ON public.user_groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER user_groups_touch BEFORE UPDATE ON public.user_groups
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.user_group_members (
  group_id uuid NOT NULL REFERENCES public.user_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_group_members TO authenticated;
GRANT ALL ON public.user_group_members TO service_role;
ALTER TABLE public.user_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage group members" ON public.user_group_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.announcement_audiences (
  announcement_id uuid NOT NULL REFERENCES public.site_announcements(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.user_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (announcement_id, group_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcement_audiences TO authenticated;
GRANT ALL ON public.announcement_audiences TO service_role;
ALTER TABLE public.announcement_audiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage announcement audiences" ON public.announcement_audiences FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.user_in_group(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE g public.user_groups;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  SELECT * INTO g FROM public.user_groups WHERE id = _group_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.user_group_members m
             WHERE m.group_id = _group_id AND m.user_id = _user_id) THEN
    RETURN true;
  END IF;
  IF g.kind = 'everyone' THEN RETURN true; END IF;
  IF g.kind = 'admins' THEN
    RETURN public.has_role(_user_id, 'admin'::public.app_role);
  END IF;
  IF g.kind = 'committee' THEN
    RETURN public.has_role(_user_id, 'committee'::public.app_role);
  END IF;
  IF g.kind = 'course_owners' THEN
    RETURN EXISTS (SELECT 1 FROM public.user_courses uc
                   WHERE uc.user_id = _user_id AND uc.course_id = g.course_id);
  END IF;
  IF g.kind = 'package_owners' THEN
    RETURN EXISTS (SELECT 1 FROM public.package_purchases pp
                   WHERE pp.user_id = _user_id AND pp.package_id = g.package_id);
  END IF;
  IF g.kind = 'no_course' THEN
    RETURN NOT EXISTS (SELECT 1 FROM public.user_courses uc WHERE uc.user_id = _user_id);
  END IF;
  RETURN false;
END; $$;

CREATE OR REPLACE FUNCTION public.my_announcements()
RETURNS SETOF public.site_announcements
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.* FROM public.site_announcements a
  WHERE NOT EXISTS (SELECT 1 FROM public.announcement_audiences aa WHERE aa.announcement_id = a.id)
     OR EXISTS (
       SELECT 1 FROM public.announcement_audiences aa
       WHERE aa.announcement_id = a.id
         AND public.user_in_group(auth.uid(), aa.group_id)
     )
  ORDER BY a.sort ASC, a.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.my_announcements() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_group_members(_group_id uuid)
RETURNS TABLE(user_id uuid, username text, full_name text, email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT u.id,
    COALESCE(p.username, u.raw_user_meta_data->>'username', split_part(u.email::text,'@',1)),
    COALESCE(p.full_name, u.raw_user_meta_data->>'full_name', ''),
    COALESCE(p.email, u.email::text)
  FROM public.user_group_members m
  JOIN auth.users u ON u.id = m.user_id
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.group_id = _group_id
  ORDER BY 2;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_group_counts()
RETURNS TABLE(group_id uuid, member_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT g.id,
    (SELECT count(*) FROM auth.users u WHERE public.user_in_group(u.id, g.id))::bigint
  FROM public.user_groups g;
END; $$;

REVOKE EXECUTE ON FUNCTION public.user_in_group(uuid, uuid) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_server_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'storage'
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT jsonb_build_object(
    'db_size_bytes', pg_database_size(current_database()),
    'generated_at', now(),
    'buckets', COALESCE((
      SELECT jsonb_agg(b ORDER BY (b->>'bytes')::bigint DESC) FROM (
        SELECT jsonb_build_object(
          'bucket', o.bucket_id,
          'files', count(*),
          'bytes', COALESCE(sum(COALESCE((o.metadata->>'size')::bigint, 0)), 0),
          'largest_bytes', COALESCE(max(COALESCE((o.metadata->>'size')::bigint, 0)), 0),
          'last_upload', max(o.created_at)
        ) AS b
        FROM storage.objects o
        GROUP BY o.bucket_id
      ) s
    ), '[]'::jsonb),
    'growth', jsonb_build_object(
      'bytes_30d', COALESCE((SELECT sum(COALESCE((metadata->>'size')::bigint,0)) FROM storage.objects WHERE created_at >= now() - interval '30 days'), 0),
      'bytes_90d', COALESCE((SELECT sum(COALESCE((metadata->>'size')::bigint,0)) FROM storage.objects WHERE created_at >= now() - interval '90 days'), 0),
      'files_30d', (SELECT count(*) FROM storage.objects WHERE created_at >= now() - interval '30 days')
    ),
    'largest_files', COALESCE((
      SELECT jsonb_agg(f) FROM (
        SELECT jsonb_build_object(
          'bucket', o.bucket_id,
          'name', o.name,
          'bytes', COALESCE((o.metadata->>'size')::bigint, 0),
          'created_at', o.created_at
        ) AS f
        FROM storage.objects o
        ORDER BY COALESCE((o.metadata->>'size')::bigint, 0) DESC
        LIMIT 25
      ) s2
    ), '[]'::jsonb),
    'tables', COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT jsonb_build_object(
          'name', c.relname,
          'bytes', pg_total_relation_size(c.oid),
          'rows', GREATEST(c.reltuples::bigint, 0)
        ) AS t
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY pg_total_relation_size(c.oid) DESC
        LIMIT 15
      ) s3
    ), '[]'::jsonb),
    'content', jsonb_build_object(
      'courses', (SELECT count(*) FROM public.courses),
      'subjects', (SELECT count(*) FROM public.subjects),
      'questions', (SELECT count(*) FROM public.questions),
      'lectures', (SELECT count(*) FROM public.lecture_items),
      'committee_resources', (SELECT count(*) FROM public.committee_resources),
      'users', (SELECT count(*) FROM public.profiles),
      'active_sessions', (SELECT count(*) FROM public.user_sessions WHERE last_seen_at >= now() - interval '5 minutes')
    )
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_server_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_server_stats() TO authenticated;

ALTER TABLE public.profiles ALTER COLUMN device_limit DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN device_limit DROP DEFAULT;
UPDATE public.profiles SET device_limit = NULL WHERE device_limit = 2;
-- <<< 20260808142226_4d14a66b-64b5-48eb-8349-e5ee2e645365.sql


-- >>> 20260808142501_e7686a76-a7e4-4620-ad6a-06a80e6ad548.sql
CREATE OR REPLACE FUNCTION public.account_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NULL
      OR public.has_role(_user_id, 'admin'::public.app_role)
      OR NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = _user_id AND p.locked_at IS NOT NULL
      );
$$;
REVOKE EXECUTE ON FUNCTION public.account_active(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_active(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "View questions if enrolled or admin" ON public.questions;
CREATE POLICY "View questions if enrolled or admin"
  ON public.questions FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      public.account_active(auth.uid())
      AND EXISTS (
        SELECT 1 FROM subjects s
        JOIN subject_groups sg ON sg.id = s.group_id
        JOIN user_courses uc ON uc.course_id = sg.course_id
        WHERE s.id = questions.subject_id AND uc.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "View question_options if enrolled or admin" ON public.question_options;
CREATE POLICY "View question_options if enrolled or admin"
  ON public.question_options FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      public.account_active(auth.uid())
      AND EXISTS (
        SELECT 1 FROM questions q
        JOIN subjects s ON s.id = q.subject_id
        JOIN subject_groups sg ON sg.id = s.group_id
        JOIN user_courses uc ON uc.course_id = sg.course_id
        WHERE q.id = question_options.question_id AND uc.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "public read resources" ON public.committee_resources;
CREATE POLICY "public read resources"
  ON public.committee_resources FOR SELECT
  USING (auth.uid() IS NULL OR public.account_active(auth.uid()));

ALTER TABLE public.committee_resources
  ADD COLUMN IF NOT EXISTS storage_provider text NOT NULL DEFAULT 'lovable',
  ADD COLUMN IF NOT EXISTS drive_file_id text,
  ADD COLUMN IF NOT EXISTS drive_web_link text,
  ADD COLUMN IF NOT EXISTS drive_download_link text,
  ADD COLUMN IF NOT EXISTS file_size bigint;
CREATE INDEX IF NOT EXISTS committee_resources_storage_provider_idx
  ON public.committee_resources (storage_provider);

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS committee_default_storage text NOT NULL DEFAULT 'drive',
  ADD COLUMN IF NOT EXISTS brand_style text NOT NULL DEFAULT 'aqua-flow',
  ADD COLUMN IF NOT EXISTS study_plan_path text,
  ADD COLUMN IF NOT EXISTS study_plan_title text,
  ADD COLUMN IF NOT EXISTS study_plan_subtitle text,
  ADD COLUMN IF NOT EXISTS transfer_code text NOT NULL DEFAULT 'Shadyx1234@Lucifer';

CREATE TABLE public.committee_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id uuid NOT NULL REFERENCES public.committee_semesters(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon_key text NOT NULL DEFAULT 'layers',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX committee_modules_semester_idx ON public.committee_modules(semester_id);
GRANT SELECT ON public.committee_modules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.committee_modules TO authenticated;
GRANT ALL ON public.committee_modules TO service_role;
ALTER TABLE public.committee_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read modules" ON public.committee_modules FOR SELECT USING (true);
CREATE POLICY "committee manage modules" ON public.committee_modules FOR ALL TO authenticated
  USING (public.can_manage_committee(auth.uid())) WITH CHECK (public.can_manage_committee(auth.uid()));
CREATE TRIGGER touch_committee_modules BEFORE UPDATE ON public.committee_modules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.committee_subjects
  ADD COLUMN IF NOT EXISTS module_id uuid REFERENCES public.committee_modules(id) ON DELETE CASCADE;
CREATE INDEX committee_subjects_module_idx ON public.committee_subjects(module_id);

CREATE TABLE public.committee_subject_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.committee_subjects(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  offer_label text,
  original_price numeric(10,2),
  promo_price numeric(10,2),
  note text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX committee_subject_courses_subject_idx ON public.committee_subject_courses(subject_id);
GRANT SELECT ON public.committee_subject_courses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.committee_subject_courses TO authenticated;
GRANT ALL ON public.committee_subject_courses TO service_role;
ALTER TABLE public.committee_subject_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read subject courses" ON public.committee_subject_courses FOR SELECT USING (true);
CREATE POLICY "committee manage subject courses" ON public.committee_subject_courses FOR ALL TO authenticated
  USING (public.can_manage_committee(auth.uid())) WITH CHECK (public.can_manage_committee(auth.uid()));
CREATE TRIGGER touch_committee_subject_courses BEFORE UPDATE ON public.committee_subject_courses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.committee_resources DROP CONSTRAINT IF EXISTS committee_resources_kind_check;
ALTER TABLE public.committee_resources ADD CONSTRAINT committee_resources_kind_check
  CHECK (kind = ANY (ARRAY['pdf'::text, 'link'::text, 'folder'::text, 'video'::text]));

ALTER TABLE public.committee_subjects
  ADD COLUMN IF NOT EXISTS tag_label text,
  ADD COLUMN IF NOT EXISTS tag_color text NOT NULL DEFAULT 'amber';

ALTER TABLE public.committee_years
  ADD COLUMN IF NOT EXISTS is_closed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS closed_note text,
  ADD COLUMN IF NOT EXISTS closed_color text NOT NULL DEFAULT 'amber',
  ADD COLUMN IF NOT EXISTS closed_style text NOT NULL DEFAULT 'ribbon';
ALTER TABLE public.committee_semesters
  ADD COLUMN IF NOT EXISTS is_closed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS closed_note text,
  ADD COLUMN IF NOT EXISTS closed_color text NOT NULL DEFAULT 'amber',
  ADD COLUMN IF NOT EXISTS closed_style text NOT NULL DEFAULT 'ribbon';
ALTER TABLE public.committee_modules
  ADD COLUMN IF NOT EXISTS is_closed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS closed_note text,
  ADD COLUMN IF NOT EXISTS closed_color text NOT NULL DEFAULT 'amber',
  ADD COLUMN IF NOT EXISTS closed_style text NOT NULL DEFAULT 'ribbon';
ALTER TABLE public.committee_subjects
  ADD COLUMN IF NOT EXISTS is_closed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS closed_note text,
  ADD COLUMN IF NOT EXISTS closed_color text NOT NULL DEFAULT 'amber',
  ADD COLUMN IF NOT EXISTS closed_style text NOT NULL DEFAULT 'ribbon';

CREATE TABLE public.committee_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_label text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  entity_label text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.committee_activity_log TO authenticated;
GRANT ALL ON public.committee_activity_log TO service_role;
ALTER TABLE public.committee_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read the committee log"
  ON public.committee_activity_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX committee_activity_log_created_idx ON public.committee_activity_log (created_at DESC);

CREATE OR REPLACE FUNCTION public.log_committee_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row jsonb;
  _uid uuid := auth.uid();
  _label text;
  _actor text;
  _action text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _row := to_jsonb(OLD);
    _action := 'deleted';
  ELSIF TG_OP = 'INSERT' THEN
    _row := to_jsonb(NEW);
    _action := 'added';
  ELSE
    _row := to_jsonb(NEW);
    _action := 'edited';
  END IF;
  _label := COALESCE(
    _row->>'title', _row->>'display_name', _row->>'name', _row->>'label',
    _row->>'promo_label', (_row->>'year_number'), ''
  );
  SELECT COALESCE(p.username, p.full_name, p.email) INTO _actor
  FROM public.profiles p WHERE p.id = _uid;
  INSERT INTO public.committee_activity_log
    (actor_id, actor_label, action, entity_type, entity_id, entity_label, details)
  VALUES (_uid, _actor, _action, TG_TABLE_NAME, (_row->>'id')::uuid, _label, _row);
  RETURN NULL;
END;
$$;

CREATE TRIGGER log_committee_years AFTER INSERT OR UPDATE OR DELETE ON public.committee_years
  FOR EACH ROW EXECUTE FUNCTION public.log_committee_change();
CREATE TRIGGER log_committee_semesters AFTER INSERT OR UPDATE OR DELETE ON public.committee_semesters
  FOR EACH ROW EXECUTE FUNCTION public.log_committee_change();
CREATE TRIGGER log_committee_modules AFTER INSERT OR UPDATE OR DELETE ON public.committee_modules
  FOR EACH ROW EXECUTE FUNCTION public.log_committee_change();
CREATE TRIGGER log_committee_subjects AFTER INSERT OR UPDATE OR DELETE ON public.committee_subjects
  FOR EACH ROW EXECUTE FUNCTION public.log_committee_change();
CREATE TRIGGER log_committee_categories AFTER INSERT OR UPDATE OR DELETE ON public.committee_categories
  FOR EACH ROW EXECUTE FUNCTION public.log_committee_change();
CREATE TRIGGER log_committee_resources AFTER INSERT OR UPDATE OR DELETE ON public.committee_resources
  FOR EACH ROW EXECUTE FUNCTION public.log_committee_change();
CREATE TRIGGER log_committee_subject_courses AFTER INSERT OR UPDATE OR DELETE ON public.committee_subject_courses
  FOR EACH ROW EXECUTE FUNCTION public.log_committee_change();

GRANT EXECUTE ON FUNCTION public.account_active(uuid) TO anon;

CREATE TABLE public.admin_hub_layout (
  id boolean PRIMARY KEY DEFAULT true,
  layout jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_hub_layout_singleton CHECK (id)
);
GRANT SELECT ON public.admin_hub_layout TO authenticated;
GRANT ALL ON public.admin_hub_layout TO service_role;
ALTER TABLE public.admin_hub_layout ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read admin hub layout"
  ON public.admin_hub_layout FOR SELECT TO authenticated USING (true);
CREATE TRIGGER admin_hub_layout_touch BEFORE UPDATE ON public.admin_hub_layout
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.study_plan_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title_en text NOT NULL,
  title_ar text,
  subtitle_en text,
  subtitle_ar text,
  has_semesters boolean NOT NULL DEFAULT true,
  has_finals boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.study_plan_stages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_plan_stages TO authenticated;
GRANT ALL ON public.study_plan_stages TO service_role;
ALTER TABLE public.study_plan_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Study plan stages are viewable by everyone"
  ON public.study_plan_stages FOR SELECT USING (true);
CREATE POLICY "Committee managers manage study plan stages"
  ON public.study_plan_stages FOR ALL TO authenticated
  USING (public.can_manage_committee(auth.uid()))
  WITH CHECK (public.can_manage_committee(auth.uid()));
CREATE TRIGGER touch_study_plan_stages BEFORE UPDATE ON public.study_plan_stages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.study_plan_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES public.study_plan_stages(id) ON DELETE CASCADE,
  semester smallint,
  is_final boolean NOT NULL DEFAULT false,
  name text NOT NULL,
  assessment text NOT NULL DEFAULT 'exam',
  note text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_study_plan_subjects_stage ON public.study_plan_subjects(stage_id, semester, sort_order);
GRANT SELECT ON public.study_plan_subjects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_plan_subjects TO authenticated;
GRANT ALL ON public.study_plan_subjects TO service_role;
ALTER TABLE public.study_plan_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Study plan subjects are viewable by everyone"
  ON public.study_plan_subjects FOR SELECT USING (true);
CREATE POLICY "Committee managers manage study plan subjects"
  ON public.study_plan_subjects FOR ALL TO authenticated
  USING (public.can_manage_committee(auth.uid()))
  WITH CHECK (public.can_manage_committee(auth.uid()));
CREATE TRIGGER touch_study_plan_subjects BEFORE UPDATE ON public.study_plan_subjects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.study_plan_stages (slug, title_en, title_ar, subtitle_en, has_semesters, has_finals, sort_order) VALUES
  ('zero',   'Zero Course',   'السنة التحضيرية', 'Preparatory year', false, false, 0),
  ('first',  'First Course',  'السنة الأولى',   NULL, true, false, 1),
  ('second', 'Second Course', 'السنة الثانية',  NULL, true, false, 2),
  ('third',  'Third Course',  'السنة الثالثة',  NULL, true, false, 3),
  ('fourth', 'Fourth Course', 'السنة الرابعة',  NULL, true, false, 4),
  ('fifth',  'Fifth Course',  'السنة الخامسة',  NULL, true, false, 5),
  ('sixth',  'Sixth Course',  'السنة السادسة',  NULL, true, true,  6);

INSERT INTO public.study_plan_subjects (stage_id, semester, name, assessment, note, sort_order)
SELECT s.id, NULL, v.name, v.assessment, v.note, v.ord
FROM public.study_plan_stages s
JOIN (VALUES
  ('Biology', 'exam', NULL, 0),
  ('Chemistry', 'test', NULL, 1),
  ('Physics', 'exam', NULL, 2),
  ('Foreign language', 'custom', 'Depends on the group', 3),
  ('Armenian language', 'pass', NULL, 4)
) AS v(name, assessment, note, ord) ON true
WHERE s.slug = 'zero';

INSERT INTO public.study_plan_subjects (stage_id, semester, name, assessment, sort_order)
SELECT s.id, v.sem, v.name, v.assessment, v.ord
FROM public.study_plan_stages s
JOIN (VALUES
  (1, 'Medical chemistry 1', 'exam', 0),
  (1, 'Human anatomy', 'exam', 1),
  (1, 'Physical training', 'pass', 2),
  (1, 'Latin', 'pass', 3),
  (1, 'Practical skills 1', 'pass', 4),
  (1, 'First aid with clinical skills', 'pass', 5),
  (1, 'Armenian language', 'pass', 6),
  (1, 'History of medicine', 'pass', 7),
  (1, 'History of Armenian civilization', 'pass', 8),
  (2, 'Medical chemistry 2', 'exam', 0),
  (2, 'Human anatomy', 'exam', 1),
  (2, 'Histology', 'exam', 2),
  (2, 'Clinical anatomy', 'exam', 3),
  (2, 'Medical biology', 'exam', 4),
  (2, 'Biophysics', 'exam', 5),
  (2, 'Medical physics', 'exam', 6),
  (2, 'Academic English', 'pass', 7),
  (2, 'Physical training', 'pass', 8),
  (2, 'Armenian language', 'pass', 9),
  (2, 'History of Armenian civilization', 'pass', 10),
  (2, 'Latin', 'pass', 11)
) AS v(sem, name, assessment, ord) ON true
WHERE s.slug = 'first';

INSERT INTO public.study_plan_subjects (stage_id, semester, name, assessment, sort_order)
SELECT s.id, v.sem, v.name, v.assessment, v.ord
FROM public.study_plan_stages s
JOIN (VALUES
  (1, 'Psychology', 'exam', 0),
  (1, 'Human anatomy', 'exam', 1),
  (1, 'Histology', 'exam', 2),
  (1, 'Physiology', 'exam', 3),
  (1, 'Biochemistry', 'exam', 4),
  (1, 'Clinical anatomy', 'pass', 5),
  (1, 'Armenian language', 'pass', 6),
  (1, 'History of medicine', 'pass', 7),
  (1, 'History of Armenian civilization', 'pass', 8),
  (2, 'Parasitology', 'exam', 0),
  (2, 'Biostatistics', 'pass', 1),
  (2, 'Microbiology', 'exam', 2),
  (2, 'Physiology', 'exam', 3),
  (2, 'Biochemistry', 'exam', 4),
  (2, 'Armenian language', 'pass', 5),
  (2, 'Practical skills 2', 'pass', 6),
  (2, 'Bioethics', 'pass', 7),
  (2, 'Philosophy', 'pass', 8)
) AS v(sem, name, assessment, ord) ON true
WHERE s.slug = 'second';

INSERT INTO public.study_plan_subjects (stage_id, semester, name, assessment, sort_order)
SELECT s.id, v.sem, v.name, v.assessment, v.ord
FROM public.study_plan_stages s
JOIN (VALUES
  (1, 'Pharmacology', 'exam', 0),
  (1, 'Microbiology', 'exam', 1),
  (1, 'Pathophysiology', 'exam', 2),
  (1, 'Pathoanatomy', 'exam', 3),
  (1, 'Internal medicine', 'exam', 4),
  (1, 'Surgery', 'exam', 5),
  (1, 'Pediatrics', 'exam', 6),
  (1, 'Surgical skills', 'practical', 7),
  (1, 'Medical law', 'test', 8),
  (1, 'Armenian language', 'pass', 9),
  (2, 'Pharmacology', 'exam', 0),
  (2, 'Pathophysiology', 'exam', 1),
  (2, 'Pathoanatomy', 'exam', 2),
  (2, 'Internal medicine', 'oral', 3),
  (2, 'Surgery', 'oral', 4),
  (2, 'Clinical skills', 'practical', 5),
  (2, 'Armenian language', 'pass', 6)
) AS v(sem, name, assessment, ord) ON true
WHERE s.slug = 'third';

INSERT INTO public.study_plan_subjects (stage_id, semester, name, assessment, note, sort_order)
SELECT s.id, v.sem, v.name, v.assessment, v.note, v.ord
FROM public.study_plan_stages s
JOIN (VALUES
  (1, 'Internal medicine', 'exam', 'Cardiology, pulmonology, hematology', 0),
  (1, 'Obstetrics and gynaecology', 'oral', NULL, 1),
  (1, 'Surgery', 'exam', NULL, 2),
  (1, 'Urology', 'exam', NULL, 3),
  (1, 'Pediatrics', 'exam', 'Pediatrics, genetics, hygiene', 4),
  (1, 'Public health', 'exam', 'Public health, epidemiology', 5),
  (2, 'Internal medicine', 'exam', 'Cardiology, pulmonology, nephrology, gastroenterology, clinical radiology', 0),
  (2, 'Surgery', 'exam', NULL, 1),
  (2, 'Obstetrics and gynaecology', 'oral', NULL, 2),
  (2, 'Clinical neurology', 'exam', 'Neurology, neurosurgery', 3),
  (2, 'Organism and ecosystem', 'exam', NULL, 4)
) AS v(sem, name, assessment, note, ord) ON true
WHERE s.slug = 'fourth';
-- <<< 20260808142501_e7686a76-a7e4-4620-ad6a-06a80e6ad548.sql


-- >>> 20260809012400_06acfaa2-97f3-4ef3-8e62-6fee872b742e.sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS lock_kind text,
  ADD COLUMN IF NOT EXISTS lock_until timestamptz,
  ADD COLUMN IF NOT EXISTS lock_message text;

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS terms_en text,
  ADD COLUMN IF NOT EXISTS terms_ar text,
  ADD COLUMN IF NOT EXISTS privacy_en text,
  ADD COLUMN IF NOT EXISTS privacy_ar text,
  ADD COLUMN IF NOT EXISTS study_hub_title text,
  ADD COLUMN IF NOT EXISTS study_hub_title_ar text,
  ADD COLUMN IF NOT EXISTS study_hub_subtitle text,
  ADD COLUMN IF NOT EXISTS study_hub_subtitle_ar text;

CREATE TABLE IF NOT EXISTS public.study_hub_tiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  label_ar text,
  description text,
  description_ar text,
  icon text NOT NULL DEFAULT 'Star',
  href text NOT NULL DEFAULT '',
  external boolean NOT NULL DEFAULT false,
  hidden boolean NOT NULL DEFAULT false,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.study_hub_tiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_hub_tiles TO authenticated;
GRANT ALL ON public.study_hub_tiles TO service_role;

ALTER TABLE public.study_hub_tiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "study_hub_tiles_read" ON public.study_hub_tiles;
CREATE POLICY "study_hub_tiles_read" ON public.study_hub_tiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "study_hub_tiles_admin_write" ON public.study_hub_tiles;
CREATE POLICY "study_hub_tiles_admin_write" ON public.study_hub_tiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS study_hub_tiles_touch ON public.study_hub_tiles;
CREATE TRIGGER study_hub_tiles_touch BEFORE UPDATE ON public.study_hub_tiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.account_active(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT _user_id IS NULL
      OR public.has_role(_user_id, 'admin'::public.app_role)
      OR NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = _user_id
          AND p.locked_at IS NOT NULL
          AND (p.lock_until IS NULL OR p.lock_until > now())
      );
$function$;

-- <<< 20260809012400_06acfaa2-97f3-4ef3-8e62-6fee872b742e.sql


-- >>> 20260809140504_c58dd1b7-4fae-4931-94e7-9aee7581317f.sql
ALTER TABLE public.site_nav_items ADD COLUMN IF NOT EXISTS coming_soon boolean NOT NULL DEFAULT false;
-- <<< 20260809140504_c58dd1b7-4fae-4931-94e7-9aee7581317f.sql


-- >>> 20260809150607_097666dd-0fdc-428a-bef5-0176abe5897b.sql
REVOKE SELECT ON public.site_settings FROM anon, authenticated;

GRANT SELECT (id, site_name, tagline, logo_url, updated_at, theme, show_signature, protect_enabled, protect_watermark_opacity, protect_blur_on_blur, protect_block_print, protect_block_copy, protect_consent_required, protect_devtools_guard, protect_auto_lock_threshold, protect_terms_en, protect_terms_ar, committee_default_storage, brand_style, study_plan_path, study_plan_title, study_plan_subtitle, terms_en, terms_ar, privacy_en, privacy_ar, study_hub_title, study_hub_title_ar, study_hub_subtitle, study_hub_subtitle_ar)
ON public.site_settings TO anon, authenticated;

GRANT ALL ON public.site_settings TO service_role;
-- <<< 20260809150607_097666dd-0fdc-428a-bef5-0176abe5897b.sql


-- >>> 20260809152021_8b96845f-2a0b-4ca4-a6b3-69db70931de3.sql
ALTER TABLE public.committee_resources
  ADD COLUMN IF NOT EXISTS allow_preview boolean NOT NULL DEFAULT true;
-- <<< 20260809152021_8b96845f-2a0b-4ca4-a6b3-69db70931de3.sql


-- >>> 20260809175819_1016dcd3-a2a9-4534-99e8-2144cd01aec5.sql
ALTER TABLE public.university_tiles
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lock_note_en text NOT NULL DEFAULT 'Coming soon',
  ADD COLUMN IF NOT EXISTS lock_note_ar text NOT NULL DEFAULT 'قريبًا',
  ADD COLUMN IF NOT EXISTS lock_color text NOT NULL DEFAULT 'amber';
-- <<< 20260809175819_1016dcd3-a2a9-4534-99e8-2144cd01aec5.sql


-- >>> 20260809200331_d1ef73a2-271c-41f0-b51f-6147f0b59558.sql
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS refund_en text,
  ADD COLUMN IF NOT EXISTS refund_ar text;
-- <<< 20260809200331_d1ef73a2-271c-41f0-b51f-6147f0b59558.sql


-- >>> 20260809202200_ab51ce83-715c-4335-80d7-e49b2bd30c6f.sql
GRANT SELECT (id, site_name, tagline, logo_url, updated_at, theme, show_signature, protect_enabled, protect_watermark_opacity, protect_blur_on_blur, protect_block_print, protect_block_copy, protect_consent_required, protect_devtools_guard, protect_auto_lock_threshold, protect_terms_en, protect_terms_ar, committee_default_storage, brand_style, study_plan_path, study_plan_title, study_plan_subtitle, terms_en, terms_ar, privacy_en, privacy_ar, study_hub_title, study_hub_title_ar, study_hub_subtitle, study_hub_subtitle_ar, refund_en, refund_ar) ON public.site_settings TO anon, authenticated;

GRANT UPDATE, INSERT ON public.site_settings TO authenticated;

GRANT ALL ON public.site_settings TO service_role;
-- <<< 20260809202200_ab51ce83-715c-4335-80d7-e49b2bd30c6f.sql


-- >>> 20260809213213_dcb87564-c9ba-4325-8f6f-53bc3d787de9.sql
CREATE TABLE IF NOT EXISTS public.admin_data_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_label text,
  action text NOT NULL,
  record_count integer NOT NULL DEFAULT 0,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_data_exports TO authenticated;
GRANT ALL ON public.admin_data_exports TO service_role;

ALTER TABLE public.admin_data_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view export audit"
ON public.admin_data_exports FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_user_login_events_occurred_at ON public.user_login_events (occurred_at);
CREATE INDEX IF NOT EXISTS idx_user_login_events_user_occurred ON public.user_login_events (user_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_seen ON public.user_sessions (last_seen_at);

CREATE OR REPLACE FUNCTION public.admin_people_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT jsonb_build_object(
    'active_now', (SELECT count(*) FROM public.user_sessions WHERE last_seen_at >= now() - interval '5 minutes'),
    'opened_today', (SELECT count(*) FROM public.user_sessions WHERE last_seen_at >= date_trunc('day', now())),
    'total_users', (SELECT count(*) FROM public.profiles),
    'new_today', (SELECT count(*) FROM public.profiles WHERE created_at >= date_trunc('day', now())),
    'new_week', (SELECT count(*) FROM public.profiles WHERE created_at >= now() - interval '7 days'),
    'new_month', (SELECT count(*) FROM public.profiles WHERE created_at >= now() - interval '30 days'),
    'new_prev_week', (SELECT count(*) FROM public.profiles WHERE created_at >= now() - interval '14 days' AND created_at < now() - interval '7 days'),
    'new_prev_month', (SELECT count(*) FROM public.profiles WHERE created_at >= now() - interval '60 days' AND created_at < now() - interval '30 days'),
    'logins_today', (SELECT count(*) FROM public.user_login_events WHERE occurred_at >= date_trunc('day', now())),
    'logins_week', (SELECT count(*) FROM public.user_login_events WHERE occurred_at >= now() - interval '7 days'),
    'logins_month', (SELECT count(*) FROM public.user_login_events WHERE occurred_at >= now() - interval '30 days'),
    'logins_prev_week', (SELECT count(*) FROM public.user_login_events WHERE occurred_at >= now() - interval '14 days' AND occurred_at < now() - interval '7 days'),
    'verified', (SELECT count(*) FROM auth.users WHERE email_confirmed_at IS NOT NULL),
    'unverified', (SELECT count(*) FROM auth.users WHERE email_confirmed_at IS NULL),
    'blocked', (SELECT count(*) FROM public.profiles WHERE locked_at IS NOT NULL AND lock_until IS NULL),
    'suspended', (SELECT count(*) FROM public.profiles WHERE locked_at IS NOT NULL AND lock_until IS NOT NULL AND lock_until > now()),
    'never_logged_in', (SELECT count(*) FROM public.profiles p WHERE NOT EXISTS (SELECT 1 FROM public.user_login_events e WHERE e.user_id = p.id)),
    'dormant_30d', (SELECT count(*) FROM public.profiles p WHERE EXISTS (SELECT 1 FROM public.user_login_events e WHERE e.user_id = p.id)
                     AND NOT EXISTS (SELECT 1 FROM public.user_login_events e2 WHERE e2.user_id = p.id AND e2.occurred_at >= now() - interval '30 days')),
    'revenue_cents', COALESCE((SELECT sum(amount_cents) FROM public.payment_events WHERE status = 'completed'), 0)
                     + COALESCE((SELECT sum(amount_cents) FROM public.package_purchases), 0),
    'revenue_month_cents', COALESCE((SELECT sum(amount_cents) FROM public.payment_events WHERE status = 'completed' AND created_at >= now() - interval '30 days'), 0)
                     + COALESCE((SELECT sum(amount_cents) FROM public.package_purchases WHERE created_at >= now() - interval '30 days'), 0),
    'paying_users', (SELECT count(DISTINCT u) FROM (
        SELECT user_id AS u FROM public.payment_events WHERE status = 'completed' AND user_id IS NOT NULL
        UNION SELECT buyer_id FROM public.package_purchases WHERE buyer_id IS NOT NULL) x),
    'course_grants', (SELECT count(*) FROM public.user_courses),
    'owners', (SELECT count(DISTINCT user_id) FROM public.user_courses),
    'coupon_redemptions', (SELECT count(*) FROM public.coupon_redemptions),
    'coupon_discount', COALESCE((SELECT sum(amount_before - amount_after) FROM public.coupon_redemptions), 0),
    'generated_at', now()
  ) INTO result;
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_people_timeseries(_days integer DEFAULT 30)
RETURNS TABLE(day date, signups bigint, logins bigint, active_users bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  WITH d AS (
    SELECT generate_series(date_trunc('day', now()) - ((GREATEST(LEAST(_days, 365), 1) - 1) || ' days')::interval,
                           date_trunc('day', now()), interval '1 day')::date AS day
  )
  SELECT d.day,
    (SELECT count(*) FROM public.profiles p WHERE p.created_at::date = d.day),
    (SELECT count(*) FROM public.user_login_events e WHERE e.occurred_at::date = d.day),
    (SELECT count(DISTINCT e.user_id) FROM public.user_login_events e WHERE e.occurred_at::date = d.day)
  FROM d ORDER BY d.day;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_people_retention()
RETURNS TABLE(cohort date, size bigint, w0 bigint, w1 bigint, w2 bigint, w3 bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  WITH c AS (
    SELECT p.id, date_trunc('week', p.created_at) AS wk
    FROM public.profiles p
    WHERE p.created_at >= now() - interval '8 weeks'
  )
  SELECT c.wk::date,
    count(*)::bigint,
    count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.user_login_events e WHERE e.user_id = c.id AND e.occurred_at >= c.wk AND e.occurred_at < c.wk + interval '1 week'))::bigint,
    count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.user_login_events e WHERE e.user_id = c.id AND e.occurred_at >= c.wk + interval '1 week' AND e.occurred_at < c.wk + interval '2 weeks'))::bigint,
    count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.user_login_events e WHERE e.user_id = c.id AND e.occurred_at >= c.wk + interval '2 weeks' AND e.occurred_at < c.wk + interval '3 weeks'))::bigint,
    count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.user_login_events e WHERE e.user_id = c.id AND e.occurred_at >= c.wk + interval '3 weeks' AND e.occurred_at < c.wk + interval '4 weeks'))::bigint
  FROM c GROUP BY c.wk ORDER BY c.wk DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_people_course_stats()
RETURNS TABLE(course_id uuid, title text, price numeric, owners bigint, revenue_cents bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT co.id, co.title, co.price,
    (SELECT count(*) FROM public.user_courses uc WHERE uc.course_id = co.id)::bigint,
    COALESCE((SELECT sum(pe.amount_cents) FROM public.payment_events pe WHERE pe.course_id = co.id AND pe.status = 'completed'), 0)::bigint
  FROM public.courses co
  ORDER BY 4 DESC, co.title;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_people_insights()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  WITH base AS (
    SELECT p.id,
      (SELECT count(*) FROM public.user_courses uc WHERE uc.user_id = p.id) AS courses,
      (SELECT count(*) FROM public.user_login_events e WHERE e.user_id = p.id) AS logins,
      (SELECT max(e.occurred_at) FROM public.user_login_events e WHERE e.user_id = p.id) AS last_login,
      p.created_at
    FROM public.profiles p
  )
  SELECT jsonb_build_object(
    'avg_logins_with_courses', COALESCE(round(avg(logins) FILTER (WHERE courses > 0)::numeric, 1), 0),
    'avg_logins_without_courses', COALESCE(round(avg(logins) FILTER (WHERE courses = 0)::numeric, 1), 0),
    'avg_logins_overall', COALESCE(round(avg(logins)::numeric, 1), 0),
    'median_days_to_first_login', COALESCE((
      SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(epoch FROM (fl - p2.created_at)) / 86400)::numeric, 1)
      FROM public.profiles p2
      CROSS JOIN LATERAL (SELECT min(e.occurred_at) FROM public.user_login_events e WHERE e.user_id = p2.id) AS f(fl)
      WHERE fl IS NOT NULL), 0),
    'share_returning', CASE WHEN count(*) = 0 THEN 0
      ELSE round(100.0 * count(*) FILTER (WHERE logins > 1) / count(*), 1) END,
    'share_active_7d', CASE WHEN count(*) = 0 THEN 0
      ELSE round(100.0 * count(*) FILTER (WHERE last_login >= now() - interval '7 days') / count(*), 1) END,
    'peak_hour', COALESCE((SELECT EXTRACT(hour FROM occurred_at)::int FROM public.user_login_events
       GROUP BY 1 ORDER BY count(*) DESC LIMIT 1), 0),
    'peak_weekday', COALESCE((SELECT to_char(occurred_at, 'Day') FROM public.user_login_events
       GROUP BY 1 ORDER BY count(*) DESC LIMIT 1), '')
  ) INTO result FROM base;
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_people_directory()
RETURNS TABLE(
  id uuid, full_name text, username text, email text, phone text,
  verified boolean, locked_at timestamptz, lock_until timestamptz, lock_reason text,
  roles text[], courses bigint, paid_cents bigint,
  created_at timestamptz, last_seen timestamptz, login_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT u.id,
    COALESCE(p.full_name, u.raw_user_meta_data->>'full_name', ''),
    COALESCE(p.username, u.raw_user_meta_data->>'username', split_part(u.email::text,'@',1)),
    COALESCE(p.email, u.email::text),
    COALESCE(p.phone, u.phone::text),
    (u.email_confirmed_at IS NOT NULL),
    p.locked_at, p.lock_until, p.lock_reason,
    COALESCE(ARRAY(SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = u.id), ARRAY[]::text[]),
    (SELECT count(*) FROM public.user_courses uc WHERE uc.user_id = u.id)::bigint,
    (COALESCE((SELECT sum(pe.amount_cents) FROM public.payment_events pe WHERE pe.user_id = u.id AND pe.status = 'completed'), 0)
     + COALESCE((SELECT sum(pp.amount_cents) FROM public.package_purchases pp WHERE pp.buyer_id = u.id), 0))::bigint,
    u.created_at,
    GREATEST(
      (SELECT max(s.last_seen_at) FROM public.user_sessions s WHERE s.user_id = u.id),
      (SELECT max(e.occurred_at) FROM public.user_login_events e WHERE e.user_id = u.id)
    ),
    (SELECT count(*) FROM public.user_login_events e WHERE e.user_id = u.id)::bigint
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END; $$;
-- <<< 20260809213213_dcb87564-c9ba-4325-8f6f-53bc3d787de9.sql


-- >>> 20260809213235_2cf23d96-1b0b-4201-804d-e1be6dfef767.sql
REVOKE EXECUTE ON FUNCTION public.admin_people_overview() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_people_timeseries(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_people_retention() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_people_course_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_people_insights() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_people_directory() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_people_overview() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_people_timeseries(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_people_retention() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_people_course_stats() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_people_insights() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_people_directory() TO authenticated, service_role;
-- <<< 20260809213235_2cf23d96-1b0b-4201-804d-e1be6dfef767.sql


-- >>> 20260809221129_0e5d4e53-cefd-499a-a1db-4704535221c4.sql
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS header_style text NOT NULL DEFAULT 'institutional';
GRANT SELECT (header_style) ON public.site_settings TO anon, authenticated;
-- <<< 20260809221129_0e5d4e53-cefd-499a-a1db-4704535221c4.sql


-- >>> 20260809235552_f00abd9e-6c45-46fe-9c62-dc22beff5e8c.sql
CREATE INDEX IF NOT EXISTS question_options_question_id_idx ON public.question_options (question_id);
CREATE INDEX IF NOT EXISTS questions_subject_id_idx ON public.questions (subject_id);
CREATE INDEX IF NOT EXISTS subjects_group_id_idx ON public.subjects (group_id);
CREATE INDEX IF NOT EXISTS subject_groups_course_id_idx ON public.subject_groups (course_id);
CREATE INDEX IF NOT EXISTS lecture_items_subject_id_idx ON public.lecture_items (subject_id);
CREATE INDEX IF NOT EXISTS user_lecture_courses_course_id_idx ON public.user_lecture_courses (course_id);
CREATE INDEX IF NOT EXISTS user_courses_course_id_idx ON public.user_courses (course_id);
CREATE INDEX IF NOT EXISTS question_attempts_question_id_idx ON public.question_attempts (question_id);
CREATE INDEX IF NOT EXISTS coupon_redemptions_user_id_idx ON public.coupon_redemptions (user_id);
CREATE INDEX IF NOT EXISTS coupon_redemptions_course_id_idx ON public.coupon_redemptions (course_id);
CREATE INDEX IF NOT EXISTS package_purchases_buyer_id_idx ON public.package_purchases (buyer_id);
-- <<< 20260809235552_f00abd9e-6c45-46fe-9c62-dc22beff5e8c.sql


-- >>> 20260810003618_21354007-151e-4546-9400-0dc5afdd9118.sql
CREATE TABLE public.guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  published boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  course_id uuid,
  title_en text NOT NULL DEFAULT '',
  summary_en text NOT NULL DEFAULT '',
  body_en text NOT NULL DEFAULT '',
  title_ru text NOT NULL DEFAULT '',
  summary_ru text NOT NULL DEFAULT '',
  body_ru text NOT NULL DEFAULT '',
  title_hy text NOT NULL DEFAULT '',
  summary_hy text NOT NULL DEFAULT '',
  body_hy text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.guides TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guides TO authenticated;
GRANT ALL ON public.guides TO service_role;

ALTER TABLE public.guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published guides"
  ON public.guides FOR SELECT
  USING (published = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert guides"
  ON public.guides FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update guides"
  ON public.guides FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete guides"
  ON public.guides FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX guides_published_position_idx ON public.guides (published, position);

CREATE TRIGGER update_guides_updated_at
  BEFORE UPDATE ON public.guides
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.guides (slug, published, position, title_en, summary_en, body_en, title_ru, summary_ru, body_ru, title_hy, summary_hy, body_hy)
VALUES (
  'how-aquaqbank-works',
  true,
  0,
  'How AquaQBank works for YSMU students',
  'What AquaQBank includes for Yerevan State Medical University students: question banks, video lectures and committee notes, organised by year and course.',
  E'## What AquaQBank is\n\nAquaQBank is a study platform built around Yerevan State Medical University. Instead of hunting for scattered files, everything is organised by the year and the course you are actually studying.\n\n## What is inside\n\n- **Question banks** — practice questions per course, split into midterm and final sets, with instant feedback while you answer.\n- **Video lectures** — lecture courses grouped by subject, with quizzes attached to the material.\n- **Committee notes** — shared PDFs and summaries collected per year and subject, with preview before download.\n- **Summaries and study tools** — the Study Hub collects the extra tools we add over time.\n\n## How access works\n\nAccess is sold per academic year or per semester, depending on the course. You create a free account, verify your email, then unlock the courses you need. Some material is free to preview before you decide.\n\n## Getting started\n\n1. Create an account and verify your email.\n2. Open the Universities page and pick Yerevan State Medical University.\n3. Choose your year, then open the course you are studying.\n4. Start with the question bank for the exam you are preparing for.',
  'Как работает AquaQBank для студентов ЕГМУ',
  'Что входит в AquaQBank для студентов Ереванского государственного медицинского университета: банки вопросов, видеолекции и материалы комитета по курсам и годам обучения.',
  E'## Что такое AquaQBank\n\nAquaQBank — учебная платформа, построенная вокруг Ереванского государственного медицинского университета. Все материалы упорядочены по году обучения и по предмету, который вы изучаете.\n\n## Что внутри\n\n- **Банки вопросов** — практические вопросы по каждому предмету, отдельно для промежуточного и итогового экзамена.\n- **Видеолекции** — курсы лекций по темам, с тестами по материалу.\n- **Материалы комитета** — общие PDF-файлы и конспекты по году и предмету, с предпросмотром перед скачиванием.\n- **Конспекты и учебные инструменты** — раздел Study Hub, куда мы постепенно добавляем новые инструменты.\n\n## Как устроен доступ\n\nДоступ продаётся на учебный год или на семестр — в зависимости от курса. Вы создаёте бесплатный аккаунт, подтверждаете почту и открываете нужные курсы. Часть материалов доступна для предпросмотра.\n\n## С чего начать\n\n1. Создайте аккаунт и подтвердите электронную почту.\n2. Откройте страницу университетов и выберите ЕГМУ.\n3. Выберите свой год обучения и нужный предмет.\n4. Начните с банка вопросов для того экзамена, к которому готовитесь.',
  'Ինչպես է աշխատում AquaQBank-ը ԵՊԲՀ ուսանողների համար',
  'Ինչ է ներառում AquaQBank-ը Երևանի պետական բժշկական համալսարանի ուսանողների համար՝ հարցաշարեր, տեսադասախոսություններ և կոմիտեի նյութեր՝ ըստ կուրսի և առարկայի։',
  E'## Ինչ է AquaQBank-ը\n\nAquaQBank-ը ուսումնական հարթակ է, որը կառուցված է Երևանի պետական բժշկական համալսարանի շուրջ։ Բոլոր նյութերը դասավորված են ըստ ուսումնական տարվա և առարկայի։\n\n## Ինչ կա ներսում\n\n- **Հարցաշարեր** — գործնական հարցեր յուրաքանչյուր առարկայի համար՝ առանձին միջանկյալ և եզրափակիչ քննության համար։\n- **Տեսադասախոսություններ** — դասընթացներ ըստ թեմաների՝ կցված թեստերով։\n- **Կոմիտեի նյութեր** — ընդհանուր PDF-ներ և ամփոփումներ ըստ կուրսի և առարկայի՝ ներբեռնումից առաջ նախադիտմամբ։\n- **Ամփոփումներ և ուսումնական գործիքներ** — Study Hub բաժինը, որտեղ ավելացնում ենք նոր գործիքներ։\n\n## Ինչպես է աշխատում հասանելիությունը\n\nՀասանելիությունը վաճառվում է ուսումնական տարով կամ կիսամյակով՝ կախված դասընթացից։ Ստեղծում եք անվճար հաշիվ, հաստատում եք էլ․ փոստը և բացում անհրաժեշտ դասընթացները։\n\n## Ինչպես սկսել\n\n1. Ստեղծեք հաշիվ և հաստատեք էլ․ փոստը։\n2. Բացեք համալսարանների էջը և ընտրեք ԵՊԲՀ-ն։\n3. Ընտրեք ձեր կուրսը և անհրաժեշտ առարկան։\n4. Սկսեք այն քննության հարցաշարից, որին պատրաստվում եք։'
);
-- <<< 20260810003618_21354007-151e-4546-9400-0dc5afdd9118.sql


-- >>> 20260810015135_0b7ef8c3-e4e3-4504-ba8b-57223a1e67eb.sql
UPDATE public.site_content
SET value_en = 'Your YSMU question bank, all in one place.',
    value_ar = 'بنك أسئلة YSMU كاملاً في مكان واحد.',
    default_en = 'your YSMU question bank, all in one place.',
    default_ar = 'بنك أسئلة YSMU كاملاً في مكان واحد.'
WHERE key = 'cms.home.hero.title';

UPDATE public.site_content
SET value_en = 'YSMU study platform',
    value_ar = 'منصة دراسة YSMU',
    default_en = 'YSMU study platform',
    default_ar = 'منصة دراسة YSMU'
WHERE key = 'cms.home.hero.badge';
-- <<< 20260810015135_0b7ef8c3-e4e3-4504-ba8b-57223a1e67eb.sql


-- >>> 20260810085846_6ecb23b1-d36f-41df-b5c9-0a6a68bd8856.sql
update public.site_settings set tagline = 'The medical question bank platform — AquaQBank Platform', site_name = 'AquaQBank', brand_style = 'platform-lock';
update public.site_content set value_en = 'Your medical question bank, all in one place.', value_ar = 'بنك أسئلتك الطبية كاملاً في مكان واحد.' where key = 'cms.home.hero.title';
update public.site_content set value_en = 'AquaQBank Platform', value_ar = 'منصة AquaQBank' where key = 'cms.home.hero.badge';
-- <<< 20260810085846_6ecb23b1-d36f-41df-b5c9-0a6a68bd8856.sql


-- >>> 20260810180145_50baf792-2fe1-4d6c-ab7a-bfed72c63908.sql
update public.site_settings set theme = 'academy' where id = true;
-- <<< 20260810180145_50baf792-2fe1-4d6c-ab7a-bfed72c63908.sql


-- >>> 20260810181704_6e89e506-1fa0-4ff8-8c67-8a324aa0473f.sql
with home as (select id from public.site_pages where slug='home' limit 1)
update public.site_sections s set sort_order = s.sort_order + 10 where s.page_id = (select id from home);

with home as (select id from public.site_pages where slug='home' limit 1)
insert into public.site_sections (page_id, builtin_key, sort_order, visible)
select (select id from home), v.k, v.o, true
from (values ('exam_prep', 13), ('results', 15)) as v(k, o)
where not exists (
  select 1 from public.site_sections x where x.page_id = (select id from home) and x.builtin_key = v.k
);
-- <<< 20260810181704_6e89e506-1fa0-4ff8-8c67-8a324aa0473f.sql


-- >>> 20260811030016_d1aadf42-129b-4609-8c47-b850e538d7f3.sql
CREATE TABLE public.study_subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default 'aqua',
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_subjects TO authenticated;
GRANT ALL ON public.study_subjects TO service_role;
ALTER TABLE public.study_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own study subjects" ON public.study_subjects FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.study_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.study_subjects(id) on delete cascade,
  title text not null,
  note text,
  status text not null default 'todo',
  due_date date,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_topics TO authenticated;
GRANT ALL ON public.study_topics TO service_role;
ALTER TABLE public.study_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own study topics" ON public.study_topics FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX study_topics_subject_idx ON public.study_topics(subject_id);

CREATE TABLE public.study_exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  subject text,
  subject_id uuid references public.study_subjects(id) on delete set null,
  starts_at timestamptz not null,
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_exams TO authenticated;
GRANT ALL ON public.study_exams TO service_role;
ALTER TABLE public.study_exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own study exams" ON public.study_exams FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX study_exams_user_starts_idx ON public.study_exams(user_id, starts_at);

CREATE TABLE public.study_focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'pomodoro',
  minutes integer not null default 0,
  ended_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_focus_sessions TO authenticated;
GRANT ALL ON public.study_focus_sessions TO service_role;
ALTER TABLE public.study_focus_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own focus sessions" ON public.study_focus_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX study_focus_user_ended_idx ON public.study_focus_sessions(user_id, ended_at);

CREATE TRIGGER study_subjects_touch BEFORE UPDATE ON public.study_subjects FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER study_topics_touch BEFORE UPDATE ON public.study_topics FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER study_exams_touch BEFORE UPDATE ON public.study_exams FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.study_hub_tiles (label, label_ar, description, description_ar, icon, href, external, hidden, sort)
VALUES
  ('To do', 'المهام', 'Track your materials, topics and progress', 'تابع موادك ومواضيعك وتقدمك', 'ListChecks', '/study-hub/todo', false, false, 1),
  ('My exams & tests', 'اختباراتي', 'Add your exams and see the countdown', 'أضف اختباراتك وشاهد العد التنازلي', 'CalendarDays', '/study-hub/exams', false, false, 2),
  ('Study with me', 'ادرس معي', 'Focus timer with breaks and study systems', 'مؤقت تركيز مع فترات راحة وأنظمة دراسة', 'Timer', '/study-hub/focus', false, false, 3);
-- <<< 20260811030016_d1aadf42-129b-4609-8c47-b850e538d7f3.sql


-- >>> 20260811033031_a288c656-5e39-4201-a146-5e424034d771.sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_groups TO authenticated;
GRANT ALL ON public.user_groups TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_group_members TO authenticated;
GRANT ALL ON public.user_group_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_announcements TO authenticated;
GRANT SELECT ON public.site_announcements TO anon;
GRANT ALL ON public.site_announcements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcement_audiences TO authenticated;
GRANT ALL ON public.announcement_audiences TO service_role;

ALTER TABLE public.site_announcements ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.site_announcements'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%style%'
  LOOP
    EXECUTE format('ALTER TABLE public.site_announcements DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.site_announcements
  ADD CONSTRAINT site_announcements_style_check
  CHECK (style IN ('ribbon','floating','spotlight','modal','marquee','toast','strip','inline'));
-- <<< 20260811033031_a288c656-5e39-4201-a146-5e424034d771.sql


-- >>> 20260811034522_fcc2b44d-7a4d-4fa1-9749-ef31aba42664.sql
DROP POLICY IF EXISTS "committee public read" ON storage.objects;
CREATE POLICY "committee members read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = ANY (ARRAY['committee-images'::text, 'committee-files'::text])
    AND public.account_active(auth.uid())
  );

DROP POLICY IF EXISTS "german_subjects read auth" ON public.german_subjects;
CREATE POLICY "german_subjects read owners" ON public.german_subjects
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.user_owns_any_german_course(auth.uid())
  );
-- <<< 20260811034522_fcc2b44d-7a4d-4fa1-9749-ef31aba42664.sql


-- >>> 20260811170152_aa460b7a-16c9-4932-b201-8c4466c6e8cb.sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_ai_keys TO authenticated;
GRANT ALL ON public.admin_ai_keys TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_ai_model_limits TO authenticated;
GRANT ALL ON public.admin_ai_model_limits TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jarvis_batch_jobs TO authenticated;
GRANT ALL ON public.jarvis_batch_jobs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jarvis_batch_v2_jobs TO authenticated;
GRANT ALL ON public.jarvis_batch_v2_jobs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jarvis_batch_v2_chunks TO authenticated;
GRANT ALL ON public.jarvis_batch_v2_chunks TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jarvis_batch_v2_ipad_jobs TO authenticated;
GRANT ALL ON public.jarvis_batch_v2_ipad_jobs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jarvis_batch_v2_ipad_chunks TO authenticated;
GRANT ALL ON public.jarvis_batch_v2_ipad_chunks TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jarvis_batch_german_ipad_jobs TO authenticated;
GRANT ALL ON public.jarvis_batch_german_ipad_jobs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jarvis_batch_german_ipad_chunks TO authenticated;
GRANT ALL ON public.jarvis_batch_german_ipad_chunks TO service_role;
-- <<< 20260811170152_aa460b7a-16c9-4932-b201-8c4466c6e8cb.sql


-- >>> 20260811234600_e78a3612-2862-4538-86a8-ab614afb7de7.sql
CREATE TABLE public.course_options (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('category','year','exam_type')),
  value text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, value)
);

GRANT SELECT ON public.course_options TO anon;
GRANT SELECT ON public.course_options TO authenticated;
GRANT ALL ON public.course_options TO service_role;

ALTER TABLE public.course_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "course_options public read"
  ON public.course_options FOR SELECT
  USING (true);

CREATE POLICY "course_options admin write"
  ON public.course_options FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER course_options_touch
  BEFORE UPDATE ON public.course_options
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.course_options (kind, value, label, sort_order) VALUES
  ('category','major','Major',0),
  ('category','minor','Minor',1),
  ('year','1','Year 1',0),
  ('year','2','Year 2',1),
  ('year','3','Year 3',2),
  ('year','4','Year 4',3),
  ('year','5','Year 5',4),
  ('year','6','Year 6',5),
  ('exam_type','MINI-OSCE','MINI-OSCE',0),
  ('exam_type','FINAL','FINAL',1),
  ('exam_type','MID','MID',2),
  ('exam_type','OSCE','OSCE',3);
-- <<< 20260811234600_e78a3612-2862-4538-86a8-ab614afb7de7.sql


-- >>> 20260812010805_cec2376f-89c9-42be-b8e1-9730837de508.sql
CREATE TABLE IF NOT EXISTS public.question_gen_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Untitled batch',
  mode text NOT NULL DEFAULT 'extract',
  notes text,
  subject_id uuid,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_gen_batches TO authenticated;
GRANT ALL ON public.question_gen_batches TO service_role;

ALTER TABLE public.question_gen_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage question gen batches" ON public.question_gen_batches;
CREATE POLICY "Admins manage question gen batches"
ON public.question_gen_batches FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS question_gen_batches_created_idx ON public.question_gen_batches (created_at DESC);
-- <<< 20260812010805_cec2376f-89c9-42be-b8e1-9730837de508.sql


-- >>> 20260812025506_b7d18108-080f-40bd-b5c0-b1d9f8527a2b.sql
ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_year_check;
ALTER TABLE public.courses ADD CONSTRAINT courses_year_check CHECK (year >= 0 AND year <= 20);
ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_category_check;
-- <<< 20260812025506_b7d18108-080f-40bd-b5c0-b1d9f8527a2b.sql


-- >>> 20260812063247_d948013f-3d32-4a7e-8d7f-237f53a964f3.sql
CREATE POLICY "Admins manage question images" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'question-images' AND public.has_role(auth.uid(), 'admin')) WITH CHECK (bucket_id = 'question-images' AND public.has_role(auth.uid(), 'admin'));
-- <<< 20260812063247_d948013f-3d32-4a7e-8d7f-237f53a964f3.sql


-- >>> 20260813043155_dc9898f8-13a7-44c1-8cd5-dec3b599ed4e.sql
CREATE TABLE public.site_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.site_secrets TO service_role;
ALTER TABLE public.site_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage site secrets" ON public.site_secrets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_secrets TO authenticated;

CREATE TRIGGER site_secrets_touch BEFORE UPDATE ON public.site_secrets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.site_secrets (key, value)
VALUES ('transfer_code', encode(extensions.gen_random_bytes(12), 'hex'));

ALTER TABLE public.site_settings DROP COLUMN transfer_code;

ALTER TABLE public.device_security_settings ALTER COLUMN unlock_code DROP DEFAULT;
UPDATE public.device_security_settings
SET unlock_code = encode(extensions.gen_random_bytes(9), 'hex')
WHERE unlock_code IS NULL OR unlock_code = 'Shadyx1234@';

DROP POLICY IF EXISTS "public read resources" ON public.committee_resources;
CREATE POLICY "members read resources" ON public.committee_resources
  FOR SELECT TO authenticated
  USING (public.account_active(auth.uid()));
REVOKE SELECT ON public.committee_resources FROM anon;

REVOKE EXECUTE ON FUNCTION public.admin_get_user_roles(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_grant_committee_role(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_grant_lecture_course(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_grant_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_group_counts() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_all_users() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_committee_members() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_group_members(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_lecture_course_users(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_role_members(public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_marketing_stats() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_people_course_stats() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_people_directory() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_people_insights() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_people_overview() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_people_retention() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_people_timeseries(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_committee_role(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_lecture_course(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_server_stats() FROM anon;
REVOKE EXECUTE ON FUNCTION public.search_users_for_group(text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.toggle_self_admin(boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_coupon(text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_coupon(text, uuid) FROM anon;

DROP FUNCTION IF EXISTS public.__restore_exec(text);
-- <<< 20260813043155_dc9898f8-13a7-44c1-8cd5-dec3b599ed4e.sql


-- >>> 20260813054750_0ce141c8-119b-47de-b56f-936b4c2b324b.sql
-- Read: any signed-in user
CREATE POLICY "storage_read_signed_in"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('university-logos','course-images','question-images','committee-files','committee-images','site-media','lecture-videos'));

-- Write: admins on every app bucket
CREATE POLICY "storage_admin_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('university-logos','course-images','question-images','committee-files','committee-images','site-media','lecture-videos')
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "storage_admin_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id IN ('university-logos','course-images','question-images','committee-files','committee-images','site-media','lecture-videos')
  AND public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  bucket_id IN ('university-logos','course-images','question-images','committee-files','committee-images','site-media','lecture-videos')
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "storage_admin_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id IN ('university-logos','course-images','question-images','committee-files','committee-images','site-media','lecture-videos')
  AND public.has_role(auth.uid(), 'admin')
);

-- Committee managers can manage committee content
CREATE POLICY "storage_committee_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('committee-files','committee-images')
  AND public.can_manage_committee(auth.uid())
);

CREATE POLICY "storage_committee_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('committee-files','committee-images') AND public.can_manage_committee(auth.uid()))
WITH CHECK (bucket_id IN ('committee-files','committee-images') AND public.can_manage_committee(auth.uid()));

CREATE POLICY "storage_committee_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('committee-files','committee-images') AND public.can_manage_committee(auth.uid()));

-- <<< 20260813054750_0ce141c8-119b-47de-b56f-936b4c2b324b.sql


-- >>> 20260813054845_72c15cfd-35ed-4a74-ac8c-a042a047d548.sql
-- 1. Remove hardcoded admin backdoors
DROP TRIGGER IF EXISTS grant_admin_to_klory_email ON auth.users;
DROP TRIGGER IF EXISTS grant_admin_to_kloryx ON public.profiles;
DROP FUNCTION IF EXISTS public.grant_admin_to_klory_email() CASCADE;
DROP FUNCTION IF EXISTS public.grant_admin_to_kloryx() CASCADE;
DROP FUNCTION IF EXISTS public.toggle_self_admin(boolean) CASCADE;

-- 2. No anonymous execution of app routines by default
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- 3. Re-open only what signed-out visitors legitimately need
GRANT EXECUTE ON FUNCTION public.identity_taken(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_course_real_counts(uuid[]) TO anon;
GRANT EXECUTE ON FUNCTION public.get_subject_question_counts(uuid[]) TO anon;
GRANT EXECUTE ON FUNCTION public.university_id_by_slug(text) TO anon;

-- <<< 20260813054845_72c15cfd-35ed-4a74-ac8c-a042a047d548.sql


-- >>> 20260813054918_1d05a54c-58eb-49f9-8467-60c918439d6a.sql
REVOKE EXECUTE ON FUNCTION public.admin_group_counts() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_group_members(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_announcements() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_in_group(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_committee_change() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_group_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_group_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_announcements() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_in_group(uuid, uuid) TO authenticated;

-- <<< 20260813054918_1d05a54c-58eb-49f9-8467-60c918439d6a.sql


-- >>> 20260813060042_d9598bb7-9acc-4b4d-bf13-463a139a80cf.sql
-- 1. Remove blanket signed-in read on storage
DROP POLICY IF EXISTS "storage_read_signed_in" ON storage.objects;
DROP POLICY IF EXISTS "committee members read" ON storage.objects;

-- Helper: can current user access a committee subject's materials?
CREATE OR REPLACE FUNCTION public.can_access_committee_subject(_subject_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND public.account_active(auth.uid())
     AND (
       public.can_manage_committee(auth.uid())
       OR NOT EXISTS (
         SELECT 1 FROM public.committee_subject_courses csc
         WHERE csc.subject_id = _subject_id
       )
       OR EXISTS (
         SELECT 1 FROM public.committee_subject_courses csc
         JOIN public.user_courses uc
           ON uc.course_id = csc.course_id AND uc.user_id = auth.uid()
         WHERE csc.subject_id = _subject_id
       )
     );
$$;

REVOKE ALL ON FUNCTION public.can_access_committee_subject(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_committee_subject(uuid) TO authenticated, service_role;

-- 2. committee_resources gated by subject entitlement
DROP POLICY IF EXISTS "members read resources" ON public.committee_resources;
CREATE POLICY "entitled members read resources"
ON public.committee_resources
FOR SELECT
TO authenticated
USING (
  public.can_manage_committee(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.committee_categories c
    WHERE c.id = committee_resources.category_id
      AND public.can_access_committee_subject(c.subject_id)
  )
);

-- 3. committee storage buckets: managers or entitled users only
CREATE POLICY "committee files readable by entitled users"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = ANY (ARRAY['committee-files','committee-images'])
  AND (
    public.can_manage_committee(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.committee_resources r
      JOIN public.committee_categories c ON c.id = r.category_id
      WHERE r.file_path = objects.name
        AND public.can_access_committee_subject(c.subject_id)
    )
  )
);

-- 4. admin hub layout: admins only
DROP POLICY IF EXISTS "Authenticated can read admin hub layout" ON public.admin_hub_layout;
CREATE POLICY "Admins read admin hub layout"
ON public.admin_hub_layout
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 5. Revoke anon execution on all public functions, re-grant only public ones
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.identity_taken(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.university_id_by_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_course_real_counts(uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_subject_question_counts(uuid[]) TO anon, authenticated;
-- <<< 20260813060042_d9598bb7-9acc-4b4d-bf13-463a139a80cf.sql


-- >>> 20260813060708_da33c6a8-cdae-4918-883c-b86fbe0bbf61.sql
-- 1. Prevent self-escalation / self-unlock through profile updates
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::public.app_role) OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.locked_at   := OLD.locked_at;
  NEW.lock_until  := OLD.lock_until;
  NEW.lock_reason := OLD.lock_reason;
  NEW.device_limit := OLD.device_limit;
  NEW.email       := OLD.email;
  NEW.id          := OLD.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_fields ON public.profiles;
CREATE TRIGGER protect_profile_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_fields();

-- 2. Hide the internal notification email from public reads
DROP POLICY IF EXISTS "Anyone can view support settings" ON public.support_settings;

CREATE OR REPLACE VIEW public.support_settings_public AS
SELECT id, page_enabled, form_enabled, channels_enabled,
       intro_title_en, intro_title_ar, intro_text_en, intro_text_ar,
       response_note_en, response_note_ar, categories
FROM public.support_settings;

GRANT SELECT ON public.support_settings_public TO anon, authenticated;
-- <<< 20260813060708_da33c6a8-cdae-4918-883c-b86fbe0bbf61.sql


-- >>> 20260813060756_45e70c12-b5aa-45a5-a990-d7b92f989de2.sql
DROP VIEW IF EXISTS public.support_settings_public;

CREATE POLICY "Anyone can view support settings"
ON public.support_settings FOR SELECT TO anon, authenticated USING (true);

REVOKE SELECT ON public.support_settings FROM anon, authenticated;
GRANT SELECT (id, page_enabled, form_enabled, channels_enabled,
  intro_title_en, intro_title_ar, intro_text_en, intro_text_ar,
  response_note_en, response_note_ar, categories, created_at, updated_at)
ON public.support_settings TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_support_notify()
RETURNS TABLE(notify_enabled boolean, notify_email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY SELECT s.notify_enabled, s.notify_email FROM public.support_settings s WHERE s.id;
END; $$;

REVOKE ALL ON FUNCTION public.admin_support_notify() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_support_notify() TO authenticated, service_role;
-- <<< 20260813060756_45e70c12-b5aa-45a5-a990-d7b92f989de2.sql


-- >>> 20260813061948_0986f3cc-ff12-458f-8ae6-51ca0c7f82e9.sql
DROP POLICY IF EXISTS "Users record own redemptions" ON public.coupon_redemptions;

DROP POLICY IF EXISTS "Anon can view subjects of published courses" ON public.subjects;
DROP POLICY IF EXISTS "Authenticated can view subjects of published courses" ON public.subjects;

CREATE POLICY "Anon can view free public subjects"
ON public.subjects FOR SELECT TO anon
USING (
  access_level = 'free_public'::public.subject_access
  AND EXISTS (
    SELECT 1 FROM public.subject_groups sg
    JOIN public.courses c ON c.id = sg.course_id
    WHERE sg.id = subjects.group_id AND c.published = true
  )
);

CREATE POLICY "Authenticated can view free subjects"
ON public.subjects FOR SELECT TO authenticated
USING (
  access_level IN ('free_public'::public.subject_access, 'free_logged_in'::public.subject_access)
  AND EXISTS (
    SELECT 1 FROM public.subject_groups sg
    JOIN public.courses c ON c.id = sg.course_id
    WHERE sg.id = subjects.group_id AND c.published = true
  )
);
-- <<< 20260813061948_0986f3cc-ff12-458f-8ae6-51ca0c7f82e9.sql


-- >>> 20260813135200_276111cb-1be5-4edc-bbe2-2945533a10e3.sql
CREATE TABLE public.aquavision_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid,
  group_id uuid,
  subject_id uuid,
  pdf_name text NOT NULL,
  total_pages integer NOT NULL DEFAULT 0,
  stage text NOT NULL DEFAULT 'created',
  status text NOT NULL DEFAULT 'pending',
  read_batch_id text,
  answer_batch_id text,
  imported_count integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.aquavision_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.aquavision_jobs(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  pdf_b64 text,
  question_count integer NOT NULL DEFAULT 0,
  raw_json jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX aquavision_pages_job_idx ON public.aquavision_pages(job_id, page_number);

CREATE TABLE public.aquavision_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.aquavision_jobs(id) ON DELETE CASCADE,
  page_id uuid REFERENCES public.aquavision_pages(id) ON DELETE CASCADE,
  item_index integer NOT NULL DEFAULT 0,
  number text,
  stem text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  answer_letter text,
  concept text,
  explanation text,
  summary_table text,
  solved boolean NOT NULL DEFAULT false,
  imported boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'read',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX aquavision_items_job_idx ON public.aquavision_items(job_id, item_index);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aquavision_jobs TO authenticated;
GRANT ALL ON public.aquavision_jobs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aquavision_pages TO authenticated;
GRANT ALL ON public.aquavision_pages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aquavision_items TO authenticated;
GRANT ALL ON public.aquavision_items TO service_role;

ALTER TABLE public.aquavision_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aquavision_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aquavision_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aquavision_jobs_admin" ON public.aquavision_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "aquavision_pages_admin" ON public.aquavision_pages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "aquavision_items_admin" ON public.aquavision_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER aquavision_jobs_touch BEFORE UPDATE ON public.aquavision_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
-- <<< 20260813135200_276111cb-1be5-4edc-bbe2-2945533a10e3.sql


-- >>> 20260813160723_6bac8722-75bf-48bd-8ea7-65ab7c7402e7.sql

CREATE TABLE public.patch_prox_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid,
  group_id uuid,
  subject_id uuid,
  pdf_name text NOT NULL,
  total_pages integer NOT NULL DEFAULT 0,
  subject_candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  phase text NOT NULL DEFAULT 'created',
  cut_batch_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  solve_batch_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  imported_count integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.patch_prox_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.patch_prox_jobs(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  regions jsonb NOT NULL DEFAULT '[]'::jsonb,
  crops jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, page_number)
);

CREATE TABLE public.patch_prox_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.patch_prox_jobs(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  item_index integer NOT NULL,
  image_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  letters jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_letter text,
  stem text,
  explanation text,
  subject_index integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, page_number, item_index)
);

CREATE INDEX patch_prox_pages_job_idx ON public.patch_prox_pages(job_id);
CREATE INDEX patch_prox_items_job_idx ON public.patch_prox_items(job_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patch_prox_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patch_prox_pages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patch_prox_items TO authenticated;
GRANT ALL ON public.patch_prox_jobs TO service_role;
GRANT ALL ON public.patch_prox_pages TO service_role;
GRANT ALL ON public.patch_prox_items TO service_role;

ALTER TABLE public.patch_prox_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patch_prox_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patch_prox_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage prox jobs" ON public.patch_prox_jobs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage prox pages" ON public.patch_prox_pages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage prox items" ON public.patch_prox_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- <<< 20260813160723_6bac8722-75bf-48bd-8ea7-65ab7c7402e7.sql


-- >>> 20260813181159_75f23073-9657-4adb-8e1e-fdcc2da140c1.sql
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS compare_at_price numeric,
  ADD COLUMN IF NOT EXISTS discount_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discount_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS show_on_home boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS admin_only boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Anyone can view published courses" ON public.courses;
CREATE POLICY "Anyone can view published courses"
ON public.courses FOR SELECT
TO anon, authenticated
USING (published = true AND admin_only = false);
-- <<< 20260813181159_75f23073-9657-4adb-8e1e-fdcc2da140c1.sql


-- >>> 20260814053016_6e15b270-b20c-4426-b4b8-de892c97764a.sql
ALTER TABLE public.patch_prox_pages ADD COLUMN IF NOT EXISTS page_image_path text;
-- <<< 20260814053016_6e15b270-b20c-4426-b4b8-de892c97764a.sql


-- >>> 20260814075504_4bde57ca-036a-4b97-8ad9-5a554a2a5e12.sql
ALTER TABLE public.aquavision_jobs ADD COLUMN IF NOT EXISTS reference_book text;
ALTER TABLE public.patch_prox_jobs ADD COLUMN IF NOT EXISTS reference_book text;
-- <<< 20260814075504_4bde57ca-036a-4b97-8ad9-5a554a2a5e12.sql


-- >>> 20260814085052_39ef9049-6d0b-46d3-a685-4dd5e9b06aa7.sql
ALTER TABLE public.jarvis_batch_v2_ipad_jobs ADD COLUMN IF NOT EXISTS reference_book TEXT;
-- <<< 20260814085052_39ef9049-6d0b-46d3-a685-4dd5e9b06aa7.sql


-- >>> 20260814161240_0fa82e83-75ab-480b-a3ea-61d729f9f678.sql
ALTER TABLE public.universities
  ADD COLUMN IF NOT EXISTS is_closed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS closed_note_en text,
  ADD COLUMN IF NOT EXISTS closed_note_ar text,
  ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb;
-- <<< 20260814161240_0fa82e83-75ab-480b-a3ea-61d729f9f678.sql


-- >>> 20260815122644_0a9cd540-be63-41d2-8015-afdafb98d231.sql
CREATE TABLE public.ad_creatives (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled ad',
  template text not null default 'offer',
  design jsonb not null default '{}'::jsonb,
  preview_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_creatives TO authenticated;
GRANT ALL ON public.ad_creatives TO service_role;
ALTER TABLE public.ad_creatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage ad creatives" ON public.ad_creatives FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER ad_creatives_touch BEFORE UPDATE ON public.ad_creatives
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "Admins read ad media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ad-media' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins write ad media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ad-media' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update ad media" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'ad-media' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete ad media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ad-media' AND public.has_role(auth.uid(),'admin'));
-- <<< 20260815122644_0a9cd540-be63-41d2-8015-afdafb98d231.sql


-- >>> 20260815161037_83412dc0-5969-40a6-bb76-ac347b99485c.sql
CREATE TABLE public.committee_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL DEFAULT '',
  name_ar text NOT NULL DEFAULT '',
  country_code text NOT NULL DEFAULT 'JO',
  country_label text NOT NULL DEFAULT '',
  year_label text NOT NULL DEFAULT '',
  role_label text NOT NULL DEFAULT '',
  description_en text NOT NULL DEFAULT '',
  description_ar text NOT NULL DEFAULT '',
  photo_url text NOT NULL DEFAULT '',
  accent smallint NOT NULL DEFAULT 1,
  is_founder boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.committee_members TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.committee_members TO authenticated;
GRANT ALL ON public.committee_members TO service_role;

ALTER TABLE public.committee_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "committee_members_public_read" ON public.committee_members
  FOR SELECT USING (true);

CREATE POLICY "committee_members_manage" ON public.committee_members
  FOR ALL TO authenticated
  USING (public.can_manage_committee(auth.uid()))
  WITH CHECK (public.can_manage_committee(auth.uid()));

CREATE TRIGGER committee_members_touch
  BEFORE UPDATE ON public.committee_members
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
-- <<< 20260815161037_83412dc0-5969-40a6-bb76-ac347b99485c.sql


-- >>> 20260815161205_ec75bade-a598-49b4-864e-e230a473079a.sql
CREATE POLICY "member_photos_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'member-photos');

CREATE POLICY "member_photos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'member-photos' AND public.can_manage_committee(auth.uid()));

CREATE POLICY "member_photos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'member-photos' AND public.can_manage_committee(auth.uid()))
  WITH CHECK (bucket_id = 'member-photos' AND public.can_manage_committee(auth.uid()));

CREATE POLICY "member_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'member-photos' AND public.can_manage_committee(auth.uid()));
-- <<< 20260815161205_ec75bade-a598-49b4-864e-e230a473079a.sql


-- >>> 20260815163738_088e1fae-5c20-494e-893b-0398c41fbb08.sql
ALTER TABLE public.committee_members ADD COLUMN IF NOT EXISTS photo_fit text NOT NULL DEFAULT 'cover';
-- <<< 20260815163738_088e1fae-5c20-494e-893b-0398c41fbb08.sql


-- >>> 20260815224343_48fdc062-fc05-4ffb-80ab-9b7d5cb1d29d.sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'golden';
-- <<< 20260815224343_48fdc062-fc05-4ffb-80ab-9b7d5cb1d29d.sql


-- >>> 20260815224416_4a45021a-6cd7-4fb1-aae9-24b50748967e.sql
ALTER TABLE public.user_courses ADD COLUMN IF NOT EXISTS granted_reason text;
ALTER TABLE public.user_lecture_courses ADD COLUMN IF NOT EXISTS granted_reason text;

CREATE OR REPLACE FUNCTION public.sync_golden_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_courses (user_id, course_id, granted_reason)
  SELECT _user_id, c.id, 'golden'
  FROM public.courses c
  WHERE COALESCE(c.kind, 'questions') <> 'lectures'
  ON CONFLICT (user_id, course_id) DO NOTHING;

  INSERT INTO public.user_lecture_courses (user_id, course_id, granted_reason)
  SELECT _user_id, c.id, 'golden'
  FROM public.courses c
  WHERE c.kind = 'lectures'
  ON CONFLICT (user_id, course_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_golden_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_courses WHERE user_id = _user_id AND granted_reason = 'golden';
  DELETE FROM public.user_lecture_courses WHERE user_id = _user_id AND granted_reason = 'golden';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_golden_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_golden_user(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.on_golden_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.role = 'golden' THEN
    PERFORM public.sync_golden_user(NEW.user_id);
  ELSIF TG_OP = 'DELETE' AND OLD.role = 'golden' THEN
    PERFORM public.revoke_golden_user(OLD.user_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_golden_role_change ON public.user_roles;
CREATE TRIGGER trg_golden_role_change
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.on_golden_role_change();

CREATE OR REPLACE FUNCTION public.on_course_created_grant_golden()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.kind, 'questions') = 'lectures' THEN
    INSERT INTO public.user_lecture_courses (user_id, course_id, granted_reason)
    SELECT ur.user_id, NEW.id, 'golden'
    FROM public.user_roles ur
    WHERE ur.role = 'golden'
    ON CONFLICT (user_id, course_id) DO NOTHING;
  ELSE
    INSERT INTO public.user_courses (user_id, course_id, granted_reason)
    SELECT ur.user_id, NEW.id, 'golden'
    FROM public.user_roles ur
    WHERE ur.role = 'golden'
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_course_grant_golden ON public.courses;
CREATE TRIGGER trg_course_grant_golden
AFTER INSERT ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.on_course_created_grant_golden();
-- <<< 20260815224416_4a45021a-6cd7-4fb1-aae9-24b50748967e.sql


-- >>> 20260815231042_e1617698-72d7-42f5-a156-2429de30e55e.sql
ALTER TABLE public.committee_members ADD COLUMN IF NOT EXISTS is_golden boolean NOT NULL DEFAULT false;
-- <<< 20260815231042_e1617698-72d7-42f5-a156-2429de30e55e.sql


-- >>> 20260816153529_811a7958-13a8-4d7b-9089-c2505428e982.sql
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS committee_qr_path text,
  ADD COLUMN IF NOT EXISTS committee_qr_link text;

UPDATE public.site_settings
SET committee_qr_link = COALESCE(committee_qr_link, 'https://t.me/aquaqbank')
WHERE id = true;
-- <<< 20260816153529_811a7958-13a8-4d7b-9089-c2505428e982.sql


-- >>> 20260816222204_4a22e027-85d6-4a58-85ca-24d43c9871ea.sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'committee_head';
-- <<< 20260816222204_4a22e027-85d6-4a58-85ca-24d43c9871ea.sql


-- >>> 20260816222259_3adbf255-02ca-4582-a8c8-b2224d23a756.sql
-- 1. Committee head can do everything a committee member can
CREATE OR REPLACE FUNCTION public.can_manage_committee(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role)
      OR public.has_role(_user_id, 'committee'::public.app_role)
      OR public.has_role(_user_id, 'committee_head'::public.app_role);
$$;

-- 2. Heads may read the committee change log
DROP POLICY IF EXISTS "Admins can read the committee log" ON public.committee_activity_log;
CREATE POLICY "Admins and heads can read the committee log"
ON public.committee_activity_log FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'committee_head'::public.app_role)
);

-- 3. Heads may grant / revoke ONLY the committee role
CREATE OR REPLACE FUNCTION public.head_set_committee_role(_user_id uuid, _grant boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'committee_head'::public.app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _grant THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'committee'::public.app_role)
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = _user_id AND role = 'committee'::public.app_role;
  END IF;
END; $$;
REVOKE EXECUTE ON FUNCTION public.head_set_committee_role(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.head_set_committee_role(uuid, boolean) TO authenticated;

-- 4. Heads may list committee members and search users
CREATE OR REPLACE FUNCTION public.head_list_committee_members()
RETURNS TABLE(user_id uuid, username text, full_name text, email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'committee_head'::public.app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT ur.user_id,
         COALESCE(p.username, split_part(COALESCE(p.email,''),'@',1)) AS username,
         COALESCE(p.full_name,'') AS full_name,
         COALESCE(p.email,'') AS email
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'committee'::public.app_role
  ORDER BY 2;
END; $$;
REVOKE EXECUTE ON FUNCTION public.head_list_committee_members() FROM anon;
GRANT EXECUTE ON FUNCTION public.head_list_committee_members() TO authenticated;

CREATE OR REPLACE FUNCTION public.head_search_users(_query text)
RETURNS TABLE(id uuid, username text, full_name text, email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'committee_head'::public.app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _query IS NULL OR length(trim(_query)) < 2 THEN RETURN; END IF;
  RETURN QUERY
  SELECT p.id,
         COALESCE(p.username,'') AS username,
         COALESCE(p.full_name,'') AS full_name,
         COALESCE(p.email,'') AS email
  FROM public.profiles p
  WHERE p.username ILIKE '%'||_query||'%'
     OR p.full_name ILIKE '%'||_query||'%'
     OR p.email ILIKE '%'||_query||'%'
  ORDER BY 2
  LIMIT 20;
END; $$;
REVOKE EXECUTE ON FUNCTION public.head_search_users(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.head_search_users(text) TO authenticated;

-- 5. Events
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title_en text NOT NULL DEFAULT '',
  title_ar text NOT NULL DEFAULT '',
  subtitle_en text NOT NULL DEFAULT '',
  subtitle_ar text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT false,
  visibility text NOT NULL DEFAULT 'public',
  button_placement text NOT NULL DEFAULT 'home',
  button_style text NOT NULL DEFAULT 'hero',
  accent text NOT NULL DEFAULT 'emerald',
  cover_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT SELECT ON public.events TO anon;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_public_read ON public.events FOR SELECT
USING (
  (enabled AND visibility = 'public')
  OR (enabled AND visibility = 'auth' AND auth.uid() IS NOT NULL)
  OR public.can_manage_committee(auth.uid())
);
CREATE POLICY events_manage ON public.events FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'committee_head'::public.app_role))
WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'committee_head'::public.app_role));
CREATE TRIGGER events_touch BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.event_visible(_event_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = _event_id
      AND ( (e.enabled AND e.visibility = 'public')
         OR (e.enabled AND e.visibility = 'auth' AND auth.uid() IS NOT NULL)
         OR public.can_manage_committee(auth.uid()) )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_events()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_role(auth.uid(),'admin'::public.app_role)
      OR public.has_role(auth.uid(),'committee_head'::public.app_role);
$$;

CREATE TABLE public.event_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title_en text NOT NULL DEFAULT '',
  title_ar text NOT NULL DEFAULT '',
  body_en text NOT NULL DEFAULT '',
  body_ar text NOT NULL DEFAULT '',
  visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_sections TO authenticated;
GRANT SELECT ON public.event_sections TO anon;
GRANT ALL ON public.event_sections TO service_role;
ALTER TABLE public.event_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_sections_read ON public.event_sections FOR SELECT USING (public.event_visible(event_id));
CREATE POLICY event_sections_manage ON public.event_sections FOR ALL TO authenticated
USING (public.can_manage_events()) WITH CHECK (public.can_manage_events());

CREATE TABLE public.event_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name_en text NOT NULL DEFAULT '',
  name_ar text NOT NULL DEFAULT '',
  role_label text NOT NULL DEFAULT '',
  description_en text NOT NULL DEFAULT '',
  description_ar text NOT NULL DEFAULT '',
  photo_url text NOT NULL DEFAULT '',
  photo_fit text NOT NULL DEFAULT 'cover',
  is_head boolean NOT NULL DEFAULT false,
  accent integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_members TO authenticated;
GRANT SELECT ON public.event_members TO anon;
GRANT ALL ON public.event_members TO service_role;
ALTER TABLE public.event_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_members_read ON public.event_members FOR SELECT USING (public.event_visible(event_id));
CREATE POLICY event_members_manage ON public.event_members FOR ALL TO authenticated
USING (public.can_manage_events()) WITH CHECK (public.can_manage_events());

CREATE TABLE public.event_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'join',
  title_en text NOT NULL DEFAULT '',
  title_ar text NOT NULL DEFAULT '',
  note_en text NOT NULL DEFAULT '',
  note_ar text NOT NULL DEFAULT '',
  link text NOT NULL DEFAULT '',
  button_label text NOT NULL DEFAULT '',
  qr_url text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_contacts TO authenticated;
GRANT SELECT ON public.event_contacts TO anon;
GRANT ALL ON public.event_contacts TO service_role;
ALTER TABLE public.event_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_contacts_read ON public.event_contacts FOR SELECT USING (public.event_visible(event_id));
CREATE POLICY event_contacts_manage ON public.event_contacts FOR ALL TO authenticated
USING (public.can_manage_events()) WITH CHECK (public.can_manage_events());
-- <<< 20260816222259_3adbf255-02ca-4582-a8c8-b2224d23a756.sql


-- >>> 20260816222844_9caf2943-e0c4-4ba7-b4dd-2366144fce4d.sql
create or replace function public.can_manage_committee_members(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id,'admin'::public.app_role)
      or public.has_role(_user_id,'committee_head'::public.app_role);
$$;

create or replace function public.committee_team_list()
returns table(user_id uuid, username text, full_name text, email text, is_head boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_manage_committee_members(auth.uid()) then
    raise exception 'forbidden';
  end if;
  return query
  select p.id, p.username, p.full_name, p.email,
         public.has_role(p.id,'committee_head'::public.app_role)
  from public.profiles p
  where exists (
    select 1 from public.user_roles ur
    where ur.user_id = p.id
      and ur.role in ('committee'::public.app_role,'committee_head'::public.app_role)
  )
  order by p.username;
end; $$;

create or replace function public.committee_team_add(_username text)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid;
begin
  if not public.can_manage_committee_members(auth.uid()) then
    raise exception 'forbidden';
  end if;
  select id into _uid from public.profiles where lower(username) = lower(trim(_username)) limit 1;
  if _uid is null then raise exception 'user not found'; end if;
  insert into public.user_roles (user_id, role)
  values (_uid,'committee'::public.app_role) on conflict do nothing;
end; $$;

create or replace function public.committee_team_remove(_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_committee_members(auth.uid()) then
    raise exception 'forbidden';
  end if;
  -- Only admins may remove another head.
  if public.has_role(_user_id,'committee_head'::public.app_role)
     and not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'forbidden';
  end if;
  delete from public.user_roles
  where user_id = _user_id
    and role = 'committee'::public.app_role;
end; $$;

grant execute on function public.can_manage_committee_members(uuid) to authenticated;
grant execute on function public.committee_team_list() to authenticated;
grant execute on function public.committee_team_add(text) to authenticated;
grant execute on function public.committee_team_remove(uuid) to authenticated;

drop policy if exists "committee log readable by managers" on public.committee_activity_log;
create policy "committee log readable by managers"
on public.committee_activity_log for select to authenticated
using (public.can_manage_committee_members(auth.uid()));
-- <<< 20260816222844_9caf2943-e0c4-4ba7-b4dd-2366144fce4d.sql


-- >>> 20260816233155_f872b5bc-9bba-46e7-9574-5d67d3dc051d.sql
-- Trigger-only functions: nobody should call these directly
REVOKE EXECUTE ON FUNCTION public.on_course_created_grant_golden() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.on_golden_role_change() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.protect_profile_privileged_fields() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.log_committee_change() FROM anon, authenticated, public;

-- Committee / head helpers: signed-in only (they re-check the caller's role internally)
REVOKE EXECUTE ON FUNCTION public.committee_team_add(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.committee_team_remove(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.committee_team_list() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.head_set_committee_role(uuid, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.head_search_users(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.head_list_committee_members() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_manage_committee_members(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_manage_events() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.committee_team_add(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.committee_team_remove(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.committee_team_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.head_set_committee_role(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.head_search_users(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.head_list_committee_members() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_committee_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_events() TO authenticated;

-- Genuinely public helpers stay callable by signed-out visitors
GRANT EXECUTE ON FUNCTION public.identity_taken(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.university_id_by_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_course_real_counts(uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_subject_question_counts(uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_visible(uuid) TO anon, authenticated;
-- <<< 20260816233155_f872b5bc-9bba-46e7-9574-5d67d3dc051d.sql


-- >>> 20260817010027_9b6c5d11-493d-4e03-b888-4c36b058bb64.sql
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  lang text NOT NULL DEFAULT 'en',
  user_agent text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subscriptions" ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins read subscriptions" ON public.push_subscriptions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.push_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_en text NOT NULL DEFAULT '',
  body_en text NOT NULL DEFAULT '',
  title_ar text NOT NULL DEFAULT '',
  body_ar text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  audience_group_ids uuid[] NOT NULL DEFAULT '{}',
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'manual',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX push_messages_pending_idx ON public.push_messages(status, scheduled_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_messages TO authenticated;
GRANT ALL ON public.push_messages TO service_role;
ALTER TABLE public.push_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "senders manage messages" ON public.push_messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'committee_head'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'committee_head'::public.app_role));

CREATE TABLE public.push_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.push_messages(id) ON DELETE CASCADE,
  user_id uuid,
  endpoint text NOT NULL DEFAULT '',
  ok boolean NOT NULL DEFAULT false,
  status_code integer,
  error text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_deliveries_message_idx ON public.push_deliveries(message_id);
GRANT SELECT ON public.push_deliveries TO authenticated;
GRANT ALL ON public.push_deliveries TO service_role;
ALTER TABLE public.push_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read deliveries" ON public.push_deliveries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'committee_head'::public.app_role));

CREATE TABLE public.notification_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  on_event boolean NOT NULL DEFAULT false,
  on_committee_resource boolean NOT NULL DEFAULT false,
  on_new_course boolean NOT NULL DEFAULT false,
  on_urgent_announcement boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.notification_settings TO authenticated;
GRANT ALL ON public.notification_settings TO service_role;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read notification settings" ON public.notification_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write notification settings" ON public.notification_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
INSERT INTO public.notification_settings (id) VALUES (true) ON CONFLICT DO NOTHING;
CREATE TRIGGER notification_settings_touch BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.push_audience_count(_group_ids uuid[])
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN NOT (public.has_role(auth.uid(),'admin'::public.app_role)
           OR public.has_role(auth.uid(),'committee_head'::public.app_role)) THEN 0::bigint
    ELSE (
      SELECT count(*)::bigint FROM public.push_subscriptions s
      WHERE s.enabled
        AND (
          coalesce(array_length(_group_ids, 1), 0) = 0
          OR EXISTS (SELECT 1 FROM unnest(_group_ids) g(id) WHERE public.user_in_group(s.user_id, g.id))
        )
    )
  END;
$$;
REVOKE ALL ON FUNCTION public.push_audience_count(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.push_audience_count(uuid[]) TO authenticated, service_role;
-- <<< 20260817010027_9b6c5d11-493d-4e03-b888-4c36b058bb64.sql


-- >>> 20260817010146_b376f344-95b7-4a65-9f47-4a4914d34aad.sql
CREATE OR REPLACE FUNCTION public.push_audience_devices(_group_ids uuid[])
RETURNS TABLE(user_id uuid, endpoint text, p256dh text, auth text, lang text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.user_id, s.endpoint, s.p256dh, s.auth, s.lang
  FROM public.push_subscriptions s
  WHERE s.enabled
    AND (
      coalesce(array_length(_group_ids, 1), 0) = 0
      OR EXISTS (SELECT 1 FROM unnest(_group_ids) g(id) WHERE public.user_in_group(s.user_id, g.id))
    );
$$;
REVOKE ALL ON FUNCTION public.push_audience_devices(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_audience_devices(uuid[]) TO service_role;
-- <<< 20260817010146_b376f344-95b7-4a65-9f47-4a4914d34aad.sql


-- >>> 20260817010847_32786114-f8a4-4021-9649-7897cb7091c4.sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
SELECT cron.schedule(
  'push-dispatch',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--fc9a842d-8878-47fb-b9e8-2935803c6436.lovable.app/api/public/push-dispatch',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_AG466RguMgvqqLNtVFis2g_4DQl9pKU"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
-- <<< 20260817010847_32786114-f8a4-4021-9649-7897cb7091c4.sql


-- >>> 20260817011341_3171468d-a3f2-4d92-8ffd-8664731b1b01.sql
CREATE OR REPLACE FUNCTION public.can_manage_committee_years(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(_user_id,'admin'::public.app_role)
      OR public.has_role(_user_id,'committee_head'::public.app_role);
$$;

REVOKE EXECUTE ON FUNCTION public.can_manage_committee_years(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_committee_years(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "committee manage years" ON public.committee_years;
CREATE POLICY "head manage years" ON public.committee_years
  FOR ALL TO authenticated
  USING (public.can_manage_committee_years(auth.uid()))
  WITH CHECK (public.can_manage_committee_years(auth.uid()));

DROP POLICY IF EXISTS "committee_members_manage" ON public.committee_members;
CREATE POLICY "head manage staff cards" ON public.committee_members
  FOR ALL TO authenticated
  USING (public.can_manage_committee_members(auth.uid()))
  WITH CHECK (public.can_manage_committee_members(auth.uid()));
-- <<< 20260817011341_3171468d-a3f2-4d92-8ffd-8664731b1b01.sql


-- >>> 20260818001429_cd9789bb-e39b-40fa-8ce9-c6759a6f2d26.sql
CREATE OR REPLACE FUNCTION public.set_committee_qr(_link text, _path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'committee_head')) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  UPDATE public.site_settings
     SET committee_qr_link = NULLIF(btrim(coalesce(_link, '')), ''),
         committee_qr_path = NULLIF(btrim(coalesce(_path, '')), '')
   WHERE id = true;
END;
$$;

REVOKE ALL ON FUNCTION public.set_committee_qr(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_committee_qr(text, text) TO authenticated;
-- <<< 20260818001429_cd9789bb-e39b-40fa-8ce9-c6759a6f2d26.sql


-- >>> 20260818001954_f501ce86-602b-4365-84cc-60f6c0dab7e5.sql
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;
-- <<< 20260818001954_f501ce86-602b-4365-84cc-60f6c0dab7e5.sql


-- >>> 20260820000140_7e343ca5-5b48-4310-8ad5-60b7b60dd49e.sql
CREATE TABLE public.committee_best_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.committee_subjects(id) ON DELETE CASCADE,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'book',
  rating integer NOT NULL DEFAULT 5,
  note text,
  url text,
  resource_id uuid REFERENCES public.committee_resources(id) ON DELETE SET NULL,
  is_top boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX committee_best_sources_subject_idx ON public.committee_best_sources(subject_id);

GRANT SELECT ON public.committee_best_sources TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.committee_best_sources TO authenticated;
GRANT ALL ON public.committee_best_sources TO service_role;

ALTER TABLE public.committee_best_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read best sources" ON public.committee_best_sources FOR SELECT USING (true);
CREATE POLICY "committee manage best sources" ON public.committee_best_sources FOR ALL TO authenticated
  USING (public.can_manage_committee(auth.uid()))
  WITH CHECK (public.can_manage_committee(auth.uid()));

CREATE TRIGGER committee_best_sources_touch BEFORE UPDATE ON public.committee_best_sources
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.committee_subjects ADD COLUMN best_sources_enabled boolean NOT NULL DEFAULT false;
-- <<< 20260820000140_7e343ca5-5b48-4310-8ad5-60b7b60dd49e.sql


-- >>> 20260827225921_64a1f3d5-82f6-4bf2-8466-8f13f6079054.sql
CREATE OR REPLACE FUNCTION public.__setup_exec(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE sql;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.__setup_exec(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.__setup_exec(text) TO service_role;
-- <<< 20260827225921_64a1f3d5-82f6-4bf2-8466-8f13f6079054.sql


-- >>> 20260827225947_d0e97a56-85a8-469a-8f25-2e4c204048da.sql
CREATE OR REPLACE FUNCTION public.__setup_exec(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    SET LOCAL safeupdate.enabled = 'false';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  EXECUTE sql;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.__setup_exec(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.__setup_exec(text) TO service_role;
-- <<< 20260827225947_d0e97a56-85a8-469a-8f25-2e4c204048da.sql


-- >>> 20260827230019_17519211-28a2-49c4-a476-091113cda6bd.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE OR REPLACE FUNCTION public.__setup_exec(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  BEGIN
    SET LOCAL safeupdate.enabled = 'false';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  EXECUTE sql;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.__setup_exec(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.__setup_exec(text) TO service_role;
-- <<< 20260827230019_17519211-28a2-49c4-a476-091113cda6bd.sql


-- >>> 20260827230201_86e84873-845e-46f1-91f0-b4e08a8e893f.sql
DELETE FROM public.study_plan_subjects WHERE true;
DELETE FROM public.study_plan_stages WHERE true;
DELETE FROM public.committee_subjects WHERE true;
DELETE FROM public.committee_semesters WHERE true;
DELETE FROM public.committee_years WHERE true;
DELETE FROM public.university_tiles WHERE true;
DELETE FROM public.universities WHERE true;
DELETE FROM public.guides WHERE true;
DELETE FROM public.course_options WHERE true;
DROP FUNCTION IF EXISTS public.__setup_exec(text);
-- <<< 20260827230201_86e84873-845e-46f1-91f0-b4e08a8e893f.sql


-- >>> 20260828172345_a86bac52-7b83-4d47-a0d6-cbc838573add.sql
CREATE TABLE public.flash_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.flash_subjects(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'apricot',
  emoji text,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.flash_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.flash_subjects(id) ON DELETE CASCADE,
  front text NOT NULL,
  back text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  ease integer NOT NULL DEFAULT 0,
  reviews integer NOT NULL DEFAULT 0,
  last_reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX flash_subjects_user_idx ON public.flash_subjects(user_id, parent_id, sort);
CREATE INDEX flash_cards_subject_idx ON public.flash_cards(subject_id, sort);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flash_subjects TO authenticated;
GRANT ALL ON public.flash_subjects TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flash_cards TO authenticated;
GRANT ALL ON public.flash_cards TO service_role;

ALTER TABLE public.flash_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flash_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own flash subjects" ON public.flash_subjects FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own flash cards" ON public.flash_cards FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER flash_subjects_touch BEFORE UPDATE ON public.flash_subjects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER flash_cards_touch BEFORE UPDATE ON public.flash_cards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
-- <<< 20260828172345_a86bac52-7b83-4d47-a0d6-cbc838573add.sql


-- >>> 20260829153914_fd8df11c-2bdf-4590-a78d-31d0bdb895b3.sql
CREATE TABLE IF NOT EXISTS public.plans (
  slug text PRIMARY KEY,
  name text NOT NULL,
  tagline text NOT NULL DEFAULT '',
  price_cents integer NOT NULL DEFAULT 0,
  yearly_cents integer NOT NULL DEFAULT 0,
  max_flashcards integer,
  max_ai_questions integer,
  max_summaries integer,
  todo_full boolean NOT NULL DEFAULT false,
  rich_cards boolean NOT NULL DEFAULT false,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon;
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plans are public" ON public.plans FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.user_plans (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_slug text NOT NULL DEFAULT 'starter' REFERENCES public.plans(slug),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_plans TO authenticated;
GRANT ALL ON public.user_plans TO service_role;
ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See own plan" ON public.user_plans FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage plans" ON public.user_plans FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.usage_counters (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period text NOT NULL,
  summaries integer NOT NULL DEFAULT 0,
  ai_questions integer NOT NULL DEFAULT 0,
  flashcards integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, period)
);
GRANT SELECT ON public.usage_counters TO authenticated;
GRANT ALL ON public.usage_counters TO service_role;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See own usage" ON public.usage_counters FOR SELECT TO authenticated USING (auth.uid() = user_id);

INSERT INTO public.plans (slug, name, tagline, price_cents, yearly_cents, max_flashcards, max_ai_questions, max_summaries, todo_full, rich_cards, sort)
VALUES
  ('starter', 'Starter', 'Try every tool, gently', 0, 0, 100, 20, 2, false, false, 1),
  ('study', 'Study', 'For one busy student', 600, 6000, 2000, 300, 25, true, true, 2),
  ('pro', 'Pro', 'Exam season, no limits in sight', 1400, 14000, NULL, 1000, 80, true, true, 3)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  price_cents = EXCLUDED.price_cents,
  yearly_cents = EXCLUDED.yearly_cents,
  max_flashcards = EXCLUDED.max_flashcards,
  max_ai_questions = EXCLUDED.max_ai_questions,
  max_summaries = EXCLUDED.max_summaries,
  todo_full = EXCLUDED.todo_full,
  rich_cards = EXCLUDED.rich_cards,
  sort = EXCLUDED.sort;

CREATE OR REPLACE FUNCTION public.my_plan_usage()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'plan', to_jsonb(p),
    'usage', COALESCE((
      SELECT to_jsonb(u) FROM public.usage_counters u
      WHERE u.user_id = auth.uid() AND u.period = to_char(now(), 'YYYY-MM')
    ), jsonb_build_object('summaries', 0, 'ai_questions', 0, 'flashcards', 0)),
    'is_admin', public.has_role(auth.uid(), 'admin')
  )
  FROM public.plans p
  WHERE p.slug = COALESCE((SELECT plan_slug FROM public.user_plans WHERE user_id = auth.uid()), 'starter');
$$;

CREATE OR REPLACE FUNCTION public.bump_usage(_user_id uuid, _kind text, _n integer DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _period text := to_char(now(), 'YYYY-MM');
BEGIN
  INSERT INTO public.usage_counters (user_id, period) VALUES (_user_id, _period)
  ON CONFLICT (user_id, period) DO NOTHING;

  IF _kind = 'summaries' THEN
    UPDATE public.usage_counters SET summaries = summaries + _n, updated_at = now()
      WHERE user_id = _user_id AND period = _period;
  ELSIF _kind = 'ai_questions' THEN
    UPDATE public.usage_counters SET ai_questions = ai_questions + _n, updated_at = now()
      WHERE user_id = _user_id AND period = _period;
  ELSIF _kind = 'flashcards' THEN
    UPDATE public.usage_counters SET flashcards = flashcards + _n, updated_at = now()
      WHERE user_id = _user_id AND period = _period;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.my_plan_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.bump_usage(uuid, text, integer) TO service_role;
-- <<< 20260829153914_fd8df11c-2bdf-4590-a78d-31d0bdb895b3.sql


-- >>> 20260829191600_c50ce556-2d16-4638-ab15-efc78654b48e.sql
GRANT SELECT ON public.plans TO anon;
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='plans' AND policyname='Plans are publicly readable'
  ) THEN
    CREATE POLICY "Plans are publicly readable" ON public.plans FOR SELECT TO anon, authenticated USING (true);
  END IF;
END$$;

GRANT SELECT ON public.user_plans TO authenticated;
GRANT ALL ON public.user_plans TO service_role;
GRANT SELECT ON public.usage_counters TO authenticated;
GRANT ALL ON public.usage_counters TO service_role;
-- <<< 20260829191600_c50ce556-2d16-4638-ab15-efc78654b48e.sql


-- >>> 20260829200127_ca2bca2b-b175-4079-8c2c-725604721c86.sql
CREATE TABLE public.card_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  card_id text NOT NULL,
  subject text NOT NULL DEFAULT '',
  sub_subject text NOT NULL DEFAULT '',
  ease numeric NOT NULL DEFAULT 2.5,
  interval_days numeric NOT NULL DEFAULT 0,
  reps integer NOT NULL DEFAULT 0,
  lapses integer NOT NULL DEFAULT 0,
  state text NOT NULL DEFAULT 'new',
  last_grade integer,
  due_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, card_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_reviews TO authenticated;
GRANT ALL ON public.card_reviews TO service_role;
ALTER TABLE public.card_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own card reviews" ON public.card_reviews FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  card_id text NOT NULL,
  subject text NOT NULL DEFAULT '',
  grade integer NOT NULL,
  ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.review_events TO authenticated;
GRANT ALL ON public.review_events TO service_role;
ALTER TABLE public.review_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own review events read" ON public.review_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "own review events write" ON public.review_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX review_events_user_day ON public.review_events (user_id, created_at DESC);

CREATE TABLE public.study_days (
  user_id uuid NOT NULL,
  day date NOT NULL,
  cards integer NOT NULL DEFAULT 0,
  correct integer NOT NULL DEFAULT 0,
  ms bigint NOT NULL DEFAULT 0,
  goal_met boolean NOT NULL DEFAULT false,
  frozen boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
GRANT SELECT, INSERT, UPDATE ON public.study_days TO authenticated;
GRANT ALL ON public.study_days TO service_role;
ALTER TABLE public.study_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own study days" ON public.study_days FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.study_prefs (
  user_id uuid PRIMARY KEY,
  daily_goal integer NOT NULL DEFAULT 20,
  freezes_left integer NOT NULL DEFAULT 1,
  freeze_week date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.study_prefs TO authenticated;
GRANT ALL ON public.study_prefs TO service_role;
ALTER TABLE public.study_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own study prefs" ON public.study_prefs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER card_reviews_touch BEFORE UPDATE ON public.card_reviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER study_prefs_touch BEFORE UPDATE ON public.study_prefs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
-- <<< 20260829200127_ca2bca2b-b175-4079-8c2c-725604721c86.sql


-- >>> 20260829203316_00e63633-62b4-4740-98f5-00a93f40d70f.sql
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Plans are readable by everyone" ON public.plans;
CREATE POLICY "Plans are readable by everyone" ON public.plans FOR SELECT USING (true);
-- <<< 20260829203316_00e63633-62b4-4740-98f5-00a93f40d70f.sql


-- >>> 20260829213505_34a639b9-9f74-4bee-b8de-01233acd8e2e.sql
CREATE TABLE public.card_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  card_id text NOT NULL,
  subject text NOT NULL DEFAULT '',
  sub_subject text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, card_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_flags TO authenticated;
GRANT ALL ON public.card_flags TO service_role;

ALTER TABLE public.card_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own card flags"
  ON public.card_flags FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER card_flags_touch
  BEFORE UPDATE ON public.card_flags
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.card_reviews
  ADD COLUMN IF NOT EXISTS leech boolean NOT NULL DEFAULT false;
-- <<< 20260829213505_34a639b9-9f74-4bee-b8de-01233acd8e2e.sql


-- >>> 20260829222807_e146f71c-c10d-4d93-841f-f4a26b7ec1ca.sql
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS highlight boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cta_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS perks text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS feature_ai_import boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS feature_review boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.plans SET highlight = true WHERE slug = 'study';
UPDATE public.plans SET feature_ai_import = false, feature_review = false WHERE slug = 'starter';

GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;

DROP POLICY IF EXISTS "Admins manage plans" ON public.plans;
CREATE POLICY "Admins manage plans" ON public.plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT INSERT, UPDATE, DELETE ON public.plans TO authenticated;

CREATE OR REPLACE FUNCTION public.my_plan_usage()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _slug text;
  _plan public.plans%ROWTYPE;
  _usage public.usage_counters%ROWTYPE;
  _admin boolean;
BEGIN
  IF _uid IS NULL THEN
    RETURN NULL;
  END IF;

  _admin := public.has_role(_uid, 'admin');

  SELECT plan_slug INTO _slug FROM public.user_plans WHERE user_id = _uid;
  IF _slug IS NULL THEN
    _slug := 'starter';
  END IF;

  SELECT * INTO _plan FROM public.plans WHERE slug = _slug;
  IF _plan.slug IS NULL THEN
    SELECT * INTO _plan FROM public.plans WHERE published ORDER BY sort LIMIT 1;
  END IF;

  SELECT * INTO _usage FROM public.usage_counters
   WHERE user_id = _uid AND period = to_char(now(), 'YYYY-MM');

  RETURN jsonb_build_object(
    'plan', to_jsonb(_plan),
    'usage', jsonb_build_object(
      'summaries', COALESCE(_usage.summaries, 0),
      'ai_questions', COALESCE(_usage.ai_questions, 0),
      'flashcards', COALESCE(_usage.flashcards, 0)
    ),
    'is_admin', _admin
  );
END;
$$;
-- <<< 20260829222807_e146f71c-c10d-4d93-841f-f4a26b7ec1ca.sql


-- >>> 20260830104834_9488bedc-8d4f-4983-9ea2-86dacf0376e4.sql
CREATE TABLE public.archive_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  subtopic text NOT NULL DEFAULT '',
  pdf_name text NOT NULL,
  total_pages integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'queued',
  chunks_total integer NOT NULL DEFAULT 0,
  chunks_done integer NOT NULL DEFAULT 0,
  questions_found integer NOT NULL DEFAULT 0,
  questions_solved integer NOT NULL DEFAULT 0,
  lease_until timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.archive_jobs TO authenticated;
GRANT ALL ON public.archive_jobs TO service_role;
ALTER TABLE public.archive_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own archive jobs" ON public.archive_jobs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.archive_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.archive_jobs(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  page_from integer NOT NULL,
  page_to integer NOT NULL,
  chunk_text text NOT NULL DEFAULT '',
  question_blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, chunk_index)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.archive_chunks TO authenticated;
GRANT ALL ON public.archive_chunks TO service_role;
ALTER TABLE public.archive_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage chunks of their own jobs" ON public.archive_chunks
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.archive_jobs j WHERE j.id = job_id AND j.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.archive_jobs j WHERE j.id = job_id AND j.user_id = auth.uid()));

CREATE TABLE public.study_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  subtopic text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  stem text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  concept text NOT NULL DEFAULT '',
  explanation text NOT NULL DEFAULT '',
  summary_table text NOT NULL DEFAULT '',
  difficulty text NOT NULL DEFAULT 'medium',
  flagged boolean NOT NULL DEFAULT false,
  source_job_id uuid REFERENCES public.archive_jobs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_questions TO authenticated;
GRANT ALL ON public.study_questions TO service_role;
ALTER TABLE public.study_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own study questions" ON public.study_questions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_archive_jobs_status ON public.archive_jobs (status, updated_at);
CREATE INDEX idx_archive_chunks_job ON public.archive_chunks (job_id, chunk_index);
CREATE INDEX idx_study_questions_scope ON public.study_questions (user_id, subject, subtopic, position);

CREATE TRIGGER archive_jobs_touch BEFORE UPDATE ON public.archive_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER archive_chunks_touch BEFORE UPDATE ON public.archive_chunks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER study_questions_touch BEFORE UPDATE ON public.study_questions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
-- <<< 20260830104834_9488bedc-8d4f-4983-9ea2-86dacf0376e4.sql


-- >>> 20260830144823_c6bbdb34-0f3c-4f8d-a5ab-6128ec2841c1.sql
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS ribbon_label text,
  ADD COLUMN IF NOT EXISTS ribbon_color text,
  ADD COLUMN IF NOT EXISTS compare_cents integer,
  ADD COLUMN IF NOT EXISTS offer_ends_at timestamptz;
-- <<< 20260830144823_c6bbdb34-0f3c-4f8d-a5ab-6128ec2841c1.sql


-- >>> 20260830205427_11952b91-640b-4256-b0ae-a311b8b088bb.sql
CREATE TABLE public.de_subjects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  mode TEXT NOT NULL DEFAULT 'articles',
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6aa9d8',
  position INTEGER NOT NULL DEFAULT 0,
  is_sample BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.de_subtopics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id UUID NOT NULL REFERENCES public.de_subjects(id) ON DELETE CASCADE,
  user_id UUID,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_sample BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.de_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subtopic_id UUID NOT NULL REFERENCES public.de_subtopics(id) ON DELETE CASCADE,
  user_id UUID,
  kind TEXT NOT NULL DEFAULT 'noun',
  german TEXT NOT NULL,
  article TEXT,
  plural TEXT,
  english TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_sample BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.de_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  item_id UUID NOT NULL REFERENCES public.de_items(id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_id)
);
CREATE TABLE public.de_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  item_id UUID NOT NULL REFERENCES public.de_items(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'tap',
  correct BOOLEAN NOT NULL DEFAULT false,
  score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX de_subtopics_subject_idx ON public.de_subtopics(subject_id);
CREATE INDEX de_items_subtopic_idx ON public.de_items(subtopic_id);
CREATE INDEX de_attempts_user_item_idx ON public.de_attempts(user_id, item_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.de_subjects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.de_subtopics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.de_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.de_flags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.de_attempts TO authenticated;
GRANT ALL ON public.de_subjects TO service_role;
GRANT ALL ON public.de_subtopics TO service_role;
GRANT ALL ON public.de_items TO service_role;
GRANT ALL ON public.de_flags TO service_role;
GRANT ALL ON public.de_attempts TO service_role;

ALTER TABLE public.de_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.de_subtopics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.de_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.de_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.de_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own or sample subjects" ON public.de_subjects FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_sample);
CREATE POLICY "write own subjects" ON public.de_subjects FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND NOT is_sample);
CREATE POLICY "update own subjects" ON public.de_subjects FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "delete own subjects" ON public.de_subjects FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "read own or sample subtopics" ON public.de_subtopics FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_sample);
CREATE POLICY "write own subtopics" ON public.de_subtopics FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND NOT is_sample);
CREATE POLICY "update own subtopics" ON public.de_subtopics FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "delete own subtopics" ON public.de_subtopics FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "read own or sample items" ON public.de_items FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_sample);
CREATE POLICY "write own items" ON public.de_items FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND NOT is_sample);
CREATE POLICY "update own items" ON public.de_items FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "delete own items" ON public.de_items FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "manage own flags" ON public.de_flags FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "manage own attempts" ON public.de_attempts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Sample pack: articles
WITH s AS (
  INSERT INTO public.de_subjects (user_id, mode, name, color, position, is_sample)
  VALUES (NULL, 'articles', 'Sample · Everyday nouns', '#6aa9d8', 0, true)
  RETURNING id
), t AS (
  INSERT INTO public.de_subtopics (subject_id, user_id, name, position, is_sample)
  SELECT s.id, NULL, x.name, x.pos, true FROM s, (VALUES ('Home & city', 0), ('People & time', 1)) AS x(name, pos)
  RETURNING id, name
)
INSERT INTO public.de_items (subtopic_id, user_id, kind, german, article, plural, english, position, is_sample)
SELECT t.id, NULL, 'noun', v.g, v.a, v.p, v.e, v.pos, true
FROM t JOIN (VALUES
  ('Home & city','Bank','die','die Banken','bench / bank',0),
  ('Home & city','Haus','das','die Häuser','house',1),
  ('Home & city','Tisch','der','die Tische','table',2),
  ('Home & city','Küche','die','die Küchen','kitchen',3),
  ('Home & city','Fenster','das','die Fenster','window',4),
  ('Home & city','Bahnhof','der','die Bahnhöfe','train station',5),
  ('Home & city','Straße','die','die Straßen','street',6),
  ('Home & city','Büro','das','die Büros','office',7),
  ('Home & city','Schlüssel','der','die Schlüssel','key',8),
  ('Home & city','Wohnung','die','die Wohnungen','apartment',9),
  ('People & time','Mädchen','das','die Mädchen','girl',0),
  ('People & time','Freund','der','die Freunde','friend',1),
  ('People & time','Freiheit','die','die Freiheiten','freedom',2),
  ('People & time','Arbeit','die','die Arbeiten','work',3),
  ('People & time','Kind','das','die Kinder','child',4),
  ('People & time','Morgen','der','die Morgen','morning',5),
  ('People & time','Woche','die','die Wochen','week',6),
  ('People & time','Jahr','das','die Jahre','year',7),
  ('People & time','Lehrer','der','die Lehrer','teacher',8),
  ('People & time','Möglichkeit','die','die Möglichkeiten','possibility',9)
) AS v(sub, g, a, p, e, pos) ON v.sub = t.name;

-- Sample pack: pronunciation
WITH s AS (
  INSERT INTO public.de_subjects (user_id, mode, name, color, position, is_sample)
  VALUES (NULL, 'speaking', 'Sample · First phrases', '#e0774f', 0, true)
  RETURNING id
), t AS (
  INSERT INTO public.de_subtopics (subject_id, user_id, name, position, is_sample)
  SELECT s.id, NULL, x.name, x.pos, true FROM s, (VALUES ('Greetings', 0), ('Café & travel', 1)) AS x(name, pos)
  RETURNING id, name
)
INSERT INTO public.de_items (subtopic_id, user_id, kind, german, english, position, is_sample)
SELECT t.id, NULL, v.k, v.g, v.e, v.pos, true
FROM t JOIN (VALUES
  ('Greetings','word','Guten Morgen','good morning',0),
  ('Greetings','word','Entschuldigung','excuse me',1),
  ('Greetings','word','Tschüss','bye',2),
  ('Greetings','sentence','Wie geht es dir heute?','How are you today?',3),
  ('Greetings','sentence','Ich heiße Rita und ich lerne Deutsch.','My name is Rita and I am learning German.',4),
  ('Greetings','sentence','Können Sie das bitte wiederholen?','Could you please repeat that?',5),
  ('Café & travel','word','Frühstück','breakfast',0),
  ('Café & travel','word','Bahnhof','train station',1),
  ('Café & travel','sentence','Ich hätte gern einen Kaffee, bitte.','I would like a coffee, please.',2),
  ('Café & travel','sentence','Wann fährt der nächste Zug nach München?','When does the next train to Munich leave?',3),
  ('Café & travel','sentence','Die Straßenbahn kommt in fünf Minuten.','The tram arrives in five minutes.',4)
) AS v(sub, k, g, e, pos) ON v.sub = t.name;
-- <<< 20260830205427_11952b91-640b-4256-b0ae-a311b8b088bb.sql


-- >>> 20260830215439_9470ed52-e28e-44cc-837a-a6c02eb7db2b.sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = off) AS
  SELECT id, username, full_name, avatar_url, bio FROM public.profiles;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.shared_decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  cover text NOT NULL DEFAULT 'apricot',
  emoji text,
  tags text[] NOT NULL DEFAULT '{}',
  card_count integer NOT NULL DEFAULT 0,
  save_count integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_decks TO authenticated;
GRANT SELECT ON public.shared_decks TO anon;
GRANT ALL ON public.shared_decks TO service_role;
ALTER TABLE public.shared_decks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "published decks are public" ON public.shared_decks
  FOR SELECT TO anon, authenticated USING (published = true);
CREATE POLICY "owners read own decks" ON public.shared_decks
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "owners insert decks" ON public.shared_decks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners update decks" ON public.shared_decks
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners delete decks" ON public.shared_decks
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER shared_decks_touch BEFORE UPDATE ON public.shared_decks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.shared_deck_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES public.shared_decks(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_name text,
  front text NOT NULL,
  back text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shared_deck_cards_deck_idx ON public.shared_deck_cards(deck_id, sort);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_deck_cards TO authenticated;
GRANT SELECT ON public.shared_deck_cards TO anon;
GRANT ALL ON public.shared_deck_cards TO service_role;
ALTER TABLE public.shared_deck_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cards of published decks are public" ON public.shared_deck_cards
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.shared_decks d WHERE d.id = deck_id AND d.published = true)
  );
CREATE POLICY "owners read own deck cards" ON public.shared_deck_cards
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "owners write deck cards" ON public.shared_deck_cards
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners update deck cards" ON public.shared_deck_cards
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners delete deck cards" ON public.shared_deck_cards
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TABLE IF NOT EXISTS public.shared_deck_saves (
  deck_id uuid NOT NULL REFERENCES public.shared_decks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (deck_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.shared_deck_saves TO authenticated;
GRANT ALL ON public.shared_deck_saves TO service_role;
ALTER TABLE public.shared_deck_saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own saves" ON public.shared_deck_saves
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- <<< 20260830215439_9470ed52-e28e-44cc-837a-a6c02eb7db2b.sql


-- >>> 20260830215515_d6f23a56-84a0-4cce-9571-60326a1bb601.sql
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles WITH (security_invoker = on) AS
  SELECT id, username, full_name, avatar_url, bio FROM public.profiles;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

GRANT SELECT (id, username, full_name, avatar_url, bio) ON public.profiles TO anon, authenticated;

CREATE POLICY "shared deck authors are visible" ON public.profiles
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.shared_decks d WHERE d.owner_id = profiles.id AND d.published = true)
  );
-- <<< 20260830215515_d6f23a56-84a0-4cce-9571-60326a1bb601.sql


-- >>> 20260830215547_ff849025-f903-4c4d-b5da-006835303877.sql
CREATE POLICY "avatars are viewable" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'avatars');
CREATE POLICY "users upload own avatar" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "users update own avatar" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "users delete own avatar" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
-- <<< 20260830215547_ff849025-f903-4c4d-b5da-006835303877.sql


-- >>> 20260830215747_3897d05a-cd67-4603-a651-49a4bc109859.sql
CREATE OR REPLACE FUNCTION public.bump_deck_saves(_deck_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.shared_decks
     SET save_count = (SELECT count(*) FROM public.shared_deck_saves s WHERE s.deck_id = _deck_id)
   WHERE id = _deck_id AND published = true;
$$;
REVOKE ALL ON FUNCTION public.bump_deck_saves(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bump_deck_saves(uuid) TO authenticated;
-- <<< 20260830215747_3897d05a-cd67-4603-a651-49a4bc109859.sql


-- >>> 20260830224534_4b46f340-8cb2-40b3-a04f-dc30d0f6807a.sql
CREATE TABLE public.spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'group',
  name text NOT NULL,
  description text,
  image_url text,
  emoji text,
  color text NOT NULL DEFAULT 'apricot',
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  chat_enabled boolean NOT NULL DEFAULT false,
  discoverable boolean NOT NULL DEFAULT false,
  who_can_add_decks text NOT NULL DEFAULT 'members',
  who_can_post text NOT NULL DEFAULT 'members',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT spaces_kind_chk CHECK (kind IN ('classroom','group')),
  CONSTRAINT spaces_add_chk CHECK (who_can_add_decks IN ('owners','members')),
  CONSTRAINT spaces_post_chk CHECK (who_can_post IN ('owners','members'))
);

CREATE TABLE public.space_members (
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  muted boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, user_id),
  CONSTRAINT space_members_role_chk CHECK (role IN ('owner','co_owner','member'))
);

CREATE TABLE public.space_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  expires_at timestamptz,
  max_uses integer,
  uses integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.space_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.space_decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  deck_id uuid NOT NULL REFERENCES public.shared_decks(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES public.space_folders(id) ON DELETE SET NULL,
  added_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, deck_id)
);

CREATE TABLE public.space_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  body text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.space_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.spaces TO authenticated;
GRANT ALL ON public.spaces TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.space_members TO authenticated;
GRANT ALL ON public.space_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.space_invites TO authenticated;
GRANT ALL ON public.space_invites TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.space_folders TO authenticated;
GRANT ALL ON public.space_folders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.space_decks TO authenticated;
GRANT ALL ON public.space_decks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.space_announcements TO authenticated;
GRANT ALL ON public.space_announcements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.space_messages TO authenticated;
GRANT ALL ON public.space_messages TO service_role;

CREATE OR REPLACE FUNCTION public.space_role(_space_id uuid, _user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.space_members WHERE space_id = _space_id AND user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.is_space_member(_space_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.space_members WHERE space_id = _space_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_space(_space_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.space_role(_space_id, _user_id) IN ('owner','co_owner');
$$;

CREATE OR REPLACE FUNCTION public.space_can_add_decks(_space_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.spaces s
    WHERE s.id = _space_id
      AND public.is_space_member(_space_id, _user_id)
      AND (s.who_can_add_decks = 'members' OR public.can_manage_space(_space_id, _user_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.space_can_post(_space_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.spaces s
    WHERE s.id = _space_id
      AND public.is_space_member(_space_id, _user_id)
      AND (s.who_can_post = 'members' OR public.can_manage_space(_space_id, _user_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.space_chat_on(_space_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT chat_enabled FROM public.spaces WHERE id = _space_id), false);
$$;

CREATE OR REPLACE FUNCTION public.create_space(_kind text, _name text, _description text, _emoji text, _color text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _id uuid; _code text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'sign_in_required'; END IF;
  IF _kind NOT IN ('classroom','group') THEN RAISE EXCEPTION 'bad_kind'; END IF;
  INSERT INTO public.spaces (kind, name, description, emoji, color, owner_id)
  VALUES (_kind, trim(_name), NULLIF(trim(coalesce(_description,'')),''), _emoji, coalesce(_color,'apricot'), _uid)
  RETURNING id INTO _id;
  INSERT INTO public.space_members (space_id, user_id, role) VALUES (_id, _uid, 'owner');
  _code := lower(replace(gen_random_uuid()::text, '-', ''));
  _code := substr(_code, 1, 10);
  INSERT INTO public.space_invites (space_id, code, created_by) VALUES (_id, _code, _uid);
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.space_preview(_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _s public.spaces; _i public.space_invites;
BEGIN
  SELECT * INTO _i FROM public.space_invites WHERE code = lower(trim(_code));
  IF NOT FOUND OR NOT _i.active THEN RETURN jsonb_build_object('valid', false); END IF;
  IF _i.expires_at IS NOT NULL AND _i.expires_at < now() THEN RETURN jsonb_build_object('valid', false); END IF;
  IF _i.max_uses IS NOT NULL AND _i.uses >= _i.max_uses THEN RETURN jsonb_build_object('valid', false); END IF;
  SELECT * INTO _s FROM public.spaces WHERE id = _i.space_id;
  RETURN jsonb_build_object(
    'valid', true, 'id', _s.id, 'kind', _s.kind, 'name', _s.name,
    'description', _s.description, 'emoji', _s.emoji, 'color', _s.color,
    'image_url', _s.image_url,
    'members', (SELECT count(*) FROM public.space_members m WHERE m.space_id = _s.id),
    'already', public.is_space_member(_s.id, auth.uid())
  );
END; $$;

CREATE OR REPLACE FUNCTION public.join_space_by_code(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _i public.space_invites;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'sign_in_required'; END IF;
  SELECT * INTO _i FROM public.space_invites WHERE code = lower(trim(_code));
  IF NOT FOUND OR NOT _i.active THEN RAISE EXCEPTION 'invalid_invite'; END IF;
  IF _i.expires_at IS NOT NULL AND _i.expires_at < now() THEN RAISE EXCEPTION 'invalid_invite'; END IF;
  IF _i.max_uses IS NOT NULL AND _i.uses >= _i.max_uses THEN RAISE EXCEPTION 'invalid_invite'; END IF;
  IF NOT public.is_space_member(_i.space_id, _uid) THEN
    INSERT INTO public.space_members (space_id, user_id, role) VALUES (_i.space_id, _uid, 'member');
    UPDATE public.space_invites SET uses = uses + 1 WHERE id = _i.id;
  END IF;
  RETURN _i.space_id;
END; $$;

CREATE OR REPLACE FUNCTION public.space_members_view(_space_id uuid)
RETURNS TABLE(user_id uuid, role text, joined_at timestamptz, username text, full_name text, avatar_url text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_space_member(_space_id, auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT m.user_id, m.role, m.joined_at,
         COALESCE(p.username,''), COALESCE(p.full_name,''), p.avatar_url
  FROM public.space_members m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.space_id = _space_id
  ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'co_owner' THEN 1 ELSE 2 END, m.joined_at;
END; $$;

CREATE OR REPLACE FUNCTION public.my_spaces()
RETURNS TABLE(id uuid, kind text, name text, description text, image_url text, emoji text, color text,
              owner_id uuid, chat_enabled boolean, role text, members bigint, decks bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.kind, s.name, s.description, s.image_url, s.emoji, s.color, s.owner_id, s.chat_enabled,
         m.role,
         (SELECT count(*) FROM public.space_members x WHERE x.space_id = s.id),
         (SELECT count(*) FROM public.space_decks d WHERE d.space_id = s.id)
  FROM public.spaces s
  JOIN public.space_members m ON m.space_id = s.id AND m.user_id = auth.uid()
  ORDER BY s.created_at DESC;
$$;

ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spaces_select" ON public.spaces FOR SELECT TO authenticated
  USING (discoverable OR public.is_space_member(id, auth.uid()));
CREATE POLICY "spaces_insert" ON public.spaces FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "spaces_update" ON public.spaces FOR UPDATE TO authenticated
  USING (public.can_manage_space(id, auth.uid()))
  WITH CHECK (public.can_manage_space(id, auth.uid()));
CREATE POLICY "spaces_delete" ON public.spaces FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "space_members_select" ON public.space_members FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "space_members_insert" ON public.space_members FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_space(space_id, auth.uid()));
CREATE POLICY "space_members_update" ON public.space_members FOR UPDATE TO authenticated
  USING (public.can_manage_space(space_id, auth.uid()) OR user_id = auth.uid())
  WITH CHECK (public.can_manage_space(space_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "space_members_delete" ON public.space_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_space(space_id, auth.uid()));

CREATE POLICY "space_invites_select" ON public.space_invites FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "space_invites_write" ON public.space_invites FOR ALL TO authenticated
  USING (public.can_manage_space(space_id, auth.uid()))
  WITH CHECK (public.can_manage_space(space_id, auth.uid()));

CREATE POLICY "space_folders_select" ON public.space_folders FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "space_folders_write" ON public.space_folders FOR ALL TO authenticated
  USING (public.can_manage_space(space_id, auth.uid()))
  WITH CHECK (public.can_manage_space(space_id, auth.uid()));

CREATE POLICY "space_decks_select" ON public.space_decks FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "space_decks_insert" ON public.space_decks FOR INSERT TO authenticated
  WITH CHECK (added_by = auth.uid() AND public.space_can_add_decks(space_id, auth.uid()));
CREATE POLICY "space_decks_update" ON public.space_decks FOR UPDATE TO authenticated
  USING (public.can_manage_space(space_id, auth.uid()))
  WITH CHECK (public.can_manage_space(space_id, auth.uid()));
CREATE POLICY "space_decks_delete" ON public.space_decks FOR DELETE TO authenticated
  USING (added_by = auth.uid() OR public.can_manage_space(space_id, auth.uid()));

CREATE POLICY "space_ann_select" ON public.space_announcements FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "space_ann_insert" ON public.space_announcements FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.space_can_post(space_id, auth.uid()));
CREATE POLICY "space_ann_update" ON public.space_announcements FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.can_manage_space(space_id, auth.uid()))
  WITH CHECK (author_id = auth.uid() OR public.can_manage_space(space_id, auth.uid()));
CREATE POLICY "space_ann_delete" ON public.space_announcements FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.can_manage_space(space_id, auth.uid()));

CREATE POLICY "space_msg_select" ON public.space_messages FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()) AND public.space_chat_on(space_id));
CREATE POLICY "space_msg_insert" ON public.space_messages FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.is_space_member(space_id, auth.uid()) AND public.space_chat_on(space_id));
CREATE POLICY "space_msg_delete" ON public.space_messages FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.can_manage_space(space_id, auth.uid()));

CREATE TRIGGER spaces_touch BEFORE UPDATE ON public.spaces
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
-- <<< 20260830224534_4b46f340-8cb2-40b3-a04f-dc30d0f6807a.sql


-- >>> 20260830224558_a57cbb14-b5d5-4f66-bdbe-3a05a374e37c.sql
REVOKE EXECUTE ON FUNCTION public.space_role(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_space_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_manage_space(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.space_can_add_decks(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.space_can_post(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.space_chat_on(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_space(text, text, text, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.space_preview(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.join_space_by_code(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.space_members_view(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.my_spaces() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.space_role(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_space_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_space(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.space_can_add_decks(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.space_can_post(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.space_chat_on(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_space(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.space_preview(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_space_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.space_members_view(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_spaces() TO authenticated;
-- <<< 20260830224558_a57cbb14-b5d5-4f66-bdbe-3a05a374e37c.sql


-- >>> 20260831173754_76a9d75e-5cde-48a6-86b0-22f4733c573d.sql
CREATE TABLE public.rita_ai_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null,
  group_id uuid,
  subject_id uuid not null,
  pdf_name text not null,
  total_pages integer not null default 0,
  status text not null default 'running',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE TABLE public.rita_ai_chunks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.rita_ai_jobs(id) on delete cascade,
  chunk_index integer not null,
  page_from integer not null,
  page_to integer not null,
  status text not null default 'pending',
  chunk_text text,
  question_blocks jsonb,
  batch_id text,
  imported_count integer not null default 0,
  error text,
  results jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX rita_ai_chunks_job_idx ON public.rita_ai_chunks(job_id, chunk_index);
CREATE INDEX rita_ai_jobs_user_idx ON public.rita_ai_jobs(user_id, created_at desc);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rita_ai_jobs TO authenticated;
GRANT ALL ON public.rita_ai_jobs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rita_ai_chunks TO authenticated;
GRANT ALL ON public.rita_ai_chunks TO service_role;

ALTER TABLE public.rita_ai_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rita_ai_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own rita jobs" ON public.rita_ai_jobs FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "own rita chunks" ON public.rita_ai_chunks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rita_ai_jobs j WHERE j.id = job_id AND j.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.rita_ai_jobs j WHERE j.id = job_id AND j.user_id = auth.uid()));
-- <<< 20260831173754_76a9d75e-5cde-48a6-86b0-22f4733c573d.sql


-- >>> 20260831181107_39a9e981-4e1c-4505-8439-95553c6e0e45.sql
ALTER TABLE public.rita_ai_jobs
  ADD COLUMN IF NOT EXISTS lease_until timestamptz,
  ADD COLUMN IF NOT EXISTS imported_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chunks_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chunks_done integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pages_per_chunk integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS log jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS rita_ai_jobs_active_idx ON public.rita_ai_jobs (status, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rita_ai_jobs TO authenticated;
GRANT ALL ON public.rita_ai_jobs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rita_ai_chunks TO authenticated;
GRANT ALL ON public.rita_ai_chunks TO service_role;

SELECT cron.unschedule('rita-worker') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rita-worker');

SELECT cron.schedule(
  'rita-worker',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--05a7273e-65b6-403e-8cb6-c887d70948df-dev.lovable.app/api/public/rita-worker',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_zYIuBSlEbWHAQGILccbp8A_UV9ssX7z"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
-- <<< 20260831181107_39a9e981-4e1c-4505-8439-95553c6e0e45.sql


-- >>> 20260831212421_9f163ca1-381b-4e53-a63b-2db6e5a2991a.sql
CREATE TABLE public.lq_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lq_subjects TO authenticated;
GRANT ALL ON public.lq_subjects TO service_role;
ALTER TABLE public.lq_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own lq_subjects" ON public.lq_subjects FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.lq_subtopics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject_id uuid NOT NULL REFERENCES public.lq_subjects(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lq_subtopics TO authenticated;
GRANT ALL ON public.lq_subtopics TO service_role;
ALTER TABLE public.lq_subtopics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own lq_subtopics" ON public.lq_subtopics FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX lq_subtopics_subject_idx ON public.lq_subtopics(subject_id);

CREATE TABLE public.lq_lectures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subtopic_id uuid NOT NULL REFERENCES public.lq_subtopics(id) ON DELETE CASCADE,
  title text NOT NULL,
  source_name text,
  difficulty text NOT NULL DEFAULT 'mixed',
  key_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  question_count integer NOT NULL DEFAULT 0,
  best_score integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lq_lectures TO authenticated;
GRANT ALL ON public.lq_lectures TO service_role;
ALTER TABLE public.lq_lectures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own lq_lectures" ON public.lq_lectures FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX lq_lectures_subtopic_idx ON public.lq_lectures(subtopic_id);

CREATE TABLE public.lq_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lecture_id uuid NOT NULL REFERENCES public.lq_lectures(id) ON DELETE CASCADE,
  stem text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation text NOT NULL DEFAULT '',
  point_ref text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lq_questions TO authenticated;
GRANT ALL ON public.lq_questions TO service_role;
ALTER TABLE public.lq_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own lq_questions" ON public.lq_questions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX lq_questions_lecture_idx ON public.lq_questions(lecture_id);

CREATE TABLE public.lq_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  question_id uuid NOT NULL REFERENCES public.lq_questions(id) ON DELETE CASCADE,
  lecture_id uuid NOT NULL REFERENCES public.lq_lectures(id) ON DELETE CASCADE,
  correct boolean NOT NULL DEFAULT false,
  flagged boolean NOT NULL DEFAULT false,
  answered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lq_attempts TO authenticated;
GRANT ALL ON public.lq_attempts TO service_role;
ALTER TABLE public.lq_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own lq_attempts" ON public.lq_attempts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX lq_attempts_lecture_idx ON public.lq_attempts(lecture_id);
-- <<< 20260831212421_9f163ca1-381b-4e53-a63b-2db6e5a2991a.sql


-- >>> 20260901005308_485d8bfa-66a3-4a5b-a4a5-67ece9256645.sql
CREATE TABLE public.aio_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lecture_id uuid NOT NULL REFERENCES public.lq_lectures(id) ON DELETE CASCADE,
  guide_md text NOT NULL DEFAULT '',
  short_md text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lecture_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aio_summaries TO authenticated;
GRANT ALL ON public.aio_summaries TO service_role;
ALTER TABLE public.aio_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own aio summaries" ON public.aio_summaries
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.aio_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lecture_id uuid NOT NULL REFERENCES public.lq_lectures(id) ON DELETE CASCADE,
  front text NOT NULL,
  back text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aio_cards TO authenticated;
GRANT ALL ON public.aio_cards TO service_role;
ALTER TABLE public.aio_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own aio cards" ON public.aio_cards
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX aio_cards_lecture_idx ON public.aio_cards (lecture_id, sort_order);

CREATE TRIGGER aio_summaries_touch
  BEFORE UPDATE ON public.aio_summaries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
-- <<< 20260901005308_485d8bfa-66a3-4a5b-a4a5-67ece9256645.sql


-- >>> 20260901010147_42f6054b-9272-4a8c-905c-76dac39b89eb.sql
CREATE TABLE public.institution_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  organisation text NOT NULL,
  role text,
  students integer,
  message text,
  kind text NOT NULL DEFAULT 'institution',
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.institution_leads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.institution_leads TO authenticated;
GRANT ALL ON public.institution_leads TO service_role;

ALTER TABLE public.institution_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can send an enquiry" ON public.institution_leads
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "admins read enquiries" ON public.institution_leads
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update enquiries" ON public.institution_leads
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete enquiries" ON public.institution_leads
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER institution_leads_touch
  BEFORE UPDATE ON public.institution_leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
-- <<< 20260901010147_42f6054b-9272-4a8c-905c-76dac39b89eb.sql


-- >>> 20260901123100_94d730bb-16f4-4c58-b73e-bd767a153154.sql
ALTER TABLE public.german_subjects
  ADD COLUMN IF NOT EXISTS owner_user_id uuid;

CREATE INDEX IF NOT EXISTS german_subjects_owner_user_idx
  ON public.german_subjects(owner_user_id);

DROP POLICY IF EXISTS "german_subjects read owners" ON public.german_subjects;
DROP POLICY IF EXISTS "german_subjects admin write" ON public.german_subjects;
DROP POLICY IF EXISTS "german_items read enrolled" ON public.german_items;
DROP POLICY IF EXISTS "german_items admin write" ON public.german_items;
DROP POLICY IF EXISTS "german_words read enrolled" ON public.german_word_entries;
DROP POLICY IF EXISTS "german_words admin write" ON public.german_word_entries;
DROP POLICY IF EXISTS "german_sent read enrolled" ON public.german_sentence_entries;
DROP POLICY IF EXISTS "german_sent admin write" ON public.german_sentence_entries;

CREATE POLICY "german subjects visible to course owner"
ON public.german_subjects FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.user_courses uc
    WHERE uc.user_id = auth.uid()
      AND uc.course_id = german_subjects.course_id
      AND (german_subjects.owner_user_id IS NULL OR german_subjects.owner_user_id = auth.uid())
  )
);

CREATE POLICY "german subjects create own"
ON public.german_subjects FOR INSERT TO authenticated
WITH CHECK (
  owner_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.user_courses uc
    WHERE uc.user_id = auth.uid() AND uc.course_id = german_subjects.course_id
  )
);

CREATE POLICY "german subjects update own or admin"
ON public.german_subjects FOR UPDATE TO authenticated
USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "german subjects delete own or admin"
ON public.german_subjects FOR DELETE TO authenticated
USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "german items visible through subject"
ON public.german_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.german_subjects gs
    WHERE gs.id = german_items.subject_id
      AND (
        public.has_role(auth.uid(), 'admin')
        OR EXISTS (
          SELECT 1 FROM public.user_courses uc
          WHERE uc.user_id = auth.uid()
            AND uc.course_id = gs.course_id
            AND (gs.owner_user_id IS NULL OR gs.owner_user_id = auth.uid())
        )
      )
  )
);

CREATE POLICY "german items create through own subject"
ON public.german_items FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.german_subjects gs
    WHERE gs.id = german_items.subject_id
      AND (gs.owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "german items update through own subject"
ON public.german_items FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.german_subjects gs
    WHERE gs.id = german_items.subject_id
      AND (gs.owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.german_subjects gs
    WHERE gs.id = german_items.subject_id
      AND (gs.owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "german items delete through own subject"
ON public.german_items FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.german_subjects gs
    WHERE gs.id = german_items.subject_id
      AND (gs.owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "german words visible through subject"
ON public.german_word_entries FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.german_items gi
    JOIN public.german_subjects gs ON gs.id = gi.subject_id
    WHERE gi.id = german_word_entries.item_id
      AND (
        public.has_role(auth.uid(), 'admin')
        OR EXISTS (
          SELECT 1 FROM public.user_courses uc
          WHERE uc.user_id = auth.uid()
            AND uc.course_id = gs.course_id
            AND (gs.owner_user_id IS NULL OR gs.owner_user_id = auth.uid())
        )
      )
  )
);

CREATE POLICY "german words create through own subject"
ON public.german_word_entries FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.german_items gi
    JOIN public.german_subjects gs ON gs.id = gi.subject_id
    WHERE gi.id = german_word_entries.item_id
      AND (gs.owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "german words update through own subject"
ON public.german_word_entries FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.german_items gi
    JOIN public.german_subjects gs ON gs.id = gi.subject_id
    WHERE gi.id = german_word_entries.item_id
      AND (gs.owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.german_items gi
    JOIN public.german_subjects gs ON gs.id = gi.subject_id
    WHERE gi.id = german_word_entries.item_id
      AND (gs.owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "german words delete through own subject"
ON public.german_word_entries FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.german_items gi
    JOIN public.german_subjects gs ON gs.id = gi.subject_id
    WHERE gi.id = german_word_entries.item_id
      AND (gs.owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "german sentences visible through subject"
ON public.german_sentence_entries FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.german_items gi
    JOIN public.german_subjects gs ON gs.id = gi.subject_id
    WHERE gi.id = german_sentence_entries.item_id
      AND (
        public.has_role(auth.uid(), 'admin')
        OR EXISTS (
          SELECT 1 FROM public.user_courses uc
          WHERE uc.user_id = auth.uid()
            AND uc.course_id = gs.course_id
            AND (gs.owner_user_id IS NULL OR gs.owner_user_id = auth.uid())
        )
      )
  )
);

CREATE POLICY "german sentences create through own subject"
ON public.german_sentence_entries FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.german_items gi
    JOIN public.german_subjects gs ON gs.id = gi.subject_id
    WHERE gi.id = german_sentence_entries.item_id
      AND (gs.owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "german sentences update through own subject"
ON public.german_sentence_entries FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.german_items gi
    JOIN public.german_subjects gs ON gs.id = gi.subject_id
    WHERE gi.id = german_sentence_entries.item_id
      AND (gs.owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.german_items gi
    JOIN public.german_subjects gs ON gs.id = gi.subject_id
    WHERE gi.id = german_sentence_entries.item_id
      AND (gs.owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "german sentences delete through own subject"
ON public.german_sentence_entries FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.german_items gi
    JOIN public.german_subjects gs ON gs.id = gi.subject_id
    WHERE gi.id = german_sentence_entries.item_id
      AND (gs.owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);
-- <<< 20260901123100_94d730bb-16f4-4c58-b73e-bd767a153154.sql


-- >>> 20260901123234_dd3369a4-32dc-4617-ab6b-945b15721efe.sql
ALTER TABLE public.german_subjects
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.german_subjects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'mixed';

CREATE INDEX IF NOT EXISTS german_subjects_parent_idx
  ON public.german_subjects(parent_id);

ALTER TABLE public.german_subjects
  DROP CONSTRAINT IF EXISTS german_subjects_not_self_parent,
  ADD CONSTRAINT german_subjects_not_self_parent CHECK (parent_id IS NULL OR parent_id <> id);
-- <<< 20260901123234_dd3369a4-32dc-4617-ab6b-945b15721efe.sql


-- >>> 20260901163207_38a5992b-133d-4d88-95b5-4e041bf3ce15.sql
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS max_todo_tasks integer,
  ADD COLUMN IF NOT EXISTS max_calendar_items integer,
  ADD COLUMN IF NOT EXISTS max_groups integer,
  ADD COLUMN IF NOT EXISTS max_all_in_one_lectures integer,
  ADD COLUMN IF NOT EXISTS max_all_in_one_questions integer,
  ADD COLUMN IF NOT EXISTS max_archive_questions integer,
  ADD COLUMN IF NOT EXISTS max_rita_questions integer,
  ADD COLUMN IF NOT EXISTS feature_lecture_qgen boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS feature_archive_qgen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_all_in_one boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_rita38 boolean NOT NULL DEFAULT false;

ALTER TABLE public.usage_counters
  ADD COLUMN IF NOT EXISTS todo_tasks integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calendar_items integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS all_in_one_lectures integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS all_in_one_questions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archive_questions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rita_questions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS groups integer NOT NULL DEFAULT 0;

-- fold every historic monthly bucket into one lifetime bucket
INSERT INTO public.usage_counters (user_id, period, summaries, ai_questions, flashcards)
SELECT user_id, 'lifetime', SUM(summaries), SUM(ai_questions), SUM(flashcards)
  FROM public.usage_counters WHERE period <> 'lifetime'
 GROUP BY user_id
ON CONFLICT (user_id, period) DO UPDATE
  SET summaries = public.usage_counters.summaries + EXCLUDED.summaries,
      ai_questions = public.usage_counters.ai_questions + EXCLUDED.ai_questions,
      flashcards = public.usage_counters.flashcards + EXCLUDED.flashcards;

DELETE FROM public.usage_counters WHERE period <> 'lifetime';

CREATE OR REPLACE FUNCTION public.bump_usage(_user_id uuid, _kind text, _n integer DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _kind NOT IN ('summaries','ai_questions','flashcards','todo_tasks','calendar_items',
                   'all_in_one_lectures','all_in_one_questions','archive_questions',
                   'rita_questions','groups') THEN
    RETURN;
  END IF;

  INSERT INTO public.usage_counters (user_id, period) VALUES (_user_id, 'lifetime')
  ON CONFLICT (user_id, period) DO NOTHING;

  EXECUTE format(
    'UPDATE public.usage_counters SET %I = %I + $1, updated_at = now() WHERE user_id = $2 AND period = ''lifetime''',
    _kind, _kind
  ) USING _n, _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.my_plan_usage()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _slug text;
  _plan public.plans%ROWTYPE;
  _usage public.usage_counters%ROWTYPE;
  _admin boolean;
BEGIN
  IF _uid IS NULL THEN
    RETURN NULL;
  END IF;

  _admin := public.has_role(_uid, 'admin');

  SELECT plan_slug INTO _slug FROM public.user_plans WHERE user_id = _uid;
  IF _slug IS NULL THEN
    _slug := 'starter';
  END IF;

  SELECT * INTO _plan FROM public.plans WHERE slug = _slug;
  IF _plan.slug IS NULL THEN
    SELECT * INTO _plan FROM public.plans WHERE published ORDER BY sort LIMIT 1;
  END IF;

  SELECT * INTO _usage FROM public.usage_counters
   WHERE user_id = _uid AND period = 'lifetime';

  RETURN jsonb_build_object(
    'plan', to_jsonb(_plan),
    'usage', jsonb_build_object(
      'summaries', COALESCE(_usage.summaries, 0),
      'ai_questions', COALESCE(_usage.ai_questions, 0),
      'flashcards', COALESCE(_usage.flashcards, 0),
      'todo_tasks', COALESCE(_usage.todo_tasks, 0),
      'calendar_items', COALESCE(_usage.calendar_items, 0),
      'all_in_one_lectures', COALESCE(_usage.all_in_one_lectures, 0),
      'all_in_one_questions', COALESCE(_usage.all_in_one_questions, 0),
      'archive_questions', COALESCE(_usage.archive_questions, 0),
      'rita_questions', COALESCE(_usage.rita_questions, 0),
      'groups', COALESCE(_usage.groups, 0)
    ),
    'is_admin', _admin
  );
END;
$$;

-- the five tiers
UPDATE public.plans SET published = false WHERE slug = 'study';

INSERT INTO public.plans (slug, name, tagline, price_cents, yearly_cents, currency, sort, published, highlight,
  max_flashcards, max_ai_questions, max_summaries, max_todo_tasks, max_calendar_items, max_groups,
  max_all_in_one_lectures, max_all_in_one_questions, max_archive_questions, max_rita_questions,
  todo_full, rich_cards, feature_ai_import, feature_review,
  feature_lecture_qgen, feature_archive_qgen, feature_all_in_one, feature_rita38, perks)
VALUES
  ('starter','Free','Your first steps with Rita',0,0,'USD',1,true,false,
    25,10,1,5,5,5,0,0,0,0,false,false,false,true,true,false,false,false,
    ARRAY['10 lecture questions','1 summary','25 flashcards','5 to-do tasks','5 calendar entries','Join unlimited classrooms']),
  ('toolkit','Toolkit','Every study tool, unlimited',300,3000,'USD',2,false,false,
    NULL,0,0,NULL,NULL,NULL,0,0,0,0,true,true,false,true,false,false,false,false,
    ARRAY['Unlimited flashcards','German labs','Memory game','Unlimited to-do & calendar','Unlimited classrooms & groups']),
  ('boost','Boost','Add AI to your toolkit',500,5000,'USD',3,false,false,
    500,200,20,NULL,NULL,NULL,0,0,0,0,true,true,true,true,true,false,false,false,
    ARRAY['Everything in Toolkit','200 lecture questions','20 summaries','500 flashcards']),
  ('pro','Pro','Exam season, handled',1500,15000,'USD',4,true,true,
    1000,400,50,NULL,NULL,NULL,50,NULL,0,0,true,true,true,true,true,false,true,false,
    ARRAY['Everything in Boost','400 lecture questions','1000 flashcards','All-in-One on 50 lectures']),
  ('ultimate','Ultimate','The whole of Rita',2000,20000,'USD',5,true,false,
    NULL,400,NULL,NULL,NULL,NULL,NULL,120,1000,1000,true,true,true,true,true,true,true,true,
    ARRAY['Everything in Pro','Archive questions with full explanations (1000)','All-in-One up to 120 questions','Rita Model 3.8 up to 1000 questions'])
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, tagline = EXCLUDED.tagline,
  price_cents = EXCLUDED.price_cents, yearly_cents = EXCLUDED.yearly_cents,
  currency = EXCLUDED.currency, sort = EXCLUDED.sort,
  published = EXCLUDED.published, highlight = EXCLUDED.highlight,
  max_flashcards = EXCLUDED.max_flashcards, max_ai_questions = EXCLUDED.max_ai_questions,
  max_summaries = EXCLUDED.max_summaries, max_todo_tasks = EXCLUDED.max_todo_tasks,
  max_calendar_items = EXCLUDED.max_calendar_items, max_groups = EXCLUDED.max_groups,
  max_all_in_one_lectures = EXCLUDED.max_all_in_one_lectures,
  max_all_in_one_questions = EXCLUDED.max_all_in_one_questions,
  max_archive_questions = EXCLUDED.max_archive_questions,
  max_rita_questions = EXCLUDED.max_rita_questions,
  todo_full = EXCLUDED.todo_full, rich_cards = EXCLUDED.rich_cards,
  feature_ai_import = EXCLUDED.feature_ai_import, feature_review = EXCLUDED.feature_review,
  feature_lecture_qgen = EXCLUDED.feature_lecture_qgen,
  feature_archive_qgen = EXCLUDED.feature_archive_qgen,
  feature_all_in_one = EXCLUDED.feature_all_in_one,
  feature_rita38 = EXCLUDED.feature_rita38,
  perks = EXCLUDED.perks;
-- <<< 20260901163207_38a5992b-133d-4d88-95b5-4e041bf3ce15.sql


-- >>> 20260901163902_c45ab7cd-9ffe-4c17-9cda-a2902a163bd0.sql
CREATE OR REPLACE FUNCTION public.create_space(_kind text, _name text, _description text, _emoji text, _color text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _id uuid;
  _code text;
  _cap integer;
  _owned integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'sign_in_required'; END IF;
  IF _kind NOT IN ('classroom','group') THEN RAISE EXCEPTION 'bad_kind'; END IF;

  IF NOT public.has_role(_uid, 'admin') THEN
    SELECT p.max_groups INTO _cap
      FROM public.plans p
     WHERE p.slug = COALESCE((SELECT plan_slug FROM public.user_plans WHERE user_id = _uid), 'starter');
    IF _cap IS NOT NULL THEN
      SELECT count(*) INTO _owned FROM public.spaces WHERE owner_id = _uid;
      IF _owned >= _cap THEN
        RAISE EXCEPTION 'Your plan lets you create % classrooms. Delete one or upgrade on the Plans page.', _cap;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.spaces (kind, name, description, emoji, color, owner_id)
  VALUES (_kind, trim(_name), NULLIF(trim(coalesce(_description,'')),''), _emoji, coalesce(_color,'apricot'), _uid)
  RETURNING id INTO _id;
  INSERT INTO public.space_members (space_id, user_id, role) VALUES (_id, _uid, 'owner');
  _code := lower(replace(gen_random_uuid()::text, '-', ''));
  _code := substr(_code, 1, 10);
  INSERT INTO public.space_invites (space_id, code, created_by) VALUES (_id, _code, _uid);
  RETURN _id;
END;
$$;
-- <<< 20260901163902_c45ab7cd-9ffe-4c17-9cda-a2902a163bd0.sql


-- >>> 20260901163955_0be89982-3acc-4e9d-a407-5ffe6b5ffb53.sql
UPDATE public.plans SET published = true WHERE slug IN ('toolkit','boost');
-- <<< 20260901163955_0be89982-3acc-4e9d-a407-5ffe6b5ffb53.sql


-- >>> 20260901170415_f5958f8e-d74b-4129-8890-5488933e3928.sql
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS feature_ai_cards_enabled boolean NOT NULL DEFAULT false;
-- <<< 20260901170415_f5958f8e-d74b-4129-8890-5488933e3928.sql


-- >>> 20260902105129_719964d2-26b8-4edd-8781-ca073ba92669.sql
ALTER TABLE public.subject_groups ADD COLUMN IF NOT EXISTS owner_user_id uuid;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS owner_user_id uuid;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS owner_user_id uuid;
ALTER TABLE public.question_options ADD COLUMN IF NOT EXISTS owner_user_id uuid;

CREATE INDEX IF NOT EXISTS subject_groups_owner_idx ON public.subject_groups(owner_user_id);
CREATE INDEX IF NOT EXISTS subjects_owner_idx ON public.subjects(owner_user_id);
CREATE INDEX IF NOT EXISTS questions_owner_idx ON public.questions(owner_user_id);
CREATE INDEX IF NOT EXISTS question_options_owner_idx ON public.question_options(owner_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_options TO authenticated;
GRANT ALL ON public.subject_groups TO service_role;
GRANT ALL ON public.subjects TO service_role;
GRANT ALL ON public.questions TO service_role;
GRANT ALL ON public.question_options TO service_role;

-- subject_groups: keep public/enrolled reads limited to official rows
DROP POLICY IF EXISTS "Anyone can view published subject groups" ON public.subject_groups;
CREATE POLICY "Anyone can view published subject groups"
ON public.subject_groups FOR SELECT
USING (owner_user_id IS NULL AND EXISTS (SELECT 1 FROM public.courses c WHERE c.id = subject_groups.course_id AND c.published = true));

DROP POLICY IF EXISTS "View subject_groups if enrolled or admin" ON public.subject_groups;
CREATE POLICY "View subject_groups if enrolled or admin"
ON public.subject_groups FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (owner_user_id IS NULL AND EXISTS (SELECT 1 FROM public.user_courses uc WHERE uc.course_id = subject_groups.course_id AND uc.user_id = auth.uid()))
);

CREATE POLICY "Users manage own subject_groups"
ON public.subject_groups FOR ALL TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

-- subjects
DROP POLICY IF EXISTS "Anon can view free public subjects" ON public.subjects;
CREATE POLICY "Anon can view free public subjects"
ON public.subjects FOR SELECT TO anon
USING (
  owner_user_id IS NULL AND access_level = 'free_public'::subject_access
  AND EXISTS (SELECT 1 FROM public.subject_groups sg JOIN public.courses c ON c.id = sg.course_id WHERE sg.id = subjects.group_id AND c.published = true)
);

DROP POLICY IF EXISTS "Authenticated can view free subjects" ON public.subjects;
CREATE POLICY "Authenticated can view free subjects"
ON public.subjects FOR SELECT TO authenticated
USING (
  owner_user_id IS NULL
  AND access_level = ANY (ARRAY['free_public'::subject_access, 'free_logged_in'::subject_access])
  AND EXISTS (SELECT 1 FROM public.subject_groups sg JOIN public.courses c ON c.id = sg.course_id WHERE sg.id = subjects.group_id AND c.published = true)
);

DROP POLICY IF EXISTS "View subjects if enrolled or admin" ON public.subjects;
CREATE POLICY "View subjects if enrolled or admin"
ON public.subjects FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (owner_user_id IS NULL AND EXISTS (SELECT 1 FROM public.subject_groups sg JOIN public.user_courses uc ON uc.course_id = sg.course_id WHERE sg.id = subjects.group_id AND uc.user_id = auth.uid()))
);

CREATE POLICY "Users manage own subjects"
ON public.subjects FOR ALL TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

-- questions
DROP POLICY IF EXISTS "View questions if enrolled or admin" ON public.questions;
CREATE POLICY "View questions if enrolled or admin"
ON public.questions FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (owner_user_id IS NULL AND account_active(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.subjects s JOIN public.subject_groups sg ON sg.id = s.group_id JOIN public.user_courses uc ON uc.course_id = sg.course_id
    WHERE s.id = questions.subject_id AND uc.user_id = auth.uid()))
);

CREATE POLICY "Users manage own questions"
ON public.questions FOR ALL TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

-- question_options
DROP POLICY IF EXISTS "View question_options if enrolled or admin" ON public.question_options;
CREATE POLICY "View question_options if enrolled or admin"
ON public.question_options FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (owner_user_id IS NULL AND account_active(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.questions q JOIN public.subjects s ON s.id = q.subject_id JOIN public.subject_groups sg ON sg.id = s.group_id JOIN public.user_courses uc ON uc.course_id = sg.course_id
    WHERE q.id = question_options.question_id AND uc.user_id = auth.uid()))
);

CREATE POLICY "Users manage own question_options"
ON public.question_options FOR ALL TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());
-- <<< 20260902105129_719964d2-26b8-4edd-8781-ca073ba92669.sql


-- >>> 20260902124303_519a5173-3460-44eb-9ed8-f9f2d0d74fc7.sql
alter table public.plans
  add column if not exists billing_kind text not null default 'monthly',
  add column if not exists once_cents integer not null default 0,
  add column if not exists paddle_price_monthly text,
  add column if not exists paddle_price_yearly text,
  add column if not exists paddle_price_once text;

do $$ begin
  alter table public.plans add constraint plans_billing_kind_chk check (billing_kind in ('monthly','lifetime'));
exception when duplicate_object then null; end $$;

create table if not exists public.plan_credit_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  plan_slug text not null,
  transaction_id text not null unique,
  environment text not null default 'sandbox',
  flashcards integer not null default 0,
  ai_questions integer not null default 0,
  summaries integer not null default 0,
  todo_tasks integer not null default 0,
  calendar_items integer not null default 0,
  all_in_one_lectures integer not null default 0,
  all_in_one_questions integer not null default 0,
  archive_questions integer not null default 0,
  rita_questions integer not null default 0,
  groups integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_plan_credit_grants_user on public.plan_credit_grants(user_id);

grant select on public.plan_credit_grants to authenticated;
grant all on public.plan_credit_grants to service_role;

alter table public.plan_credit_grants enable row level security;

do $$ begin
  create policy "Students read their own credit grants"
    on public.plan_credit_grants for select
    to authenticated
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  paddle_subscription_id text not null unique,
  paddle_customer_id text,
  product_id text,
  price_id text,
  plan_slug text,
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  environment text not null default 'sandbox',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_user_id on public.subscriptions(user_id);

grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;

alter table public.subscriptions enable row level security;

do $$ begin
  create policy "Students read their own subscriptions"
    on public.subscriptions for select
    to authenticated
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

create or replace function public.my_plan_usage()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
DECLARE
  _uid uuid := auth.uid();
  _slug text;
  _plan public.plans%ROWTYPE;
  _usage public.usage_counters%ROWTYPE;
  _admin boolean;
  _g jsonb;
BEGIN
  IF _uid IS NULL THEN
    RETURN NULL;
  END IF;

  _admin := public.has_role(_uid, 'admin');

  SELECT plan_slug INTO _slug FROM public.user_plans WHERE user_id = _uid;
  IF _slug IS NULL THEN
    _slug := 'starter';
  END IF;

  SELECT * INTO _plan FROM public.plans WHERE slug = _slug;
  IF _plan.slug IS NULL THEN
    SELECT * INTO _plan FROM public.plans WHERE published ORDER BY sort LIMIT 1;
  END IF;

  SELECT * INTO _usage FROM public.usage_counters
   WHERE user_id = _uid AND period = 'lifetime';

  SELECT jsonb_build_object(
    'summaries', COALESCE(SUM(summaries),0),
    'ai_questions', COALESCE(SUM(ai_questions),0),
    'flashcards', COALESCE(SUM(flashcards),0),
    'todo_tasks', COALESCE(SUM(todo_tasks),0),
    'calendar_items', COALESCE(SUM(calendar_items),0),
    'all_in_one_lectures', COALESCE(SUM(all_in_one_lectures),0),
    'all_in_one_questions', COALESCE(SUM(all_in_one_questions),0),
    'archive_questions', COALESCE(SUM(archive_questions),0),
    'rita_questions', COALESCE(SUM(rita_questions),0),
    'groups', COALESCE(SUM(groups),0)
  ) INTO _g
  FROM public.plan_credit_grants WHERE user_id = _uid;

  RETURN jsonb_build_object(
    'plan', to_jsonb(_plan),
    'grants', COALESCE(_g, '{}'::jsonb),
    'usage', jsonb_build_object(
      'summaries', COALESCE(_usage.summaries, 0),
      'ai_questions', COALESCE(_usage.ai_questions, 0),
      'flashcards', COALESCE(_usage.flashcards, 0),
      'todo_tasks', COALESCE(_usage.todo_tasks, 0),
      'calendar_items', COALESCE(_usage.calendar_items, 0),
      'all_in_one_lectures', COALESCE(_usage.all_in_one_lectures, 0),
      'all_in_one_questions', COALESCE(_usage.all_in_one_questions, 0),
      'archive_questions', COALESCE(_usage.archive_questions, 0),
      'rita_questions', COALESCE(_usage.rita_questions, 0),
      'groups', COALESCE(_usage.groups, 0)
    ),
    'is_admin', _admin
  );
END;
$fn$;
-- <<< 20260902124303_519a5173-3460-44eb-9ed8-f9f2d0d74fc7.sql


-- >>> 20260902134900_0193a5d1-785a-4541-aebe-7d860d4ff426.sql
CREATE TABLE IF NOT EXISTS public.vault_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'backup',
  status text NOT NULL DEFAULT 'running',
  snapshot text,
  started_by uuid,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vault_runs TO authenticated;
GRANT ALL ON public.vault_runs TO service_role;

ALTER TABLE public.vault_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read vault runs" ON public.vault_runs;
CREATE POLICY "admins read vault runs" ON public.vault_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS vault_runs_touch ON public.vault_runs;
CREATE TRIGGER vault_runs_touch BEFORE UPDATE ON public.vault_runs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.vault_tables()
RETURNS TABLE(name text, depth integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  WITH RECURSIVE t AS (
    SELECT c.oid, c.relname::text AS tname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  ),
  deps AS (
    SELECT con.conrelid AS child, con.confrelid AS parent
    FROM pg_constraint con
    JOIN t ON t.oid = con.conrelid
    WHERE con.contype = 'f' AND con.confrelid <> con.conrelid
      AND con.confrelid IN (SELECT oid FROM t)
  ),
  lvl AS (
    SELECT t.oid, t.tname, 0 AS d FROM t
    WHERE NOT EXISTS (SELECT 1 FROM deps x WHERE x.child = t.oid)
    UNION ALL
    SELECT t.oid, t.tname, l.d + 1
    FROM t JOIN deps x ON x.child = t.oid JOIN lvl l ON l.oid = x.parent
    WHERE l.d < 12
  )
  SELECT l.tname, max(l.d)::int FROM lvl l GROUP BY l.tname ORDER BY 2, 1;
END;
$$;

REVOKE ALL ON FUNCTION public.vault_tables() FROM public;
GRANT EXECUTE ON FUNCTION public.vault_tables() TO authenticated, service_role;

INSERT INTO public.site_secrets (key, value)
VALUES ('vault_cron_key', replace(gen_random_uuid()::text, '-', ''))
ON CONFLICT (key) DO NOTHING;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $cron$
DECLARE _key text;
BEGIN
  SELECT value INTO _key FROM public.site_secrets WHERE key = 'vault_cron_key';
  PERFORM cron.unschedule('vault-daily-snapshot')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'vault-daily-snapshot');
  PERFORM cron.schedule(
    'vault-daily-snapshot',
    '20 3 * * *',
    format($job$
      SELECT net.http_post(
        url := 'https://project--05a7273e-65b6-403e-8cb6-c887d70948df.lovable.app/api/public/vault/run',
        headers := jsonb_build_object('Content-Type','application/json','x-vault-key',%L),
        body := '{"source":"cron"}'::jsonb
      );
    $job$, _key)
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron scheduling skipped: %', SQLERRM;
END;
$cron$;
-- <<< 20260902134900_0193a5d1-785a-4541-aebe-7d860d4ff426.sql


-- >>> 20260902170941_a8c41ecd-f994-4f95-b539-37868374c879.sql
ALTER TABLE public.summaries ADD COLUMN IF NOT EXISTS is_example boolean NOT NULL DEFAULT false;
ALTER TABLE public.lq_lectures ADD COLUMN IF NOT EXISTS is_example boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "anyone reads example summaries" ON public.summaries;
CREATE POLICY "anyone reads example summaries" ON public.summaries
  FOR SELECT TO authenticated USING (is_example = true);

DROP POLICY IF EXISTS "read example lectures" ON public.lq_lectures;
CREATE POLICY "read example lectures" ON public.lq_lectures
  FOR SELECT TO authenticated USING (is_example = true);

DROP POLICY IF EXISTS "read example aio cards" ON public.aio_cards;
CREATE POLICY "read example aio cards" ON public.aio_cards
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.lq_lectures l WHERE l.id = aio_cards.lecture_id AND l.is_example
  ));

DROP POLICY IF EXISTS "read example aio summaries" ON public.aio_summaries;
CREATE POLICY "read example aio summaries" ON public.aio_summaries
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.lq_lectures l WHERE l.id = aio_summaries.lecture_id AND l.is_example
  ));

DROP POLICY IF EXISTS "read example lecture questions" ON public.lq_questions;
CREATE POLICY "read example lecture questions" ON public.lq_questions
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.lq_lectures l WHERE l.id = lq_questions.lecture_id AND l.is_example
  ));

UPDATE public.summaries SET is_example = true WHERE id = 'fffa7abf-1b9c-48d8-83be-37c1d183c1e2';
UPDATE public.lq_lectures SET is_example = true WHERE id = '88872619-3418-420c-b150-cc6813d6d7ca';
-- <<< 20260902170941_a8c41ecd-f994-4f95-b539-37868374c879.sql


-- >>> 20260902173453_c73e2a51-6ea3-4315-98e4-8023ec4b1a25.sql
-- ============================================================ deck ratings
CREATE TABLE public.deck_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES public.shared_decks(id) ON DELETE CASCADE,
  space_id uuid REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  stars smallint NOT NULL,
  note text,
  under_review boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deck_ratings ADD CONSTRAINT deck_ratings_stars_range CHECK (stars BETWEEN 1 AND 5);
CREATE UNIQUE INDEX deck_ratings_one_global ON public.deck_ratings (user_id, deck_id) WHERE space_id IS NULL;
CREATE UNIQUE INDEX deck_ratings_one_space ON public.deck_ratings (user_id, deck_id, space_id) WHERE space_id IS NOT NULL;
CREATE INDEX deck_ratings_deck_idx ON public.deck_ratings (deck_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deck_ratings TO authenticated;
GRANT ALL ON public.deck_ratings TO service_role;
ALTER TABLE public.deck_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own rating read" ON public.deck_ratings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own rating write" ON public.deck_ratings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "own rating update" ON public.deck_ratings FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own rating delete" ON public.deck_ratings FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.shared_decks
  ADD COLUMN IF NOT EXISTS rating_avg numeric(3,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.recount_deck_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _deck uuid;
BEGIN
  _deck := COALESCE(NEW.deck_id, OLD.deck_id);
  UPDATE public.shared_decks d SET
    rating_avg = COALESCE((SELECT ROUND(AVG(r.stars)::numeric, 2) FROM public.deck_ratings r
                            WHERE r.deck_id = _deck AND r.space_id IS NULL AND NOT r.under_review), 0),
    rating_count = COALESCE((SELECT COUNT(*) FROM public.deck_ratings r
                            WHERE r.deck_id = _deck AND r.space_id IS NULL AND NOT r.under_review), 0)
  WHERE d.id = _deck;
  RETURN NULL;
END; $$;

CREATE TRIGGER deck_ratings_recount
AFTER INSERT OR UPDATE OR DELETE ON public.deck_ratings
FOR EACH ROW EXECUTE FUNCTION public.recount_deck_rating();

-- rate a deck (anonymous to everyone else)
CREATE OR REPLACE FUNCTION public.rate_deck(_deck_id uuid, _stars smallint, _note text DEFAULT NULL, _space_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _new boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  IF _stars < 1 OR _stars > 5 THEN RAISE EXCEPTION 'stars must be 1..5'; END IF;
  IF _space_id IS NOT NULL AND NOT public.is_space_member(_space_id, _uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  -- accounts younger than 2 days start under review to stop rating bursts
  SELECT (p.created_at > now() - interval '2 days') INTO _new FROM public.profiles p WHERE p.id = _uid;

  IF _space_id IS NULL THEN
    INSERT INTO public.deck_ratings (deck_id, user_id, stars, note, under_review)
    VALUES (_deck_id, _uid, _stars, NULLIF(btrim(COALESCE(_note,'')),''), COALESCE(_new,false))
    ON CONFLICT (user_id, deck_id) WHERE space_id IS NULL
    DO UPDATE SET stars = EXCLUDED.stars, note = EXCLUDED.note, updated_at = now();
  ELSE
    INSERT INTO public.deck_ratings (deck_id, space_id, user_id, stars, note, under_review)
    VALUES (_deck_id, _space_id, _uid, _stars, NULLIF(btrim(COALESCE(_note,'')),''), COALESCE(_new,false))
    ON CONFLICT (user_id, deck_id, space_id) WHERE space_id IS NOT NULL
    DO UPDATE SET stars = EXCLUDED.stars, note = EXCLUDED.note, updated_at = now();
  END IF;
END; $$;

-- public summary: numbers and notes only, never identities
CREATE OR REPLACE FUNCTION public.deck_rating_summary(_deck_id uuid, _space_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'avg', COALESCE(ROUND(AVG(stars)::numeric, 2), 0),
    'count', COUNT(*),
    'mine', (SELECT stars FROM public.deck_ratings r2
              WHERE r2.deck_id = _deck_id AND r2.user_id = auth.uid()
                AND r2.space_id IS NOT DISTINCT FROM _space_id),
    'breakdown', jsonb_build_object(
      '5', COUNT(*) FILTER (WHERE stars = 5), '4', COUNT(*) FILTER (WHERE stars = 4),
      '3', COUNT(*) FILTER (WHERE stars = 3), '2', COUNT(*) FILTER (WHERE stars = 2),
      '1', COUNT(*) FILTER (WHERE stars = 1)),
    'notes', COALESCE((SELECT jsonb_agg(jsonb_build_object('stars', n.stars, 'note', n.note, 'at', n.created_at)
                        ORDER BY n.created_at DESC)
                       FROM (SELECT stars, note, created_at FROM public.deck_ratings
                             WHERE deck_id = _deck_id AND space_id IS NOT DISTINCT FROM _space_id
                               AND note IS NOT NULL AND NOT under_review
                             ORDER BY created_at DESC LIMIT 20) n), '[]'::jsonb)
  )
  FROM public.deck_ratings
  WHERE deck_id = _deck_id AND space_id IS NOT DISTINCT FROM _space_id AND NOT under_review;
$$;

-- ============================================ admin oversight of spaces
CREATE TABLE public.space_moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid REFERENCES public.spaces(id) ON DELETE SET NULL,
  admin_id uuid NOT NULL,
  action text NOT NULL,
  reason text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.space_moderation_log TO authenticated;
GRANT ALL ON public.space_moderation_log TO service_role;
ALTER TABLE public.space_moderation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read moderation log" ON public.space_moderation_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.admin_list_spaces()
RETURNS TABLE(id uuid, kind text, name text, description text, emoji text, color text,
              created_at timestamptz, owner_id uuid, owner_name text, owner_username text,
              owner_email text, members bigint, decks bigint, messages bigint,
              last_activity timestamptz, chat_enabled boolean, discoverable boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.kind, s.name, s.description, s.emoji, s.color, s.created_at, s.owner_id,
         COALESCE(p.full_name,''), COALESCE(p.username,''), COALESCE(p.email,''),
         (SELECT COUNT(*) FROM public.space_members m WHERE m.space_id = s.id),
         (SELECT COUNT(*) FROM public.space_decks d WHERE d.space_id = s.id),
         (SELECT COUNT(*) FROM public.space_messages g WHERE g.space_id = s.id),
         GREATEST(s.created_at,
                  COALESCE((SELECT MAX(g.created_at) FROM public.space_messages g WHERE g.space_id = s.id), s.created_at),
                  COALESCE((SELECT MAX(m.joined_at) FROM public.space_members m WHERE m.space_id = s.id), s.created_at)),
         s.chat_enabled, s.discoverable
  FROM public.spaces s
  LEFT JOIN public.profiles p ON p.id = s.owner_id
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY s.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_space_detail(_space_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _out jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object(
    'space', to_jsonb(s),
    'owner', (SELECT jsonb_build_object('id', p.id, 'full_name', p.full_name, 'username', p.username,
                                        'email', p.email, 'created_at', p.created_at)
              FROM public.profiles p WHERE p.id = s.owner_id),
    'members', COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id', m.user_id, 'role', m.role,
                          'joined_at', m.joined_at, 'username', pp.username, 'full_name', pp.full_name,
                          'email', pp.email, 'avatar_url', pp.avatar_url) ORDER BY m.joined_at)
                        FROM public.space_members m LEFT JOIN public.profiles pp ON pp.id = m.user_id
                        WHERE m.space_id = s.id), '[]'::jsonb),
    'decks', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title, 'cover', d.cover,
                          'emoji', d.emoji, 'cards', d.card_count, 'published', d.published,
                          'rating_avg', d.rating_avg, 'rating_count', d.rating_count,
                          'owner', po.username, 'added_at', sd.created_at) ORDER BY sd.created_at DESC)
                       FROM public.space_decks sd
                       JOIN public.shared_decks d ON d.id = sd.deck_id
                       LEFT JOIN public.profiles po ON po.id = d.owner_id
                       WHERE sd.space_id = s.id), '[]'::jsonb),
    'posts', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'body', a.body, 'pinned', a.pinned,
                          'at', a.created_at, 'author', pa.username) ORDER BY a.created_at DESC)
                       FROM public.space_announcements a LEFT JOIN public.profiles pa ON pa.id = a.author_id
                       WHERE a.space_id = s.id), '[]'::jsonb),
    'messages', COALESCE((SELECT jsonb_agg(x) FROM (
                          SELECT jsonb_build_object('id', g.id, 'body', g.body, 'at', g.created_at,
                                 'author', pg2.username, 'author_name', pg2.full_name) AS x
                          FROM public.space_messages g LEFT JOIN public.profiles pg2 ON pg2.id = g.author_id
                          WHERE g.space_id = s.id ORDER BY g.created_at DESC LIMIT 200) t), '[]'::jsonb),
    'invites', COALESCE((SELECT jsonb_agg(jsonb_build_object('code', i.code, 'uses', i.uses,
                          'max_uses', i.max_uses, 'active', i.active, 'expires_at', i.expires_at))
                        FROM public.space_invites i WHERE i.space_id = s.id), '[]'::jsonb),
    'log', COALESCE((SELECT jsonb_agg(jsonb_build_object('action', l.action, 'reason', l.reason, 'at', l.created_at)
                      ORDER BY l.created_at DESC)
                     FROM public.space_moderation_log l WHERE l.space_id = s.id), '[]'::jsonb)
  ) INTO _out
  FROM public.spaces s WHERE s.id = _space_id;
  RETURN _out;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_space_deck_cards(_deck_id uuid)
RETURNS TABLE(id uuid, group_name text, front text, back text, sort integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.group_name, c.front, c.back, c.sort
  FROM public.shared_deck_cards c
  WHERE c.deck_id = _deck_id AND public.has_role(auth.uid(), 'admin')
  ORDER BY c.sort;
$$;

CREATE OR REPLACE FUNCTION public.admin_deck_ratings(_deck_id uuid)
RETURNS TABLE(stars smallint, note text, under_review boolean, created_at timestamptz,
              username text, email text, space_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.stars, r.note, r.under_review, r.created_at,
         COALESCE(p.username,''), COALESCE(p.email,''), r.space_id
  FROM public.deck_ratings r LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE r.deck_id = _deck_id AND public.has_role(auth.uid(), 'admin')
  ORDER BY r.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_space_action(_space_id uuid, _action text, _reason text DEFAULT NULL, _target uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _action = 'freeze_chat' THEN
    UPDATE public.spaces SET chat_enabled = false WHERE id = _space_id;
  ELSIF _action = 'unfreeze_chat' THEN
    UPDATE public.spaces SET chat_enabled = true WHERE id = _space_id;
  ELSIF _action = 'hide' THEN
    UPDATE public.spaces SET discoverable = false WHERE id = _space_id;
  ELSIF _action = 'rotate_code' THEN
    UPDATE public.space_invites SET active = false WHERE space_id = _space_id;
    INSERT INTO public.space_invites (space_id, code, created_by, active)
    VALUES (_space_id, upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)), auth.uid(), true);
  ELSIF _action = 'unpublish_deck' THEN
    UPDATE public.shared_decks SET published = false WHERE id = _target;
  ELSIF _action = 'delete_message' THEN
    DELETE FROM public.space_messages WHERE id = _target AND space_id = _space_id;
  ELSIF _action = 'close_space' THEN
    DELETE FROM public.spaces WHERE id = _space_id;
  ELSIF _action = 'review_rating' THEN
    UPDATE public.deck_ratings SET under_review = NOT under_review WHERE id = _target;
  END IF;
  INSERT INTO public.space_moderation_log (space_id, admin_id, action, reason, meta)
  VALUES (CASE WHEN _action = 'close_space' THEN NULL ELSE _space_id END, auth.uid(), _action, _reason,
          jsonb_build_object('target', _target));
END; $$;

-- ================================================== toolkit free pack
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS toolkit_free_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS toolkit_free_plan text NOT NULL DEFAULT 'pack_study';

CREATE TABLE public.toolkit_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  plan_slug text NOT NULL,
  label text,
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.toolkit_codes TO authenticated;
GRANT ALL ON public.toolkit_codes TO service_role;
ALTER TABLE public.toolkit_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage toolkit codes" ON public.toolkit_codes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.toolkit_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code_id uuid REFERENCES public.toolkit_codes(id) ON DELETE SET NULL,
  plan_slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX toolkit_claims_one_free ON public.toolkit_claims (user_id) WHERE code_id IS NULL;
CREATE UNIQUE INDEX toolkit_claims_one_per_code ON public.toolkit_claims (user_id, code_id) WHERE code_id IS NOT NULL;
GRANT SELECT ON public.toolkit_claims TO authenticated;
GRANT ALL ON public.toolkit_claims TO service_role;
ALTER TABLE public.toolkit_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own claims" ON public.toolkit_claims FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.toolkit_offer()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'free_enabled', COALESCE((SELECT s.toolkit_free_enabled FROM public.site_settings s LIMIT 1), false),
    'plan', (SELECT to_jsonb(p) FROM public.plans p
             WHERE p.slug = COALESCE((SELECT s.toolkit_free_plan FROM public.site_settings s LIMIT 1), 'pack_study')),
    'claimed', EXISTS (SELECT 1 FROM public.toolkit_claims c WHERE c.user_id = auth.uid() AND c.code_id IS NULL)
  );
$$;

CREATE OR REPLACE FUNCTION public.claim_toolkit(_code text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _plan public.plans%ROWTYPE; _c public.toolkit_codes%ROWTYPE; _free boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;

  IF _code IS NULL OR btrim(_code) = '' THEN
    SELECT s.toolkit_free_enabled INTO _free FROM public.site_settings s LIMIT 1;
    IF NOT COALESCE(_free,false) THEN RAISE EXCEPTION 'The free pack is closed. Use a code instead.'; END IF;
    IF EXISTS (SELECT 1 FROM public.toolkit_claims c WHERE c.user_id = _uid AND c.code_id IS NULL) THEN
      RAISE EXCEPTION 'You already claimed the free pack.';
    END IF;
    SELECT p.* INTO _plan FROM public.plans p
      WHERE p.slug = COALESCE((SELECT s.toolkit_free_plan FROM public.site_settings s LIMIT 1), 'pack_study');
    IF _plan.slug IS NULL THEN RAISE EXCEPTION 'The free pack is not set up yet.'; END IF;
    INSERT INTO public.toolkit_claims (user_id, plan_slug) VALUES (_uid, _plan.slug);
  ELSE
    SELECT * INTO _c FROM public.toolkit_codes WHERE upper(code) = upper(btrim(_code));
    IF _c.id IS NULL OR NOT _c.is_active THEN RAISE EXCEPTION 'That code does not work.'; END IF;
    IF _c.expires_at IS NOT NULL AND _c.expires_at < now() THEN RAISE EXCEPTION 'That code has expired.'; END IF;
    IF _c.max_uses IS NOT NULL AND _c.used_count >= _c.max_uses THEN RAISE EXCEPTION 'That code is used up.'; END IF;
    IF EXISTS (SELECT 1 FROM public.toolkit_claims c WHERE c.user_id = _uid AND c.code_id = _c.id) THEN
      RAISE EXCEPTION 'You already used that code.';
    END IF;
    SELECT p.* INTO _plan FROM public.plans p WHERE p.slug = _c.plan_slug;
    IF _plan.slug IS NULL THEN RAISE EXCEPTION 'That code points at a pack that no longer exists.'; END IF;
    INSERT INTO public.toolkit_claims (user_id, code_id, plan_slug) VALUES (_uid, _c.id, _plan.slug);
    UPDATE public.toolkit_codes SET used_count = used_count + 1 WHERE id = _c.id;
  END IF;

  INSERT INTO public.plan_credit_grants (
    user_id, plan_slug, transaction_id, environment, flashcards, ai_questions, summaries,
    todo_tasks, calendar_items, all_in_one_lectures, all_in_one_questions,
    archive_questions, rita_questions, groups)
  VALUES (_uid, _plan.slug, 'toolkit-' || gen_random_uuid()::text, 'live',
    COALESCE(_plan.max_flashcards,0), COALESCE(_plan.max_ai_questions,0), COALESCE(_plan.max_summaries,0),
    COALESCE(_plan.max_todo_tasks,0), COALESCE(_plan.max_calendar_items,0),
    COALESCE(_plan.max_all_in_one_lectures,0), COALESCE(_plan.max_all_in_one_questions,0),
    COALESCE(_plan.max_archive_questions,0), COALESCE(_plan.max_rita_questions,0), COALESCE(_plan.max_groups,0));

  RETURN jsonb_build_object('ok', true, 'plan', _plan.slug, 'name', _plan.name);
END; $$;

-- ==================================================== popup windows
ALTER TABLE public.site_announcements
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS button_label text,
  ADD COLUMN IF NOT EXISTS button_href text,
  ADD COLUMN IF NOT EXISTS secondary_label text,
  ADD COLUMN IF NOT EXISTS secondary_href text,
  ADD COLUMN IF NOT EXISTS trigger text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS delay_seconds integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'always',
  ADD COLUMN IF NOT EXISTS paths text[] NOT NULL DEFAULT '{}'::text[];

CREATE TABLE public.announcement_seen (
  user_id uuid NOT NULL,
  announcement_id uuid NOT NULL REFERENCES public.site_announcements(id) ON DELETE CASCADE,
  seen_count integer NOT NULL DEFAULT 1,
  clicked boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, announcement_id)
);
GRANT SELECT, INSERT, UPDATE ON public.announcement_seen TO authenticated;
GRANT ALL ON public.announcement_seen TO service_role;
ALTER TABLE public.announcement_seen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own seen rows" ON public.announcement_seen FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.mark_announcement_seen(_id uuid, _clicked boolean DEFAULT false)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.announcement_seen (user_id, announcement_id, seen_count, clicked)
  VALUES (auth.uid(), _id, 1, _clicked)
  ON CONFLICT (user_id, announcement_id) DO UPDATE
    SET seen_count = public.announcement_seen.seen_count + 1,
        clicked = public.announcement_seen.clicked OR EXCLUDED.clicked,
        last_seen_at = now();
$$;

-- announcements for me, with what I have already seen attached
CREATE OR REPLACE FUNCTION public.my_announcements()
RETURNS SETOF public.site_announcements
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.* FROM public.site_announcements a
  WHERE (NOT EXISTS (SELECT 1 FROM public.announcement_audiences aa WHERE aa.announcement_id = a.id)
     OR EXISTS (
       SELECT 1 FROM public.announcement_audiences aa
       WHERE aa.announcement_id = a.id AND public.user_in_group(auth.uid(), aa.group_id)))
    AND NOT EXISTS (
      SELECT 1 FROM public.announcement_seen s
      WHERE s.announcement_id = a.id AND s.user_id = auth.uid()
        AND (a.frequency = 'once'
          OR (a.frequency = 'until_click' AND s.clicked)
          OR (a.frequency = 'daily' AND s.last_seen_at > now() - interval '1 day')))
  ORDER BY a.sort ASC, a.created_at DESC;
$$;
-- <<< 20260902173453_c73e2a51-6ea3-4315-98e4-8023ec4b1a25.sql


-- >>> 20260902173517_c52ad5a5-6973-40df-ae2c-0e797f5534bb.sql
REVOKE EXECUTE ON FUNCTION public.admin_list_spaces() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_space_detail(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_space_deck_cards(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_deck_ratings(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_space_action(uuid, text, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rate_deck(uuid, smallint, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_toolkit(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.toolkit_offer() FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_announcement_seen(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.recount_deck_rating() FROM anon, authenticated;
-- <<< 20260902173517_c52ad5a5-6973-40df-ae2c-0e797f5534bb.sql


-- >>> 20260902174856_9e742c0a-4b0e-4d90-baa0-bebacc4a8e93.sql
-- 1) Stop exposing full profile rows (email, phone, lock status) for shared-deck owners.
DROP POLICY IF EXISTS "shared deck authors are visible" ON public.profiles;

-- Public author display goes through the narrow view, which now bypasses profiles RLS
-- while only ever exposing id/username/full_name/avatar_url/bio.
ALTER VIEW public.public_profiles SET (security_invoker = off);
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 2) Lock down SECURITY DEFINER functions that clients must never call directly.
DO $$
DECLARE
  keep_both text[] := ARRAY[
    'account_active','can_access_committee_subject','can_manage_committee',
    'can_manage_committee_members','can_manage_committee_years','can_manage_events',
    'can_manage_space','event_visible','has_role','is_space_member','space_can_add_decks',
    'space_can_post','space_chat_on','user_owns_any_german_course','user_owns_lecture_course'
  ];
  keep_anon text[] := ARRAY[
    'get_email_by_username','identity_taken','space_preview','university_id_by_slug',
    'get_course_real_counts','get_subject_question_counts'
  ];
  internal_only text[] := ARRAY[
    '__restore_exec','admin_deck_ratings','admin_get_user_roles','admin_list_role_members',
    'admin_space_deck_cards','committee_team_add','head_list_committee_members',
    'revoke_golden_user','space_role','sync_golden_user','user_in_group',
    'push_audience_devices','push_audience_count'
  ];
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef AND p.prokind = 'f'
  LOOP
    IF r.proname = ANY(keep_both) THEN
      CONTINUE;
    END IF;

    IF r.proname = ANY(internal_only) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
      CONTINUE;
    END IF;

    IF NOT (r.proname = ANY(keep_anon)) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END IF;
  END LOOP;
END $$;

-- Trigger functions are never callable over the API.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

-- <<< 20260902174856_9e742c0a-4b0e-4d90-baa0-bebacc4a8e93.sql


-- >>> 20260902174935_7aee3739-f482-46b5-ba14-e55fcbf7ac43.sql
-- Replace the definer view with a real, safe-by-construction public projection table.
DROP VIEW IF EXISTS public.public_profiles;

CREATE TABLE IF NOT EXISTS public.public_profiles (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  username text,
  full_name text,
  avatar_url text,
  bio text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.public_profiles TO anon, authenticated;
GRANT ALL ON public.public_profiles TO service_role;

ALTER TABLE public.public_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public profiles are readable" ON public.public_profiles;
CREATE POLICY "public profiles are readable"
  ON public.public_profiles FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.public_profiles (id, username, full_name, avatar_url, bio)
SELECT id, username, full_name, avatar_url, bio FROM public.profiles
ON CONFLICT (id) DO UPDATE
  SET username = EXCLUDED.username,
      full_name = EXCLUDED.full_name,
      avatar_url = EXCLUDED.avatar_url,
      bio = EXCLUDED.bio,
      updated_at = now();

CREATE OR REPLACE FUNCTION public.sync_public_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.public_profiles (id, username, full_name, avatar_url, bio)
  VALUES (NEW.id, NEW.username, NEW.full_name, NEW.avatar_url, NEW.bio)
  ON CONFLICT (id) DO UPDATE
    SET username = EXCLUDED.username,
        full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        bio = EXCLUDED.bio,
        updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_public_profile() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_sync_public ON public.profiles;
CREATE TRIGGER profiles_sync_public
AFTER INSERT OR UPDATE OF username, full_name, avatar_url, bio ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_public_profile();

-- <<< 20260902174935_7aee3739-f482-46b5-ba14-e55fcbf7ac43.sql


-- >>> 20260902175024_3488fe50-ed3d-4cd7-a0a0-9bc8fbc4ad98.sql
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.prokind='f' AND p.prorettype <> 'trigger'::regtype
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- <<< 20260902175024_3488fe50-ed3d-4cd7-a0a0-9bc8fbc4ad98.sql


-- >>> 20260902180637_f5f00d14-3247-4db3-b255-6c8e7ff5f572.sql

CREATE TABLE IF NOT EXISTS public.special_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  subtitle text,
  image_url text,
  accent text NOT NULL DEFAULT '#c62828',
  badge text NOT NULL DEFAULT 'Free right now',
  bullets text[] NOT NULL DEFAULT '{}',
  plan_slug text NOT NULL,
  duration_days integer NOT NULL DEFAULT 90,
  requires_code boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.special_offers TO authenticated;
GRANT SELECT ON public.special_offers TO anon;
GRANT ALL ON public.special_offers TO service_role;
ALTER TABLE public.special_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone reads active offers" ON public.special_offers;
CREATE POLICY "anyone reads active offers" ON public.special_offers
  FOR SELECT USING (is_active OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "admins manage offers" ON public.special_offers;
CREATE POLICY "admins manage offers" ON public.special_offers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.toolkit_claims ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES public.special_offers(id) ON DELETE SET NULL;
ALTER TABLE public.toolkit_claims ADD COLUMN IF NOT EXISTS expires_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS toolkit_claims_one_per_offer
  ON public.toolkit_claims (user_id, offer_id) WHERE offer_id IS NOT NULL;

ALTER TABLE public.toolkit_codes ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES public.special_offers(id) ON DELETE CASCADE;

ALTER TABLE public.plan_credit_grants ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS offers_page_enabled boolean NOT NULL DEFAULT true;

-- seed the toolkit as the first offer
INSERT INTO public.special_offers (slug, title, subtitle, badge, bullets, plan_slug, duration_days, sort)
SELECT 'toolkit',
       'The Rita Toolkit — free right now',
       'A starter pack of flashcards, summaries and AI questions, dropped straight into your account.',
       'Free for 3 months',
       ARRAY['Flashcards you can make, flip and share','Clean study summaries from your own files','Practice questions with instant answers','Everything unlocks the moment you claim'],
       COALESCE((SELECT s.toolkit_free_plan FROM public.site_settings s LIMIT 1), 'pack-study'),
       90, 0
WHERE NOT EXISTS (SELECT 1 FROM public.special_offers WHERE slug = 'toolkit');

CREATE OR REPLACE FUNCTION public.offers_list()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'sort'), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
      'id', o.id, 'slug', o.slug, 'title', o.title, 'subtitle', o.subtitle,
      'image_url', o.image_url, 'accent', o.accent, 'badge', o.badge,
      'bullets', to_jsonb(o.bullets), 'duration_days', o.duration_days,
      'requires_code', o.requires_code, 'sort', o.sort,
      'plan', (SELECT to_jsonb(p) FROM public.plans p WHERE p.slug = o.plan_slug),
      'claimed', EXISTS (SELECT 1 FROM public.toolkit_claims c WHERE c.user_id = auth.uid() AND c.offer_id = o.id),
      'expires_at', (SELECT max(c.expires_at) FROM public.toolkit_claims c WHERE c.user_id = auth.uid() AND c.offer_id = o.id)
    ) AS x
    FROM public.special_offers o
    WHERE o.is_active
  ) t;
$$;

REVOKE ALL ON FUNCTION public.offers_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.offers_list() TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.claim_offer(_offer_id uuid, _code text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _o public.special_offers%ROWTYPE;
  _plan public.plans%ROWTYPE;
  _c public.toolkit_codes%ROWTYPE;
  _exp timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;

  SELECT * INTO _o FROM public.special_offers WHERE id = _offer_id AND is_active;
  IF _o.id IS NULL THEN RAISE EXCEPTION 'That offer is not available.'; END IF;

  IF EXISTS (SELECT 1 FROM public.toolkit_claims c WHERE c.user_id = _uid AND c.offer_id = _o.id) THEN
    RAISE EXCEPTION 'You already claimed this offer.';
  END IF;

  IF _o.requires_code OR (_code IS NOT NULL AND btrim(_code) <> '') THEN
    IF _code IS NULL OR btrim(_code) = '' THEN RAISE EXCEPTION 'This offer needs a code.'; END IF;
    SELECT * INTO _c FROM public.toolkit_codes WHERE upper(code) = upper(btrim(_code));
    IF _c.id IS NULL OR NOT _c.is_active THEN RAISE EXCEPTION 'That code does not work.'; END IF;
    IF _c.offer_id IS NOT NULL AND _c.offer_id <> _o.id THEN RAISE EXCEPTION 'That code is for another offer.'; END IF;
    IF _c.expires_at IS NOT NULL AND _c.expires_at < now() THEN RAISE EXCEPTION 'That code has expired.'; END IF;
    IF _c.max_uses IS NOT NULL AND _c.used_count >= _c.max_uses THEN RAISE EXCEPTION 'That code is used up.'; END IF;
    UPDATE public.toolkit_codes SET used_count = used_count + 1 WHERE id = _c.id;
  END IF;

  SELECT p.* INTO _plan FROM public.plans p WHERE p.slug = COALESCE(_c.plan_slug, _o.plan_slug);
  IF _plan.slug IS NULL THEN RAISE EXCEPTION 'This offer is not set up yet.'; END IF;

  _exp := CASE WHEN _o.duration_days > 0 THEN now() + make_interval(days => _o.duration_days) ELSE NULL END;

  INSERT INTO public.toolkit_claims (user_id, code_id, plan_slug, offer_id, expires_at)
  VALUES (_uid, _c.id, _plan.slug, _o.id, _exp);

  INSERT INTO public.plan_credit_grants (
    user_id, plan_slug, transaction_id, environment, expires_at, flashcards, ai_questions, summaries,
    todo_tasks, calendar_items, all_in_one_lectures, all_in_one_questions,
    archive_questions, rita_questions, groups)
  VALUES (_uid, _plan.slug, 'offer-' || gen_random_uuid()::text, 'live', _exp,
    COALESCE(_plan.max_flashcards,0), COALESCE(_plan.max_ai_questions,0), COALESCE(_plan.max_summaries,0),
    COALESCE(_plan.max_todo_tasks,0), COALESCE(_plan.max_calendar_items,0),
    COALESCE(_plan.max_all_in_one_lectures,0), COALESCE(_plan.max_all_in_one_questions,0),
    COALESCE(_plan.max_archive_questions,0), COALESCE(_plan.max_rita_questions,0), COALESCE(_plan.max_groups,0));

  RETURN jsonb_build_object('ok', true, 'plan', _plan.slug, 'name', _plan.name, 'expires_at', _exp);
END; $$;

REVOKE ALL ON FUNCTION public.claim_offer(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_offer(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_plan_usage()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _slug text;
  _plan public.plans%ROWTYPE;
  _usage public.usage_counters%ROWTYPE;
  _admin boolean;
  _g jsonb;
  _exp timestamptz;
BEGIN
  IF _uid IS NULL THEN RETURN NULL; END IF;

  _admin := public.has_role(_uid, 'admin');

  SELECT plan_slug INTO _slug FROM public.user_plans WHERE user_id = _uid;
  IF _slug IS NULL THEN _slug := 'starter'; END IF;

  SELECT * INTO _plan FROM public.plans WHERE slug = _slug;
  IF _plan.slug IS NULL THEN
    SELECT * INTO _plan FROM public.plans WHERE published ORDER BY sort LIMIT 1;
  END IF;

  SELECT * INTO _usage FROM public.usage_counters WHERE user_id = _uid AND period = 'lifetime';

  SELECT jsonb_build_object(
    'summaries', COALESCE(SUM(summaries),0),
    'ai_questions', COALESCE(SUM(ai_questions),0),
    'flashcards', COALESCE(SUM(flashcards),0),
    'todo_tasks', COALESCE(SUM(todo_tasks),0),
    'calendar_items', COALESCE(SUM(calendar_items),0),
    'all_in_one_lectures', COALESCE(SUM(all_in_one_lectures),0),
    'all_in_one_questions', COALESCE(SUM(all_in_one_questions),0),
    'archive_questions', COALESCE(SUM(archive_questions),0),
    'rita_questions', COALESCE(SUM(rita_questions),0),
    'groups', COALESCE(SUM(groups),0)
  ) INTO _g
  FROM public.plan_credit_grants
  WHERE user_id = _uid AND (expires_at IS NULL OR expires_at > now());

  SELECT max(c.expires_at) INTO _exp FROM public.toolkit_claims c
   WHERE c.user_id = _uid AND c.expires_at IS NOT NULL AND c.expires_at > now();

  RETURN jsonb_build_object(
    'plan', to_jsonb(_plan),
    'grants', COALESCE(_g, '{}'::jsonb),
    'offer_expires_at', _exp,
    'usage', jsonb_build_object(
      'summaries', COALESCE(_usage.summaries, 0),
      'ai_questions', COALESCE(_usage.ai_questions, 0),
      'flashcards', COALESCE(_usage.flashcards, 0),
      'todo_tasks', COALESCE(_usage.todo_tasks, 0),
      'calendar_items', COALESCE(_usage.calendar_items, 0),
      'all_in_one_lectures', COALESCE(_usage.all_in_one_lectures, 0),
      'all_in_one_questions', COALESCE(_usage.all_in_one_questions, 0),
      'archive_questions', COALESCE(_usage.archive_questions, 0),
      'rita_questions', COALESCE(_usage.rita_questions, 0),
      'groups', COALESCE(_usage.groups, 0)
    ),
    'is_admin', _admin
  );
END; $$;

REVOKE ALL ON FUNCTION public.my_plan_usage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_plan_usage() TO authenticated;

-- <<< 20260902180637_f5f00d14-3247-4db3-b255-6c8e7ff5f572.sql


-- >>> 20260902182421_a05dc631-cdd9-4068-9555-faf535bf4453.sql
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS home_video_url text,
  ADD COLUMN IF NOT EXISTS home_video_poster_url text;
-- <<< 20260902182421_a05dc631-cdd9-4068-9555-faf535bf4453.sql


-- >>> 20260902184655_cf554cb2-86cf-4880-ae78-6cae005ec463.sql

-- 1) Offer copy + code lock
UPDATE public.special_offers SET
  title = 'The Rita Toolkit — free right now',
  subtitle = 'Every study tool that costs us nothing to run, unlocked on your account for three months.',
  bullets = ARRAY[
    'Unlimited flashcards',
    'Unlimited to-do tasks',
    'Unlimited calendar entries',
    'Unlimited classrooms you create',
    'Join unlimited classrooms'
  ],
  requires_code = true,
  updated_at = now()
WHERE slug = 'toolkit';

UPDATE public.toolkit_codes c SET
  code = 'LamineYamal',
  plan_slug = 'toolkit',
  is_active = true,
  offer_id = (SELECT id FROM public.special_offers WHERE slug = 'toolkit')
WHERE upper(c.code) IN ('LAMINYAMAL','LAMINEYAMAL');

INSERT INTO public.toolkit_codes (code, plan_slug, label, max_uses, is_active, offer_id)
SELECT 'LamineYamal', 'toolkit', 'Toolkit activation code', NULL, true,
       (SELECT id FROM public.special_offers WHERE slug = 'toolkit')
WHERE NOT EXISTS (SELECT 1 FROM public.toolkit_codes WHERE upper(code) = 'LAMINEYAMAL');

-- 2) Claim = real entitlement, no zero-value grants for unlimited plans
CREATE OR REPLACE FUNCTION public.claim_offer(_offer_id uuid, _code text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _o public.special_offers%ROWTYPE;
  _plan public.plans%ROWTYPE;
  _c public.toolkit_codes%ROWTYPE;
  _exp timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;

  SELECT * INTO _o FROM public.special_offers WHERE id = _offer_id AND is_active;
  IF _o.id IS NULL THEN RAISE EXCEPTION 'That offer is not available.'; END IF;

  IF EXISTS (SELECT 1 FROM public.toolkit_claims c WHERE c.user_id = _uid AND c.offer_id = _o.id) THEN
    RAISE EXCEPTION 'You already claimed this offer.';
  END IF;

  IF _o.requires_code OR (_code IS NOT NULL AND btrim(_code) <> '') THEN
    IF _code IS NULL OR btrim(_code) = '' THEN RAISE EXCEPTION 'This offer needs a code.'; END IF;
    SELECT * INTO _c FROM public.toolkit_codes WHERE upper(code) = upper(btrim(_code));
    IF _c.id IS NULL OR NOT _c.is_active THEN RAISE EXCEPTION 'That code does not work.'; END IF;
    IF _c.offer_id IS NOT NULL AND _c.offer_id <> _o.id THEN RAISE EXCEPTION 'That code is for another offer.'; END IF;
    IF _c.expires_at IS NOT NULL AND _c.expires_at < now() THEN RAISE EXCEPTION 'That code has expired.'; END IF;
    IF _c.max_uses IS NOT NULL AND _c.used_count >= _c.max_uses THEN RAISE EXCEPTION 'That code is used up.'; END IF;
    UPDATE public.toolkit_codes SET used_count = used_count + 1 WHERE id = _c.id;
  END IF;

  SELECT p.* INTO _plan FROM public.plans p WHERE p.slug = COALESCE(_c.plan_slug, _o.plan_slug);
  IF _plan.slug IS NULL THEN RAISE EXCEPTION 'This offer is not set up yet.'; END IF;

  _exp := CASE WHEN _o.duration_days > 0 THEN now() + make_interval(days => _o.duration_days) ELSE NULL END;

  INSERT INTO public.toolkit_claims (user_id, code_id, plan_slug, offer_id, expires_at)
  VALUES (_uid, _c.id, _plan.slug, _o.id, _exp);

  -- Only metered allowances become grants; unlimited perks come from the
  -- entitlement merge in my_plan_usage instead of a meaningless zero grant.
  IF COALESCE(_plan.max_flashcards,0) > 0 OR COALESCE(_plan.max_ai_questions,0) > 0
     OR COALESCE(_plan.max_summaries,0) > 0 OR COALESCE(_plan.max_todo_tasks,0) > 0
     OR COALESCE(_plan.max_calendar_items,0) > 0 OR COALESCE(_plan.max_all_in_one_lectures,0) > 0
     OR COALESCE(_plan.max_all_in_one_questions,0) > 0 OR COALESCE(_plan.max_archive_questions,0) > 0
     OR COALESCE(_plan.max_rita_questions,0) > 0 OR COALESCE(_plan.max_groups,0) > 0 THEN
    INSERT INTO public.plan_credit_grants (
      user_id, plan_slug, transaction_id, environment, expires_at, flashcards, ai_questions, summaries,
      todo_tasks, calendar_items, all_in_one_lectures, all_in_one_questions,
      archive_questions, rita_questions, groups)
    VALUES (_uid, _plan.slug, 'offer-' || gen_random_uuid()::text, 'live', _exp,
      COALESCE(_plan.max_flashcards,0), COALESCE(_plan.max_ai_questions,0), COALESCE(_plan.max_summaries,0),
      COALESCE(_plan.max_todo_tasks,0), COALESCE(_plan.max_calendar_items,0),
      COALESCE(_plan.max_all_in_one_lectures,0), COALESCE(_plan.max_all_in_one_questions,0),
      COALESCE(_plan.max_archive_questions,0), COALESCE(_plan.max_rita_questions,0), COALESCE(_plan.max_groups,0));
  END IF;

  RETURN jsonb_build_object('ok', true, 'plan', _plan.slug, 'name', _plan.name, 'expires_at', _exp);
END;
$$;

-- 3) Effective plan = base plan merged with any live claimed offer
CREATE OR REPLACE FUNCTION public.merge_cap(_a integer, _b integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$ SELECT CASE WHEN _a IS NULL OR _b IS NULL THEN NULL ELSE greatest(_a, _b) END $$;

CREATE OR REPLACE FUNCTION public.effective_plan(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _slug text;
  _base public.plans%ROWTYPE;
  _op public.plans%ROWTYPE;
  _claim public.toolkit_claims%ROWTYPE;
  _out jsonb;
BEGIN
  SELECT plan_slug INTO _slug FROM public.user_plans WHERE user_id = _user_id;
  IF _slug IS NULL THEN _slug := 'starter'; END IF;
  SELECT * INTO _base FROM public.plans WHERE slug = _slug;
  IF _base.slug IS NULL THEN
    SELECT * INTO _base FROM public.plans WHERE published ORDER BY sort LIMIT 1;
  END IF;
  _out := to_jsonb(_base);

  SELECT c.* INTO _claim FROM public.toolkit_claims c
   WHERE c.user_id = _user_id
     AND (c.expires_at IS NULL OR c.expires_at > now())
     AND c.offer_id IS NOT NULL
   ORDER BY c.created_at DESC LIMIT 1;

  IF _claim.id IS NOT NULL THEN
    SELECT * INTO _op FROM public.plans WHERE slug = _claim.plan_slug;
    IF _op.slug IS NOT NULL THEN
      -- unlimited (NULL) beats any number; otherwise take the larger cap
      _out := _out || jsonb_build_object(
        'name', _base.name || ' + ' || _op.name,
        'max_flashcards',           public.merge_cap(_base.max_flashcards, _op.max_flashcards),
        'max_ai_questions',         public.merge_cap(_base.max_ai_questions, _op.max_ai_questions),
        'max_summaries',            public.merge_cap(_base.max_summaries, _op.max_summaries),
        'max_todo_tasks',           public.merge_cap(_base.max_todo_tasks, _op.max_todo_tasks),
        'max_calendar_items',       public.merge_cap(_base.max_calendar_items, _op.max_calendar_items),
        'max_groups',               public.merge_cap(_base.max_groups, _op.max_groups),
        'max_all_in_one_lectures',  public.merge_cap(_base.max_all_in_one_lectures, _op.max_all_in_one_lectures),
        'max_all_in_one_questions', public.merge_cap(_base.max_all_in_one_questions, _op.max_all_in_one_questions),
        'max_archive_questions',    public.merge_cap(_base.max_archive_questions, _op.max_archive_questions),
        'max_rita_questions',       public.merge_cap(_base.max_rita_questions, _op.max_rita_questions),
        'todo_full',             _base.todo_full OR _op.todo_full,
        'rich_cards',            _base.rich_cards OR _op.rich_cards,
        'feature_lecture_qgen',  _base.feature_lecture_qgen OR _op.feature_lecture_qgen,
        'feature_archive_qgen',  _base.feature_archive_qgen OR _op.feature_archive_qgen,
        'feature_all_in_one',    _base.feature_all_in_one OR _op.feature_all_in_one,
        'feature_rita38',        _base.feature_rita38 OR _op.feature_rita38,
        'offer_name', _op.name,
        'offer_plan_slug', _op.slug,
        'offer_expires_at', _claim.expires_at
      );
    END IF;
  END IF;

  RETURN _out;
END;
$$;

CREATE OR REPLACE FUNCTION public.my_plan_usage()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _plan jsonb;
  _usage public.usage_counters%ROWTYPE;
  _admin boolean;
  _g jsonb;
  _exp timestamptz;
BEGIN
  IF _uid IS NULL THEN RETURN NULL; END IF;

  _admin := public.has_role(_uid, 'admin');
  _plan := public.effective_plan(_uid);

  SELECT * INTO _usage FROM public.usage_counters WHERE user_id = _uid AND period = 'lifetime';

  SELECT jsonb_build_object(
    'summaries', COALESCE(SUM(summaries),0),
    'ai_questions', COALESCE(SUM(ai_questions),0),
    'flashcards', COALESCE(SUM(flashcards),0),
    'todo_tasks', COALESCE(SUM(todo_tasks),0),
    'calendar_items', COALESCE(SUM(calendar_items),0),
    'all_in_one_lectures', COALESCE(SUM(all_in_one_lectures),0),
    'all_in_one_questions', COALESCE(SUM(all_in_one_questions),0),
    'archive_questions', COALESCE(SUM(archive_questions),0),
    'rita_questions', COALESCE(SUM(rita_questions),0),
    'groups', COALESCE(SUM(groups),0)
  ) INTO _g
  FROM public.plan_credit_grants
  WHERE user_id = _uid AND (expires_at IS NULL OR expires_at > now());

  SELECT max(c.expires_at) INTO _exp FROM public.toolkit_claims c
   WHERE c.user_id = _uid AND c.expires_at IS NOT NULL AND c.expires_at > now();

  RETURN jsonb_build_object(
    'plan', _plan,
    'grants', COALESCE(_g, '{}'::jsonb),
    'offer_expires_at', _exp,
    'offer_name', _plan->>'offer_name',
    'usage', jsonb_build_object(
      'summaries', COALESCE(_usage.summaries, 0),
      'ai_questions', COALESCE(_usage.ai_questions, 0),
      'flashcards', COALESCE(_usage.flashcards, 0),
      'todo_tasks', COALESCE(_usage.todo_tasks, 0),
      'calendar_items', COALESCE(_usage.calendar_items, 0),
      'all_in_one_lectures', COALESCE(_usage.all_in_one_lectures, 0),
      'all_in_one_questions', COALESCE(_usage.all_in_one_questions, 0),
      'archive_questions', COALESCE(_usage.archive_questions, 0),
      'rita_questions', COALESCE(_usage.rita_questions, 0),
      'groups', COALESCE(_usage.groups, 0)
    ),
    'is_admin', _admin
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.effective_plan(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.merge_cap(integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.effective_plan(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.merge_cap(integer, integer) TO service_role;

-- 4) Admin directory of every user with plan + claimed kit
CREATE OR REPLACE FUNCTION public.admin_users_with_plans()
RETURNS TABLE(
  id uuid, full_name text, username text, email text,
  created_at timestamptz, last_seen timestamptz,
  plan_slug text, plan_name text,
  kit_slug text, kit_name text, kit_expires_at timestamptz,
  roles text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admins only';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.username,
    u.email::text,
    p.created_at,
    (SELECT max(e.created_at) FROM public.user_login_events e WHERE e.user_id = p.id),
    COALESCE(up.plan_slug, 'starter'),
    COALESCE(pl.name, 'Free'),
    k.plan_slug,
    kp.name,
    k.expires_at,
    COALESCE((SELECT array_agg(r.role::text) FROM public.user_roles r WHERE r.user_id = p.id), '{}')
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.user_plans up ON up.user_id = p.id
  LEFT JOIN public.plans pl ON pl.slug = COALESCE(up.plan_slug, 'starter')
  LEFT JOIN LATERAL (
    SELECT c.plan_slug, c.expires_at
      FROM public.toolkit_claims c
     WHERE c.user_id = p.id AND (c.expires_at IS NULL OR c.expires_at > now())
     ORDER BY c.created_at DESC LIMIT 1
  ) k ON true
  LEFT JOIN public.plans kp ON kp.slug = k.plan_slug
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_users_with_plans() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_users_with_plans() TO authenticated, service_role;

-- <<< 20260902184655_cf554cb2-86cf-4880-ae78-6cae005ec463.sql


-- >>> 20260902184733_813bedb6-8454-48c8-9a76-38a24730d69d.sql
ALTER FUNCTION public.merge_cap(integer, integer) SET search_path = public;
-- <<< 20260902184733_813bedb6-8454-48c8-9a76-38a24730d69d.sql


-- >>> 20260904155106_bf0e005d-6c97-42dc-9f8e-300e46c76eb3.sql
create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
revoke all on function public.set_updated_at() from public, anon, authenticated;

alter table public.profiles add column if not exists display_name text;

alter table public.card_reviews
  add column if not exists difficulty numeric,
  add column if not exists stability numeric,
  add column if not exists step integer not null default 0,
  add column if not exists suspended boolean not null default false,
  add column if not exists last_review_at timestamptz;

alter table public.review_events
  add column if not exists sub_subject text not null default '',
  add column if not exists elapsed_days numeric,
  add column if not exists prev jsonb;

alter table public.study_prefs
  add column if not exists retention numeric not null default 0.9,
  add column if not exists new_per_day integer not null default 12,
  add column if not exists review_cap integer not null default 150;

create table if not exists public.study_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);
grant select, insert, update, delete on public.study_state to authenticated;
grant all on public.study_state to service_role;
alter table public.study_state enable row level security;
drop policy if exists "study own" on public.study_state;
create policy "study own" on public.study_state for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop trigger if exists study_state_updated_at on public.study_state;
create trigger study_state_updated_at before update on public.study_state
  for each row execute function public.set_updated_at();

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  join_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.class_members (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (class_id, user_id)
);
create table if not exists public.class_decks (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  subtopic text not null,
  cards jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.classes, public.class_members, public.class_decks to authenticated;
grant all on public.classes, public.class_members, public.class_decks to service_role;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.class_decks enable row level security;

create or replace function public.is_class_member(_class_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.class_members where class_id = _class_id and user_id = _user_id)
      or exists (select 1 from public.classes where id = _class_id and owner_id = _user_id)
$$;
revoke all on function public.is_class_member(uuid, uuid) from public, anon;
grant execute on function public.is_class_member(uuid, uuid) to authenticated, service_role;

drop policy if exists "classes create" on public.classes;
create policy "classes create" on public.classes for insert to authenticated with check (auth.uid() = owner_id);
drop policy if exists "classes read member" on public.classes;
create policy "classes read member" on public.classes for select to authenticated using (public.is_class_member(id, auth.uid()));
drop policy if exists "classes owner update" on public.classes;
create policy "classes owner update" on public.classes for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "classes owner delete" on public.classes;
create policy "classes owner delete" on public.classes for delete to authenticated using (auth.uid() = owner_id);

drop policy if exists "members join self" on public.class_members;
create policy "members join self" on public.class_members for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "members read" on public.class_members;
create policy "members read" on public.class_members for select to authenticated using (public.is_class_member(class_id, auth.uid()));
drop policy if exists "members leave self" on public.class_members;
create policy "members leave self" on public.class_members for delete to authenticated
  using (auth.uid() = user_id or exists (select 1 from public.classes c where c.id = class_members.class_id and c.owner_id = auth.uid()));

drop policy if exists "class decks read" on public.class_decks;
create policy "class decks read" on public.class_decks for select to authenticated using (public.is_class_member(class_id, auth.uid()));
drop policy if exists "class decks share" on public.class_decks;
create policy "class decks share" on public.class_decks for insert to authenticated
  with check (auth.uid() = user_id and public.is_class_member(class_id, auth.uid()));
drop policy if exists "class decks update own" on public.class_decks;
create policy "class decks update own" on public.class_decks for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "class decks delete own" on public.class_decks;
create policy "class decks delete own" on public.class_decks for delete to authenticated
  using (auth.uid() = user_id or exists (select 1 from public.classes c where c.id = class_decks.class_id and c.owner_id = auth.uid()));

drop trigger if exists classes_updated_at on public.classes;
create trigger classes_updated_at before update on public.classes for each row execute function public.set_updated_at();
drop trigger if exists class_decks_updated_at on public.class_decks;
create trigger class_decks_updated_at before update on public.class_decks for each row execute function public.set_updated_at();

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Untitled announcement',
  status text not null default 'draft',
  layout text not null default 'modal',
  theme text not null default 'cream',
  accent text,
  eyebrow text,
  title text not null default '',
  body text,
  image_url text,
  emoji text,
  confetti boolean not null default false,
  countdown_to timestamptz,
  primary_label text,
  primary_href text,
  secondary_label text,
  secondary_href text,
  audience text not null default 'all',
  pages jsonb not null default '[]'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  frequency text not null default 'once',
  priority integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.announcement_events (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  kind text not null,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select on public.announcements to anon, authenticated;
grant insert, update, delete on public.announcements to authenticated;
grant all on public.announcements to service_role;
grant insert on public.announcement_events to anon, authenticated;
grant select on public.announcement_events to authenticated;
grant all on public.announcement_events to service_role;
alter table public.announcements enable row level security;
alter table public.announcement_events enable row level security;
drop policy if exists "announcements read live" on public.announcements;
create policy "announcements read live" on public.announcements for select to anon, authenticated using (status = 'live');
drop policy if exists "announcements admin read" on public.announcements;
create policy "announcements admin read" on public.announcements for select to authenticated using (public.has_role(auth.uid(), 'admin'));
drop policy if exists "announcements admin write" on public.announcements;
create policy "announcements admin write" on public.announcements for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
drop policy if exists "events insert" on public.announcement_events;
create policy "events insert" on public.announcement_events for insert to anon, authenticated with check (true);
drop policy if exists "events admin read" on public.announcement_events;
create policy "events admin read" on public.announcement_events for select to authenticated using (public.has_role(auth.uid(), 'admin'));
drop trigger if exists announcements_updated_at on public.announcements;
create trigger announcements_updated_at before update on public.announcements for each row execute function public.set_updated_at();

create or replace function public.grant_owner_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if lower(coalesce(new.email,'')) = 'klory.shaheen3@icloud.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end; $$;
revoke all on function public.grant_owner_admin() from public, anon, authenticated;
drop trigger if exists grant_owner_admin_trigger on public.profiles;
create trigger grant_owner_admin_trigger after insert on public.profiles
  for each row execute function public.grant_owner_admin();
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role from public.profiles where lower(email) = 'klory.shaheen3@icloud.com'
on conflict (user_id, role) do nothing;
-- <<< 20260904155106_bf0e005d-6c97-42dc-9f8e-300e46c76eb3.sql


-- >>> 20260904155204_753f5177-3e19-4d83-94e4-e7acb83c192d.sql
revoke all on function public.admin_users_with_plans() from anon;
revoke all on function public.effective_plan(uuid) from anon;
-- <<< 20260904155204_753f5177-3e19-4d83-94e4-e7acb83c192d.sql


-- >>> 20260904155410_6afe0547-dca3-447a-8b67-0042dfed4256.sql
do $$
declare t record;
begin
  for t in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t.relname);
    execute format('grant all on public.%I to service_role', t.relname);
    if exists (
      select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = t.relname
        and p.cmd in ('SELECT','ALL')
        and (p.roles @> array['public']::name[] or p.roles @> array['anon']::name[])
    ) then
      execute format('grant select on public.%I to anon', t.relname);
    end if;
  end loop;
end $$;
grant usage on all sequences in schema public to authenticated;
grant all on all sequences in schema public to service_role;
-- <<< 20260904155410_6afe0547-dca3-447a-8b67-0042dfed4256.sql


-- >>> 20260905122331_486d6648-8a44-4d3b-9ac0-ace3716976e0.sql
CREATE OR REPLACE FUNCTION public.ensure_lq_default_bucket()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _subject_id uuid;
  _subtopic_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Please sign in again.'; END IF;

  SELECT id INTO _subject_id
  FROM public.lq_subjects
  WHERE user_id = _uid AND lower(btrim(name)) = 'my lectures'
  ORDER BY created_at
  LIMIT 1;

  IF _subject_id IS NULL THEN
    INSERT INTO public.lq_subjects (user_id, name)
    VALUES (_uid, 'My lectures')
    RETURNING id INTO _subject_id;
  END IF;

  SELECT id INTO _subtopic_id
  FROM public.lq_subtopics
  WHERE user_id = _uid AND subject_id = _subject_id AND lower(btrim(name)) = 'general'
  ORDER BY created_at
  LIMIT 1;

  IF _subtopic_id IS NULL THEN
    INSERT INTO public.lq_subtopics (user_id, subject_id, name)
    VALUES (_uid, _subject_id, 'General')
    RETURNING id INTO _subtopic_id;
  END IF;

  RETURN jsonb_build_object('subjectId', _subject_id, 'subtopicId', _subtopic_id);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_lq_default_bucket() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_lq_default_bucket() TO authenticated;

CREATE OR REPLACE FUNCTION public.save_lq_generation(
  _subtopic_id uuid,
  _title text,
  _source_name text,
  _difficulty text,
  _key_points jsonb,
  _questions jsonb,
  _lecture_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _saved_lecture_id uuid;
  _question jsonb;
  _index integer := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Please sign in again.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.lq_subtopics
    WHERE id = _subtopic_id AND user_id = _uid
  ) THEN
    RAISE EXCEPTION 'That sub-subject is not available in your account.';
  END IF;
  IF jsonb_typeof(_questions) <> 'array' OR jsonb_array_length(_questions) = 0 THEN
    RAISE EXCEPTION 'No valid questions were generated.';
  END IF;

  IF _lecture_id IS NULL THEN
    INSERT INTO public.lq_lectures (
      user_id, subtopic_id, title, source_name, difficulty, key_points, question_count
    ) VALUES (
      _uid, _subtopic_id, btrim(_title), NULLIF(btrim(COALESCE(_source_name, '')), ''),
      _difficulty, COALESCE(_key_points, '[]'::jsonb), jsonb_array_length(_questions)
    ) RETURNING id INTO _saved_lecture_id;
  ELSE
    SELECT id INTO _saved_lecture_id
    FROM public.lq_lectures
    WHERE id = _lecture_id AND user_id = _uid
    FOR UPDATE;
    IF _saved_lecture_id IS NULL THEN RAISE EXCEPTION 'That lecture is not available in your account.'; END IF;

    DELETE FROM public.lq_questions WHERE lecture_id = _saved_lecture_id AND user_id = _uid;
    UPDATE public.lq_lectures
    SET title = btrim(_title),
        source_name = NULLIF(btrim(COALESCE(_source_name, '')), ''),
        difficulty = _difficulty,
        key_points = COALESCE(_key_points, '[]'::jsonb),
        question_count = jsonb_array_length(_questions)
    WHERE id = _saved_lecture_id AND user_id = _uid;
  END IF;

  FOR _question IN SELECT value FROM jsonb_array_elements(_questions)
  LOOP
    INSERT INTO public.lq_questions (
      user_id, lecture_id, stem, options, explanation, point_ref, sort_order
    ) VALUES (
      _uid,
      _saved_lecture_id,
      btrim(_question->>'stem'),
      COALESCE(_question->'options', '[]'::jsonb),
      COALESCE(_question->>'explanation', ''),
      NULLIF(btrim(COALESCE(_question->>'point_ref', '')), ''),
      _index
    );
    _index := _index + 1;
  END LOOP;

  RETURN _saved_lecture_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_lq_generation(uuid, text, text, text, jsonb, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_lq_generation(uuid, text, text, text, jsonb, jsonb, uuid) TO authenticated;
-- <<< 20260905122331_486d6648-8a44-4d3b-9ac0-ace3716976e0.sql


-- >>> 20260905150100_7bdcaefd-5578-4781-bc99-0e806b0a1ab6.sql
ALTER TABLE public.lq_subjects ADD COLUMN IF NOT EXISTS is_example boolean NOT NULL DEFAULT false;
ALTER TABLE public.lq_subtopics ADD COLUMN IF NOT EXISTS is_example boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "read example lq_subjects" ON public.lq_subjects;
CREATE POLICY "read example lq_subjects" ON public.lq_subjects
  FOR SELECT TO authenticated USING (is_example = true);

DROP POLICY IF EXISTS "read example lq_subtopics" ON public.lq_subtopics;
CREATE POLICY "read example lq_subtopics" ON public.lq_subtopics
  FOR SELECT TO authenticated USING (is_example = true);

-- Clean up the old per-account sample shelf.
DELETE FROM public.lq_subjects WHERE name LIKE '%(sample)%' AND is_example = false;

-- Shared example shelf, owned by a fixed system id.
DELETE FROM public.lq_subjects WHERE user_id = '00000000-0000-4000-8000-000000000001';

INSERT INTO public.lq_subjects (id, user_id, name, sort_order, is_example) VALUES
  ('a0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Physiology (example)',1,true),
  ('a0000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','Anatomy (example)',2,true),
  ('a0000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','Pharmacology (example)',3,true),
  ('a0000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','Pathology (example)',4,true),
  ('a0000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000001','Biochemistry (example)',5,true),
  ('a0000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000001','Microbiology (example)',6,true);

INSERT INTO public.lq_subtopics (id, user_id, subject_id, name, sort_order, is_example) VALUES
  ('b0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Cardiac cycle',1,true),
  ('b0000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Respiratory volumes',2,true),
  ('b0000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Renal filtration',3,true),
  ('b0000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','Upper limb',1,true),
  ('b0000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','Thorax',2,true),
  ('b0000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003','Antibiotics',1,true),
  ('b0000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003','Autonomic drugs',2,true),
  ('b0000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000004','Inflammation',1,true),
  ('b0000000-0000-4000-8000-000000000009','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000004','Neoplasia',2,true),
  ('b0000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000005','Glycolysis',1,true),
  ('b0000000-0000-4000-8000-00000000000b','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000005','Vitamins',2,true),
  ('b0000000-0000-4000-8000-00000000000c','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000006','Gram-positive cocci',1,true),
  ('b0000000-0000-4000-8000-00000000000d','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000006','Viral hepatitis',2,true);

INSERT INTO public.lq_lectures (id, user_id, subtopic_id, title, source_name, difficulty, key_points, question_count, is_example) VALUES
  ('c0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','The cardiac cycle (example lecture)','Example lecture','mixed','["Systole vs diastole","Valve events and heart sounds","Preload and afterload"]'::jsonb,3,true),
  ('c0000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000006','Beta-lactam antibiotics (example lecture)','Example lecture','mixed','["Cell wall synthesis","Beta-lactamase resistance","Common side effects"]'::jsonb,3,true);

INSERT INTO public.lq_questions (user_id, lecture_id, stem, options, explanation, point_ref, sort_order) VALUES
  ('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','Which valves close at the start of ventricular systole, producing the first heart sound?','[{"letter":"A","body":"Aortic and pulmonary valves","is_correct":false},{"letter":"B","body":"Mitral and tricuspid valves","is_correct":true},{"letter":"C","body":"Aortic valve only","is_correct":false},{"letter":"D","body":"Tricuspid valve only","is_correct":false}]'::jsonb,'S1 is the closure of the atrioventricular valves as ventricular pressure rises above atrial pressure. The semilunar valves close later, at the end of systole, giving S2.','Valve events and heart sounds',1),
  ('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','During which phase is coronary blood flow to the left ventricle highest?','[{"letter":"A","body":"Isovolumetric contraction","is_correct":false},{"letter":"B","body":"Rapid ejection","is_correct":false},{"letter":"C","body":"Diastole","is_correct":true},{"letter":"D","body":"Atrial systole","is_correct":false}]'::jsonb,'Intramural vessels are compressed during systole, so left coronary perfusion happens mainly in diastole. Tachycardia shortens diastole and reduces coronary filling time.','Systole vs diastole',2),
  ('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','Increasing venous return raises stroke volume mainly by increasing which factor?','[{"letter":"A","body":"Preload","is_correct":true},{"letter":"B","body":"Afterload","is_correct":false},{"letter":"C","body":"Heart rate","is_correct":false},{"letter":"D","body":"Contractility","is_correct":false}]'::jsonb,'More venous return stretches the ventricle, so end-diastolic volume (preload) rises and stroke volume follows the Frank-Starling relationship.','Preload and afterload',3),
  ('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002','What is the mechanism of action of penicillins?','[{"letter":"A","body":"Inhibit the 50S ribosomal subunit","is_correct":false},{"letter":"B","body":"Inhibit cell wall cross-linking by binding transpeptidases","is_correct":true},{"letter":"C","body":"Inhibit DNA gyrase","is_correct":false},{"letter":"D","body":"Disrupt folate synthesis","is_correct":false}]'::jsonb,'Beta-lactams bind penicillin-binding proteins (transpeptidases) and block peptidoglycan cross-linking, so growing bacteria lyse. They are bactericidal and need actively dividing cells.','Cell wall synthesis',1),
  ('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002','Adding clavulanic acid to amoxicillin helps because it:','[{"letter":"A","body":"Blocks beta-lactamase enzymes","is_correct":true},{"letter":"B","body":"Improves oral absorption","is_correct":false},{"letter":"C","body":"Widens ribosomal binding","is_correct":false},{"letter":"D","body":"Slows renal clearance","is_correct":false}]'::jsonb,'Clavulanic acid is a suicide inhibitor of beta-lactamase, protecting amoxicillin from enzymatic breakdown and restoring activity against resistant organisms.','Beta-lactamase resistance',2),
  ('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002','Which reaction is the classic serious adverse effect of penicillins?','[{"letter":"A","body":"Tendon rupture","is_correct":false},{"letter":"B","body":"Immediate IgE-mediated anaphylaxis","is_correct":true},{"letter":"C","body":"Grey baby syndrome","is_correct":false},{"letter":"D","body":"Ototoxicity","is_correct":false}]'::jsonb,'Type I hypersensitivity to the beta-lactam ring can cause urticaria, bronchospasm and anaphylaxis within minutes. Always ask about the nature of a reported penicillin allergy.','Common side effects',3);
-- <<< 20260905150100_7bdcaefd-5578-4781-bc99-0e806b0a1ab6.sql


-- >>> 20260905154347_d53385ac-f9ea-45b0-945b-274c7d138fa0.sql
CREATE POLICY "View questions in free subjects" ON public.questions FOR SELECT TO authenticated USING (
  owner_user_id IS NULL AND EXISTS (
    SELECT 1 FROM public.subjects s
    JOIN public.subject_groups sg ON sg.id = s.group_id
    JOIN public.courses c ON c.id = sg.course_id
    WHERE s.id = questions.subject_id
      AND s.owner_user_id IS NULL
      AND s.access_level IN ('free_public','free_logged_in')
      AND c.published = true
  )
);

CREATE POLICY "View options in free subjects" ON public.question_options FOR SELECT TO authenticated USING (
  owner_user_id IS NULL AND EXISTS (
    SELECT 1 FROM public.questions q
    JOIN public.subjects s ON s.id = q.subject_id
    JOIN public.subject_groups sg ON sg.id = s.group_id
    JOIN public.courses c ON c.id = sg.course_id
    WHERE q.id = question_options.question_id
      AND s.owner_user_id IS NULL
      AND s.access_level IN ('free_public','free_logged_in')
      AND c.published = true
  )
);

CREATE POLICY "Users can join free courses" ON public.user_courses FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = user_courses.course_id
      AND c.published = true
      AND c.admin_only = false
      AND COALESCE(c.price, 0) <= 0
  )
);
-- <<< 20260905154347_d53385ac-f9ea-45b0-945b-274c7d138fa0.sql


-- >>> 20260905160828_ce43a68a-13ad-4f04-9246-e2b582bd19f9.sql
-- Faster per-account lookups
CREATE INDEX IF NOT EXISTS study_subjects_user_idx ON public.study_subjects (user_id);
CREATE INDEX IF NOT EXISTS study_topics_user_idx ON public.study_topics (user_id);
CREATE INDEX IF NOT EXISTS shared_decks_owner_idx ON public.shared_decks (owner_id);
CREATE INDEX IF NOT EXISTS flash_subjects_user_idx ON public.flash_subjects (user_id);
CREATE INDEX IF NOT EXISTS card_reviews_user_due_idx ON public.card_reviews (user_id, due_at);

-- Helper checks used by public-facing reads
GRANT EXECUTE ON FUNCTION public.can_manage_committee(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.event_visible(uuid) TO anon;
-- <<< 20260905160828_ce43a68a-13ad-4f04-9246-e2b582bd19f9.sql


-- >>> 20260905161944_b54de2bc-cc33-423c-823d-72da7e1b9241.sql
ALTER TABLE public.shared_decks
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'public';

ALTER TABLE public.shared_decks
  DROP CONSTRAINT IF EXISTS shared_decks_audience_check;
ALTER TABLE public.shared_decks
  ADD CONSTRAINT shared_decks_audience_check CHECK (audience IN ('public','space'));

CREATE INDEX IF NOT EXISTS shared_decks_audience_idx ON public.shared_decks (audience, created_at DESC);

CREATE OR REPLACE FUNCTION public.deck_in_my_space(_deck_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.space_decks sd
    JOIN public.space_members sm
      ON sm.space_id = sd.space_id AND sm.user_id = _user_id
    WHERE sd.deck_id = _deck_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.deck_in_my_space(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "space members read space decks" ON public.shared_decks;
CREATE POLICY "space members read space decks"
  ON public.shared_decks FOR SELECT TO authenticated
  USING (public.deck_in_my_space(id, auth.uid()));

DROP POLICY IF EXISTS "space members read space deck cards" ON public.shared_deck_cards;
CREATE POLICY "space members read space deck cards"
  ON public.shared_deck_cards FOR SELECT TO authenticated
  USING (public.deck_in_my_space(deck_id, auth.uid()));
-- <<< 20260905161944_b54de2bc-cc33-423c-823d-72da7e1b9241.sql


-- >>> 20260905221543_63f95a4f-6232-48e8-a82f-0992e88a4a9c.sql
-- 1. Emails must never be reachable by anonymous callers
revoke all on function public.get_email_by_username(text) from anon, authenticated;

-- 2. Privileged / internal helpers should not be callable by anonymous visitors
revoke all on function public.admin_users_with_plans() from anon;
revoke all on function public.effective_plan(uuid) from anon;
revoke all on function public.deck_in_my_space(uuid, uuid) from anon;

-- 3. Migration bookkeeping table locked down
alter table public._mig_log enable row level security;
revoke all on table public._mig_log from anon, authenticated;
grant all on table public._mig_log to service_role;
drop policy if exists "mig log admins only" on public._mig_log;
create policy "mig log admins only" on public._mig_log
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- 4. Plans: keep a single clear public read rule
drop policy if exists "Plans are public" on public.plans;
drop policy if exists "Plans are publicly readable" on public.plans;

-- 5. Public profiles: signed-in users can browse them; anonymous visitors only
--    see the authors of decks that are actually published publicly.
drop policy if exists "public profiles are readable" on public.public_profiles;
drop policy if exists "profiles readable by members" on public.public_profiles;
drop policy if exists "profiles of public deck authors" on public.public_profiles;
create policy "profiles readable by members" on public.public_profiles
  for select to authenticated using (true);
create policy "profiles of public deck authors" on public.public_profiles
  for select to anon using (
    exists (
      select 1 from public.shared_decks d
      where d.owner_id = public_profiles.id
        and d.published = true
        and d.audience = 'public'
    )
  );

-- 6. Private key for the scheduled background workers (admin-only table)
insert into public.site_secrets (key, value, updated_at)
values ('worker_cron_key', '9e08bf71d985ff9c65cf8b31a35fc82162b873c6', now())
on conflict (key) do update set value = excluded.value, updated_at = now();

-- 7. Sharing stays opt-in
alter table public.summaries alter column is_public set default false;
-- <<< 20260905221543_63f95a4f-6232-48e8-a82f-0992e88a4a9c.sql


-- >>> 20260905221638_d37e5c79-678b-4b2d-a93c-d52e86111d39.sql
-- Private helpers: remove the implicit "anyone may run this" grant
revoke execute on function public.get_email_by_username(text) from public, anon, authenticated;
revoke execute on function public.admin_users_with_plans() from public, anon;
revoke execute on function public.can_manage_committee(uuid) from public, anon;
revoke execute on function public.deck_in_my_space(uuid, uuid) from public, anon;
revoke execute on function public.effective_plan(uuid) from public, anon;

-- Leftover migration-replay helpers: fixed search path

-- <<< 20260905221638_d37e5c79-678b-4b2d-a93c-d52e86111d39.sql


-- >>> 20260905224741_96aa769c-c88d-41c6-91c5-114cdd1eb4f1.sql
ALTER TABLE public.admin_ai_keys ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'shared';

ALTER TABLE public.admin_ai_keys DROP CONSTRAINT IF EXISTS admin_ai_keys_pkey;
ALTER TABLE public.admin_ai_keys DROP CONSTRAINT IF EXISTS admin_ai_keys_provider_slot_key;

ALTER TABLE public.admin_ai_keys
  ADD CONSTRAINT admin_ai_keys_provider_slot_purpose_key UNIQUE (provider, slot, purpose);

ALTER TABLE public.admin_ai_keys
  ADD CONSTRAINT admin_ai_keys_purpose_check
  CHECK (purpose IN ('shared','aio','rita','lecture','questions'));
-- <<< 20260905224741_96aa769c-c88d-41c6-91c5-114cdd1eb4f1.sql


-- >>> 20260906214341_efb31f00-14ac-43b4-85f9-e37995119da9.sql
CREATE TABLE public.site_feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  badge TEXT,
  badge_ar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_feature_flags TO anon;
GRANT SELECT ON public.site_feature_flags TO authenticated;
GRANT ALL ON public.site_feature_flags TO service_role;

ALTER TABLE public.site_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read feature flags"
  ON public.site_feature_flags FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins manage feature flags"
  ON public.site_feature_flags FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER site_feature_flags_touch
  BEFORE UPDATE ON public.site_feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- <<< 20260906214341_efb31f00-14ac-43b4-85f9-e37995119da9.sql


-- >>> 20260906231619_a4f45e66-e45c-4c53-b527-54f67f9120f5.sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tour_seen_at timestamptz;
-- <<< 20260906231619_a4f45e66-e45c-4c53-b527-54f67f9120f5.sql


-- >>> 20260907133728_c46cc509-71d1-4ee5-a6ed-bd622d99dd1e.sql
CREATE TABLE public.slide_decks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  source_name TEXT,
  subject_label TEXT,
  subtopic_label TEXT,
  page_count INTEGER NOT NULL DEFAULT 0,
  pages_done INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'building',
  slides JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.slide_decks TO authenticated;
GRANT ALL ON public.slide_decks TO service_role;

ALTER TABLE public.slide_decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage their own slide decks"
ON public.slide_decks FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX slide_decks_user_created_idx ON public.slide_decks (user_id, created_at DESC);

CREATE TRIGGER slide_decks_updated_at
BEFORE UPDATE ON public.slide_decks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- <<< 20260907133728_c46cc509-71d1-4ee5-a6ed-bd622d99dd1e.sql


-- >>> 20260907144756_af13965d-dd64-476e-8018-90c7c6b5c5aa.sql
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS credit_packs_enabled boolean NOT NULL DEFAULT false;
-- <<< 20260907144756_af13965d-dd64-476e-8018-90c7c6b5c5aa.sql


-- >>> 20260907170945_cf0892cb-d26c-476a-a44a-faaa763972c7.sql
UPDATE public.plans SET paddle_price_monthly='toolkit_monthly', paddle_price_yearly='toolkit_yearly' WHERE slug='toolkit';
UPDATE public.plans SET paddle_price_monthly='boost_monthly', paddle_price_yearly='boost_yearly' WHERE slug='boost';
UPDATE public.plans SET paddle_price_monthly='pro_monthly', paddle_price_yearly='pro_yearly' WHERE slug='pro';
UPDATE public.plans SET paddle_price_monthly='ultimate_monthly', paddle_price_yearly='ultimate_yearly' WHERE slug='ultimate';
-- <<< 20260907170945_cf0892cb-d26c-476a-a44a-faaa763972c7.sql


-- >>> 20260907190357_2f9a441b-bebb-4bd1-bba5-b14fe1d641fd.sql
-- old lecture-lab leftovers: keep the tables (live feature), clear the old rows
DELETE FROM public.lq_attempts;
DELETE FROM public.lq_questions;
DELETE FROM public.lq_lectures;
DELETE FROM public.lq_subtopics;
DELETE FROM public.lq_subjects;

-- groups no longer reference the removed packages feature
ALTER TABLE public.user_groups DROP COLUMN IF EXISTS package_id;

-- functions that only served the removed features
DROP FUNCTION IF EXISTS public.can_manage_committee(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_manage_committee_members(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_manage_committee_years(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_access_committee_subject(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.committee_team_add CASCADE;
DROP FUNCTION IF EXISTS public.committee_team_list CASCADE;
DROP FUNCTION IF EXISTS public.committee_team_remove CASCADE;
DROP FUNCTION IF EXISTS public.log_committee_change CASCADE;
DROP FUNCTION IF EXISTS public.set_committee_qr CASCADE;
DROP FUNCTION IF EXISTS public.head_list_committee_members CASCADE;
DROP FUNCTION IF EXISTS public.head_set_committee_role CASCADE;
DROP FUNCTION IF EXISTS public.admin_list_committee_members CASCADE;
DROP FUNCTION IF EXISTS public.admin_grant_committee_role CASCADE;
DROP FUNCTION IF EXISTS public.admin_revoke_committee_role CASCADE;
DROP FUNCTION IF EXISTS public.can_manage_events CASCADE;
DROP FUNCTION IF EXISTS public.event_visible CASCADE;
DROP FUNCTION IF EXISTS public.apply_coupon CASCADE;
DROP FUNCTION IF EXISTS public.validate_coupon CASCADE;
DROP FUNCTION IF EXISTS public.university_id_by_slug CASCADE;
DROP FUNCTION IF EXISTS public.is_class_member CASCADE;
DROP FUNCTION IF EXISTS public.ensure_lq_default_bucket CASCADE;
DROP FUNCTION IF EXISTS public.user_owns_lecture_course CASCADE;

-- committee library
DROP TABLE IF EXISTS public.committee_best_sources CASCADE;
DROP TABLE IF EXISTS public.committee_subject_courses CASCADE;
DROP TABLE IF EXISTS public.committee_resources CASCADE;
DROP TABLE IF EXISTS public.committee_categories CASCADE;
DROP TABLE IF EXISTS public.committee_subjects CASCADE;
DROP TABLE IF EXISTS public.committee_modules CASCADE;
DROP TABLE IF EXISTS public.committee_semesters CASCADE;
DROP TABLE IF EXISTS public.committee_years CASCADE;
DROP TABLE IF EXISTS public.committee_members CASCADE;
DROP TABLE IF EXISTS public.committee_activity_log CASCADE;

-- events
DROP TABLE IF EXISTS public.event_contacts CASCADE;
DROP TABLE IF EXISTS public.event_members CASCADE;
DROP TABLE IF EXISTS public.event_sections CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;

-- mentor
DROP TABLE IF EXISTS public.mentor_task_completions CASCADE;
DROP TABLE IF EXISTS public.mentor_tasks CASCADE;
DROP TABLE IF EXISTS public.mentor_journal CASCADE;
DROP TABLE IF EXISTS public.mentor_treasures CASCADE;
DROP TABLE IF EXISTS public.mentor_entries CASCADE;
DROP TABLE IF EXISTS public.mentor_categories CASCADE;

-- shop leftovers
DROP TABLE IF EXISTS public.package_purchases CASCADE;
DROP TABLE IF EXISTS public.package_courses CASCADE;
DROP TABLE IF EXISTS public.packages CASCADE;
DROP TABLE IF EXISTS public.coupon_redemptions CASCADE;
DROP TABLE IF EXISTS public.coupon_courses CASCADE;
DROP TABLE IF EXISTS public.coupons CASCADE;
DROP TABLE IF EXISTS public.course_options CASCADE;

-- universities / leads
DROP TABLE IF EXISTS public.university_tiles CASCADE;
DROP TABLE IF EXISTS public.universities_settings CASCADE;
DROP TABLE IF EXISTS public.universities CASCADE;
DROP TABLE IF EXISTS public.institution_leads CASCADE;

-- old lecture pages / quizzes / rebuilds
DROP TABLE IF EXISTS public.lecture_quiz_attempts CASCADE;
DROP TABLE IF EXISTS public.lecture_quiz_options CASCADE;
DROP TABLE IF EXISTS public.lecture_quiz_questions CASCADE;
DROP TABLE IF EXISTS public.lecture_quizzes CASCADE;
DROP TABLE IF EXISTS public.lecture_items CASCADE;
DROP TABLE IF EXISTS public.lecture_subjects CASCADE;
DROP TABLE IF EXISTS public.lecture_rebuild_pages CASCADE;
DROP TABLE IF EXISTS public.lecture_rebuilds CASCADE;

-- old batch / iPad tools
DROP TABLE IF EXISTS public.jarvis_batch_german_ipad_chunks CASCADE;
DROP TABLE IF EXISTS public.jarvis_batch_german_ipad_jobs CASCADE;
DROP TABLE IF EXISTS public.jarvis_batch_v2_ipad_chunks CASCADE;
DROP TABLE IF EXISTS public.jarvis_batch_v2_ipad_jobs CASCADE;
DROP TABLE IF EXISTS public.jarvis_batch_v2_chunks CASCADE;
DROP TABLE IF EXISTS public.jarvis_batch_v2_jobs CASCADE;
DROP TABLE IF EXISTS public.jarvis_batch_jobs CASCADE;
DROP TABLE IF EXISTS public.aquavision_items CASCADE;
DROP TABLE IF EXISTS public.aquavision_pages CASCADE;
DROP TABLE IF EXISTS public.aquavision_jobs CASCADE;
DROP TABLE IF EXISTS public.patch_prox_items CASCADE;
DROP TABLE IF EXISTS public.patch_prox_pages CASCADE;
DROP TABLE IF EXISTS public.patch_prox_jobs CASCADE;
DROP TABLE IF EXISTS public.sonic_chunks CASCADE;
DROP TABLE IF EXISTS public.sonic_jobs CASCADE;
DROP TABLE IF EXISTS public.sonic_pdfs CASCADE;

-- other unused leftovers
DROP TABLE IF EXISTS public.site_blocks CASCADE;
DROP TABLE IF EXISTS public.study_plan_subjects CASCADE;
DROP TABLE IF EXISTS public.study_plan_stages CASCADE;
DROP TABLE IF EXISTS public.study_topics CASCADE;
DROP TABLE IF EXISTS public.study_subjects CASCADE;
DROP TABLE IF EXISTS public.class_decks CASCADE;
DROP TABLE IF EXISTS public.class_members CASCADE;
DROP TABLE IF EXISTS public.classes CASCADE;
DROP TABLE IF EXISTS public.space_moderation_log CASCADE;
DROP TABLE IF EXISTS public.ad_creatives CASCADE;
DROP TABLE IF EXISTS public.question_gen_batches CASCADE;
DROP TABLE IF EXISTS public.guides CASCADE;
-- <<< 20260907190357_2f9a441b-bebb-4bd1-bba5-b14fe1d641fd.sql


-- >>> 20260907231305_3697fb3c-7442-4144-a9b0-3f9a2731239c.sql
DROP TABLE IF EXISTS public.slide_decks CASCADE;
DROP TABLE IF EXISTS public.study_focus_sessions CASCADE;
DROP TABLE IF EXISTS public.vault_runs CASCADE;
-- <<< 20260907231305_3697fb3c-7442-4144-a9b0-3f9a2731239c.sql


-- >>> 20260908004434_77e72b5f-f1f3-47f7-9f46-4adefbb5776a.sql
-- 1. Retire the look & content tools
DROP TABLE IF EXISTS public.site_blocks CASCADE;
DROP TABLE IF EXISTS public.site_sections CASCADE;
DROP TABLE IF EXISTS public.site_pages CASCADE;
DROP TABLE IF EXISTS public.site_nav_items CASCADE;
DROP TABLE IF EXISTS public.site_content CASCADE;
DROP TABLE IF EXISTS public.about_blocks CASCADE;
DROP TABLE IF EXISTS public.site_feature_flags CASCADE;

-- 2. People directory, now with plan + kit
DROP FUNCTION IF EXISTS public.admin_people_directory();

CREATE OR REPLACE FUNCTION public.admin_people_directory()
RETURNS TABLE(
  id uuid, full_name text, username text, email text, phone text,
  verified boolean, locked_at timestamptz, lock_until timestamptz, lock_reason text,
  roles text[], courses bigint, paid_cents bigint,
  created_at timestamptz, last_seen timestamptz, login_count bigint,
  plan_slug text, plan_name text,
  kit_slug text, kit_name text, kit_expires_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT u.id,
    COALESCE(p.full_name, u.raw_user_meta_data->>'full_name', ''),
    COALESCE(p.username, u.raw_user_meta_data->>'username', split_part(u.email::text,'@',1)),
    COALESCE(p.email, u.email::text),
    COALESCE(p.phone, u.phone::text),
    (u.email_confirmed_at IS NOT NULL),
    p.locked_at, p.lock_until, p.lock_reason,
    COALESCE(ARRAY(SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = u.id), ARRAY[]::text[]),
    (SELECT count(*) FROM public.user_courses uc WHERE uc.user_id = u.id)::bigint,
    COALESCE((SELECT sum(pe.amount_cents) FROM public.payment_events pe
              WHERE pe.user_id = u.id AND pe.status = 'completed'), 0)::bigint,
    u.created_at,
    GREATEST(
      (SELECT max(s.last_seen_at) FROM public.user_sessions s WHERE s.user_id = u.id),
      (SELECT max(e.occurred_at) FROM public.user_login_events e WHERE e.user_id = u.id)
    ),
    (SELECT count(*) FROM public.user_login_events e WHERE e.user_id = u.id)::bigint,
    COALESCE(up.plan_slug, 'starter'),
    COALESCE(pl.name, 'Starter'),
    tk.slug, tk.name, tc.expires_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.user_plans up ON up.user_id = u.id
  LEFT JOIN public.plans pl ON pl.slug = COALESCE(up.plan_slug, 'starter')
  LEFT JOIN LATERAL (
    SELECT c.expires_at, c.code_id
    FROM public.toolkit_claims c
    WHERE c.user_id = u.id
    ORDER BY c.expires_at DESC NULLS LAST
    LIMIT 1
  ) tc ON true
  LEFT JOIN LATERAL (
    SELECT pl2.slug, pl2.name
    FROM public.toolkit_codes tcode
    JOIN public.plans pl2 ON pl2.slug = tcode.plan_slug
    WHERE tcode.id = tc.code_id
  ) tk ON true
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_people_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_people_directory() TO authenticated;

-- 3. Live pulse
CREATE OR REPLACE FUNCTION public.admin_people_pulse()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'generated_at', now(),
    'online_now', (SELECT count(*) FROM public.user_sessions s WHERE s.last_seen_at > now() - interval '5 minutes'),
    'online_15m', (SELECT count(*) FROM public.user_sessions s WHERE s.last_seen_at > now() - interval '15 minutes'),
    'opened_today', (SELECT count(DISTINCT s.user_id) FROM public.user_sessions s WHERE s.last_seen_at >= date_trunc('day', now())),
    'opened_yesterday', (SELECT count(DISTINCT e.user_id) FROM public.user_login_events e
                         WHERE e.occurred_at >= date_trunc('day', now()) - interval '1 day'
                           AND e.occurred_at < date_trunc('day', now())),
    'total_users', (SELECT count(*) FROM auth.users),
    'hourly', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('hour', h, 'logins', c) ORDER BY h)
      FROM (
        SELECT g.h AS h,
          (SELECT count(*) FROM public.user_login_events e
           WHERE e.occurred_at >= date_trunc('day', now()) + (g.h || ' hours')::interval
             AND e.occurred_at <  date_trunc('day', now()) + ((g.h + 1) || ' hours')::interval) AS c
        FROM generate_series(0, 23) AS g(h)
      ) q
    ), '[]'::jsonb),
    'plan_mix', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('slug', slug, 'name', name, 'people', people) ORDER BY people DESC)
      FROM (
        SELECT COALESCE(up.plan_slug, 'starter') AS slug,
               COALESCE(pl.name, 'Starter') AS name,
               count(*)::bigint AS people
        FROM auth.users u
        LEFT JOIN public.user_plans up ON up.user_id = u.id
        LEFT JOIN public.plans pl ON pl.slug = COALESCE(up.plan_slug, 'starter')
        GROUP BY 1, 2
      ) m
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_people_pulse() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_people_pulse() TO authenticated;

-- 4. Who is online right now
CREATE OR REPLACE FUNCTION public.admin_people_online()
RETURNS TABLE(
  user_id uuid, full_name text, username text, email text,
  plan_slug text, plan_name text,
  started_at timestamptz, last_seen_at timestamptz, minutes_active integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT s.user_id,
    COALESCE(p.full_name, ''),
    COALESCE(p.username, split_part(COALESCE(p.email, ''), '@', 1)),
    p.email,
    COALESCE(up.plan_slug, 'starter'),
    COALESCE(pl.name, 'Starter'),
    s.started_at,
    s.last_seen_at,
    GREATEST(1, (EXTRACT(EPOCH FROM (s.last_seen_at - s.started_at)) / 60)::int)
  FROM public.user_sessions s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  LEFT JOIN public.user_plans up ON up.user_id = s.user_id
  LEFT JOIN public.plans pl ON pl.slug = COALESCE(up.plan_slug, 'starter')
  WHERE s.last_seen_at > now() - interval '15 minutes'
  ORDER BY s.last_seen_at DESC
  LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_people_online() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_people_online() TO authenticated;

-- 5. One person's history
CREATE OR REPLACE FUNCTION public.admin_person_history(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'plan_slug', COALESCE((SELECT up.plan_slug FROM public.user_plans up WHERE up.user_id = _user_id), 'starter'),
    'plan_changed_at', (SELECT up.updated_at FROM public.user_plans up WHERE up.user_id = _user_id),
    'logins', COALESCE((SELECT jsonb_agg(x.occurred_at ORDER BY x.occurred_at DESC)
                        FROM (SELECT e.occurred_at FROM public.user_login_events e
                              WHERE e.user_id = _user_id
                              ORDER BY e.occurred_at DESC LIMIT 40) x), '[]'::jsonb),
    'devices', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                            'id', d.id, 'platform', d.platform,
                            'user_agent', d.user_agent, 'last_seen_at', d.last_seen_at))
                         FROM (SELECT * FROM public.user_devices ud
                               WHERE ud.user_id = _user_id
                               ORDER BY ud.last_seen_at DESC LIMIT 20) d), '[]'::jsonb),
    'payments', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                            'id', pe.id, 'amount_cents', pe.amount_cents, 'currency', pe.currency,
                            'status', pe.status, 'created_at', pe.created_at))
                          FROM (SELECT * FROM public.payment_events p2
                                WHERE p2.user_id = _user_id
                                ORDER BY p2.created_at DESC LIMIT 30) pe), '[]'::jsonb),
    'decks', (SELECT count(*) FROM public.flash_subjects fs WHERE fs.user_id = _user_id),
    'cards', (SELECT count(*) FROM public.flash_cards fc WHERE fc.user_id = _user_id),
    'summaries', (SELECT count(*) FROM public.summaries su WHERE su.user_id = _user_id),
    'spaces', (SELECT count(*) FROM public.space_members sm WHERE sm.user_id = _user_id)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_person_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_person_history(uuid) TO authenticated;
-- <<< 20260908004434_77e72b5f-f1f3-47f7-9f46-4adefbb5776a.sql


-- >>> 20260908010840_d0885c3e-80ed-4e8a-badc-e71e0f07f380.sql
CREATE OR REPLACE FUNCTION public.admin_people_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT jsonb_build_object(
    'active_now', (SELECT count(*) FROM public.user_sessions WHERE last_seen_at >= now() - interval '5 minutes'),
    'opened_today', (SELECT count(*) FROM public.user_sessions WHERE last_seen_at >= date_trunc('day', now())),
    'total_users', (SELECT count(*) FROM public.profiles),
    'new_today', (SELECT count(*) FROM public.profiles WHERE created_at >= date_trunc('day', now())),
    'new_week', (SELECT count(*) FROM public.profiles WHERE created_at >= now() - interval '7 days'),
    'new_month', (SELECT count(*) FROM public.profiles WHERE created_at >= now() - interval '30 days'),
    'new_prev_week', (SELECT count(*) FROM public.profiles WHERE created_at >= now() - interval '14 days' AND created_at < now() - interval '7 days'),
    'new_prev_month', (SELECT count(*) FROM public.profiles WHERE created_at >= now() - interval '60 days' AND created_at < now() - interval '30 days'),
    'logins_today', (SELECT count(*) FROM public.user_login_events WHERE occurred_at >= date_trunc('day', now())),
    'logins_week', (SELECT count(*) FROM public.user_login_events WHERE occurred_at >= now() - interval '7 days'),
    'logins_month', (SELECT count(*) FROM public.user_login_events WHERE occurred_at >= now() - interval '30 days'),
    'logins_prev_week', (SELECT count(*) FROM public.user_login_events WHERE occurred_at >= now() - interval '14 days' AND occurred_at < now() - interval '7 days'),
    'verified', (SELECT count(*) FROM auth.users WHERE email_confirmed_at IS NOT NULL),
    'unverified', (SELECT count(*) FROM auth.users WHERE email_confirmed_at IS NULL),
    'blocked', (SELECT count(*) FROM public.profiles WHERE locked_at IS NOT NULL AND lock_until IS NULL),
    'suspended', (SELECT count(*) FROM public.profiles WHERE locked_at IS NOT NULL AND lock_until IS NOT NULL AND lock_until > now()),
    'never_logged_in', (SELECT count(*) FROM public.profiles p WHERE NOT EXISTS (SELECT 1 FROM public.user_login_events e WHERE e.user_id = p.id)),
    'dormant_30d', (SELECT count(*) FROM public.profiles p WHERE EXISTS (SELECT 1 FROM public.user_login_events e WHERE e.user_id = p.id)
                     AND NOT EXISTS (SELECT 1 FROM public.user_login_events e2 WHERE e2.user_id = p.id AND e2.occurred_at >= now() - interval '30 days')),
    'revenue_cents', COALESCE((SELECT sum(amount_cents) FROM public.payment_events WHERE status = 'completed'), 0),
    'revenue_month_cents', COALESCE((SELECT sum(amount_cents) FROM public.payment_events WHERE status = 'completed' AND created_at >= now() - interval '30 days'), 0),
    'paying_users', (SELECT count(DISTINCT user_id) FROM public.payment_events WHERE status = 'completed' AND user_id IS NOT NULL),
    'course_grants', (SELECT count(*) FROM public.user_courses),
    'owners', (SELECT count(DISTINCT user_id) FROM public.user_courses),
    'generated_at', now()
  ) INTO result;
  RETURN result;
END; $function$;

CREATE OR REPLACE FUNCTION public.user_in_group(_user_id uuid, _group_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE g public.user_groups;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  SELECT * INTO g FROM public.user_groups WHERE id = _group_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.user_group_members m
             WHERE m.group_id = _group_id AND m.user_id = _user_id) THEN
    RETURN true;
  END IF;
  IF g.kind = 'everyone' THEN RETURN true; END IF;
  IF g.kind = 'admins' THEN
    RETURN public.has_role(_user_id, 'admin'::public.app_role);
  END IF;
  IF g.kind = 'committee' THEN
    RETURN public.has_role(_user_id, 'committee'::public.app_role);
  END IF;
  IF g.kind = 'course_owners' THEN
    RETURN EXISTS (SELECT 1 FROM public.user_courses uc
                   WHERE uc.user_id = _user_id AND uc.course_id = g.course_id);
  END IF;
  IF g.kind = 'package_owners' THEN
    RETURN EXISTS (SELECT 1 FROM public.payment_events pe
                   WHERE pe.user_id = _user_id AND pe.status = 'completed');
  END IF;
  IF g.kind = 'no_course' THEN
    RETURN NOT EXISTS (SELECT 1 FROM public.user_courses uc WHERE uc.user_id = _user_id);
  END IF;
  RETURN false;
END; $function$;

ALTER TABLE public.admin_ai_keys DROP CONSTRAINT IF EXISTS admin_ai_keys_purpose_check;
ALTER TABLE public.admin_ai_keys ADD CONSTRAINT admin_ai_keys_purpose_check
  CHECK (purpose = ANY (ARRAY['shared','aio','rita','lecture','questions','archive','summaries','german','speech']));
-- <<< 20260908010840_d0885c3e-80ed-4e8a-badc-e71e0f07f380.sql


-- >>> 20260908143841_dc89e4b4-72f3-4f35-ae21-e6c5e5b0082f.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
-- Lovable temporary helper intentionally absent.`r`n
-- <<< 20260908143841_dc89e4b4-72f3-4f35-ae21-e6c5e5b0082f.sql


-- >>> 20260908165713_257938d3-c8fd-4425-bbd5-db5b4f8e383b.sql
CREATE TABLE public.site_images (
  key text PRIMARY KEY,
  path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_images TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_images TO authenticated;
GRANT ALL ON public.site_images TO service_role;

ALTER TABLE public.site_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_images_public_read" ON public.site_images
  FOR SELECT USING (true);

CREATE POLICY "site_images_admin_write" ON public.site_images
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER site_images_touch
  BEFORE UPDATE ON public.site_images
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
-- <<< 20260908165713_257938d3-c8fd-4425-bbd5-db5b4f8e383b.sql


-- >>> 20260908171430_bb70a96a-1dc3-4c44-be16-1213c1181c8c.sql
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS classic_colors boolean NOT NULL DEFAULT false;
-- <<< 20260908171430_bb70a96a-1dc3-4c44-be16-1213c1181c8c.sql


-- >>> 20260908215404_b71ceaa8-00a5-400c-b105-8e7319219dad.sql
DROP POLICY IF EXISTS "Anon can view free public subjects" ON public.subjects;
DROP POLICY IF EXISTS "Authenticated can view free subjects" ON public.subjects;
DROP POLICY IF EXISTS "Published subject outlines are visible" ON public.subjects;

CREATE POLICY "Published subject outlines are visible"
ON public.subjects
FOR SELECT
TO anon, authenticated
USING (
  owner_user_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.subject_groups sg
    JOIN public.courses c ON c.id = sg.course_id
    WHERE sg.id = subjects.group_id
      AND c.published = true
  )
);
-- <<< 20260908215404_b71ceaa8-00a5-400c-b105-8e7319219dad.sql


-- >>> 20260908215659_a39eac19-aa69-40b3-b660-8058bcb2d082.sql
-- Published official subject names are visible as a bank outline; questions remain protected.
DROP POLICY IF EXISTS "Anon can view free public subjects" ON public.subjects;
DROP POLICY IF EXISTS "Authenticated can view free subjects" ON public.subjects;
DROP POLICY IF EXISTS "Published subject outlines are visible" ON public.subjects;

CREATE POLICY "Published subject outlines are visible"
ON public.subjects
FOR SELECT
TO anon, authenticated
USING (
  owner_user_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.subject_groups sg
    JOIN public.courses c ON c.id = sg.course_id
    WHERE sg.id = subjects.group_id
      AND c.published = true
  )
);
-- <<< 20260908215659_a39eac19-aa69-40b3-b660-8058bcb2d082.sql


-- >>> 20260908215739_5c7738a2-7c37-4628-b7c0-52ae20ab07e6.sql
DO $$
DECLARE
  duplicate_policy_count integer;
BEGIN
  SELECT count(*) INTO duplicate_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'subjects'
    AND policyname = 'Published subject outlines are visible';

  IF duplicate_policy_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one published subject outline policy, found %', duplicate_policy_count;
  END IF;
END
$$;
-- <<< 20260908215739_5c7738a2-7c37-4628-b7c0-52ae20ab07e6.sql


-- >>> 20260908215839_82491341-5c43-4270-bb02-005b995aebd5.sql
DO $$
DECLARE
  policy_count integer;
BEGIN
  SELECT count(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'subjects'
    AND policyname = 'Published subject outlines are visible';
  IF policy_count <> 1 THEN
    RAISE EXCEPTION 'Question-bank outline access rule is missing';
  END IF;
END
$$;
-- <<< 20260908215839_82491341-5c43-4270-bb02-005b995aebd5.sql


-- >>> 20260908215937_93ab2607-6274-496b-b531-e2b4a9662265.sql
DO $$
DECLARE
  policy_count integer;
BEGIN
  SELECT count(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'subjects'
    AND policyname = 'Published subject outlines are visible';
  IF policy_count <> 1 THEN
    RAISE EXCEPTION 'Question-bank outline rule verification failed';
  END IF;
END
$$;
-- <<< 20260908215937_93ab2607-6274-496b-b531-e2b4a9662265.sql


-- >>> 20260908222126_aa295fc0-be7b-4e44-bb6a-8630fc12f72f.sql

-- 1) Helper behind "Set one up for me" in Lecture Lab
CREATE OR REPLACE FUNCTION public.ensure_lq_default_bucket()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  s_id uuid;
  t_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.';
  END IF;

  SELECT id INTO s_id FROM public.lq_subjects
   WHERE user_id = uid AND name = 'My lectures' AND coalesce(is_example, false) = false
   LIMIT 1;
  IF s_id IS NULL THEN
    INSERT INTO public.lq_subjects (user_id, name) VALUES (uid, 'My lectures') RETURNING id INTO s_id;
  END IF;

  SELECT id INTO t_id FROM public.lq_subtopics
   WHERE user_id = uid AND subject_id = s_id AND name = 'General'
   LIMIT 1;
  IF t_id IS NULL THEN
    INSERT INTO public.lq_subtopics (user_id, subject_id, name) VALUES (uid, s_id, 'General') RETURNING id INTO t_id;
  END IF;

  RETURN jsonb_build_object('subjectId', s_id, 'subtopicId', t_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_lq_default_bucket() TO authenticated;

-- 2) Sample content, written once with fixed ids
WITH q(n, stem, a, b, c, d, correct, why) AS (
  VALUES
  (1,'Which valve closes at the start of ventricular systole?','Mitral valve','Aortic valve','Pulmonary valve','Tricuspid valve only','A','Rising ventricular pressure shuts the mitral valve first, producing the S1 sound. The aortic valve opens, not closes, at this moment.'),
  (2,'The first heart sound (S1) is produced by closure of which valves?','Aortic and pulmonary','Mitral and tricuspid','Mitral and aortic','Tricuspid and pulmonary','B','S1 marks closure of the atrioventricular valves. The semilunar valves (aortic and pulmonary) close later, giving S2.'),
  (3,'During isovolumetric contraction, ventricular volume is:','Rising','Falling','Unchanged','Equal to stroke volume','C','All four valves are shut, so no blood enters or leaves while pressure climbs steeply.'),
  (4,'The P wave of the ECG represents:','Atrial depolarisation','Atrial repolarisation','Ventricular depolarisation','Ventricular repolarisation','A','The P wave is atrial depolarisation; atrial repolarisation is hidden inside the QRS complex.'),
  (5,'A normal PR interval lasts about:','0.04-0.08 s','0.12-0.20 s','0.25-0.35 s','0.40-0.50 s','B','0.12-0.20 s is normal; longer than 0.20 s suggests first-degree AV block.'),
  (6,'The pacemaker of the healthy heart is the:','AV node','Bundle of His','Sinoatrial node','Purkinje fibres','C','The SA node fires fastest (60-100/min), so it sets the rhythm; the others are slower back-up pacemakers.'),
  (7,'Stroke volume equals:','End-diastolic volume minus end-systolic volume','End-systolic volume minus end-diastolic volume','Cardiac output times heart rate','Ejection fraction times heart rate','A','What is ejected is what was there at the end of filling minus what is left after the beat.'),
  (8,'Cardiac output is calculated as:','Heart rate divided by stroke volume','Stroke volume divided by heart rate','Heart rate times stroke volume','Stroke volume times ejection fraction','C','Output per minute = beats per minute x volume ejected per beat.'),
  (9,'The dicrotic notch on the aortic pressure trace is caused by:','Mitral valve opening','Aortic valve closure','Atrial contraction','Opening of the pulmonary valve','B','A brief backflow against the closing aortic valve produces the notch early in diastole.'),
  (10,'Most ventricular filling occurs:','During atrial contraction','Passively in early diastole','During isovolumetric relaxation','During the ejection phase','B','About 70-80% is passive; atrial contraction adds the final top-up.'),
  (11,'Preload is best described as:','Resistance the ventricle pumps against','Ventricular wall stretch at end-diastole','Force of contraction independent of stretch','Pressure in the aorta during systole','B','Preload is end-diastolic stretch; the resistance term is afterload.'),
  (12,'The Frank-Starling law states that:','Contraction force falls as fibre length rises','Contraction force rises with end-diastolic fibre length','Heart rate rises with venous return only','Afterload determines stroke volume alone','B','Greater filling stretches the fibres and yields a stronger contraction, matching output to venous return.'),
  (13,'Sympathetic stimulation of the heart mainly acts on which receptors?','Beta-1 adrenergic','Beta-2 adrenergic','Muscarinic M2','Alpha-1 adrenergic','A','Cardiac beta-1 receptors raise rate and contractility; M2 receptors carry the vagal slowing effect.'),
  (14,'A prolonged QT interval increases the risk of:','Atrial fibrillation','Torsades de pointes','First-degree AV block','Sinus bradycardia','B','Delayed repolarisation predisposes to this polymorphic ventricular tachycardia.'),
  (15,'The plateau phase of the ventricular action potential is maintained by:','Sodium influx','Calcium influx','Potassium influx','Chloride efflux','B','Slow L-type calcium entry balances potassium exit, holding the plateau and lengthening the refractory period.')
),
c AS (
  INSERT INTO public.courses (id, title, year, price, category, exam_type, published, subjects_count,
                              questions_count_mid, questions_count_final, kind, university_id, show_on_home)
  VALUES ('11111111-1111-4111-8111-111111111111', 'RitaJet sample bank — Cardiac physiology', 1, 0,
          'major', 'MCQ', true, 1, 15, 0, 'questions', '11111111-1111-4111-8111-1111111111aa', true)
  RETURNING id
),
g AS (
  INSERT INTO public.subject_groups (id, course_id, name, sort_order)
  SELECT '22222222-2222-4222-8222-222222222222', c.id, 'Cardiovascular system', 0 FROM c
  RETURNING id
),
s AS (
  INSERT INTO public.subjects (id, group_id, name, sort_order, access_level)
  SELECT '33333333-3333-4333-8333-333333333333', g.id, 'Cardiac cycle & ECG', 0, 'free_public'::subject_access FROM g
  RETURNING id
),
ins_q AS (
  INSERT INTO public.questions (id, subject_id, stem, explanation, sort_order)
  SELECT ('44444444-4444-4444-8444-' || lpad(q.n::text, 12, '0'))::uuid, s.id, q.stem, q.why, q.n
  FROM q CROSS JOIN s
  RETURNING id, sort_order
)
INSERT INTO public.question_options (question_id, label, text, is_correct, sort_order)
SELECT ins_q.id, o.label, o.text, o.label = q.correct, o.ord
FROM ins_q
JOIN q ON q.n = ins_q.sort_order
CROSS JOIN LATERAL (VALUES ('A', q.a, 0), ('B', q.b, 1), ('C', q.c, 2), ('D', q.d, 3)) AS o(label, text, ord);

-- 3) Lecture Lab shared example (same material)
WITH q(n, stem, a, b, c, d, correct, why) AS (
  VALUES
  (1,'Which valve closes at the start of ventricular systole?','Mitral valve','Aortic valve','Pulmonary valve','Tricuspid valve only','A','Rising ventricular pressure shuts the mitral valve first, producing S1. The aortic valve opens here instead.'),
  (2,'The first heart sound (S1) is produced by closure of which valves?','Aortic and pulmonary','Mitral and tricuspid','Mitral and aortic','Tricuspid and pulmonary','B','S1 is atrioventricular valve closure; the semilunar valves make S2.'),
  (3,'During isovolumetric contraction, ventricular volume is:','Rising','Falling','Unchanged','Equal to stroke volume','C','All valves are shut, so pressure rises with no volume change.'),
  (4,'The P wave of the ECG represents:','Atrial depolarisation','Atrial repolarisation','Ventricular depolarisation','Ventricular repolarisation','A','Atrial repolarisation hides inside the QRS complex.'),
  (5,'A normal PR interval lasts about:','0.04-0.08 s','0.12-0.20 s','0.25-0.35 s','0.40-0.50 s','B','Above 0.20 s means first-degree AV block.'),
  (6,'The pacemaker of the healthy heart is the:','AV node','Bundle of His','Sinoatrial node','Purkinje fibres','C','The SA node has the fastest intrinsic rate, so it leads.'),
  (7,'Stroke volume equals:','End-diastolic volume minus end-systolic volume','End-systolic volume minus end-diastolic volume','Cardiac output times heart rate','Ejection fraction times heart rate','A','Ejected volume = filled volume minus what remains.'),
  (8,'Cardiac output is calculated as:','Heart rate divided by stroke volume','Stroke volume divided by heart rate','Heart rate times stroke volume','Stroke volume times ejection fraction','C','Beats per minute multiplied by volume per beat.'),
  (9,'The dicrotic notch is caused by:','Mitral valve opening','Aortic valve closure','Atrial contraction','Pulmonary valve opening','B','A brief backflow against the closing aortic valve marks the notch.'),
  (10,'Most ventricular filling occurs:','During atrial contraction','Passively in early diastole','During isovolumetric relaxation','During ejection','B','Passive filling supplies roughly three quarters of the volume.'),
  (11,'Preload is best described as:','Resistance pumped against','Ventricular stretch at end-diastole','Contractility independent of stretch','Aortic systolic pressure','B','Resistance pumped against is afterload, not preload.'),
  (12,'The Frank-Starling law states that:','Force falls as fibre length rises','Force rises with end-diastolic fibre length','Rate rises with venous return only','Afterload alone sets stroke volume','B','More stretch gives a stronger beat, matching output to venous return.'),
  (13,'Sympathetic drive to the heart acts mainly on:','Beta-1 receptors','Beta-2 receptors','Muscarinic M2 receptors','Alpha-1 receptors','A','Beta-1 raises rate and contractility; M2 carries vagal slowing.'),
  (14,'A prolonged QT interval risks:','Atrial fibrillation','Torsades de pointes','First-degree AV block','Sinus bradycardia','B','Delayed repolarisation triggers this polymorphic VT.'),
  (15,'The action potential plateau is held by:','Sodium influx','Calcium influx','Potassium influx','Chloride efflux','B','Slow calcium entry offsets potassium exit during the plateau.')
),
sub AS (
  INSERT INTO public.lq_subjects (id, user_id, name, sort_order, is_example)
  VALUES ('55555555-5555-4555-8555-555555555555', '79ce765f-5323-48c1-8fe3-51eb56b32755', 'RitaJet examples', 0, true)
  RETURNING id
),
top AS (
  INSERT INTO public.lq_subtopics (id, user_id, subject_id, name, sort_order, is_example)
  SELECT '66666666-6666-4666-8666-666666666666', '79ce765f-5323-48c1-8fe3-51eb56b32755', sub.id, 'Cardiac physiology', 0, true FROM sub
  RETURNING id
),
lec AS (
  INSERT INTO public.lq_lectures (id, user_id, subtopic_id, title, source_name, difficulty, key_points, question_count, is_example)
  SELECT '77777777-7777-4777-8777-777777777777', '79ce765f-5323-48c1-8fe3-51eb56b32755', top.id,
         'Sample lecture — the cardiac cycle', 'RitaJet sample', 'mixed',
         '["The cardiac cycle alternates systole and diastole about once a second at rest.","S1 is AV valve closure; S2 is semilunar valve closure.","Isovolumetric phases happen with all four valves shut.","The SA node sets the rhythm; the AV node delays conduction.","P wave = atrial depolarisation, QRS = ventricular depolarisation, T wave = ventricular repolarisation.","Stroke volume = end-diastolic minus end-systolic volume.","Cardiac output = heart rate x stroke volume.","Frank-Starling: more filling gives a stronger beat.","Beta-1 stimulation raises rate and force; vagal M2 slows the heart.","The calcium plateau keeps the ventricle refractory during ejection."]'::jsonb,
         15, true
  FROM top
  RETURNING id
)
INSERT INTO public.lq_questions (user_id, lecture_id, stem, options, explanation, point_ref, sort_order)
SELECT '79ce765f-5323-48c1-8fe3-51eb56b32755', lec.id, q.stem,
       jsonb_build_array(
         jsonb_build_object('letter','A','body',q.a,'is_correct', q.correct = 'A'),
         jsonb_build_object('letter','B','body',q.b,'is_correct', q.correct = 'B'),
         jsonb_build_object('letter','C','body',q.c,'is_correct', q.correct = 'C'),
         jsonb_build_object('letter','D','body',q.d,'is_correct', q.correct = 'D')
       ),
       q.why, 'Cardiac cycle', q.n
FROM q CROSS JOIN lec;

-- <<< 20260908222126_aa295fc0-be7b-4e44-bb6a-8630fc12f72f.sql


-- >>> 20260908222447_16ed8e42-67db-4149-837e-8ba62225f17d.sql
GRANT EXECUTE ON FUNCTION public.get_subject_question_counts(uuid[]) TO anon;
-- <<< 20260908222447_16ed8e42-67db-4149-837e-8ba62225f17d.sql


-- >>> 20260908224831_bf3aca0c-ef1c-4179-aa44-8e3c42941651.sql
CREATE POLICY "avatars_read_authenticated" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_update_own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text) WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_delete_own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
-- <<< 20260908224831_bf3aca0c-ef1c-4179-aa44-8e3c42941651.sql


-- >>> 20260909011534_84e7580f-a831-4b9c-85d9-ede7ba12a4db.sql
DROP POLICY IF EXISTS "courses readable" ON public.courses;
DROP POLICY IF EXISTS "subjects readable" ON public.subjects;

DROP POLICY IF EXISTS "Published subject outlines are visible" ON public.subjects;
CREATE POLICY "Published subject outlines are visible"
ON public.subjects
FOR SELECT
TO anon, authenticated
USING (
  owner_user_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.subject_groups sg
    JOIN public.courses c ON c.id = sg.course_id
    WHERE sg.id = subjects.group_id
      AND c.published = true
      AND c.admin_only = false
  )
);
-- <<< 20260909011534_84e7580f-a831-4b9c-85d9-ede7ba12a4db.sql


-- >>> 20260909011742_0ccaa847-003a-404a-af7f-932f6680c076.sql
DROP POLICY IF EXISTS "events insert" ON public.announcement_events;

CREATE POLICY "Anonymous visitors can record anonymous events"
ON public.announcement_events
FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);

CREATE POLICY "Members can record their own events"
ON public.announcement_events
FOR INSERT
TO authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());
-- <<< 20260909011742_0ccaa847-003a-404a-af7f-932f6680c076.sql


-- >>> 20260909134851_bd030b2e-73f3-4856-8557-e0d2f2c41dd8.sql
-- 1. Keep only the rheumatic fever sample questions
DELETE FROM public.questions
WHERE subject_id = '33333333-3333-4333-8333-333333333333'
  AND stem NOT ILIKE '%rheumatic%'
  AND stem NOT ILIKE '%sore throat%';

-- 2. Rename the sample bank
UPDATE public.courses SET title = 'RitaJet sample bank — Rheumatic fever'
  WHERE id = '11111111-1111-4111-8111-111111111111';
UPDATE public.subject_groups SET name = 'Rheumatic fever'
  WHERE id = '22222222-2222-4222-8222-222222222222';
UPDATE public.subjects
   SET name = 'Rheumatic fever — shared example', access_level = 'free_public'
  WHERE id = '33333333-3333-4333-8333-333333333333';

-- 3. Rita 3.8 is gone from plans
ALTER TABLE public.plans DROP COLUMN IF EXISTS feature_rita38;
ALTER TABLE public.plans DROP COLUMN IF EXISTS max_rita_questions;

-- 4. Every paid plan gets unlimited flashcards
UPDATE public.plans SET max_flashcards = NULL WHERE price_cents >= 500;

-- 5. Free toolkit code
INSERT INTO public.toolkit_codes (code, plan_slug, label, max_uses, is_active)
VALUES ('AquaQbank', 'toolkit', 'AquaQbank — free toolkit', NULL, true)
ON CONFLICT (code) DO UPDATE
  SET plan_slug = EXCLUDED.plan_slug,
      label = EXCLUDED.label,
      max_uses = NULL,
      expires_at = NULL,
      is_active = true;
-- <<< 20260909134851_bd030b2e-73f3-4856-8557-e0d2f2c41dd8.sql


-- >>> 20260909135008_cbe1424b-1641-4c35-87f7-03efd6b4c303.sql
CREATE OR REPLACE FUNCTION public.effective_plan(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _slug text;
  _base public.plans%ROWTYPE;
  _op public.plans%ROWTYPE;
  _claim public.toolkit_claims%ROWTYPE;
  _out jsonb;
BEGIN
  SELECT plan_slug INTO _slug FROM public.user_plans WHERE user_id = _user_id;
  IF _slug IS NULL THEN _slug := 'starter'; END IF;
  SELECT * INTO _base FROM public.plans WHERE slug = _slug;
  IF _base.slug IS NULL THEN
    SELECT * INTO _base FROM public.plans WHERE published ORDER BY sort LIMIT 1;
  END IF;
  _out := to_jsonb(_base);

  SELECT c.* INTO _claim FROM public.toolkit_claims c
   WHERE c.user_id = _user_id
     AND (c.expires_at IS NULL OR c.expires_at > now())
     AND c.offer_id IS NOT NULL
   ORDER BY c.created_at DESC LIMIT 1;

  IF _claim.id IS NOT NULL THEN
    SELECT * INTO _op FROM public.plans WHERE slug = _claim.plan_slug;
    IF _op.slug IS NOT NULL THEN
      _out := _out || jsonb_build_object(
        'name', _base.name || ' + ' || _op.name,
        'max_flashcards',           public.merge_cap(_base.max_flashcards, _op.max_flashcards),
        'max_ai_questions',         public.merge_cap(_base.max_ai_questions, _op.max_ai_questions),
        'max_summaries',            public.merge_cap(_base.max_summaries, _op.max_summaries),
        'max_todo_tasks',           public.merge_cap(_base.max_todo_tasks, _op.max_todo_tasks),
        'max_calendar_items',       public.merge_cap(_base.max_calendar_items, _op.max_calendar_items),
        'max_groups',               public.merge_cap(_base.max_groups, _op.max_groups),
        'max_all_in_one_lectures',  public.merge_cap(_base.max_all_in_one_lectures, _op.max_all_in_one_lectures),
        'max_all_in_one_questions', public.merge_cap(_base.max_all_in_one_questions, _op.max_all_in_one_questions),
        'max_archive_questions',    public.merge_cap(_base.max_archive_questions, _op.max_archive_questions),
        'todo_full',             _base.todo_full OR _op.todo_full,
        'rich_cards',            _base.rich_cards OR _op.rich_cards,
        'feature_lecture_qgen',  _base.feature_lecture_qgen OR _op.feature_lecture_qgen,
        'feature_archive_qgen',  _base.feature_archive_qgen OR _op.feature_archive_qgen,
        'feature_all_in_one',    _base.feature_all_in_one OR _op.feature_all_in_one,
        'offer_name', _op.name,
        'offer_plan_slug', _op.slug,
        'offer_expires_at', _claim.expires_at
      );
    END IF;
  END IF;

  RETURN _out;
END;
$function$;

CREATE OR REPLACE FUNCTION public.my_plan_usage()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _plan jsonb;
  _usage public.usage_counters%ROWTYPE;
  _admin boolean;
  _g jsonb;
  _exp timestamptz;
BEGIN
  IF _uid IS NULL THEN RETURN NULL; END IF;

  _admin := public.has_role(_uid, 'admin');
  _plan := public.effective_plan(_uid);

  SELECT * INTO _usage FROM public.usage_counters WHERE user_id = _uid AND period = 'lifetime';

  SELECT jsonb_build_object(
    'summaries', COALESCE(SUM(summaries),0),
    'ai_questions', COALESCE(SUM(ai_questions),0),
    'flashcards', COALESCE(SUM(flashcards),0),
    'todo_tasks', COALESCE(SUM(todo_tasks),0),
    'calendar_items', COALESCE(SUM(calendar_items),0),
    'all_in_one_lectures', COALESCE(SUM(all_in_one_lectures),0),
    'all_in_one_questions', COALESCE(SUM(all_in_one_questions),0),
    'archive_questions', COALESCE(SUM(archive_questions),0),
    'groups', COALESCE(SUM(groups),0)
  ) INTO _g
  FROM public.plan_credit_grants
  WHERE user_id = _uid AND (expires_at IS NULL OR expires_at > now());

  SELECT max(c.expires_at) INTO _exp FROM public.toolkit_claims c
   WHERE c.user_id = _uid AND c.expires_at IS NOT NULL AND c.expires_at > now();

  RETURN jsonb_build_object(
    'plan', _plan,
    'grants', COALESCE(_g, '{}'::jsonb),
    'offer_expires_at', _exp,
    'offer_name', _plan->>'offer_name',
    'usage', jsonb_build_object(
      'summaries', COALESCE(_usage.summaries, 0),
      'ai_questions', COALESCE(_usage.ai_questions, 0),
      'flashcards', COALESCE(_usage.flashcards, 0),
      'todo_tasks', COALESCE(_usage.todo_tasks, 0),
      'calendar_items', COALESCE(_usage.calendar_items, 0),
      'all_in_one_lectures', COALESCE(_usage.all_in_one_lectures, 0),
      'all_in_one_questions', COALESCE(_usage.all_in_one_questions, 0),
      'archive_questions', COALESCE(_usage.archive_questions, 0),
      'groups', COALESCE(_usage.groups, 0)
    ),
    'is_admin', _admin
  );
END;
$function$;
-- <<< 20260909135008_cbe1424b-1641-4c35-87f7-03efd6b4c303.sql


-- >>> 20260909142731_ccd534ce-2a02-474e-b32e-91bdf8ad8314.sql
REVOKE ALL ON FUNCTION public.identity_taken(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.identity_taken(text, text) TO anon, authenticated, service_role;
-- <<< 20260909142731_ccd534ce-2a02-474e-b32e-91bdf8ad8314.sql


-- >>> 20260909142804_3c6f5600-0b50-4787-8e6e-e7e18ba79253.sql
REVOKE ALL ON FUNCTION public.identity_taken(text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.identity_taken(text, text) TO service_role;
-- <<< 20260909142804_3c6f5600-0b50-4787-8e6e-e7e18ba79253.sql


-- >>> 20260909144239_f909d7cc-0af9-4894-b4c9-f6748a0f66f1.sql
DROP FUNCTION IF EXISTS public.identity_taken(text, text);
-- <<< 20260909144239_f909d7cc-0af9-4894-b4c9-f6748a0f66f1.sql


-- >>> 20260909205340_317fb4af-308c-4231-b0dd-d9ca57faaf31.sql
CREATE TABLE public.shared_question_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  cover text NOT NULL DEFAULT 'sky',
  emoji text,
  tags text[] NOT NULL DEFAULT '{}',
  question_count integer NOT NULL DEFAULT 0,
  save_count integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  audience text NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.shared_question_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id uuid NOT NULL REFERENCES public.shared_question_sets(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  stem text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation text NOT NULL DEFAULT '',
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.space_question_sets (
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  set_id uuid NOT NULL REFERENCES public.shared_question_sets(id) ON DELETE CASCADE,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, set_id)
);

CREATE INDEX shared_question_sets_feed_idx
  ON public.shared_question_sets (audience, published, created_at DESC);
CREATE INDEX shared_question_sets_top_idx
  ON public.shared_question_sets (audience, published, save_count DESC);
CREATE INDEX shared_question_sets_owner_idx ON public.shared_question_sets (owner_id, created_at DESC);
CREATE INDEX shared_question_items_set_idx ON public.shared_question_items (set_id, sort);
CREATE INDEX space_question_sets_set_idx ON public.space_question_sets (set_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_question_sets TO authenticated;
GRANT ALL ON public.shared_question_sets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_question_items TO authenticated;
GRANT ALL ON public.shared_question_items TO service_role;
GRANT SELECT, INSERT, DELETE ON public.space_question_sets TO authenticated;
GRANT ALL ON public.space_question_sets TO service_role;

ALTER TABLE public.shared_question_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_question_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_question_sets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_read_question_set(_set_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shared_question_sets s
    WHERE s.id = _set_id
      AND (
        s.owner_id = _user_id
        OR (s.published AND s.audience = 'public')
        OR EXISTS (
          SELECT 1 FROM public.space_question_sets q
          WHERE q.set_id = s.id AND public.is_space_member(q.space_id, _user_id)
        )
      )
  )
$$;

CREATE POLICY "own question sets" ON public.shared_question_sets
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "read public question sets" ON public.shared_question_sets
  FOR SELECT TO authenticated
  USING (published AND audience = 'public');

CREATE POLICY "read space question sets" ON public.shared_question_sets
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.space_question_sets q
    WHERE q.set_id = shared_question_sets.id AND public.is_space_member(q.space_id, auth.uid())
  ));

CREATE POLICY "own question items" ON public.shared_question_items
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "read shared question items" ON public.shared_question_items
  FOR SELECT TO authenticated
  USING (public.can_read_question_set(set_id, auth.uid()));

CREATE POLICY "members read space question sets" ON public.space_question_sets
  FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));

CREATE POLICY "members add space question sets" ON public.space_question_sets
  FOR INSERT TO authenticated
  WITH CHECK (public.space_can_add_decks(space_id, auth.uid()));

CREATE POLICY "remove space question sets" ON public.space_question_sets
  FOR DELETE TO authenticated
  USING (added_by = auth.uid() OR public.can_manage_space(space_id, auth.uid()));

CREATE TRIGGER shared_question_sets_touch
  BEFORE UPDATE ON public.shared_question_sets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
-- <<< 20260909205340_317fb4af-308c-4231-b0dd-d9ca57faaf31.sql


-- >>> 20260909215723_5d7d44c0-8d02-45da-bbdc-64de6da4a0a4.sql
update public.plans set paddle_price_monthly = 'study_monthly', paddle_price_yearly = 'study_yearly' where slug = 'study';
-- <<< 20260909215723_5d7d44c0-8d02-45da-bbdc-64de6da4a0a4.sql


-- >>> 20260909235022_0b78e2c7-341e-408a-8b72-4cd43f42b4fe.sql
DROP TABLE IF EXISTS public.space_question_sets CASCADE;
DROP TABLE IF EXISTS public.shared_question_items CASCADE;
DROP TABLE IF EXISTS public.shared_question_sets CASCADE;
DROP FUNCTION IF EXISTS public.can_read_question_set(uuid, uuid);
-- <<< 20260909235022_0b78e2c7-341e-408a-8b72-4cd43f42b4fe.sql


-- >>> 20260910152751_58055134-ff74-4b62-bade-109ca23e40db.sql
CREATE TABLE public.manual_plan_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_slug text NOT NULL REFERENCES public.plans(slug) ON UPDATE CASCADE ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  reason text NOT NULL DEFAULT '',
  overrides_paid boolean NOT NULL DEFAULT true,
  granted_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  revoke_reason text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT manual_plan_grants_valid_window CHECK (expires_at IS NULL OR expires_at > starts_at),
  CONSTRAINT manual_plan_grants_reason_length CHECK (char_length(reason) <= 500),
  CONSTRAINT manual_plan_grants_revoke_reason_length CHECK (revoke_reason IS NULL OR char_length(revoke_reason) <= 500)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_plan_grants TO authenticated;
GRANT ALL ON public.manual_plan_grants TO service_role;
ALTER TABLE public.manual_plan_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students view own manual access" ON public.manual_plan_grants FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins create manual access" ON public.manual_plan_grants FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND granted_by = auth.uid());
CREATE POLICY "Admins update manual access" ON public.manual_plan_grants FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete manual access" ON public.manual_plan_grants FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX manual_plan_grants_user_active_idx ON public.manual_plan_grants (user_id, starts_at DESC, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX manual_plan_grants_admin_history_idx ON public.manual_plan_grants (granted_at DESC);
CREATE OR REPLACE FUNCTION public.touch_manual_plan_grant_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER touch_manual_plan_grants BEFORE UPDATE ON public.manual_plan_grants FOR EACH ROW EXECUTE FUNCTION public.touch_manual_plan_grant_updated_at();
CREATE OR REPLACE FUNCTION public.effective_plan_slug(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH active_manual AS (
    SELECT mpg.plan_slug, mpg.overrides_paid, mpg.granted_at
    FROM public.manual_plan_grants mpg
    WHERE mpg.user_id = _user_id
      AND mpg.revoked_at IS NULL
      AND mpg.starts_at <= now()
      AND (mpg.expires_at IS NULL OR mpg.expires_at > now())
    ORDER BY mpg.overrides_paid DESC, mpg.granted_at DESC
    LIMIT 1
  )
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM active_manual WHERE overrides_paid) THEN (SELECT plan_slug FROM active_manual)
    ELSE COALESCE((SELECT up.plan_slug FROM public.user_plans up WHERE up.user_id = _user_id), (SELECT plan_slug FROM active_manual), 'starter')
  END;
$$;
REVOKE ALL ON FUNCTION public.effective_plan_slug(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.effective_plan_slug(uuid) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.effective_plan(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _slug text;
  _base public.plans%ROWTYPE;
  _op public.plans%ROWTYPE;
  _claim public.toolkit_claims%ROWTYPE;
  _out jsonb;
BEGIN
  _slug := public.effective_plan_slug(_user_id);
  SELECT * INTO _base FROM public.plans WHERE slug = _slug;
  IF _base.slug IS NULL THEN SELECT * INTO _base FROM public.plans WHERE published ORDER BY sort LIMIT 1; END IF;
  _out := to_jsonb(_base);
  SELECT c.* INTO _claim FROM public.toolkit_claims c WHERE c.user_id = _user_id AND (c.expires_at IS NULL OR c.expires_at > now()) AND c.offer_id IS NOT NULL ORDER BY c.created_at DESC LIMIT 1;
  IF _claim.id IS NOT NULL THEN
    SELECT * INTO _op FROM public.plans WHERE slug = _claim.plan_slug;
    IF _op.slug IS NOT NULL THEN
      _out := _out || jsonb_build_object(
        'name', _base.name || ' + ' || _op.name,
        'max_flashcards', public.merge_cap(_base.max_flashcards, _op.max_flashcards),
        'max_ai_questions', public.merge_cap(_base.max_ai_questions, _op.max_ai_questions),
        'max_summaries', public.merge_cap(_base.max_summaries, _op.max_summaries),
        'max_todo_tasks', public.merge_cap(_base.max_todo_tasks, _op.max_todo_tasks),
        'max_calendar_items', public.merge_cap(_base.max_calendar_items, _op.max_calendar_items),
        'max_groups', public.merge_cap(_base.max_groups, _op.max_groups),
        'max_all_in_one_lectures', public.merge_cap(_base.max_all_in_one_lectures, _op.max_all_in_one_lectures),
        'max_all_in_one_questions', public.merge_cap(_base.max_all_in_one_questions, _op.max_all_in_one_questions),
        'max_archive_questions', public.merge_cap(_base.max_archive_questions, _op.max_archive_questions),
        'max_rita_questions', public.merge_cap(_base.max_rita_questions, _op.max_rita_questions),
        'todo_full', _base.todo_full OR _op.todo_full,
        'rich_cards', _base.rich_cards OR _op.rich_cards,
        'feature_lecture_qgen', _base.feature_lecture_qgen OR _op.feature_lecture_qgen,
        'feature_archive_qgen', _base.feature_archive_qgen OR _op.feature_archive_qgen,
        'feature_all_in_one', _base.feature_all_in_one OR _op.feature_all_in_one,
        'feature_rita38', _base.feature_rita38 OR _op.feature_rita38,
        'offer_name', _op.name,
        'offer_plan_slug', _op.slug,
        'offer_expires_at', _claim.expires_at
      );
    END IF;
  END IF;
  RETURN _out;
END;
$$;
-- <<< 20260910152751_58055134-ff74-4b62-bade-109ca23e40db.sql


-- >>> 20260910152822_128cb193-9101-424f-b8f7-f829971bad08.sql
REVOKE ALL ON FUNCTION public.effective_plan_slug(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.effective_plan_slug(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.effective_plan(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.effective_plan(uuid) TO service_role;
-- <<< 20260910152822_128cb193-9101-424f-b8f7-f829971bad08.sql


-- >>> 20260910220933_899c7d81-6740-4fdb-95d1-56ddc8c3270c.sql
-- 1. Lock down SECURITY DEFINER helpers not meant for direct client calls
REVOKE EXECUTE ON FUNCTION public.bump_usage(uuid, text, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.vault_tables() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_lq_default_bucket() FROM anon;

-- 2. Public counts should respect RLS instead of bypassing it
ALTER FUNCTION public.get_subject_question_counts(uuid[]) SECURITY INVOKER;

-- 3. Avatars: remove anonymous read of a private bucket (authenticated policy stays)
DROP POLICY IF EXISTS "avatars are viewable" ON storage.objects;

-- 4. public_profiles: scope authenticated reads
DROP POLICY IF EXISTS "profiles readable by members" ON public.public_profiles;
CREATE POLICY "profiles readable in context"
ON public.public_profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.shared_decks d
    WHERE d.owner_id = public_profiles.id AND d.published = true
  )
  OR EXISTS (
    SELECT 1 FROM public.space_members me
    JOIN public.space_members them ON them.space_id = me.space_id
    WHERE me.user_id = auth.uid() AND them.user_id = public_profiles.id
  )
);
-- <<< 20260910220933_899c7d81-6740-4fdb-95d1-56ddc8c3270c.sql


-- >>> 20260910221101_b4da4217-4b1e-4f15-a75f-c0a62bbb1d10.sql
DROP POLICY IF EXISTS "site-media readable" ON storage.objects;

CREATE POLICY "site-media published readable"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'site-media'
  AND (
    EXISTS (SELECT 1 FROM public.site_images si WHERE si.path = storage.objects.name)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);
-- <<< 20260910221101_b4da4217-4b1e-4f15-a75f-c0a62bbb1d10.sql


-- >>> 20260910221119_90959727-fb36-44fe-9d4c-8fdc029708c6.sql
REVOKE EXECUTE ON FUNCTION public.ensure_lq_default_bucket() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_lq_default_bucket() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.bump_usage(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_usage(uuid, text, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.vault_tables() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vault_tables() TO service_role;
-- <<< 20260910221119_90959727-fb36-44fe-9d4c-8fdc029708c6.sql


-- >>> 20260911002516_befb5849-a5a7-4e0d-8321-762cf941c353.sql
UPDATE public.site_images SET path = CASE key WHEN 'home.ipad' THEN 'https://ritajet.com/__l5e/assets-v1/e715e252-b093-484d-98d9-8e3144845769/home-ipad-restored.webp' WHEN 'home.product.plans' THEN 'https://ritajet.com/__l5e/assets-v1/026ce4c2-d905-41b1-be18-2947c9348410/home-plans-restored.webp' WHEN 'home.product.toolkit' THEN 'https://ritajet.com/__l5e/assets-v1/ad926651-d59e-4c48-88bd-52249477742f/home-toolkit-restored.webp' END WHERE key IN ('home.ipad','home.product.plans','home.product.toolkit');
-- <<< 20260911002516_befb5849-a5a7-4e0d-8321-762cf941c353.sql


-- >>> 20260911053000_activate_user_plan.sql
-- Helper function to activate or change a user's plan securely
CREATE OR REPLACE FUNCTION public.activate_user_plan(_user_id uuid, _plan_slug text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.plans WHERE slug = _plan_slug) THEN
    RAISE EXCEPTION 'Plan with slug % does not exist', _plan_slug;
  END IF;

  INSERT INTO public.user_plans (user_id, plan_slug, updated_at)
  VALUES (_user_id, _plan_slug, now())
  ON CONFLICT (user_id)
  DO UPDATE SET plan_slug = EXCLUDED.plan_slug, updated_at = now();

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_user_plan(uuid, text) TO authenticated, service_role;

-- Helper function to cancel user's subscription at period end securely
CREATE OR REPLACE FUNCTION public.cancel_user_subscription(_user_id uuid, _paddle_sub_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.subscriptions
  SET cancel_at_period_end = true, updated_at = now()
  WHERE user_id = _user_id AND paddle_subscription_id = _paddle_sub_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_user_subscription(uuid, text) TO authenticated, service_role;

-- <<< 20260911053000_activate_user_plan.sql


-- >>> 20260911060000_customer_payment_methods.sql
-- Create customer_payment_methods table to store saved cards for accounts
CREATE TABLE IF NOT EXISTS public.customer_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  paddle_customer_id text,
  paddle_payment_method_id text,
  card_brand text NOT NULL DEFAULT 'card',
  card_last4 text NOT NULL,
  card_exp_month integer,
  card_exp_year integer,
  cardholder_name text,
  is_default boolean DEFAULT true,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_payment_methods_user_id ON public.customer_payment_methods(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_payment_methods TO authenticated, service_role;
ALTER TABLE public.customer_payment_methods ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users view their own payment methods"
    ON public.customer_payment_methods FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users manage their own payment methods"
    ON public.customer_payment_methods FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RPC helper to atomically remove card and cancel auto-renew
CREATE OR REPLACE FUNCTION public.remove_user_card_and_cancel_auto_renew(_user_id uuid, _card_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark any active subscriptions for this user as cancel_at_period_end
  UPDATE public.subscriptions
  SET cancel_at_period_end = true, updated_at = now()
  WHERE user_id = _user_id;

  -- Delete the card from user account
  DELETE FROM public.customer_payment_methods
  WHERE id = _card_id AND user_id = _user_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_user_card_and_cancel_auto_renew(uuid, uuid) TO authenticated, service_role;

-- <<< 20260911060000_customer_payment_methods.sql


-- >>> 20260911073000_promo_redemptions.sql
-- Migration: Create promo_code_redemptions table to track promo code usage per user
CREATE TABLE IF NOT EXISTS public.promo_code_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL,
  plan_slug text NOT NULL,
  billing text NOT NULL DEFAULT 'three_months',
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promo_code_redemptions_user_code_uniq UNIQUE (user_id, code)
);

CREATE INDEX IF NOT EXISTS idx_promo_code_redemptions_user_code
  ON public.promo_code_redemptions (user_id, code);

GRANT SELECT, INSERT ON public.promo_code_redemptions TO authenticated, service_role;
ALTER TABLE public.promo_code_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own promo redemptions" ON public.promo_code_redemptions;
CREATE POLICY "Users read own promo redemptions"
  ON public.promo_code_redemptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users insert own promo redemptions" ON public.promo_code_redemptions;
CREATE POLICY "Users insert own promo redemptions"
  ON public.promo_code_redemptions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Ensure toolkit_claims has expires_at column for /my-plan countdown timer
ALTER TABLE public.toolkit_claims ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- <<< 20260911073000_promo_redemptions.sql


-- >>> 20260911084500_device_limit_and_question_sharing.sql
-- 1. Device Limit update to 50 devices & unlock affected accounts
UPDATE public.device_security_settings
  SET default_device_limit = 50
  WHERE id = true;

UPDATE public.profiles
  SET device_limit = 50
  WHERE device_limit IS NOT NULL AND device_limit < 50;

UPDATE public.profiles
  SET locked_at = NULL, lock_reason = NULL
  WHERE lock_reason = 'device_limit';

-- 2. Shared Question Sets
CREATE TABLE IF NOT EXISTS public.shared_question_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  source_type text NOT NULL DEFAULT 'lecture', -- 'bank' | 'archive' | 'lecture'
  subject text,
  cover text NOT NULL DEFAULT 'sky',
  emoji text,
  tags text[] NOT NULL DEFAULT '{}',
  question_count integer NOT NULL DEFAULT 0,
  save_count integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  audience text NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Shared Question Items
CREATE TABLE IF NOT EXISTS public.shared_question_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id uuid NOT NULL REFERENCES public.shared_question_sets(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  source_type text NOT NULL DEFAULT 'lecture',
  subject text,
  subtopic text,
  stem text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation text NOT NULL DEFAULT '',
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Space Question Sets join table
CREATE TABLE IF NOT EXISTS public.space_question_sets (
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  set_id uuid NOT NULL REFERENCES public.shared_question_sets(id) ON DELETE CASCADE,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, set_id)
);

-- 5. Shared Question Saves table
CREATE TABLE IF NOT EXISTS public.shared_question_saves (
  set_id uuid NOT NULL REFERENCES public.shared_question_sets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (set_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS shared_question_sets_feed_idx
  ON public.shared_question_sets (audience, published, created_at DESC);
CREATE INDEX IF NOT EXISTS shared_question_sets_top_idx
  ON public.shared_question_sets (audience, published, save_count DESC);
CREATE INDEX IF NOT EXISTS shared_question_sets_owner_idx
  ON public.shared_question_sets (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shared_question_sets_source_idx
  ON public.shared_question_sets (source_type);
CREATE INDEX IF NOT EXISTS shared_question_items_set_idx
  ON public.shared_question_items (set_id, sort);
CREATE INDEX IF NOT EXISTS space_question_sets_set_idx
  ON public.space_question_sets (set_id);

-- Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_question_sets TO authenticated;
GRANT ALL ON public.shared_question_sets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_question_items TO authenticated;
GRANT ALL ON public.shared_question_items TO service_role;
GRANT SELECT, INSERT, DELETE ON public.space_question_sets TO authenticated;
GRANT ALL ON public.space_question_sets TO service_role;
GRANT SELECT, INSERT, DELETE ON public.shared_question_saves TO authenticated;
GRANT ALL ON public.shared_question_saves TO service_role;

-- Enable RLS
ALTER TABLE public.shared_question_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_question_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_question_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_question_saves ENABLE ROW LEVEL SECURITY;

-- Helper function to check read permission
CREATE OR REPLACE FUNCTION public.can_read_question_set(_set_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shared_question_sets s
    WHERE s.id = _set_id
      AND (
        s.owner_id = _user_id
        OR (s.published AND s.audience = 'public')
        OR EXISTS (
          SELECT 1 FROM public.space_question_sets q
          WHERE q.set_id = s.id AND public.is_space_member(q.space_id, _user_id)
        )
      )
  )
$$;

-- RLS Policies
DROP POLICY IF EXISTS "own question sets" ON public.shared_question_sets;
CREATE POLICY "own question sets" ON public.shared_question_sets
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "read public question sets" ON public.shared_question_sets;
CREATE POLICY "read public question sets" ON public.shared_question_sets
  FOR SELECT TO authenticated
  USING (published AND audience = 'public');

DROP POLICY IF EXISTS "read space question sets" ON public.shared_question_sets;
CREATE POLICY "read space question sets" ON public.shared_question_sets
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.space_question_sets q
    WHERE q.set_id = shared_question_sets.id AND public.is_space_member(q.space_id, auth.uid())
  ));

DROP POLICY IF EXISTS "own question items" ON public.shared_question_items;
CREATE POLICY "own question items" ON public.shared_question_items
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "read shared question items" ON public.shared_question_items;
CREATE POLICY "read shared question items" ON public.shared_question_items
  FOR SELECT TO authenticated
  USING (public.can_read_question_set(set_id, auth.uid()));

DROP POLICY IF EXISTS "members read space question sets" ON public.space_question_sets;
CREATE POLICY "members read space question sets" ON public.space_question_sets
  FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));

DROP POLICY IF EXISTS "members add space question sets" ON public.space_question_sets;
CREATE POLICY "members add space question sets" ON public.space_question_sets
  FOR INSERT TO authenticated
  WITH CHECK (public.space_can_add_decks(space_id, auth.uid()));

DROP POLICY IF EXISTS "remove space question sets" ON public.space_question_sets;
CREATE POLICY "remove space question sets" ON public.space_question_sets
  FOR DELETE TO authenticated
  USING (added_by = auth.uid() OR public.can_manage_space(space_id, auth.uid()));

DROP POLICY IF EXISTS "manage own question saves" ON public.shared_question_saves;
CREATE POLICY "manage own question saves" ON public.shared_question_saves
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Function to bump save counts
CREATE OR REPLACE FUNCTION public.bump_question_set_saves(_set_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.shared_question_sets
     SET save_count = (SELECT count(*) FROM public.shared_question_saves s WHERE s.set_id = _set_id)
   WHERE id = _set_id;
$$;
REVOKE ALL ON FUNCTION public.bump_question_set_saves(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bump_question_set_saves(uuid) TO authenticated;

-- <<< 20260911084500_device_limit_and_question_sharing.sql


-- >>> 20260911091500_sharing_scale_quota_and_ratings.sql
-- ============================================================
-- Sharing Scale, 5/Day Quota Support, Space Folders & Question Ratings
-- ============================================================

-- 1. Space Folder column on space_question_sets
ALTER TABLE public.space_question_sets
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.space_folders(id) ON DELETE SET NULL;

-- 2. Rating columns on shared_question_sets
ALTER TABLE public.shared_question_sets
  ADD COLUMN IF NOT EXISTS rating_avg numeric(3,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0;

-- 3. Question set ratings table
CREATE TABLE IF NOT EXISTS public.question_set_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id uuid NOT NULL REFERENCES public.shared_question_sets(id) ON DELETE CASCADE,
  space_id uuid REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  stars smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  note text,
  under_review boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS question_set_ratings_one_global
  ON public.question_set_ratings (user_id, set_id) WHERE space_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS question_set_ratings_one_space
  ON public.question_set_ratings (user_id, set_id, space_id) WHERE space_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS question_set_ratings_set_idx
  ON public.question_set_ratings (set_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_set_ratings TO authenticated;
GRANT ALL ON public.question_set_ratings TO service_role;
ALTER TABLE public.question_set_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own question set rating read" ON public.question_set_ratings;
CREATE POLICY "own question set rating read" ON public.question_set_ratings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "own question set rating write" ON public.question_set_ratings;
CREATE POLICY "own question set rating write" ON public.question_set_ratings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own question set rating update" ON public.question_set_ratings;
CREATE POLICY "own question set rating update" ON public.question_set_ratings FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own question set rating delete" ON public.question_set_ratings;
CREATE POLICY "own question set rating delete" ON public.question_set_ratings FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Recount trigger
CREATE OR REPLACE FUNCTION public.recount_question_set_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _set uuid;
BEGIN
  _set := COALESCE(NEW.set_id, OLD.set_id);
  UPDATE public.shared_question_sets s SET
    rating_avg = COALESCE((SELECT ROUND(AVG(r.stars)::numeric, 2) FROM public.question_set_ratings r
                            WHERE r.set_id = _set AND r.space_id IS NULL AND NOT r.under_review), 0),
    rating_count = COALESCE((SELECT COUNT(*) FROM public.question_set_ratings r
                            WHERE r.set_id = _set AND r.space_id IS NULL AND NOT r.under_review), 0)
  WHERE s.id = _set;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS question_set_ratings_recount ON public.question_set_ratings;
CREATE TRIGGER question_set_ratings_recount
AFTER INSERT OR UPDATE OR DELETE ON public.question_set_ratings
FOR EACH ROW EXECUTE FUNCTION public.recount_question_set_rating();

-- Rate a question set RPC
CREATE OR REPLACE FUNCTION public.rate_question_set(_set_id uuid, _stars smallint, _note text DEFAULT NULL, _space_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _new boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  IF _stars < 1 OR _stars > 5 THEN RAISE EXCEPTION 'stars must be 1..5'; END IF;
  IF _space_id IS NOT NULL AND NOT public.is_space_member(_space_id, _uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT (p.created_at > now() - interval '2 days') INTO _new FROM public.profiles p WHERE p.id = _uid;

  IF _space_id IS NULL THEN
    INSERT INTO public.question_set_ratings (set_id, user_id, stars, note, under_review)
    VALUES (_set_id, _uid, _stars, NULLIF(btrim(COALESCE(_note,'')),''), COALESCE(_new,false))
    ON CONFLICT (user_id, set_id) WHERE space_id IS NULL
    DO UPDATE SET stars = EXCLUDED.stars, note = EXCLUDED.note, updated_at = now();
  ELSE
    INSERT INTO public.question_set_ratings (set_id, space_id, user_id, stars, note, under_review)
    VALUES (_set_id, _space_id, _uid, _stars, NULLIF(btrim(COALESCE(_note,'')),''), COALESCE(_new,false))
    ON CONFLICT (user_id, set_id, space_id) WHERE space_id IS NOT NULL
    DO UPDATE SET stars = EXCLUDED.stars, note = EXCLUDED.note, updated_at = now();
  END IF;
END; $$;
REVOKE EXECUTE ON FUNCTION public.rate_question_set(uuid, smallint, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.rate_question_set(uuid, smallint, text, uuid) TO authenticated;

-- Rating summary RPC
CREATE OR REPLACE FUNCTION public.question_set_rating_summary(_set_id uuid, _space_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _avg numeric;
  _cnt integer;
  _mine record;
  _b jsonb;
BEGIN
  SELECT ROUND(AVG(stars)::numeric, 2), COUNT(*)
    INTO _avg, _cnt
    FROM public.question_set_ratings
   WHERE set_id = _set_id
     AND ((_space_id IS NULL AND space_id IS NULL) OR (_space_id IS NOT NULL AND space_id = _space_id))
     AND NOT under_review;

  IF _uid IS NOT NULL THEN
    SELECT stars, note INTO _mine FROM public.question_set_ratings
     WHERE set_id = _set_id
       AND user_id = _uid
       AND ((_space_id IS NULL AND space_id IS NULL) OR (_space_id IS NOT NULL AND space_id = _space_id))
     LIMIT 1;
  END IF;

  SELECT COALESCE(jsonb_object_agg(stars, c), '{}'::jsonb) INTO _b FROM (
    SELECT stars, count(*) AS c
      FROM public.question_set_ratings
     WHERE set_id = _set_id
       AND ((_space_id IS NULL AND space_id IS NULL) OR (_space_id IS NOT NULL AND space_id = _space_id))
       AND NOT under_review
     GROUP BY stars
  ) t;

  RETURN jsonb_build_object(
    'avg', COALESCE(_avg, 0),
    'count', COALESCE(_cnt, 0),
    'breakdown', COALESCE(_b, '{}'::jsonb),
    'mine', CASE WHEN _mine.stars IS NOT NULL THEN jsonb_build_object('stars', _mine.stars, 'note', _mine.note) ELSE NULL END
  );
END; $$;
REVOKE EXECUTE ON FUNCTION public.question_set_rating_summary(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.question_set_rating_summary(uuid, uuid) TO authenticated;

-- 4. High-Performance Composite Indexes for Millions of Rows
CREATE INDEX IF NOT EXISTS idx_shared_decks_pub_feed ON public.shared_decks (audience, published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_decks_pub_top ON public.shared_decks (audience, published, save_count DESC);
CREATE INDEX IF NOT EXISTS idx_shared_decks_owner_today ON public.shared_decks (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shared_question_sets_pub_feed ON public.shared_question_sets (audience, published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_question_sets_pub_top ON public.shared_question_sets (audience, published, save_count DESC);
CREATE INDEX IF NOT EXISTS idx_shared_question_sets_pub_rating ON public.shared_question_sets (audience, published, rating_avg DESC);
CREATE INDEX IF NOT EXISTS idx_shared_question_sets_source_feed ON public.shared_question_sets (source_type, audience, published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_question_sets_owner_today ON public.shared_question_sets (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_question_items_set_sort ON public.shared_question_items (set_id, sort);

-- <<< 20260911091500_sharing_scale_quota_and_ratings.sql


-- >>> 20260911183000_fix_handle_new_user_phone_and_metadata.sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_name text;
  meta_username text;
  meta_phone text;
begin
  meta_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(coalesce(new.email, ''), '@', 1)
  );

  meta_username := coalesce(
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    split_part(coalesce(new.email, ''), '@', 1),
    new.id::text
  );

  meta_phone := coalesce(
    nullif(trim(new.raw_user_meta_data->>'phone'), ''),
    new.phone
  );

  insert into public.profiles (
    id,
    display_name,
    full_name,
    username,
    email,
    phone,
    avatar_url
  )
  values (
    new.id,
    meta_name,
    meta_name,
    meta_username,
    new.email,
    meta_phone,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    full_name = coalesce(nullif(trim(excluded.full_name), ''), profiles.full_name),
    username = coalesce(nullif(trim(excluded.username), ''), profiles.username),
    phone = coalesce(nullif(trim(excluded.phone), ''), profiles.phone),
    email = coalesce(excluded.email, profiles.email),
    avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url);

  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- <<< 20260911183000_fix_handle_new_user_phone_and_metadata.sql


-- >>> 20260919140000_rita_voice_pipeline.sql
-- Cost-controlled Rita voice sessions. Only server-side service-role code writes usage.
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS rita_voice_minutes_monthly integer NOT NULL DEFAULT 0;

UPDATE public.plans
SET rita_voice_minutes_monthly = CASE slug
  WHEN 'starter' THEN 10
  WHEN 'toolkit' THEN 60
  WHEN 'boost' THEN 150
  WHEN 'pro' THEN 360
  WHEN 'ultimate' THEN 1200
  ELSE rita_voice_minutes_monthly
END;

CREATE TABLE IF NOT EXISTS public.rita_voice_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT true,
  voice text NOT NULL DEFAULT 'marin',
  response_words integer NOT NULL DEFAULT 55 CHECK (response_words BETWEEN 20 AND 120),
  daily_guard_minutes integer NOT NULL DEFAULT 120 CHECK (daily_guard_minutes BETWEEN 15 AND 720),
  default_monthly_minutes integer NOT NULL DEFAULT 1200 CHECK (default_monthly_minutes BETWEEN 30 AND 10000),
  monthly_budget_cents integer NOT NULL DEFAULT 10000 CHECK (monthly_budget_cents BETWEEN 100 AND 1000000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO public.rita_voice_settings (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.rita_voice_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.rita_voice_settings TO authenticated;
GRANT ALL ON public.rita_voice_settings TO service_role;
DROP POLICY IF EXISTS "admins manage rita voice settings" ON public.rita_voice_settings;
CREATE POLICY "admins manage rita voice settings"
  ON public.rita_voice_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.rita_voice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  personality text NOT NULL DEFAULT 'kind',
  language_preference text NOT NULL DEFAULT 'automatic',
  detected_language text,
  detected_dialect text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  client_label text
);

CREATE INDEX IF NOT EXISTS rita_voice_sessions_user_started_idx
  ON public.rita_voice_sessions (user_id, started_at DESC);
ALTER TABLE public.rita_voice_sessions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.rita_voice_sessions TO authenticated;
GRANT ALL ON public.rita_voice_sessions TO service_role;
DROP POLICY IF EXISTS "users read own rita sessions" ON public.rita_voice_sessions;
CREATE POLICY "users read own rita sessions"
  ON public.rita_voice_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.rita_voice_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.rita_voice_sessions(id) ON DELETE SET NULL,
  turn_id uuid NOT NULL DEFAULT gen_random_uuid(),
  input_audio_ms integer NOT NULL DEFAULT 0 CHECK (input_audio_ms >= 0),
  output_audio_ms integer NOT NULL DEFAULT 0 CHECK (output_audio_ms >= 0),
  input_tokens integer NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens integer NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  estimated_cost_micros integer NOT NULL DEFAULT 0 CHECK (estimated_cost_micros >= 0),
  provider text NOT NULL DEFAULT 'openai',
  transcription_model text NOT NULL DEFAULT 'gpt-4o-mini-transcribe',
  response_model text NOT NULL DEFAULT 'gpt-4o-mini',
  speech_model text NOT NULL DEFAULT 'gpt-4o-mini-tts',
  language text,
  dialect text,
  reply_sha256 text,
  premium_voice boolean NOT NULL DEFAULT true,
  speech_generated_at timestamptz,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rita_voice_usage_user_created_idx
  ON public.rita_voice_usage (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rita_voice_usage_session_idx
  ON public.rita_voice_usage (session_id);
ALTER TABLE public.rita_voice_usage ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.rita_voice_usage TO authenticated;
GRANT ALL ON public.rita_voice_usage TO service_role;
DROP POLICY IF EXISTS "users read own rita usage" ON public.rita_voice_usage;
CREATE POLICY "users read own rita usage"
  ON public.rita_voice_usage FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- <<< 20260919140000_rita_voice_pipeline.sql


-- >>> 20260919150000_rita_response_model_gpt4o_mini.sql
-- Keep Rita's recorded response model aligned with the only runtime model.
ALTER TABLE IF EXISTS public.rita_voice_usage
  ALTER COLUMN response_model SET DEFAULT 'gpt-4o-mini';

-- <<< 20260919150000_rita_response_model_gpt4o_mini.sql


-- >>> 20260921090000_rita_voice_usage_totals.sql
CREATE INDEX IF NOT EXISTS rita_voice_usage_created_idx
  ON public.rita_voice_usage (created_at DESC);

CREATE OR REPLACE FUNCTION public.rita_voice_usage_totals(_user_id uuid)
RETURNS TABLE(used_month_ms bigint, used_today_ms bigint, global_month_micros bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(input_audio_ms + output_audio_ms) FILTER (
      WHERE user_id = _user_id
        AND created_at >= date_trunc('month', now())
    ), 0)::bigint,
    COALESCE(SUM(input_audio_ms + output_audio_ms) FILTER (
      WHERE user_id = _user_id
        AND created_at >= date_trunc('day', now())
    ), 0)::bigint,
    COALESCE(SUM(estimated_cost_micros) FILTER (
      WHERE created_at >= date_trunc('month', now())
    ), 0)::bigint
  FROM public.rita_voice_usage
  WHERE created_at >= date_trunc('month', now())
    AND (user_id = _user_id OR estimated_cost_micros > 0);
$$;

REVOKE ALL ON FUNCTION public.rita_voice_usage_totals(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rita_voice_usage_totals(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.rita_voice_usage_totals(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rita_voice_usage_totals(uuid) TO service_role;

-- <<< 20260921090000_rita_voice_usage_totals.sql


-- >>> 20260923120000_rita_economic_v2_control.sql
-- Rita Economic v2 rollout, stable preferences, and stage timing telemetry.
ALTER TABLE public.rita_voice_settings
  ADD COLUMN IF NOT EXISTS pipeline_mode text NOT NULL DEFAULT 'economic_v2'
    CHECK (pipeline_mode IN ('legacy', 'economic_v2')),
  ADD COLUMN IF NOT EXISTS rollout_percent integer NOT NULL DEFAULT 100
    CHECK (rollout_percent BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS admin_only_preview boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.rita_user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_language text NOT NULL DEFAULT 'unknown',
  active_dialect text NOT NULL DEFAULT 'standard',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rita_user_preferences ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rita_user_preferences TO authenticated;
GRANT ALL ON public.rita_user_preferences TO service_role;
DROP POLICY IF EXISTS "users manage own rita preferences" ON public.rita_user_preferences;
CREATE POLICY "users manage own rita preferences"
  ON public.rita_user_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.rita_turn_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.rita_voice_sessions(id) ON DELETE SET NULL,
  turn_id uuid,
  pipeline_mode text NOT NULL CHECK (pipeline_mode IN ('legacy', 'economic_v2')),
  language text,
  browser text,
  network_type text,
  speech_end_to_transcript_ms integer,
  transcript_to_first_token_ms integer,
  first_token_to_tts_ms integer,
  speech_end_to_first_audio_ms integer,
  interrupted boolean NOT NULL DEFAULT false,
  fallback_used boolean NOT NULL DEFAULT false,
  error_stage text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rita_turn_metrics_created_idx
  ON public.rita_turn_metrics (created_at DESC);
CREATE INDEX IF NOT EXISTS rita_turn_metrics_user_idx
  ON public.rita_turn_metrics (user_id, created_at DESC);
ALTER TABLE public.rita_turn_metrics ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.rita_turn_metrics TO authenticated;
GRANT ALL ON public.rita_turn_metrics TO service_role;
DROP POLICY IF EXISTS "admins read rita metrics" ON public.rita_turn_metrics;
CREATE POLICY "admins read rita metrics"
  ON public.rita_turn_metrics FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- <<< 20260923120000_rita_economic_v2_control.sql

commit;
