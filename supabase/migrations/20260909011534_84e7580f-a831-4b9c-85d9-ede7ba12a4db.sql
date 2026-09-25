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