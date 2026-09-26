ALTER TABLE public.rita_voice_settings ADD COLUMN IF NOT EXISTS stt_engine text NOT NULL DEFAULT 'whisper';
ALTER TABLE public.rita_voice_settings DROP CONSTRAINT IF EXISTS rita_voice_settings_stt_engine_check;
ALTER TABLE public.rita_voice_settings ADD CONSTRAINT rita_voice_settings_stt_engine_check CHECK (stt_engine IN ('whisper','deepgram'));
UPDATE public.rita_voice_settings SET stt_engine = 'whisper' WHERE id = true;