ALTER TABLE public.rita_voice_settings ALTER COLUMN groq_model SET DEFAULT 'qwen/qwen3.8-27b';
UPDATE public.rita_voice_settings SET groq_model = 'qwen/qwen3.8-27b' WHERE groq_model IS DISTINCT FROM 'qwen/qwen3.8-27b';
UPDATE public.admin_ai_keys SET preferred_model = 'qwen/qwen3.8-27b' WHERE provider = 'groq';