DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND column_name='groq_model' AND table_name='rita_live_settings') THEN
    ALTER TABLE public.rita_live_settings ALTER COLUMN groq_model SET DEFAULT 'llama-3.3-70b-versatile';
    UPDATE public.rita_live_settings SET groq_model='llama-3.3-70b-versatile' WHERE groq_model IN ('mistral-saba-24b','mixtral-8x7b-32768','gemma2-9b-it');
  END IF;
END $$;
UPDATE public.admin_ai_keys SET preferred_model='llama-3.3-70b-versatile' WHERE provider='groq' AND preferred_model IN ('mistral-saba-24b','mixtral-8x7b-32768','gemma2-9b-it');