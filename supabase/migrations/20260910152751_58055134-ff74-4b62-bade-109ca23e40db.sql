CREATE TABLE public.manual_plan_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_slug text NOT NULL REFERENCES public.plans(slug) ON UPDATE CASCADE ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  reason text NOT NULL DEFAULT '',
  overrides_paid boolean NOT NULL DEFAULT true,
  granted_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  revoke_reason text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT manual_plan_grants_valid_window CHECK (expires_at IS NULL OR expires_at > starts_at),
  CONSTRAINT manual_plan_grants_reason_length CHECK (char_length(reason) <= 500),
  CONSTRAINT manual_plan_grants_revoke_reason_length CHECK (revoke_reason IS NULL OR char_length(revoke_reason) <= 500)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_plan_grants TO authenticated;
GRANT ALL ON public.manual_plan_grants TO service_role;
ALTER TABLE public.manual_plan_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students view own manual access" ON public.manual_plan_grants FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins create manual access" ON public.manual_plan_grants FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND granted_by = auth.uid());
CREATE POLICY "Admins update manual access" ON public.manual_plan_grants FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete manual access" ON public.manual_plan_grants FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX manual_plan_grants_user_active_idx ON public.manual_plan_grants (user_id, starts_at DESC, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX manual_plan_grants_admin_history_idx ON public.manual_plan_grants (granted_at DESC);
CREATE OR REPLACE FUNCTION public.touch_manual_plan_grant_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER touch_manual_plan_grants BEFORE UPDATE ON public.manual_plan_grants FOR EACH ROW EXECUTE FUNCTION public.touch_manual_plan_grant_updated_at();
CREATE OR REPLACE FUNCTION public.effective_plan_slug(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH active_manual AS (
    SELECT mpg.plan_slug, mpg.overrides_paid, mpg.granted_at
    FROM public.manual_plan_grants mpg
    WHERE mpg.user_id = _user_id
      AND mpg.revoked_at IS NULL
      AND mpg.starts_at <= now()
      AND (mpg.expires_at IS NULL OR mpg.expires_at > now())
    ORDER BY mpg.overrides_paid DESC, mpg.granted_at DESC
    LIMIT 1
  )
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM active_manual WHERE overrides_paid) THEN (SELECT plan_slug FROM active_manual)
    ELSE COALESCE((SELECT up.plan_slug FROM public.user_plans up WHERE up.user_id = _user_id), (SELECT plan_slug FROM active_manual), 'starter')
  END;
$$;
REVOKE ALL ON FUNCTION public.effective_plan_slug(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.effective_plan_slug(uuid) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.effective_plan(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _slug text;
  _base public.plans%ROWTYPE;
  _op public.plans%ROWTYPE;
  _claim public.toolkit_claims%ROWTYPE;
  _out jsonb;
BEGIN
  _slug := public.effective_plan_slug(_user_id);
  SELECT * INTO _base FROM public.plans WHERE slug = _slug;
  IF _base.slug IS NULL THEN SELECT * INTO _base FROM public.plans WHERE published ORDER BY sort LIMIT 1; END IF;
  _out := to_jsonb(_base);
  SELECT c.* INTO _claim FROM public.toolkit_claims c WHERE c.user_id = _user_id AND (c.expires_at IS NULL OR c.expires_at > now()) AND c.offer_id IS NOT NULL ORDER BY c.created_at DESC LIMIT 1;
  IF _claim.id IS NOT NULL THEN
    SELECT * INTO _op FROM public.plans WHERE slug = _claim.plan_slug;
    IF _op.slug IS NOT NULL THEN
      _out := _out || jsonb_build_object(
        'name', _base.name || ' + ' || _op.name,
        'max_flashcards', public.merge_cap(_base.max_flashcards, _op.max_flashcards),
        'max_ai_questions', public.merge_cap(_base.max_ai_questions, _op.max_ai_questions),
        'max_summaries', public.merge_cap(_base.max_summaries, _op.max_summaries),
        'max_todo_tasks', public.merge_cap(_base.max_todo_tasks, _op.max_todo_tasks),
        'max_calendar_items', public.merge_cap(_base.max_calendar_items, _op.max_calendar_items),
        'max_groups', public.merge_cap(_base.max_groups, _op.max_groups),
        'max_all_in_one_lectures', public.merge_cap(_base.max_all_in_one_lectures, _op.max_all_in_one_lectures),
        'max_all_in_one_questions', public.merge_cap(_base.max_all_in_one_questions, _op.max_all_in_one_questions),
        'max_archive_questions', public.merge_cap(_base.max_archive_questions, _op.max_archive_questions),
        'max_rita_questions', public.merge_cap(_base.max_rita_questions, _op.max_rita_questions),
        'todo_full', _base.todo_full OR _op.todo_full,
        'rich_cards', _base.rich_cards OR _op.rich_cards,
        'feature_lecture_qgen', _base.feature_lecture_qgen OR _op.feature_lecture_qgen,
        'feature_archive_qgen', _base.feature_archive_qgen OR _op.feature_archive_qgen,
        'feature_all_in_one', _base.feature_all_in_one OR _op.feature_all_in_one,
        'feature_rita38', _base.feature_rita38 OR _op.feature_rita38,
        'offer_name', _op.name,
        'offer_plan_slug', _op.slug,
        'offer_expires_at', _claim.expires_at
      );
    END IF;
  END IF;
  RETURN _out;
END;
$$;