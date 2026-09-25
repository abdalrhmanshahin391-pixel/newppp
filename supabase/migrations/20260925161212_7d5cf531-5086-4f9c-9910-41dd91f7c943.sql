ALTER TABLE public.rita_voice_settings
  ADD COLUMN IF NOT EXISTS groq_model text NOT NULL DEFAULT 'mistral-saba-24b',
  ADD COLUMN IF NOT EXISTS second_pass_stt boolean NOT NULL DEFAULT true;

ALTER TABLE public.rita_user_preferences
  ADD COLUMN IF NOT EXISTS auto_save_words boolean NOT NULL DEFAULT true;

ALTER TABLE public.rita_turn_metrics
  ADD COLUMN IF NOT EXISTS response_provider text,
  ADD COLUMN IF NOT EXISTS response_model text,
  ADD COLUMN IF NOT EXISTS second_pass_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS second_pass_ms integer;