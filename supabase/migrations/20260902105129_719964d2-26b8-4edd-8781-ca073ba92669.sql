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