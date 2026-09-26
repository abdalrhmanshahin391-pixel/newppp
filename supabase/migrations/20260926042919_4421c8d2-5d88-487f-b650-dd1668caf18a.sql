ALTER TABLE public.rita_voice_settings ALTER COLUMN groq_model SET DEFAULT 'openai/gpt-oss-20b';
UPDATE public.rita_voice_settings SET groq_model = 'openai/gpt-oss-20b';
UPDATE public.admin_ai_keys SET preferred_model = 'openai/gpt-oss-20b' WHERE provider = 'groq';