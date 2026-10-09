-- A client-generated diagnostic trace ties browser, Lovable, Modal and worker
-- evidence together without storing spoken content.
alter table public.rita_v3_sessions
  add column if not exists diagnostic_trace_id uuid;

create unique index if not exists rita_v3_sessions_diagnostic_trace_idx
  on public.rita_v3_sessions(diagnostic_trace_id)
  where diagnostic_trace_id is not null;
