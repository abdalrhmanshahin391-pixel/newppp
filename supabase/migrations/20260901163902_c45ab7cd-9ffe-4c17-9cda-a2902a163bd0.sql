CREATE OR REPLACE FUNCTION public.create_space(_kind text, _name text, _description text, _emoji text, _color text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _id uuid;
  _code text;
  _cap integer;
  _owned integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'sign_in_required'; END IF;
  IF _kind NOT IN ('classroom','group') THEN RAISE EXCEPTION 'bad_kind'; END IF;

  IF NOT public.has_role(_uid, 'admin') THEN
    SELECT p.max_groups INTO _cap
      FROM public.plans p
     WHERE p.slug = COALESCE((SELECT plan_slug FROM public.user_plans WHERE user_id = _uid), 'starter');
    IF _cap IS NOT NULL THEN
      SELECT count(*) INTO _owned FROM public.spaces WHERE owner_id = _uid;
      IF _owned >= _cap THEN
        RAISE EXCEPTION 'Your plan lets you create % classrooms. Delete one or upgrade on the Plans page.', _cap;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.spaces (kind, name, description, emoji, color, owner_id)
  VALUES (_kind, trim(_name), NULLIF(trim(coalesce(_description,'')),''), _emoji, coalesce(_color,'apricot'), _uid)
  RETURNING id INTO _id;
  INSERT INTO public.space_members (space_id, user_id, role) VALUES (_id, _uid, 'owner');
  _code := lower(replace(gen_random_uuid()::text, '-', ''));
  _code := substr(_code, 1, 10);
  INSERT INTO public.space_invites (space_id, code, created_by) VALUES (_id, _code, _uid);
  RETURN _id;
END;
$$;