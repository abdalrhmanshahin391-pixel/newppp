ALTER TABLE public.summaries ADD COLUMN IF NOT EXISTS is_example boolean NOT NULL DEFAULT false;
ALTER TABLE public.lq_lectures ADD COLUMN IF NOT EXISTS is_example boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "anyone reads example summaries" ON public.summaries;
CREATE POLICY "anyone reads example summaries" ON public.summaries
  FOR SELECT TO authenticated USING (is_example = true);

DROP POLICY IF EXISTS "read example lectures" ON public.lq_lectures;
CREATE POLICY "read example lectures" ON public.lq_lectures
  FOR SELECT TO authenticated USING (is_example = true);

DROP POLICY IF EXISTS "read example aio cards" ON public.aio_cards;
CREATE POLICY "read example aio cards" ON public.aio_cards
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.lq_lectures l WHERE l.id = aio_cards.lecture_id AND l.is_example
  ));

DROP POLICY IF EXISTS "read example aio summaries" ON public.aio_summaries;
CREATE POLICY "read example aio summaries" ON public.aio_summaries
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.lq_lectures l WHERE l.id = aio_summaries.lecture_id AND l.is_example
  ));

DROP POLICY IF EXISTS "read example lecture questions" ON public.lq_questions;
CREATE POLICY "read example lecture questions" ON public.lq_questions
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.lq_lectures l WHERE l.id = lq_questions.lecture_id AND l.is_example
  ));

UPDATE public.summaries SET is_example = true WHERE id = 'fffa7abf-1b9c-48d8-83be-37c1d183c1e2';
UPDATE public.lq_lectures SET is_example = true WHERE id = '88872619-3418-420c-b150-cc6813d6d7ca';