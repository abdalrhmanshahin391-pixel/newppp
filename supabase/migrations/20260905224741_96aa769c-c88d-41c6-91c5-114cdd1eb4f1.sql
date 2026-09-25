ALTER TABLE public.admin_ai_keys ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'shared';

ALTER TABLE public.admin_ai_keys DROP CONSTRAINT IF EXISTS admin_ai_keys_pkey;
ALTER TABLE public.admin_ai_keys DROP CONSTRAINT IF EXISTS admin_ai_keys_provider_slot_key;

ALTER TABLE public.admin_ai_keys
  ADD CONSTRAINT admin_ai_keys_provider_slot_purpose_key UNIQUE (provider, slot, purpose);

ALTER TABLE public.admin_ai_keys
  ADD CONSTRAINT admin_ai_keys_purpose_check
  CHECK (purpose IN ('shared','aio','rita','lecture','questions'));