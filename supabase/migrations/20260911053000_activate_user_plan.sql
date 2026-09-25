-- Helper function to activate or change a user's plan securely
CREATE OR REPLACE FUNCTION public.activate_user_plan(_user_id uuid, _plan_slug text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.plans WHERE slug = _plan_slug) THEN
    RAISE EXCEPTION 'Plan with slug % does not exist', _plan_slug;
  END IF;

  INSERT INTO public.user_plans (user_id, plan_slug, updated_at)
  VALUES (_user_id, _plan_slug, now())
  ON CONFLICT (user_id)
  DO UPDATE SET plan_slug = EXCLUDED.plan_slug, updated_at = now();

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_user_plan(uuid, text) TO authenticated, service_role;

-- Helper function to cancel user's subscription at period end securely
CREATE OR REPLACE FUNCTION public.cancel_user_subscription(_user_id uuid, _paddle_sub_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.subscriptions
  SET cancel_at_period_end = true, updated_at = now()
  WHERE user_id = _user_id AND paddle_subscription_id = _paddle_sub_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_user_subscription(uuid, text) TO authenticated, service_role;
