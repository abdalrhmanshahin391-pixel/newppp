-- Faster per-account lookups
CREATE INDEX IF NOT EXISTS study_subjects_user_idx ON public.study_subjects (user_id);
CREATE INDEX IF NOT EXISTS study_topics_user_idx ON public.study_topics (user_id);
CREATE INDEX IF NOT EXISTS shared_decks_owner_idx ON public.shared_decks (owner_id);
CREATE INDEX IF NOT EXISTS flash_subjects_user_idx ON public.flash_subjects (user_id);
CREATE INDEX IF NOT EXISTS card_reviews_user_due_idx ON public.card_reviews (user_id, due_at);

-- Helper checks used by public-facing reads
GRANT EXECUTE ON FUNCTION public.can_manage_committee(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.event_visible(uuid) TO anon;