DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles WITH (security_invoker = on) AS
  SELECT id, username, full_name, avatar_url, bio FROM public.profiles;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

GRANT SELECT (id, username, full_name, avatar_url, bio) ON public.profiles TO anon, authenticated;

CREATE POLICY "shared deck authors are visible" ON public.profiles
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.shared_decks d WHERE d.owner_id = profiles.id AND d.published = true)
  );