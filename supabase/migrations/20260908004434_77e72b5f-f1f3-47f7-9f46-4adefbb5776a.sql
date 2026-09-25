-- 1. Retire the look & content tools
DROP TABLE IF EXISTS public.site_blocks CASCADE;
DROP TABLE IF EXISTS public.site_sections CASCADE;
DROP TABLE IF EXISTS public.site_pages CASCADE;
DROP TABLE IF EXISTS public.site_nav_items CASCADE;
DROP TABLE IF EXISTS public.site_content CASCADE;
DROP TABLE IF EXISTS public.about_blocks CASCADE;
DROP TABLE IF EXISTS public.site_feature_flags CASCADE;

-- 2. People directory, now with plan + kit
DROP FUNCTION IF EXISTS public.admin_people_directory();

CREATE OR REPLACE FUNCTION public.admin_people_directory()
RETURNS TABLE(
  id uuid, full_name text, username text, email text, phone text,
  verified boolean, locked_at timestamptz, lock_until timestamptz, lock_reason text,
  roles text[], courses bigint, paid_cents bigint,
  created_at timestamptz, last_seen timestamptz, login_count bigint,
  plan_slug text, plan_name text,
  kit_slug text, kit_name text, kit_expires_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT u.id,
    COALESCE(p.full_name, u.raw_user_meta_data->>'full_name', ''),
    COALESCE(p.username, u.raw_user_meta_data->>'username', split_part(u.email::text,'@',1)),
    COALESCE(p.email, u.email::text),
    COALESCE(p.phone, u.phone::text),
    (u.email_confirmed_at IS NOT NULL),
    p.locked_at, p.lock_until, p.lock_reason,
    COALESCE(ARRAY(SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = u.id), ARRAY[]::text[]),
    (SELECT count(*) FROM public.user_courses uc WHERE uc.user_id = u.id)::bigint,
    COALESCE((SELECT sum(pe.amount_cents) FROM public.payment_events pe
              WHERE pe.user_id = u.id AND pe.status = 'completed'), 0)::bigint,
    u.created_at,
    GREATEST(
      (SELECT max(s.last_seen_at) FROM public.user_sessions s WHERE s.user_id = u.id),
      (SELECT max(e.occurred_at) FROM public.user_login_events e WHERE e.user_id = u.id)
    ),
    (SELECT count(*) FROM public.user_login_events e WHERE e.user_id = u.id)::bigint,
    COALESCE(up.plan_slug, 'starter'),
    COALESCE(pl.name, 'Starter'),
    tk.slug, tk.name, tc.expires_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.user_plans up ON up.user_id = u.id
  LEFT JOIN public.plans pl ON pl.slug = COALESCE(up.plan_slug, 'starter')
  LEFT JOIN LATERAL (
    SELECT c.expires_at, c.code_id
    FROM public.toolkit_claims c
    WHERE c.user_id = u.id
    ORDER BY c.expires_at DESC NULLS LAST
    LIMIT 1
  ) tc ON true
  LEFT JOIN LATERAL (
    SELECT pl2.slug, pl2.name
    FROM public.toolkit_codes tcode
    JOIN public.plans pl2 ON pl2.slug = tcode.plan_slug
    WHERE tcode.id = tc.code_id
  ) tk ON true
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_people_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_people_directory() TO authenticated;

-- 3. Live pulse
CREATE OR REPLACE FUNCTION public.admin_people_pulse()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'generated_at', now(),
    'online_now', (SELECT count(*) FROM public.user_sessions s WHERE s.last_seen_at > now() - interval '5 minutes'),
    'online_15m', (SELECT count(*) FROM public.user_sessions s WHERE s.last_seen_at > now() - interval '15 minutes'),
    'opened_today', (SELECT count(DISTINCT s.user_id) FROM public.user_sessions s WHERE s.last_seen_at >= date_trunc('day', now())),
    'opened_yesterday', (SELECT count(DISTINCT e.user_id) FROM public.user_login_events e
                         WHERE e.occurred_at >= date_trunc('day', now()) - interval '1 day'
                           AND e.occurred_at < date_trunc('day', now())),
    'total_users', (SELECT count(*) FROM auth.users),
    'hourly', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('hour', h, 'logins', c) ORDER BY h)
      FROM (
        SELECT g.h AS h,
          (SELECT count(*) FROM public.user_login_events e
           WHERE e.occurred_at >= date_trunc('day', now()) + (g.h || ' hours')::interval
             AND e.occurred_at <  date_trunc('day', now()) + ((g.h + 1) || ' hours')::interval) AS c
        FROM generate_series(0, 23) AS g(h)
      ) q
    ), '[]'::jsonb),
    'plan_mix', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('slug', slug, 'name', name, 'people', people) ORDER BY people DESC)
      FROM (
        SELECT COALESCE(up.plan_slug, 'starter') AS slug,
               COALESCE(pl.name, 'Starter') AS name,
               count(*)::bigint AS people
        FROM auth.users u
        LEFT JOIN public.user_plans up ON up.user_id = u.id
        LEFT JOIN public.plans pl ON pl.slug = COALESCE(up.plan_slug, 'starter')
        GROUP BY 1, 2
      ) m
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_people_pulse() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_people_pulse() TO authenticated;

