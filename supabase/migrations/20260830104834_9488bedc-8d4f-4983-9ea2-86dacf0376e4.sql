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