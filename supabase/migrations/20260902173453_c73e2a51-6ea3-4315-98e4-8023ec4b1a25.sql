-- ============================================================ deck ratings
CREATE TABLE public.deck_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES public.shared_decks(id) ON DELETE CASCADE,
  space_id uuid REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  stars smallint NOT NULL,
  note text,
  under_review boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deck_ratings ADD CONSTRAINT deck_ratings_stars_range CHECK (stars BETWEEN 1 AND 5);
CREATE UNIQUE INDEX deck_ratings_one_global ON public.deck_ratings (user_id, deck_id) WHERE space_id IS NULL;
CREATE UNIQUE INDEX deck_ratings_one_space ON public.deck_ratings (user_id, deck_id, space_id) WHERE space_id IS NOT NULL;
CREATE INDEX deck_ratings_deck_idx ON public.deck_ratings (deck_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deck_ratings TO authenticated;
GRANT ALL ON public.deck_ratings TO service_role;
ALTER TABLE public.deck_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own rating read" ON public.deck_ratings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own rating write" ON public.deck_ratings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "own rating update" ON public.deck_ratings FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own rating delete" ON public.deck_ratings FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.shared_decks
  ADD COLUMN IF NOT EXISTS rating_avg numeric(3,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.recount_deck_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _deck uuid;
BEGIN
  _deck := COALESCE(NEW.deck_id, OLD.deck_id);
  UPDATE public.shared_decks d SET
    rating_avg = COALESCE((SELECT ROUND(AVG(r.stars)::numeric, 2) FROM public.deck_ratings r
                            WHERE r.deck_id = _deck AND r.space_id IS NULL AND NOT r.under_review), 0),
    rating_count = COALESCE((SELECT COUNT(*) FROM public.deck_ratings r
                            WHERE r.deck_id = _deck AND r.space_id IS NULL AND NOT r.under_review), 0)
  WHERE d.id = _deck;
  RETURN NULL;
END; $$;

CREATE TRIGGER deck_ratings_recount
AFTER INSERT OR UPDATE OR DELETE ON public.deck_ratings
FOR EACH ROW EXECUTE FUNCTION public.recount_deck_rating();

-- rate a deck (anonymous to everyone else)
CREATE OR REPLACE FUNCTION public.rate_deck(_deck_id uuid, _stars smallint, _note text DEFAULT NULL, _space_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _new boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  IF _stars < 1 OR _stars > 5 THEN RAISE EXCEPTION 'stars must be 1..5'; END IF;
  IF _space_id IS NOT NULL AND NOT public.is_space_member(_space_id, _uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  -- accounts younger than 2 days start under review to stop rating bursts
  SELECT (p.created_at > now() - interval '2 days') INTO _new FROM public.profiles p WHERE p.id = _uid;

  IF _space_id IS NULL THEN
    INSERT INTO public.deck_ratings (deck_id, user_id, stars, note, under_review)
    VALUES (_deck_id, _uid, _stars, NULLIF(btrim(COALESCE(_note,'')),''), COALESCE(_new,false))
    ON CONFLICT (user_id, deck_id) WHERE space_id IS NULL
    DO UPDATE SET stars = EXCLUDED.stars, note = EXCLUDED.note, updated_at = now();
  ELSE
    INSERT INTO public.deck_ratings (deck_id, space_id, user_id, stars, note, under_review)
    VALUES (_deck_id, _space_id, _uid, _stars, NULLIF(btrim(COALESCE(_note,'')),''), COALESCE(_new,false))
    ON CONFLICT (user_id, deck_id, space_id) WHERE space_id IS NOT NULL
    DO UPDATE SET stars = EXCLUDED.stars, note = EXCLUDED.note, updated_at = now();
  END IF;
END; $$;

-- public summary: numbers and notes only, never identities
CREATE OR REPLACE FUNCTION public.deck_rating_summary(_deck_id uuid, _space_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'avg', COALESCE(ROUND(AVG(stars)::numeric, 2), 0),
    'count', COUNT(*),
    'mine', (SELECT stars FROM public.deck_ratings r2
              WHERE r2.deck_id = _deck_id AND r2.user_id = auth.uid()
                AND r2.space_id IS NOT DISTINCT FROM _space_id),
    'breakdown', jsonb_build_object(
      '5', COUNT(*) FILTER (WHERE stars = 5), '4', COUNT(*) FILTER (WHERE stars = 4),
      '3', COUNT(*) FILTER (WHERE stars = 3), '2', COUNT(*) FILTER (WHERE stars = 2),
      '1', COUNT(*) FILTER (WHERE stars = 1)),
    'notes', COALESCE((SELECT jsonb_agg(jsonb_build_object('stars', n.stars, 'note', n.note, 'at', n.created_at)
                        ORDER BY n.created_at DESC)
                       FROM (SELECT stars, note, created_at FROM public.deck_ratings
                             WHERE deck_id = _deck_id AND space_id IS NOT DISTINCT FROM _space_id
                               AND note IS NOT NULL AND NOT under_review
                             ORDER BY created_at DESC LIMIT 20) n), '[]'::jsonb)
  )
  FROM public.deck_ratings
  WHERE deck_id = _deck_id AND space_id IS NOT DISTINCT FROM _space_id AND NOT under_review;
$$;

-- ============================================ admin oversight of spaces
CREATE TABLE public.space_moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid REFERENCES public.spaces(id) ON DELETE SET NULL,
  admin_id uuid NOT NULL,
  action text NOT NULL,
  reason text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.space_moderation_log TO authenticated;
GRANT ALL ON public.space_moderation_log TO service_role;
ALTER TABLE public.space_moderation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read moderation log" ON public.space_moderation_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.admin_list_spaces()
RETURNS TABLE(id uuid, kind text, name text, description text, emoji text, color text,
              created_at timestamptz, owner_id uuid, owner_name text, owner_username text,
              owner_email text, members bigint, decks bigint, messages bigint,
              last_activity timestamptz, chat_enabled boolean, discoverable boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.kind, s.name, s.description, s.emoji, s.color, s.created_at, s.owner_id,
         COALESCE(p.full_name,''), COALESCE(p.username,''), COALESCE(p.email,''),
         (SELECT COUNT(*) FROM public.space_members m WHERE m.space_id = s.id),
         (SELECT COUNT(*) FROM public.space_decks d WHERE d.space_id = s.id),
         (SELECT COUNT(*) FROM public.space_messages g WHERE g.space_id = s.id),
         GREATEST(s.created_at,
                  COALESCE((SELECT MAX(g.created_at) FROM public.space_messages g WHERE g.space_id = s.id), s.created_at),
                  COALESCE((SELECT MAX(m.joined_at) FROM public.space_members m WHERE m.space_id = s.id), s.created_at)),
         s.chat_enabled, s.discoverable
  FROM public.spaces s
  LEFT JOIN public.profiles p ON p.id = s.owner_id
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY s.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_space_detail(_space_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _out jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object(
    'space', to_jsonb(s),
    'owner', (SELECT jsonb_build_object('id', p.id, 'full_name', p.full_name, 'username', p.username,
                                        'email', p.email, 'created_at', p.created_at)
              FROM public.profiles p WHERE p.id = s.owner_id),
    'members', COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id', m.user_id, 'role', m.role,
                          'joined_at', m.joined_at, 'username', pp.username, 'full_name', pp.full_name,
                          'email', pp.email, 'avatar_url', pp.avatar_url) ORDER BY m.joined_at)
                        FROM public.space_members m LEFT JOIN public.profiles pp ON pp.id = m.user_id
                        WHERE m.space_id = s.id), '[]'::jsonb),
    'decks', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title, 'cover', d.cover,
                          'emoji', d.emoji, 'cards', d.card_count, 'published', d.published,
                          'rating_avg', d.rating_avg, 'rating_count', d.rating_count,
                          'owner', po.username, 'added_at', sd.created_at) ORDER BY sd.created_at DESC)
                       FROM public.space_decks sd
                       JOIN public.shared_decks d ON d.id = sd.deck_id
                       LEFT JOIN public.profiles po ON po.id = d.owner_id
                       WHERE sd.space_id = s.id), '[]'::jsonb),
    'posts', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'body', a.body, 'pinned', a.pinned,
                          'at', a.created_at, 'author', pa.username) ORDER BY a.created_at DESC)
                       FROM public.space_announcements a LEFT JOIN public.profiles pa ON pa.id = a.author_id
                       WHERE a.space_id = s.id), '[]'::jsonb),
    'messages', COALESCE((SELECT jsonb_agg(x) FROM (
                          SELECT jsonb_build_object('id', g.id, 'body', g.body, 'at', g.created_at,
                                 'author', pg2.username, 'author_name', pg2.full_name) AS x
                          FROM public.space_messages g LEFT JOIN public.profiles pg2 ON pg2.id = g.author_id
                          WHERE g.space_id = s.id ORDER BY g.created_at DESC LIMIT 200) t), '[]'::jsonb),
    'invites', COALESCE((SELECT jsonb_agg(jsonb_build_object('code', i.code, 'uses', i.uses,
                          'max_uses', i.max_uses, 'active', i.active, 'expires_at', i.expires_at))
                        FROM public.space_invites i WHERE i.space_id = s.id), '[]'::jsonb),
    'log', COALESCE((SELECT jsonb_agg(jsonb_build_object('action', l.action, 'reason', l.reason, 'at', l.created_at)
                      ORDER BY l.created_at DESC)
                     FROM public.space_moderation_log l WHERE l.space_id = s.id), '[]'::jsonb)
  ) INTO _out
  FROM public.spaces s WHERE s.id = _space_id;
  RETURN _out;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_space_deck_cards(_deck_id uuid)
