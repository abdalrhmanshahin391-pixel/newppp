-- Replace the definer view with a real, safe-by-construction public projection table.
DROP VIEW IF EXISTS public.public_profiles;

CREATE TABLE IF NOT EXISTS public.public_profiles (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  username text,
  full_name text,
  avatar_url text,
  bio text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.public_profiles TO anon, authenticated;
GRANT ALL ON public.public_profiles TO service_role;

ALTER TABLE public.public_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public profiles are readable" ON public.public_profiles;
CREATE POLICY "public profiles are readable"
  ON public.public_profiles FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.public_profiles (id, username, full_name, avatar_url, bio)
SELECT id, username, full_name, avatar_url, bio FROM public.profiles
ON CONFLICT (id) DO UPDATE
  SET username = EXCLUDED.username,
      full_name = EXCLUDED.full_name,
      avatar_url = EXCLUDED.avatar_url,
      bio = EXCLUDED.bio,
      updated_at = now();

CREATE OR REPLACE FUNCTION public.sync_public_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.public_profiles (id, username, full_name, avatar_url, bio)
  VALUES (NEW.id, NEW.username, NEW.full_name, NEW.avatar_url, NEW.bio)
  ON CONFLICT (id) DO UPDATE
    SET username = EXCLUDED.username,
        full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        bio = EXCLUDED.bio,
        updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_public_profile() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_sync_public ON public.profiles;
CREATE TRIGGER profiles_sync_public
AFTER INSERT OR UPDATE OF username, full_name, avatar_url, bio ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_public_profile();
