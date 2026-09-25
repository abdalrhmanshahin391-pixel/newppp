CREATE UNIQUE INDEX IF NOT EXISTS rita_turn_metrics_user_client_turn_unique
  ON public.rita_turn_metrics (user_id, client_turn_id);
CREATE UNIQUE INDEX IF NOT EXISTS rita_turn_metrics_user_turn_unique
  ON public.rita_turn_metrics (user_id, turn_id);