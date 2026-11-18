import { useVoiceTime } from "@/hooks/useVoiceTime";
import { voiceTimeLabel } from "@/lib/free-talk-time";
import { useUiLanguage } from "@/components/language/useUiLanguage";
export function VoiceTime() {
  const voice = useVoiceTime();
  const ar = useUiLanguage() === "ar";
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--pp-grey)] px-3 py-2 text-sm"
      aria-label={ar ? "وقت المحادثة الحرة" : "Free conversation time"}
    >
      <span>{ar ? "المحادثة الحرة" : "Free conversation"}</span>
      <span dir="ltr" className="tabular-nums font-semibold">
        {voice.isError
          ? ar
            ? "الوقت غير متاح"
            : "Time unavailable"
          : voice.seconds === undefined
            ? "…"
            : voiceTimeLabel(voice.seconds)}
      </span>
      {voice.data?.resetsAt && (
        <small className="w-full text-[var(--pp-muted)]">
          {ar ? "يتجدد" : "Renews"}{" "}
          {new Date(voice.data.resetsAt).toLocaleDateString(ar ? "ar" : "en")}
        </small>
      )}
      {voice.seconds !== undefined && voice.seconds !== null && voice.seconds <= 300 && (
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
