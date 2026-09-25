ALTER TABLE public.shared_decks
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'public';

ALTER TABLE public.shared_decks
  DROP CONSTRAINT IF EXISTS shared_decks_audience_check;
ALTER TABLE public.shared_decks
  ADD CONSTRAINT shared_decks_audience_check CHECK (audience IN ('public','space'));

CREATE INDEX IF NOT EXISTS shared_decks_audience_idx ON public.shared_decks (audience, created_at DESC);

CREATE OR REPLACE FUNCTION public.deck_in_my_space(_deck_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.space_decks sd
    JOIN public.space_members sm
      ON sm.space_id = sd.space_id AND sm.user_id = _user_id
    WHERE sd.deck_id = _deck_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.deck_in_my_space(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "space members read space decks" ON public.shared_decks;
CREATE POLICY "space members read space decks"
  ON public.shared_decks FOR SELECT TO authenticated
  USING (public.deck_in_my_space(id, auth.uid()));

DROP POLICY IF EXISTS "space members read space deck cards" ON public.shared_deck_cards;
CREATE POLICY "space members read space deck cards"
  ON public.shared_deck_cards FOR SELECT TO authenticated
  USING (public.deck_in_my_space(deck_id, auth.uid()));