RETURNS TABLE(id uuid, group_name text, front text, back text, sort integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.group_name, c.front, c.back, c.sort
  FROM public.shared_deck_cards c
  WHERE c.deck_id = _deck_id AND public.has_role(auth.uid(), 'admin')
  ORDER BY c.sort;
$$;

CREATE OR REPLACE FUNCTION public.admin_deck_ratings(_deck_id uuid)
RETURNS TABLE(stars smallint, note text, under_review boolean, created_at timestamptz,
              username text, email text, space_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.stars, r.note, r.under_review, r.created_at,
         COALESCE(p.username,''), COALESCE(p.email,''), r.space_id
  FROM public.deck_ratings r LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE r.deck_id = _deck_id AND public.has_role(auth.uid(), 'admin')
  ORDER BY r.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_space_action(_space_id uuid, _action text, _reason text DEFAULT NULL, _target uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _action = 'freeze_chat' THEN
    UPDATE public.spaces SET chat_enabled = false WHERE id = _space_id;
  ELSIF _action = 'unfreeze_chat' THEN
    UPDATE public.spaces SET chat_enabled = true WHERE id = _space_id;
  ELSIF _action = 'hide' THEN
    UPDATE public.spaces SET discoverable = false WHERE id = _space_id;
  ELSIF _action = 'rotate_code' THEN
    UPDATE public.space_invites SET active = false WHERE space_id = _space_id;
    INSERT INTO public.space_invites (space_id, code, created_by, active)
    VALUES (_space_id, upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)), auth.uid(), true);
  ELSIF _action = 'unpublish_deck' THEN
    UPDATE public.shared_decks SET published = false WHERE id = _target;
  ELSIF _action = 'delete_message' THEN
    DELETE FROM public.space_messages WHERE id = _target AND space_id = _space_id;
  ELSIF _action = 'close_space' THEN
    DELETE FROM public.spaces WHERE id = _space_id;
  ELSIF _action = 'review_rating' THEN
    UPDATE public.deck_ratings SET under_review = NOT under_review WHERE id = _target;
  END IF;
  INSERT INTO public.space_moderation_log (space_id, admin_id, action, reason, meta)
  VALUES (CASE WHEN _action = 'close_space' THEN NULL ELSE _space_id END, auth.uid(), _action, _reason,
          jsonb_build_object('target', _target));
END; $$;

-- ================================================== toolkit free pack
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS toolkit_free_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS toolkit_free_plan text NOT NULL DEFAULT 'pack_study';

CREATE TABLE public.toolkit_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  plan_slug text NOT NULL,
  label text,
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.toolkit_codes TO authenticated;
GRANT ALL ON public.toolkit_codes TO service_role;
ALTER TABLE public.toolkit_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage toolkit codes" ON public.toolkit_codes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.toolkit_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code_id uuid REFERENCES public.toolkit_codes(id) ON DELETE SET NULL,
  plan_slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX toolkit_claims_one_free ON public.toolkit_claims (user_id) WHERE code_id IS NULL;
CREATE UNIQUE INDEX toolkit_claims_one_per_code ON public.toolkit_claims (user_id, code_id) WHERE code_id IS NOT NULL;
GRANT SELECT ON public.toolkit_claims TO authenticated;
GRANT ALL ON public.toolkit_claims TO service_role;
ALTER TABLE public.toolkit_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own claims" ON public.toolkit_claims FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.toolkit_offer()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'free_enabled', COALESCE((SELECT s.toolkit_free_enabled FROM public.site_settings s LIMIT 1), false),
    'plan', (SELECT to_jsonb(p) FROM public.plans p
             WHERE p.slug = COALESCE((SELECT s.toolkit_free_plan FROM public.site_settings s LIMIT 1), 'pack_study')),
    'claimed', EXISTS (SELECT 1 FROM public.toolkit_claims c WHERE c.user_id = auth.uid() AND c.code_id IS NULL)
  );
