-- Cost-controlled Rita voice sessions. Only server-side service-role code writes usage.
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS rita_voice_minutes_monthly integer NOT NULL DEFAULT 0;

UPDATE public.plans
SET rita_voice_minutes_monthly = CASE slug
  WHEN 'starter' THEN 10
  WHEN 'toolkit' THEN 60
  WHEN 'boost' THEN 150
  WHEN 'pro' THEN 360
  WHEN 'ultimate' THEN 1200
  ELSE rita_voice_minutes_monthly
END;

CREATE TABLE IF NOT EXISTS public.rita_voice_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT true,
  voice text NOT NULL DEFAULT 'marin',
  response_words integer NOT NULL DEFAULT 55 CHECK (response_words BETWEEN 20 AND 120),
  daily_guard_minutes integer NOT NULL DEFAULT 120 CHECK (daily_guard_minutes BETWEEN 15 AND 720),
  default_monthly_minutes integer NOT NULL DEFAULT 1200 CHECK (default_monthly_minutes BETWEEN 30 AND 10000),
  monthly_budget_cents integer NOT NULL DEFAULT 10000 CHECK (monthly_budget_cents BETWEEN 100 AND 1000000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO public.rita_voice_settings (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.rita_voice_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.rita_voice_settings TO authenticated;
GRANT ALL ON public.rita_voice_settings TO service_role;
DROP POLICY IF EXISTS "admins manage rita voice settings" ON public.rita_voice_settings;
CREATE POLICY "admins manage rita voice settings"
  ON public.rita_voice_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.rita_voice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  personality text NOT NULL DEFAULT 'kind',
  language_preference text NOT NULL DEFAULT 'automatic',
  detected_language text,
  detected_dialect text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  client_label text
);

CREATE INDEX IF NOT EXISTS rita_voice_sessions_user_started_idx
  ON public.rita_voice_sessions (user_id, started_at DESC);
ALTER TABLE public.rita_voice_sessions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.rita_voice_sessions TO authenticated;
GRANT ALL ON public.rita_voice_sessions TO service_role;
DROP POLICY IF EXISTS "users read own rita sessions" ON public.rita_voice_sessions;
CREATE POLICY "users read own rita sessions"
  ON public.rita_voice_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.rita_voice_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.rita_voice_sessions(id) ON DELETE SET NULL,
  turn_id uuid NOT NULL DEFAULT gen_random_uuid(),
  input_audio_ms integer NOT NULL DEFAULT 0 CHECK (input_audio_ms >= 0),
  output_audio_ms integer NOT NULL DEFAULT 0 CHECK (output_audio_ms >= 0),
  input_tokens integer NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens integer NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  estimated_cost_micros integer NOT NULL DEFAULT 0 CHECK (estimated_cost_micros >= 0),
  provider text NOT NULL DEFAULT 'openai',
  transcription_model text NOT NULL DEFAULT 'gpt-4o-mini-transcribe',
  response_model text NOT NULL DEFAULT 'gpt-4o-mini',
  speech_model text NOT NULL DEFAULT 'gpt-4o-mini-tts',
  language text,
  dialect text,
  reply_sha256 text,
  premium_voice boolean NOT NULL DEFAULT true,
  speech_generated_at timestamptz,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rita_voice_usage_user_created_idx
  ON public.rita_voice_usage (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rita_voice_usage_session_idx
  ON public.rita_voice_usage (session_id);
ALTER TABLE public.rita_voice_usage ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.rita_voice_usage TO authenticated;
GRANT ALL ON public.rita_voice_usage TO service_role;
DROP POLICY IF EXISTS "users read own rita usage" ON public.rita_voice_usage;
CREATE POLICY "users read own rita usage"
  ON public.rita_voice_usage FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));
