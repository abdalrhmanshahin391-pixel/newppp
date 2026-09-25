CREATE TABLE public.spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'group',
  name text NOT NULL,
  description text,
  image_url text,
  emoji text,
  color text NOT NULL DEFAULT 'apricot',
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  chat_enabled boolean NOT NULL DEFAULT false,
  discoverable boolean NOT NULL DEFAULT false,
  who_can_add_decks text NOT NULL DEFAULT 'members',
  who_can_post text NOT NULL DEFAULT 'members',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT spaces_kind_chk CHECK (kind IN ('classroom','group')),
  CONSTRAINT spaces_add_chk CHECK (who_can_add_decks IN ('owners','members')),
  CONSTRAINT spaces_post_chk CHECK (who_can_post IN ('owners','members'))
);

CREATE TABLE public.space_members (
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  muted boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, user_id),
  CONSTRAINT space_members_role_chk CHECK (role IN ('owner','co_owner','member'))
);

CREATE TABLE public.space_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  expires_at timestamptz,
  max_uses integer,
  uses integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.space_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.space_decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  deck_id uuid NOT NULL REFERENCES public.shared_decks(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES public.space_folders(id) ON DELETE SET NULL,
  added_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, deck_id)
);

CREATE TABLE public.space_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  body text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.space_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.spaces TO authenticated;
GRANT ALL ON public.spaces TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.space_members TO authenticated;
GRANT ALL ON public.space_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.space_invites TO authenticated;
GRANT ALL ON public.space_invites TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.space_folders TO authenticated;
GRANT ALL ON public.space_folders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.space_decks TO authenticated;
GRANT ALL ON public.space_decks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.space_announcements TO authenticated;
GRANT ALL ON public.space_announcements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.space_messages TO authenticated;
GRANT ALL ON public.space_messages TO service_role;

