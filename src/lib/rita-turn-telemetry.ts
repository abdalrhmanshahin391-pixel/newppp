export type RitaTurnEndReason =
  | "completed"
  | "user_barge_in"
  | "new_request"
  | "session_ended"
  | "tts_error"
  | "response_error"
  | "transcription_error"
  | "playback_interrupted";

export type RitaTurnTimeline = {
  clientTurnId: string;
  turnId: string;
  traceId: string;
  diagnosticCode: string;
  originMs: number;
  marks: Record<string, number>;
  status: "started" | "streaming" | "completed" | "failed" | "aborted" | "partial";
  endReason?: RitaTurnEndReason;
  lastStage: string;
  transcriptCharCount: number;
  replyCharCount: number;
  segmentsPlanned: number;
  segmentsRequested: number;
  segmentsReceived: number;
  segmentsPlayed: number;
  segmentsCompleted: number;
  plannedAudioMs: number;
  receivedAudioMs: number;
  playedAudioMs: number;
  fillerUsed: boolean;
  fallbackUsed: boolean;
  reconnectCount: number;
  deepgramEvent?: string;
  deepgramDetail?: string;
  transcriptionEndReason?: string;
  voiceEngine?: string;
  errorStage?: string;
  serverTimings?: Record<string, number>;
  sessionId?: string | null;
  pipelineMode?: "legacy" | "economic_v2";
  language?: string;
  browser?: string;
  networkType?: string;
};

export function createRitaTurnTimeline(
  origin = performance.now(),
  originMark: "speechStart" | "signalStart" = "speechStart",
): RitaTurnTimeline {
  const clientTurnId = crypto.randomUUID();
  return {
    clientTurnId,
    turnId: "",
    traceId: "",
    diagnosticCode: clientTurnId.slice(0, 8).toUpperCase(),
    originMs: origin,
    marks: { [originMark]: 0 },
    status: "started",
    lastStage: "speech_started",
    transcriptCharCount: 0,
    replyCharCount: 0,
    segmentsPlanned: 0,
    segmentsRequested: 0,
    segmentsReceived: 0,
    segmentsPlayed: 0,
    segmentsCompleted: 0,
    plannedAudioMs: 0,
    receivedAudioMs: 0,
    playedAudioMs: 0,
    fillerUsed: false,
    fallbackUsed: false,
    reconnectCount: 0,
  };
}

export function markRitaTurn(timeline: RitaTurnTimeline, name: string, at = performance.now()) {
  if (timeline.marks[name] === undefined) timeline.marks[name] = Math.max(0, Math.round(at - timeline.originMs));
  timeline.lastStage = name;
}

export function postRitaTurnTimeline(token: string, timeline: RitaTurnTimeline, segment?: Record<string, unknown>) {
  return fetch("/api/rita/metrics", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...timeline, segment }),
    keepalive: true,
  }).catch(() => undefined);
}