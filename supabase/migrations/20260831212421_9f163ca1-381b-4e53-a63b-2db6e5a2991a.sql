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