export type VoiceTimeSnapshot = {
  remainingSeconds: number | null;
  unlimited: boolean;
  activeSessionId: string | null;
  activeDeadline: string | null;
  serverNow: string;
  enabled: boolean;
  limitSeconds: number | null;
  period: string;
  resetsAt: string | null;
};
export function voiceSecondsLeft(snapshot: VoiceTimeSnapshot, elapsedMs: number) {
  if (snapshot.unlimited) return null;
  if (!Number.isFinite(snapshot.remainingSeconds)) return 0;
  const activeSeconds =
    snapshot.activeSessionId && snapshot.activeDeadline
      ? Math.max(0, (Date.parse(snapshot.activeDeadline) - Date.parse(snapshot.serverNow)) / 1000)
      : 0;
  return Math.max(
    0,
    Math.floor(snapshot.remainingSeconds! - Math.min(activeSeconds, Math.max(0, elapsedMs) / 1000)),
  );
}
export function voiceTimeLabel(seconds: number | null) {
  if (seconds === null) return "∞";
  const value = Math.max(0, Math.floor(seconds));
  return [Math.floor(value / 3600), Math.floor(value / 60) % 60, value % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}
export function publishVoiceTime(snapshot?: VoiceTimeSnapshot) {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("uzyra-voice-time", { detail: snapshot }));
}
