ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = off) AS
  SELECT id, username, full_name, avatar_url, bio FROM public.profiles;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.shared_decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  cover text NOT NULL DEFAULT 'apricot',
  emoji text,
  tags text[] NOT NULL DEFAULT '{}',
  card_count integer NOT NULL DEFAULT 0,
  save_count integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_decks TO authenticated;
GRANT SELECT ON public.shared_decks TO anon;
GRANT ALL ON public.shared_decks TO service_role;
ALTER TABLE public.shared_decks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "published decks are public" ON public.shared_decks
  FOR SELECT TO anon, authenticated USING (published = true);
CREATE POLICY "owners read own decks" ON public.shared_decks
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "owners insert decks" ON public.shared_decks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners update decks" ON public.shared_decks
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners delete decks" ON public.shared_decks
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER shared_decks_touch BEFORE UPDATE ON public.shared_decks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.shared_deck_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES public.shared_decks(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_name text,
  front text NOT NULL,
  back text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shared_deck_cards_deck_idx ON public.shared_deck_cards(deck_id, sort);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_deck_cards TO authenticated;
GRANT SELECT ON public.shared_deck_cards TO anon;
GRANT ALL ON public.shared_deck_cards TO service_role;
ALTER TABLE public.shared_deck_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cards of published decks are public" ON public.shared_deck_cards
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.shared_decks d WHERE d.id = deck_id AND d.published = true)
  );
CREATE POLICY "owners read own deck cards" ON public.shared_deck_cards
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "owners write deck cards" ON public.shared_deck_cards
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners update deck cards" ON public.shared_deck_cards
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners delete deck cards" ON public.shared_deck_cards
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TABLE IF NOT EXISTS public.shared_deck_saves (
  deck_id uuid NOT NULL REFERENCES public.shared_decks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (deck_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.shared_deck_saves TO authenticated;
GRANT ALL ON public.shared_deck_saves TO service_role;
ALTER TABLE public.shared_deck_saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own saves" ON public.shared_deck_saves
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);