CREATE OR REPLACE FUNCTION public.space_role(_space_id uuid, _user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.space_members WHERE space_id = _space_id AND user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.is_space_member(_space_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.space_members WHERE space_id = _space_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_space(_space_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.space_role(_space_id, _user_id) IN ('owner','co_owner');
$$;

CREATE OR REPLACE FUNCTION public.space_can_add_decks(_space_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.spaces s
    WHERE s.id = _space_id
      AND public.is_space_member(_space_id, _user_id)
      AND (s.who_can_add_decks = 'members' OR public.can_manage_space(_space_id, _user_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.space_can_post(_space_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.spaces s
    WHERE s.id = _space_id
      AND public.is_space_member(_space_id, _user_id)
      AND (s.who_can_post = 'members' OR public.can_manage_space(_space_id, _user_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.space_chat_on(_space_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT chat_enabled FROM public.spaces WHERE id = _space_id), false);
$$;

CREATE OR REPLACE FUNCTION public.create_space(_kind text, _name text, _description text, _emoji text, _color text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _id uuid; _code text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'sign_in_required'; END IF;
  IF _kind NOT IN ('classroom','group') THEN RAISE EXCEPTION 'bad_kind'; END IF;
  INSERT INTO public.spaces (kind, name, description, emoji, color, owner_id)
  VALUES (_kind, trim(_name), NULLIF(trim(coalesce(_description,'')),''), _emoji, coalesce(_color,'apricot'), _uid)
  RETURNING id INTO _id;
  INSERT INTO public.space_members (space_id, user_id, role) VALUES (_id, _uid, 'owner');
  _code := lower(replace(gen_random_uuid()::text, '-', ''));
  _code := substr(_code, 1, 10);
  INSERT INTO public.space_invites (space_id, code, created_by) VALUES (_id, _code, _uid);
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.space_preview(_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _s public.spaces; _i public.space_invites;
BEGIN
  SELECT * INTO _i FROM public.space_invites WHERE code = lower(trim(_code));
  IF NOT FOUND OR NOT _i.active THEN RETURN jsonb_build_object('valid', false); END IF;
  IF _i.expires_at IS NOT NULL AND _i.expires_at < now() THEN RETURN jsonb_build_object('valid', false); END IF;
  IF _i.max_uses IS NOT NULL AND _i.uses >= _i.max_uses THEN RETURN jsonb_build_object('valid', false); END IF;
  SELECT * INTO _s FROM public.spaces WHERE id = _i.space_id;
  RETURN jsonb_build_object(
    'valid', true, 'id', _s.id, 'kind', _s.kind, 'name', _s.name,
    'description', _s.description, 'emoji', _s.emoji, 'color', _s.color,
    'image_url', _s.image_url,
    'members', (SELECT count(*) FROM public.space_members m WHERE m.space_id = _s.id),
    'already', public.is_space_member(_s.id, auth.uid())
  );
END; $$;

CREATE OR REPLACE FUNCTION public.join_space_by_code(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _i public.space_invites;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'sign_in_required'; END IF;
  SELECT * INTO _i FROM public.space_invites WHERE code = lower(trim(_code));
  IF NOT FOUND OR NOT _i.active THEN RAISE EXCEPTION 'invalid_invite'; END IF;
  IF _i.expires_at IS NOT NULL AND _i.expires_at < now() THEN RAISE EXCEPTION 'invalid_invite'; END IF;
  IF _i.max_uses IS NOT NULL AND _i.uses >= _i.max_uses THEN RAISE EXCEPTION 'invalid_invite'; END IF;
  IF NOT public.is_space_member(_i.space_id, _uid) THEN
    INSERT INTO public.space_members (space_id, user_id, role) VALUES (_i.space_id, _uid, 'member');
    UPDATE public.space_invites SET uses = uses + 1 WHERE id = _i.id;
  END IF;
  RETURN _i.space_id;
END; $$;

CREATE OR REPLACE FUNCTION public.space_members_view(_space_id uuid)
RETURNS TABLE(user_id uuid, role text, joined_at timestamptz, username text, full_name text, avatar_url text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_space_member(_space_id, auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT m.user_id, m.role, m.joined_at,
         COALESCE(p.username,''), COALESCE(p.full_name,''), p.avatar_url
  FROM public.space_members m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.space_id = _space_id
  ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'co_owner' THEN 1 ELSE 2 END, m.joined_at;
END; $$;

CREATE OR REPLACE FUNCTION public.my_spaces()
RETURNS TABLE(id uuid, kind text, name text, description text, image_url text, emoji text, color text,
              owner_id uuid, chat_enabled boolean, role text, members bigint, decks bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.kind, s.name, s.description, s.image_url, s.emoji, s.color, s.owner_id, s.chat_enabled,
         m.role,
         (SELECT count(*) FROM public.space_members x WHERE x.space_id = s.id),
         (SELECT count(*) FROM public.space_decks d WHERE d.space_id = s.id)
  FROM public.spaces s
  JOIN public.space_members m ON m.space_id = s.id AND m.user_id = auth.uid()
  ORDER BY s.created_at DESC;
$$;

ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spaces_select" ON public.spaces FOR SELECT TO authenticated
  USING (discoverable OR public.is_space_member(id, auth.uid()));
CREATE POLICY "spaces_insert" ON public.spaces FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "spaces_update" ON public.spaces FOR UPDATE TO authenticated
  USING (public.can_manage_space(id, auth.uid()))
  WITH CHECK (public.can_manage_space(id, auth.uid()));
CREATE POLICY "spaces_delete" ON public.spaces FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "space_members_select" ON public.space_members FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "space_members_insert" ON public.space_members FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_space(space_id, auth.uid()));
CREATE POLICY "space_members_update" ON public.space_members FOR UPDATE TO authenticated
  USING (public.can_manage_space(space_id, auth.uid()) OR user_id = auth.uid())
  WITH CHECK (public.can_manage_space(space_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "space_members_delete" ON public.space_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_space(space_id, auth.uid()));

CREATE POLICY "space_invites_select" ON public.space_invites FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "space_invites_write" ON public.space_invites FOR ALL TO authenticated
  USING (public.can_manage_space(space_id, auth.uid()))
  WITH CHECK (public.can_manage_space(space_id, auth.uid()));

CREATE POLICY "space_folders_select" ON public.space_folders FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "space_folders_write" ON public.space_folders FOR ALL TO authenticated
  USING (public.can_manage_space(space_id, auth.uid()))
  WITH CHECK (public.can_manage_space(space_id, auth.uid()));

CREATE POLICY "space_decks_select" ON public.space_decks FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "space_decks_insert" ON public.space_decks FOR INSERT TO authenticated
  WITH CHECK (added_by = auth.uid() AND public.space_can_add_decks(space_id, auth.uid()));
CREATE POLICY "space_decks_update" ON public.space_decks FOR UPDATE TO authenticated
  USING (public.can_manage_space(space_id, auth.uid()))
  WITH CHECK (public.can_manage_space(space_id, auth.uid()));
CREATE POLICY "space_decks_delete" ON public.space_decks FOR DELETE TO authenticated
  USING (added_by = auth.uid() OR public.can_manage_space(space_id, auth.uid()));

CREATE POLICY "space_ann_select" ON public.space_announcements FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE POLICY "space_ann_insert" ON public.space_announcements FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.space_can_post(space_id, auth.uid()));
CREATE POLICY "space_ann_update" ON public.space_announcements FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.can_manage_space(space_id, auth.uid()))
  WITH CHECK (author_id = auth.uid() OR public.can_manage_space(space_id, auth.uid()));
CREATE POLICY "space_ann_delete" ON public.space_announcements FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.can_manage_space(space_id, auth.uid()));

CREATE POLICY "space_msg_select" ON public.space_messages FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()) AND public.space_chat_on(space_id));
CREATE POLICY "space_msg_insert" ON public.space_messages FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.is_space_member(space_id, auth.uid()) AND public.space_chat_on(space_id));
CREATE POLICY "space_msg_delete" ON public.space_messages FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.can_manage_space(space_id, auth.uid()));

CREATE TRIGGER spaces_touch BEFORE UPDATE ON public.spaces
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();