$$;

CREATE OR REPLACE FUNCTION public.claim_toolkit(_code text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _plan public.plans%ROWTYPE; _c public.toolkit_codes%ROWTYPE; _free boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;

  IF _code IS NULL OR btrim(_code) = '' THEN
    SELECT s.toolkit_free_enabled INTO _free FROM public.site_settings s LIMIT 1;
    IF NOT COALESCE(_free,false) THEN RAISE EXCEPTION 'The free pack is closed. Use a code instead.'; END IF;
    IF EXISTS (SELECT 1 FROM public.toolkit_claims c WHERE c.user_id = _uid AND c.code_id IS NULL) THEN
      RAISE EXCEPTION 'You already claimed the free pack.';
    END IF;
    SELECT p.* INTO _plan FROM public.plans p
      WHERE p.slug = COALESCE((SELECT s.toolkit_free_plan FROM public.site_settings s LIMIT 1), 'pack_study');
    IF _plan.slug IS NULL THEN RAISE EXCEPTION 'The free pack is not set up yet.'; END IF;
    INSERT INTO public.toolkit_claims (user_id, plan_slug) VALUES (_uid, _plan.slug);
  ELSE
    SELECT * INTO _c FROM public.toolkit_codes WHERE upper(code) = upper(btrim(_code));
    IF _c.id IS NULL OR NOT _c.is_active THEN RAISE EXCEPTION 'That code does not work.'; END IF;
    IF _c.expires_at IS NOT NULL AND _c.expires_at < now() THEN RAISE EXCEPTION 'That code has expired.'; END IF;
    IF _c.max_uses IS NOT NULL AND _c.used_count >= _c.max_uses THEN RAISE EXCEPTION 'That code is used up.'; END IF;
    IF EXISTS (SELECT 1 FROM public.toolkit_claims c WHERE c.user_id = _uid AND c.code_id = _c.id) THEN
      RAISE EXCEPTION 'You already used that code.';
    END IF;
    SELECT p.* INTO _plan FROM public.plans p WHERE p.slug = _c.plan_slug;
    IF _plan.slug IS NULL THEN RAISE EXCEPTION 'That code points at a pack that no longer exists.'; END IF;
    INSERT INTO public.toolkit_claims (user_id, code_id, plan_slug) VALUES (_uid, _c.id, _plan.slug);
    UPDATE public.toolkit_codes SET used_count = used_count + 1 WHERE id = _c.id;
  END IF;

  INSERT INTO public.plan_credit_grants (
    user_id, plan_slug, transaction_id, environment, flashcards, ai_questions, summaries,
    todo_tasks, calendar_items, all_in_one_lectures, all_in_one_questions,
    archive_questions, rita_questions, groups)
  VALUES (_uid, _plan.slug, 'toolkit-' || gen_random_uuid()::text, 'live',
    COALESCE(_plan.max_flashcards,0), COALESCE(_plan.max_ai_questions,0), COALESCE(_plan.max_summaries,0),
    COALESCE(_plan.max_todo_tasks,0), COALESCE(_plan.max_calendar_items,0),
    COALESCE(_plan.max_all_in_one_lectures,0), COALESCE(_plan.max_all_in_one_questions,0),
    COALESCE(_plan.max_archive_questions,0), COALESCE(_plan.max_rita_questions,0), COALESCE(_plan.max_groups,0));

  RETURN jsonb_build_object('ok', true, 'plan', _plan.slug, 'name', _plan.name);
END; $$;

-- ==================================================== popup windows
ALTER TABLE public.site_announcements
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS button_label text,
  ADD COLUMN IF NOT EXISTS button_href text,
  ADD COLUMN IF NOT EXISTS secondary_label text,
  ADD COLUMN IF NOT EXISTS secondary_href text,
  ADD COLUMN IF NOT EXISTS trigger text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS delay_seconds integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'always',
  ADD COLUMN IF NOT EXISTS paths text[] NOT NULL DEFAULT '{}'::text[];

CREATE TABLE public.announcement_seen (
  user_id uuid NOT NULL,
  announcement_id uuid NOT NULL REFERENCES public.site_announcements(id) ON DELETE CASCADE,
  seen_count integer NOT NULL DEFAULT 1,
  clicked boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, announcement_id)
);
GRANT SELECT, INSERT, UPDATE ON public.announcement_seen TO authenticated;
GRANT ALL ON public.announcement_seen TO service_role;
ALTER TABLE public.announcement_seen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own seen rows" ON public.announcement_seen FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.mark_announcement_seen(_id uuid, _clicked boolean DEFAULT false)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.announcement_seen (user_id, announcement_id, seen_count, clicked)
  VALUES (auth.uid(), _id, 1, _clicked)
  ON CONFLICT (user_id, announcement_id) DO UPDATE
    SET seen_count = public.announcement_seen.seen_count + 1,
        clicked = public.announcement_seen.clicked OR EXCLUDED.clicked,
        last_seen_at = now();
$$;

-- announcements for me, with what I have already seen attached
CREATE OR REPLACE FUNCTION public.my_announcements()
RETURNS SETOF public.site_announcements
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.* FROM public.site_announcements a
  WHERE (NOT EXISTS (SELECT 1 FROM public.announcement_audiences aa WHERE aa.announcement_id = a.id)
     OR EXISTS (
       SELECT 1 FROM public.announcement_audiences aa
       WHERE aa.announcement_id = a.id AND public.user_in_group(auth.uid(), aa.group_id)))
    AND NOT EXISTS (
      SELECT 1 FROM public.announcement_seen s
      WHERE s.announcement_id = a.id AND s.user_id = auth.uid()
        AND (a.frequency = 'once'
          OR (a.frequency = 'until_click' AND s.clicked)
          OR (a.frequency = 'daily' AND s.last_seen_at > now() - interval '1 day')))
  ORDER BY a.sort ASC, a.created_at DESC;
$$;