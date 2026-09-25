CREATE OR REPLACE FUNCTION public.bump_deck_saves(_deck_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.shared_decks
     SET save_count = (SELECT count(*) FROM public.shared_deck_saves s WHERE s.deck_id = _deck_id)
   WHERE id = _deck_id AND published = true;
$$;
REVOKE ALL ON FUNCTION public.bump_deck_saves(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bump_deck_saves(uuid) TO authenticated;