ALTER TABLE public.rita_turn_metrics
  ADD COLUMN IF NOT EXISTS signal_start_ms integer,
  ADD COLUMN IF NOT EXISTS first_audio_sent_ms integer,
  ADD COLUMN IF NOT EXISTS deepgram_speech_ms integer,
  ADD COLUMN IF NOT EXISTS deepgram_result_ms integer,
  ADD COLUMN IF NOT EXISTS deepgram_event text,
  ADD COLUMN IF NOT EXISTS deepgram_detail text;