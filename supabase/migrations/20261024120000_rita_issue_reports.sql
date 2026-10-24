-- A learner's "there is a problem with this reply" report, tied to the reply and to the worker's turn
-- record, so a complaint can be traced to the decision and the build that produced it. The turn
-- record itself (turn_ledger events) lives in rita_v3_events, which learners can already read.

create table if not exists public.rita_issue_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.rita_free_conversations(id) on delete cascade,
  session_id uuid references public.rita_v3_sessions(id) on delete set null,
  -- Shared by the worker and the page: <session id>-t-<turn number>.
  turn_ref text,
  -- client_message_id of the reply the report is about.
  reply_message_id text,
  category text not null
    check (category in (
      'interrupted', 'misunderstood', 'forgot', 'wrong_answer',
      'weak_explanation', 'lost', 'other'
    )),
  note text check (note is null or char_length(note) <= 500),
  build text,
  -- The turn record that was known when the report was made (empty if it had not arrived yet).
  ledger jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists rita_issue_reports_user_created_idx
  on public.rita_issue_reports(user_id, created_at desc);
create index if not exists rita_issue_reports_conversation_idx
  on public.rita_issue_reports(conversation_id) where conversation_id is not null;
create index if not exists rita_issue_reports_category_idx
  on public.rita_issue_reports(category, created_at desc);

alter table public.rita_issue_reports enable row level security;

drop policy if exists "users create own rita issue reports" on public.rita_issue_reports;
create policy "users create own rita issue reports"
  on public.rita_issue_reports
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and (
      conversation_id is null
      or exists (
        select 1 from public.rita_free_conversations conversation
        where conversation.id = conversation_id
          and conversation.user_id = auth.uid()
      )
    )
  );

drop policy if exists "users read own rita issue reports" on public.rita_issue_reports;
create policy "users read own rita issue reports"
  on public.rita_issue_reports
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users delete own rita issue reports" on public.rita_issue_reports;
create policy "users delete own rita issue reports"
  on public.rita_issue_reports
  for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "admins read rita issue reports" on public.rita_issue_reports;
create policy "admins read rita issue reports"
  on public.rita_issue_reports
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

grant select, insert, delete on public.rita_issue_reports to authenticated;
