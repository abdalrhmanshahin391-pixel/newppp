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