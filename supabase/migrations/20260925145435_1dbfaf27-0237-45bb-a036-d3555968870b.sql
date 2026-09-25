ALTER TABLE public.rita_turn_metrics
  ADD COLUMN IF NOT EXISTS transcription_end_reason text,
  ADD COLUMN IF NOT EXISTS voice_engine text;

ALTER TABLE public.rita_turn_segments
  ADD COLUMN IF NOT EXISTS voice_engine text;