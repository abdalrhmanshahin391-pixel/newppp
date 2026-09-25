ALTER TABLE public.rita_turn_metrics
  ADD COLUMN IF NOT EXISTS client_turn_id uuid,
  ADD COLUMN IF NOT EXISTS trace_id uuid,
  ADD COLUMN IF NOT EXISTS diagnostic_code text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'started',
  ADD COLUMN IF NOT EXISTS end_reason text,
  ADD COLUMN IF NOT EXISTS last_stage text,
  ADD COLUMN IF NOT EXISTS speech_start_ms integer,
  ADD COLUMN IF NOT EXISTS speech_end_ms integer,
  ADD COLUMN IF NOT EXISTS first_interim_ms integer,
  ADD COLUMN IF NOT EXISTS transcript_final_ms integer,
  ADD COLUMN IF NOT EXISTS request_sent_ms integer,
  ADD COLUMN IF NOT EXISTS first_token_ms integer,
  ADD COLUMN IF NOT EXISTS text_complete_ms integer,
  ADD COLUMN IF NOT EXISTS text_rendered_ms integer,
  ADD COLUMN IF NOT EXISTS first_audio_ms integer,
  ADD COLUMN IF NOT EXISTS playback_end_ms integer,
  ADD COLUMN IF NOT EXISTS server_auth_ms integer,
  ADD COLUMN IF NOT EXISTS server_config_ms integer,
  ADD COLUMN IF NOT EXISTS server_allowance_ms integer,
  ADD COLUMN IF NOT EXISTS server_first_token_ms integer,
  ADD COLUMN IF NOT EXISTS server_reply_done_ms integer,
  ADD COLUMN IF NOT EXISTS transcript_char_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reply_char_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS segments_planned integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS segments_requested integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS segments_received integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS segments_played integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS segments_completed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS planned_audio_ms integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS received_audio_ms integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS played_audio_ms integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS filler_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS rita_turn_metrics_user_client_turn_idx
  ON public.rita_turn_metrics (user_id, client_turn_id)
  WHERE client_turn_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS rita_turn_metrics_user_turn_idx
  ON public.rita_turn_metrics (user_id, turn_id)
  WHERE turn_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS rita_turn_metrics_status_created_idx
  ON public.rita_turn_metrics (status, created_at DESC);

CREATE TABLE public.rita_turn_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  turn_id uuid NOT NULL,
  segment_index integer NOT NULL CHECK (segment_index BETWEEN 0 AND 15),
  char_count integer NOT NULL DEFAULT 0,
  request_ms integer,
  headers_ms integer,
  first_byte_ms integer,
  received_ms integer,
  queued_ms integer,
  playback_start_ms integer,
  playback_end_ms integer,
  received_bytes integer NOT NULL DEFAULT 0,
  played_audio_ms integer NOT NULL DEFAULT 0,
  provider_ms integer,
  http_status integer,
  status text NOT NULL DEFAULT 'planned',
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, turn_id, segment_index)
);
GRANT SELECT ON public.rita_turn_segments TO authenticated;
GRANT ALL ON public.rita_turn_segments TO service_role;
ALTER TABLE public.rita_turn_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read rita turn segments"
  ON public.rita_turn_segments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));