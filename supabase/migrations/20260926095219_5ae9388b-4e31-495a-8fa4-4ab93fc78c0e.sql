ALTER TABLE public.rita_voice_settings DROP CONSTRAINT IF EXISTS rita_voice_settings_stt_engine_check;
UPDATE public.rita_voice_settings SET stt_engine = 'whisper' WHERE stt_engine NOT IN ('whisper','deepgram','realtime');
ALTER TABLE public.rita_voice_settings ADD CONSTRAINT rita_voice_settings_stt_engine_check CHECK (stt_engine IN ('whisper','deepgram','realtime'));