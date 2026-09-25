ALTER TABLE public.rita_voice_settings
  ADD COLUMN IF NOT EXISTS tts_provider text NOT NULL DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS cartesia_voice_id text NOT NULL DEFAULT '64a941ac-07ac-462c-a81c-008e353dd83e',
  ADD COLUMN IF NOT EXISTS cartesia_model text NOT NULL DEFAULT 'sonic-3';