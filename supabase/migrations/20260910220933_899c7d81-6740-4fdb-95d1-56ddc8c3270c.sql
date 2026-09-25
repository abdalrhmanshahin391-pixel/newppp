-- 1. Lock down SECURITY DEFINER helpers not meant for direct client calls
REVOKE EXECUTE ON FUNCTION public.bump_usage(uuid, text, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.vault_tables() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_lq_default_bucket() FROM anon;

-- 2. Public counts should respect RLS instead of bypassing it
ALTER FUNCTION public.get_subject_question_counts(uuid[]) SECURITY INVOKER;

-- 3. Avatars: remove anonymous read of a private bucket (authenticated policy stays)
DROP POLICY IF EXISTS "avatars are viewable" ON storage.objects;

-- 4. public_profiles: scope authenticated reads
DROP POLICY IF EXISTS "profiles readable by members" ON public.public_profiles;
CREATE POLICY "profiles readable in context"
ON public.public_profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.shared_decks d
    WHERE d.owner_id = public_profiles.id AND d.published = true
  )
  OR EXISTS (
    SELECT 1 FROM public.space_members me
    JOIN public.space_members them ON them.space_id = me.space_id
    WHERE me.user_id = auth.uid() AND them.user_id = public_profiles.id
  )
);