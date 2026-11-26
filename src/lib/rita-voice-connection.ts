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

/** The start route's refusal reasons ("code: message" in the error text), in the learner's words. */
const REFUSALS: Array<[RegExp, string, string]> = [
  [
    /\bunauthorized: /i,
    "انتهت جلستك. سجّل دخول من جديد، ثم أعد الاتصال.",
    "Your session has ended. Sign in again, then reconnect.",
  ],
  [
    /free_talk_exhausted/i,
    "خلص وقت الصوت تبعك لليوم. بيرجع بكرا الساعة 12 بالليل.",
    "Your voice time for today is used up. It comes back at midnight (Amman time).",
  ],
  [
    /free_talk_payment_unverified|free_talk_plan_unavailable/i,
    "ما قدرنا نتأكد من اشتراكك. افتح صفحة باقتي وجرّب كمان مرة.",
    "We could not confirm your plan. Open My plan and try again.",
  ],
  [
    /free_talk_email_unverified/i,
    "أكّد إيميلك أول، وبعدين ابدأ المكالمة.",
    "Confirm your email first, then start the call.",
  ],
  [
    /free_talk_already_active/i,
    "في مكالمة ثانية مفتوحة. سكّرها وبعدين جرّب.",
    "Another call is still open. End it, then try again.",
  ],
  [
    /free_talk_not_enabled/i,
    "المحادثة الحرة مسكّرة هلّق. بتقدر تكمّل دروسك.",
    "Free conversation is switched off right now. Your lessons still work.",
  ],
  [
    /free_talk_start_rate_limit/i,
    "بلّشت مكالمات كثير ورا بعض. استنى دقيقة وجرّب.",
    "Too many calls in a row. Wait a minute and try again.",
  ],
  [
    /usage safety limit|\b(?:daily|monthly|hourly|usage|budget|safety)_?limit|\bdisabled\b/i,
    "صوت يوزرا وصل حد الاستخدام الآمن حالياً. جرّب بعد شوي.",
    "Uzyra's voice has reached its safety limit for now. Try again a little later.",
  ],
  [
    /voice_not_available_for_language/i,
    "صوت يوزرا مش متاح لهاي اللغة لسا.",
    "Uzyra's voice is not available for this language yet.",
  ],
  [
    /conversation_unavailable|invalid_conversation/i,
    "هاي المحادثة مش متاحة. ابدأ محادثة جديدة.",
    "This conversation is not available. Start a new one.",
  ],
  [/lesson_unavailable/i, "هاد الدرس مش متاح هلّق.", "This lesson is not available right now."],
  [
    /modal_not_configured|session_storage_failed|secrets_not_ready|agent_not_found|agent_unhealthy|provider_model_unavailable|capacity_unavailable|cold_start_timeout|pipecat_start_failed|pipecat_request_rejected/i,
    "خدمة الصوت مش جاهزة هلّق. جرّب كمان شوي.",
    "The voice service is not ready right now. Try again shortly.",
  ],
];

/** A provider error the call survives (a TTS or recogniser hiccup): only `fatal: false` counts. */
export function isRecoverableVoiceError(data: unknown): boolean {
  return Boolean(data && typeof data === "object" && (data as { fatal?: unknown }).fatal === false);
}

export function voiceErrorMessage(error: unknown, arabic: boolean): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  for (const [pattern, ar, en] of REFUSALS) {
    if (pattern.test(raw)) return arabic ? ar : en;
  }
  if (/permission|notallowed|microphone/i.test(raw)) {
    return arabic
      ? "اسمح للميكروفون من إعدادات المتصفح، ثم أعد الاتصال."
      : "Allow microphone access, then reconnect.";
  }
  if (
    /\b401\b|\b403\b|unauthori|provider_auth_failed|public_key_rejected|authentication|(?:invalid|missing|rejected)\s+(?:api.?key|credential)/i.test(
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
    ? "توقّف اتصال يوزرا. اضغط «إعادة الاتصال» للمحاولة من جديد."
    : "Uzyra's connection stopped. Reconnect to try again.";
}

export function voiceStateWord(phase: VoicePhase, mood: string, muted: boolean): string {
  if (phase === "failed") return "الاتصال متوقّف";
  if (phase === "connecting") return "بتجهّز الاتصال…";
  if (phase === "waiting") return "بانتظار خدمة الصوت…";
  if (phase === "ended") return "انتهت المكالمة";
  if (phase === "idle") return "ابدأ مع يوزرا";
  if (mood === "talking" || mood === "laughing") return "بتحكي…";
  if (mood === "thinking") return "بتفكر…";
  return muted ? "المايك مسكّر" : "بسمعك…";
}

/** A content-free reason for diagnostics: the refusal code, or a coarse kind of failure. */
export function failureCode(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const code = /^\s*([a-z][a-z0-9_]{2,60}):/.exec(raw)?.[1];
  if (code) return code;
  if (/timed?\s*out|timeout/i.test(raw)) return "timeout";
  if (/disconnect/i.test(raw)) return "disconnected";
  if (/handshake|network|websocket|connection/i.test(raw)) return "network";
  if (/permission|notallowed|microphone/i.test(raw)) return "microphone";
  return "other";
}
