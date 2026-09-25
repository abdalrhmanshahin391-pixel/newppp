CREATE INDEX IF NOT EXISTS rita_voice_usage_created_idx
  ON public.rita_voice_usage (created_at DESC);

CREATE OR REPLACE FUNCTION public.rita_voice_usage_totals(_user_id uuid)
RETURNS TABLE(used_month_ms bigint, used_today_ms bigint, global_month_micros bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(input_audio_ms + output_audio_ms) FILTER (
      WHERE user_id = _user_id
        AND created_at >= date_trunc('month', now())
    ), 0)::bigint,
    COALESCE(SUM(input_audio_ms + output_audio_ms) FILTER (
      WHERE user_id = _user_id
        AND created_at >= date_trunc('day', now())
    ), 0)::bigint,
    COALESCE(SUM(estimated_cost_micros) FILTER (
      WHERE created_at >= date_trunc('month', now())
    ), 0)::bigint
  FROM public.rita_voice_usage
  WHERE created_at >= date_trunc('month', now())
    AND (user_id = _user_id OR estimated_cost_micros > 0);
$$;

REVOKE ALL ON FUNCTION public.rita_voice_usage_totals(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rita_voice_usage_totals(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.rita_voice_usage_totals(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rita_voice_usage_totals(uuid) TO service_role;
