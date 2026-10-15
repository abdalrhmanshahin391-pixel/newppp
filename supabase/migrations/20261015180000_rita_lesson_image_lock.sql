-- Lock for automatic lesson pictures.
--
-- When a learner opens a lesson that still has a placeholder picture, the
-- server generates a real one in the background. image_generating_at marks
-- "a picture is being made (or failed recently)" so two learners opening the
-- same lesson do not both pay for a generation, and a failed attempt waits
-- before it is tried again.

alter table public.rita_lessons
  add column if not exists image_generating_at timestamptz;
