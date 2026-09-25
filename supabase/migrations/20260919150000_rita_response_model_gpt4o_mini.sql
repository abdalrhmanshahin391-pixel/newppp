-- Keep Rita's recorded response model aligned with the only runtime model.
ALTER TABLE IF EXISTS public.rita_voice_usage
  ALTER COLUMN response_model SET DEFAULT 'gpt-4o-mini';
