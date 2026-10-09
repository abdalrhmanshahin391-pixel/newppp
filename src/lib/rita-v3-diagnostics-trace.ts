const TRACE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MODAL_TIMING_KEYS = [
  "dailyRoomMs",
  "dailyLearnerTokenMs",
  "dailyBotTokenMs",
  "workerSpawnRequestMs",
  "modalTotalMs",
] as const;

export function normalizeRitaDiagnosticTraceId(
  value: unknown,
  create: () => string = () => crypto.randomUUID(),
) {
  const traceId = String(value ?? "").trim();
  return TRACE_ID.test(traceId) ? traceId : create();
}

/** Keep only bounded numeric timing evidence returned by the trusted Modal endpoint. */
export function readModalTimingEvidence(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const timings = Object.fromEntries(
    MODAL_TIMING_KEYS.flatMap((key) => {
      const milliseconds = Number(record[key]);
      return Number.isFinite(milliseconds) && milliseconds >= 0 && milliseconds <= 60_000
        ? [[key, Math.round(milliseconds * 100) / 100]]
        : [];
    }),
  );
  return Object.keys(timings).length ? timings : undefined;
}
