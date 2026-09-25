export type RitaEconomicReply = {
  turnId: string;
  traceId: string;
  reply: string;
  detectedLanguage: string;
  detectedDialect: string;
  emotion: string;
  totalMs: number;
  serverTimings?: Record<string, number>;
  segmentsPlanned?: number;
};

export type RitaSpeechSegment = {
  turnId: string;
  index: number;
  text: string;
  ticket: string;
  language: string;
  dialect: string;
  emotion: string;
};

let sessionTicket: { ticket: string; expiresAt: number } | null = null;
/** Stores the short signed ticket issued by /api/rita/warm. */
export function setRitaSessionTicket(value: unknown) {
  const v = value as { ticket?: unknown; expiresAt?: unknown } | null;
  if (v && typeof v.ticket === "string" && typeof v.expiresAt === "number")
    sessionTicket = { ticket: v.ticket, expiresAt: v.expiresAt };
}
export function clearRitaSessionTicket() {
  sessionTicket = null;
}
function ticketHeader(): Record<string, string> {
  return sessionTicket && sessionTicket.expiresAt - Date.now() > 30_000
    ? { "x-rita-ticket": sessionTicket.ticket }
    : {};
}

export async function streamRitaEconomicReply(args: {
  token: string;
  signal: AbortSignal;
  body: Record<string, unknown>;
  onDelta: (delta: string) => void;
  onStarted?: (turnId: string, traceId: string, serverTimings?: Record<string, number>) => void;
  onSpeechSegment?: (segment: RitaSpeechSegment) => void;
}) {
  const response = await fetch("/api/rita/respond", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.token}`,
      "Content-Type": "application/json",
      ...ticketHeader(),
    },
    body: JSON.stringify(args.body),
    signal: args.signal,
  });
  if (!response.ok || !response.body) {
    const detail = (await response.json().catch(() => null)) as {
      error?: string;
      stage?: string;
      traceId?: string;
    } | null;
    throw new Error(
      `${detail?.stage || "gpt_response"}: ${detail?.error || "GPT-4o mini did not start."}${detail?.traceId ? ` [${detail.traceId}]` : ""}`,
    );
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "message";
  let done: RitaEconomicReply | null = null;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
          continue;
        }
        if (!line.startsWith("data:")) continue;
        const raw = line.slice(5).trim();
        if (!raw) continue;
        const payload = JSON.parse(raw) as Record<string, unknown>;
        if (eventName === "turn.started")
          args.onStarted?.(
            String(payload.turnId ?? ""),
            String(payload.traceId ?? ""),
            payload.timings as Record<string, number> | undefined,
          );
        else if (eventName === "reply.delta") args.onDelta(String(payload.text ?? ""));
        else if (eventName === "speech.segment")
          args.onSpeechSegment?.(payload as unknown as RitaSpeechSegment);
        else if (eventName === "reply.done") done = payload as unknown as RitaEconomicReply;
        else if (eventName === "turn.error")
          throw new Error(
            `${String(payload.stage || "gpt_response")}: ${String(payload.error || "GPT stream failed.")}${payload.traceId ? ` [${String(payload.traceId)}]` : ""}`,
          );
        eventName = "message";
      }
    }
  } finally {
    reader.releaseLock();
  }
  if (!done) throw new Error("gpt_response: The streamed reply ended before completion.");
  return done;
}