-- 4. Who is online right now
CREATE OR REPLACE FUNCTION public.admin_people_online()
RETURNS TABLE(
  user_id uuid, full_name text, username text, email text,
  plan_slug text, plan_name text,
  started_at timestamptz, last_seen_at timestamptz, minutes_active integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT s.user_id,
    COALESCE(p.full_name, ''),
    COALESCE(p.username, split_part(COALESCE(p.email, ''), '@', 1)),
    p.email,
    COALESCE(up.plan_slug, 'starter'),
    COALESCE(pl.name, 'Starter'),
    s.started_at,
    s.last_seen_at,
    GREATEST(1, (EXTRACT(EPOCH FROM (s.last_seen_at - s.started_at)) / 60)::int)
  FROM public.user_sessions s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  LEFT JOIN public.user_plans up ON up.user_id = s.user_id
  LEFT JOIN public.plans pl ON pl.slug = COALESCE(up.plan_slug, 'starter')
  WHERE s.last_seen_at > now() - interval '15 minutes'
  ORDER BY s.last_seen_at DESC
  LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_people_online() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_people_online() TO authenticated;

-- 5. One person's history
CREATE OR REPLACE FUNCTION public.admin_person_history(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'plan_slug', COALESCE((SELECT up.plan_slug FROM public.user_plans up WHERE up.user_id = _user_id), 'starter'),
    'plan_changed_at', (SELECT up.updated_at FROM public.user_plans up WHERE up.user_id = _user_id),
    'logins', COALESCE((SELECT jsonb_agg(x.occurred_at ORDER BY x.occurred_at DESC)
                        FROM (SELECT e.occurred_at FROM public.user_login_events e
                              WHERE e.user_id = _user_id
                              ORDER BY e.occurred_at DESC LIMIT 40) x), '[]'::jsonb),
    'devices', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                            'id', d.id, 'platform', d.platform,
                            'user_agent', d.user_agent, 'last_seen_at', d.last_seen_at))
                         FROM (SELECT * FROM public.user_devices ud
                               WHERE ud.user_id = _user_id
                               ORDER BY ud.last_seen_at DESC LIMIT 20) d), '[]'::jsonb),
    'payments', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                            'id', pe.id, 'amount_cents', pe.amount_cents, 'currency', pe.currency,
                            'status', pe.status, 'created_at', pe.created_at))
                          FROM (SELECT * FROM public.payment_events p2
                                WHERE p2.user_id = _user_id
                                ORDER BY p2.created_at DESC LIMIT 30) pe), '[]'::jsonb),
    'decks', (SELECT count(*) FROM public.flash_subjects fs WHERE fs.user_id = _user_id),
    'cards', (SELECT count(*) FROM public.flash_cards fc WHERE fc.user_id = _user_id),
    'summaries', (SELECT count(*) FROM public.summaries su WHERE su.user_id = _user_id),
    'spaces', (SELECT count(*) FROM public.space_members sm WHERE sm.user_id = _user_id)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_person_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_person_history(uuid) TO authenticated;