DROP POLICY IF EXISTS "users create own lesson progress" ON public.rita_lesson_progress;
CREATE POLICY "users create own lesson progress" ON public.rita_lesson_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "users update own lesson progress" ON public.rita_lesson_progress;
CREATE POLICY "users update own lesson progress" ON public.rita_lesson_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);