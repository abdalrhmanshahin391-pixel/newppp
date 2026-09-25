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