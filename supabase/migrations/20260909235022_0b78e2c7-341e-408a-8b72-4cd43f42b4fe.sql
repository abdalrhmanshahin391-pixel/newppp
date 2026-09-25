DROP TABLE IF EXISTS public.space_question_sets CASCADE;
DROP TABLE IF EXISTS public.shared_question_items CASCADE;
DROP TABLE IF EXISTS public.shared_question_sets CASCADE;
DROP FUNCTION IF EXISTS public.can_read_question_set(uuid, uuid);