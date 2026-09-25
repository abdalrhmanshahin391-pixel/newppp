-- Migration: Create promo_code_redemptions table to track promo code usage per user
CREATE TABLE IF NOT EXISTS public.promo_code_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL,
  plan_slug text NOT NULL,
  billing text NOT NULL DEFAULT 'three_months',
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promo_code_redemptions_user_code_uniq UNIQUE (user_id, code)
);

CREATE INDEX IF NOT EXISTS idx_promo_code_redemptions_user_code
  ON public.promo_code_redemptions (user_id, code);

GRANT SELECT, INSERT ON public.promo_code_redemptions TO authenticated, service_role;
ALTER TABLE public.promo_code_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own promo redemptions" ON public.promo_code_redemptions;
CREATE POLICY "Users read own promo redemptions"
  ON public.promo_code_redemptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users insert own promo redemptions" ON public.promo_code_redemptions;
CREATE POLICY "Users insert own promo redemptions"
  ON public.promo_code_redemptions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Ensure toolkit_claims has expires_at column for /my-plan countdown timer
ALTER TABLE public.toolkit_claims ADD COLUMN IF NOT EXISTS expires_at timestamptz;
