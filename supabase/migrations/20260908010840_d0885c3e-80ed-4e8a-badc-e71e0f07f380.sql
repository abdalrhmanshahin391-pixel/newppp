CREATE OR REPLACE FUNCTION public.admin_people_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT jsonb_build_object(
    'active_now', (SELECT count(*) FROM public.user_sessions WHERE last_seen_at >= now() - interval '5 minutes'),
    'opened_today', (SELECT count(*) FROM public.user_sessions WHERE last_seen_at >= date_trunc('day', now())),
    'total_users', (SELECT count(*) FROM public.profiles),
    'new_today', (SELECT count(*) FROM public.profiles WHERE created_at >= date_trunc('day', now())),
    'new_week', (SELECT count(*) FROM public.profiles WHERE created_at >= now() - interval '7 days'),
    'new_month', (SELECT count(*) FROM public.profiles WHERE created_at >= now() - interval '30 days'),
    'new_prev_week', (SELECT count(*) FROM public.profiles WHERE created_at >= now() - interval '14 days' AND created_at < now() - interval '7 days'),
    'new_prev_month', (SELECT count(*) FROM public.profiles WHERE created_at >= now() - interval '60 days' AND created_at < now() - interval '30 days'),
    'logins_today', (SELECT count(*) FROM public.user_login_events WHERE occurred_at >= date_trunc('day', now())),
    'logins_week', (SELECT count(*) FROM public.user_login_events WHERE occurred_at >= now() - interval '7 days'),
    'logins_month', (SELECT count(*) FROM public.user_login_events WHERE occurred_at >= now() - interval '30 days'),
    'logins_prev_week', (SELECT count(*) FROM public.user_login_events WHERE occurred_at >= now() - interval '14 days' AND occurred_at < now() - interval '7 days'),
    'verified', (SELECT count(*) FROM auth.users WHERE email_confirmed_at IS NOT NULL),
    'unverified', (SELECT count(*) FROM auth.users WHERE email_confirmed_at IS NULL),
    'blocked', (SELECT count(*) FROM public.profiles WHERE locked_at IS NOT NULL AND lock_until IS NULL),
    'suspended', (SELECT count(*) FROM public.profiles WHERE locked_at IS NOT NULL AND lock_until IS NOT NULL AND lock_until > now()),
    'never_logged_in', (SELECT count(*) FROM public.profiles p WHERE NOT EXISTS (SELECT 1 FROM public.user_login_events e WHERE e.user_id = p.id)),
    'dormant_30d', (SELECT count(*) FROM public.profiles p WHERE EXISTS (SELECT 1 FROM public.user_login_events e WHERE e.user_id = p.id)
                     AND NOT EXISTS (SELECT 1 FROM public.user_login_events e2 WHERE e2.user_id = p.id AND e2.occurred_at >= now() - interval '30 days')),
    'revenue_cents', COALESCE((SELECT sum(amount_cents) FROM public.payment_events WHERE status = 'completed'), 0),
    'revenue_month_cents', COALESCE((SELECT sum(amount_cents) FROM public.payment_events WHERE status = 'completed' AND created_at >= now() - interval '30 days'), 0),
    'paying_users', (SELECT count(DISTINCT user_id) FROM public.payment_events WHERE status = 'completed' AND user_id IS NOT NULL),
    'course_grants', (SELECT count(*) FROM public.user_courses),
    'owners', (SELECT count(DISTINCT user_id) FROM public.user_courses),
    'generated_at', now()
  ) INTO result;
  RETURN result;
END; $function$;

CREATE OR REPLACE FUNCTION public.user_in_group(_user_id uuid, _group_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE g public.user_groups;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  SELECT * INTO g FROM public.user_groups WHERE id = _group_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.user_group_members m
             WHERE m.group_id = _group_id AND m.user_id = _user_id) THEN
    RETURN true;
  END IF;
  IF g.kind = 'everyone' THEN RETURN true; END IF;
  IF g.kind = 'admins' THEN
    RETURN public.has_role(_user_id, 'admin'::public.app_role);
  END IF;
  IF g.kind = 'committee' THEN
    RETURN public.has_role(_user_id, 'committee'::public.app_role);
  END IF;
  IF g.kind = 'course_owners' THEN
    RETURN EXISTS (SELECT 1 FROM public.user_courses uc
                   WHERE uc.user_id = _user_id AND uc.course_id = g.course_id);
  END IF;
  IF g.kind = 'package_owners' THEN
    RETURN EXISTS (SELECT 1 FROM public.payment_events pe
                   WHERE pe.user_id = _user_id AND pe.status = 'completed');
  END IF;
  IF g.kind = 'no_course' THEN
    RETURN NOT EXISTS (SELECT 1 FROM public.user_courses uc WHERE uc.user_id = _user_id);
  END IF;
  RETURN false;
END; $function$;

ALTER TABLE public.admin_ai_keys DROP CONSTRAINT IF EXISTS admin_ai_keys_purpose_check;
ALTER TABLE public.admin_ai_keys ADD CONSTRAINT admin_ai_keys_purpose_check
  CHECK (purpose = ANY (ARRAY['shared','aio','rita','lecture','questions','archive','summaries','german','speech']));