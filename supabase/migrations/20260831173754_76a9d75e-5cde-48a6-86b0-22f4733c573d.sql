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