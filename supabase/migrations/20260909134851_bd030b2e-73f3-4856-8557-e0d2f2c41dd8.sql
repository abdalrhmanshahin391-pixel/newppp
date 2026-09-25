-- 1. Keep only the rheumatic fever sample questions
DELETE FROM public.questions
WHERE subject_id = '33333333-3333-4333-8333-333333333333'
  AND stem NOT ILIKE '%rheumatic%'
  AND stem NOT ILIKE '%sore throat%';

-- 2. Rename the sample bank
UPDATE public.courses SET title = 'RitaJet sample bank — Rheumatic fever'
  WHERE id = '11111111-1111-4111-8111-111111111111';
UPDATE public.subject_groups SET name = 'Rheumatic fever'
  WHERE id = '22222222-2222-4222-8222-222222222222';
UPDATE public.subjects
   SET name = 'Rheumatic fever — shared example', access_level = 'free_public'
  WHERE id = '33333333-3333-4333-8333-333333333333';

-- 3. Rita 3.8 is gone from plans
ALTER TABLE public.plans DROP COLUMN IF EXISTS feature_rita38;
ALTER TABLE public.plans DROP COLUMN IF EXISTS max_rita_questions;

-- 4. Every paid plan gets unlimited flashcards
UPDATE public.plans SET max_flashcards = NULL WHERE price_cents >= 500;

-- 5. Free toolkit code
INSERT INTO public.toolkit_codes (code, plan_slug, label, max_uses, is_active)
VALUES ('AquaQbank', 'toolkit', 'AquaQbank — free toolkit', NULL, true)
ON CONFLICT (code) DO UPDATE
  SET plan_slug = EXCLUDED.plan_slug,
      label = EXCLUDED.label,
      max_uses = NULL,
      expires_at = NULL,
      is_active = true;