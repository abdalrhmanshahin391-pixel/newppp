import { memo } from "react";
import type { CorrectionRecord } from "@/lib/rita-correction";
import type { LessonMessage } from "@/lib/rita-lesson-types";
import { CorrectionCard } from "./CorrectionCard";
import { RichText } from "./RichText";

type Props = {
  message: LessonMessage;
  correction?: CorrectionRecord;
  speakBusy: boolean;
  saved: boolean;
  onSpeak: (record: CorrectionRecord, rate: number) => void;
  onSave: (record: CorrectionRecord) => void;
};

function clock(value?: number) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** A fixed bubble with the speaker named, the time, and the playback state. */
export const MessageBubble = memo(function MessageBubble({
  message,
  correction,
  speakBusy,
  saved,
  onSpeak,
  onSave,
}: Props) {
  const you = message.role === "you";
  const time = clock(message.createdAt);
  return (
    <article
      className={`rl-msg ${you ? "rl-msg--you" : "rl-msg--rita"}`}
      aria-busy={message.streaming || undefined}
    >
      <div className="rl-meta">
        <span className="rl-who">{you ? "You" : "Rita"}</span>
        {time && <span className="rl-time">{time}</span>}
        {message.streaming && <span className="rl-chip">Speaking…</span>}
        {message.interrupted && <span className="rl-chip rl-chip--warn">Interrupted</span>}
      </div>
      <div className="rl-body">
        <RichText text={message.text} />
      </div>
      {correction && (
        <CorrectionCard
          record={correction}
          busy={speakBusy}
          saved={saved}
          onSpeak={onSpeak}
          onSave={onSave}
        />
      )}
    </article>
  );
});
