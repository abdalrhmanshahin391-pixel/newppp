/** The events the live page may report about a conversation, and the checks they pass on the server. */

export const ALLOWED_EVENTS = new Set([
  "speech_start",
  "speech_end",
  "start_clicked",
  "transcript_partial",
  "transcript_final",
  "llm_start",
  "llm_first_token",
  "tts_start",
  "bot_speaking_signal",
  "first_remote_audio",
  "first_remote_audio_level",
  "session_ready",
  "interrupted",
  "provider_error",
  "session_connected",
  "transport_connected",
  "bot_ready",
  "start_call_returned",
  "provider_metrics",
  "playback_stop",
  "turn_commit",
  "backchannel",
  "stop_button",
  "false_interruption",
  "microphone_permission_error",
  "client_connection_error",
  "network_snapshot",
  "network_stats_unavailable",
  "dialogue_act",
  "explanation_language",
  "turn_ledger",
  "metrics_dropped",
]);

const METADATA_LIMIT = 12_000;

export type CleanMetric = {
  name: string;
  valueMs?: number;
  metadata: Record<string, unknown>;
};

/** One metric from the page, or null when it is not an allowed event. Oversize metadata is cut, not trusted. */
export function cleanMetricEvent(raw: unknown): CleanMetric | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const name = String(body.name ?? "");
  if (!ALLOWED_EVENTS.has(name)) return null;
  const rawMetadata =
    body.metadata && typeof body.metadata === "object" ? JSON.stringify(body.metadata) : "{}";
  const metadata =
    rawMetadata.length <= METADATA_LIMIT
      ? (JSON.parse(rawMetadata) as Record<string, unknown>)
      : { truncated: true, preview: rawMetadata.slice(0, METADATA_LIMIT - 500) };
  const value = Number(body.valueMs);
  return {
    name,
    valueMs: body.valueMs !== undefined && Number.isFinite(value) ? Math.max(0, value) : undefined,
    metadata,
  };
}
