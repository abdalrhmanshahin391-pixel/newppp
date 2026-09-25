-- Rita Economic v2 rollout, stable preferences, and stage timing telemetry.
ALTER TABLE public.rita_voice_settings
  ADD COLUMN IF NOT EXISTS pipeline_mode text NOT NULL DEFAULT 'economic_v2'
    CHECK (pipeline_mode IN ('legacy', 'economic_v2')),
  ADD COLUMN IF NOT EXISTS rollout_percent integer NOT NULL DEFAULT 100
    CHECK (rollout_percent BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS admin_only_preview boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.rita_user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_language text NOT NULL DEFAULT 'unknown',
  active_dialect text NOT NULL DEFAULT 'standard',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rita_user_preferences ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rita_user_preferences TO authenticated;
GRANT ALL ON public.rita_user_preferences TO service_role;
DROP POLICY IF EXISTS "users manage own rita preferences" ON public.rita_user_preferences;
CREATE POLICY "users manage own rita preferences"
  ON public.rita_user_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.rita_turn_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.rita_voice_sessions(id) ON DELETE SET NULL,
  turn_id uuid,
  pipeline_mode text NOT NULL CHECK (pipeline_mode IN ('legacy', 'economic_v2')),
  language text,
  browser text,
  network_type text,
  speech_end_to_transcript_ms integer,
  transcript_to_first_token_ms integer,
  first_token_to_tts_ms integer,
  speech_end_to_first_audio_ms integer,
  interrupted boolean NOT NULL DEFAULT false,
  fallback_used boolean NOT NULL DEFAULT false,
  error_stage text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rita_turn_metrics_created_idx
  ON public.rita_turn_metrics (created_at DESC);
CREATE INDEX IF NOT EXISTS rita_turn_metrics_user_idx
  ON public.rita_turn_metrics (user_id, created_at DESC);
ALTER TABLE public.rita_turn_metrics ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.rita_turn_metrics TO authenticated;
GRANT ALL ON public.rita_turn_metrics TO service_role;
DROP POLICY IF EXISTS "admins read rita metrics" ON public.rita_turn_metrics;
CREATE POLICY "admins read rita metrics"
  ON public.rita_turn_metrics FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
