import { useVoiceTime } from "@/hooks/useVoiceTime";
import { voiceTimeLabel } from "@/lib/free-talk-time";
import { useUiLanguage } from "@/components/language/useUiLanguage";

/** Why the time could not be read, in the learner's words (the server's refusal code). */
function reason(error: unknown, ar: boolean): string {
  const code = error instanceof Error ? error.message : String(error ?? "");
  if (/free_talk_email_unverified/.test(code))
    return ar ? "أكّد إيميلك عشان يبيّن وقتك" : "Confirm your email to see your time";
  if (/free_talk_payment_unverified|free_talk_plan_unavailable/.test(code))
    return ar ? "ما قدرنا نتأكد من خطتك" : "Your plan could not be confirmed";
  return ar ? "الوقت غير متاح" : "Time unavailable";
}

/** Call time left (calls and the whiteboard's voice share it), as of this page load. */
export function VoiceTime() {
  const voice = useVoiceTime();
  const ar = useUiLanguage() === "ar";
  const noTime = !!voice.data && !voice.data.unlimited && !voice.data.limitSeconds;
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--pp-grey)] px-3 py-2 text-sm"
      aria-label={ar ? "وقت المكالمات" : "Call time"}
    >
      <span>{ar ? "وقت المكالمات" : "Call time"}</span>
      <span dir="auto" className="tabular-nums font-semibold">
        {voice.isError
          ? reason(voice.error, ar)
          : voice.seconds === undefined
            ? "…"
            : noTime
              ? ar
                ? "مش ضمن خطتك"
                : "Not in your plan"
              : voiceTimeLabel(voice.seconds)}
      </span>
      {voice.data?.resetsAt && !noTime && (
        <small className="w-full text-[var(--pp-muted)]">
          {ar ? "يتجدد" : "Renews"}{" "}
          {new Date(voice.data.resetsAt).toLocaleDateString(ar ? "ar" : "en")}
        </small>
      )}
      {!noTime && voice.seconds !== undefined && voice.seconds !== null && voice.seconds <= 300 && (
        <small role="status" className="w-full">
          {voice.seconds === 0
            ? ar
              ? "انتهى وقتك المتاح."
              : "Your time is used up."
            : ar
              ? "باقي أقل من خمس دقائق."
              : "Less than five minutes left."}
        </small>
      )}
    </div>
  );
}
