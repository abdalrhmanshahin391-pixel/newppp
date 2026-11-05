export type VoicePhase = "idle" | "connecting" | "waiting" | "ready" | "failed" | "ended";

/** A retired call cannot publish callbacks into the next call. */
export class VoiceAttempt {
  private closed = false;
  get current() {
    return !this.closed;
  }
  close() {
    this.closed = true;
  }
}

export function guardVoiceCallbacks<T extends object>(callbacks: T, current: () => boolean): T {
  return Object.fromEntries(
    Object.entries(callbacks).map(([key, callback]) => [
      key,
      typeof callback === "function"
        ? (...args: unknown[]) => {
            if (current()) return callback(...args);
          }
        : callback,
    ]),
  ) as T;
}

export function voiceErrorMessage(error: unknown, arabic: boolean): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (/permission|notallowed|microphone/i.test(raw)) {
    return arabic
      ? "اسمح للميكروفون من إعدادات المتصفح، ثم أعد الاتصال."
      : "Allow microphone access, then reconnect.";
  }
  if (
    /\b401\b|\b403\b|unauthori|authentication|(?:invalid|missing|rejected)\s+(?:api.?key|credential)/i.test(
      raw,
    )
  ) {
    return arabic
      ? "خدمة الصوت رفضت الاتصال. يلزم فحص إعدادات الخدمة."
      : "The voice service rejected the connection. Its configuration needs checking.";
  }
  if (/handshake|timed?\s*out|timeout|network|connection|websocket|disconnect/i.test(raw)) {
    return arabic
      ? "تعذّر الاتصال بخدمة الصوت. اضغط «إعادة الاتصال»؛ محادثتك ومكانك بالدرس محفوظين في الصفحة."
      : "The voice connection failed. Reconnect to continue; your conversation stays on this page.";
  }
  return arabic
    ? "توقّف اتصال ريتا. اضغط «إعادة الاتصال» للمحاولة من جديد."
    : "Rita's connection stopped. Reconnect to try again.";
}

export function voiceStateWord(phase: VoicePhase, mood: string, muted: boolean): string {
  if (phase === "failed") return "الاتصال متوقّف";
  if (phase === "connecting") return "بتجهّز الاتصال…";
  if (phase === "waiting") return "بانتظار خدمة الصوت…";
  if (phase === "ended") return "انتهت المكالمة";
  if (phase === "idle") return "ابدأ مع ريتا";
  if (mood === "talking" || mood === "laughing") return "بتحكي…";
  if (mood === "thinking") return "بتفكر…";
  return muted ? "المايك مسكّر" : "بسمعك…";
}
