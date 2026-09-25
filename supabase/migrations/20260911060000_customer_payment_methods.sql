-- Create customer_payment_methods table to store saved cards for accounts
CREATE TABLE IF NOT EXISTS public.customer_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  paddle_customer_id text,
  paddle_payment_method_id text,
  card_brand text NOT NULL DEFAULT 'card',
  card_last4 text NOT NULL,
  card_exp_month integer,
  card_exp_year integer,
  cardholder_name text,
  is_default boolean DEFAULT true,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_payment_methods_user_id ON public.customer_payment_methods(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_payment_methods TO authenticated, service_role;
ALTER TABLE public.customer_payment_methods ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users view their own payment methods"
    ON public.customer_payment_methods FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users manage their own payment methods"
    ON public.customer_payment_methods FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RPC helper to atomically remove card and cancel auto-renew
CREATE OR REPLACE FUNCTION public.remove_user_card_and_cancel_auto_renew(_user_id uuid, _card_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark any active subscriptions for this user as cancel_at_period_end
  UPDATE public.subscriptions
  SET cancel_at_period_end = true, updated_at = now()
  WHERE user_id = _user_id;

  -- Delete the card from user account
  DELETE FROM public.customer_payment_methods
  WHERE id = _card_id AND user_id = _user_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_user_card_and_cancel_auto_renew(uuid, uuid) TO authenticated, service_role;
