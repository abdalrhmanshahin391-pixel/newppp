-- 1) Stop exposing full profile rows (email, phone, lock status) for shared-deck owners.
DROP POLICY IF EXISTS "shared deck authors are visible" ON public.profiles;

-- Public author display goes through the narrow view, which now bypasses profiles RLS
-- while only ever exposing id/username/full_name/avatar_url/bio.
ALTER VIEW public.public_profiles SET (security_invoker = off);
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 2) Lock down SECURITY DEFINER functions that clients must never call directly.
DO $$
DECLARE
  keep_both text[] := ARRAY[
    'account_active','can_access_committee_subject','can_manage_committee',
    'can_manage_committee_members','can_manage_committee_years','can_manage_events',
    'can_manage_space','event_visible','has_role','is_space_member','space_can_add_decks',
    'space_can_post','space_chat_on','user_owns_any_german_course','user_owns_lecture_course'
  ];
  keep_anon text[] := ARRAY[
    'get_email_by_username','identity_taken','space_preview','university_id_by_slug',
    'get_course_real_counts','get_subject_question_counts'
  ];
  internal_only text[] := ARRAY[
    '__restore_exec','admin_deck_ratings','admin_get_user_roles','admin_list_role_members',
    'admin_space_deck_cards','committee_team_add','head_list_committee_members',
    'revoke_golden_user','space_role','sync_golden_user','user_in_group',
    'push_audience_devices','push_audience_count'
  ];
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef AND p.prokind = 'f'
  LOOP
    IF r.proname = ANY(keep_both) THEN
      CONTINUE;
    END IF;

    IF r.proname = ANY(internal_only) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
      CONTINUE;
    END IF;

    IF NOT (r.proname = ANY(keep_anon)) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END IF;
  END LOOP;
END $$;

-- Trigger functions are never callable over the API.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;
