import { BookmarkPlus, Check, Turtle, Volume2 } from "lucide-react";
import type { CorrectionRecord } from "@/lib/rita-correction";
import { canSpeak } from "@/lib/rita-speak";

type Props = {
  record: CorrectionRecord;
  /** Rita is talking, so the sample buttons wait. */
  busy: boolean;
  saved: boolean;
  onSpeak: (record: CorrectionRecord, rate: number) => void;
  onSave: (record: CorrectionRecord) => void;
};

/** A correction that never interrupts: what you said, the better phrase, why, and a retry. */
export function CorrectionCard({ record, busy, saved, onSpeak, onSave }: Props) {
  const state = record.fixed ? "fixed" : record.attempts > 0 ? "retry" : "new";
  const speakable = canSpeak();
  return (
    <section className="rl-fix" aria-label="Correction">
      <header>
        <h3>Correction</h3>
        <span className="rl-fix-state" data-state={state}>
          {state === "fixed"
            ? "✓ You said it right"
            : state === "retry"
              ? "Not quite yet. Try again"
              : "Try it again"}
        </span>
      </header>
      <dl style={{ margin: 0 }}>
        <div className="rl-fix-row">
          <dt>You said</dt>
          <dd className="rl-said" dir="auto">
            {record.said}
          </dd>
        </div>
        <div className="rl-fix-row">
          <dt>Better</dt>
          <dd className="rl-better">
            <bdi dir="ltr" lang={record.language}>
              {record.better}
            </bdi>
          </dd>
        </div>
        {record.why && (
          <div className="rl-fix-row">
            <dt>Why</dt>
            <dd dir="auto">{record.why}</dd>
          </div>
        )}
        {record.translation && (
          <div className="rl-fix-row">
            <dt>Means</dt>
            <dd dir="auto">{record.translation}</dd>
          </div>
        )}
      </dl>
      <div className="rl-fix-actions">
        {speakable && (
          <>
            <button
              type="button"
              className="rl-btn"
              disabled={busy}
              onClick={() => onSpeak(record, 0.62)}
            >
              <Turtle size={16} aria-hidden="true" /> Hear it slowly
            </button>
            <button
              type="button"
              className="rl-btn"
              disabled={busy}
              onClick={() => onSpeak(record, 0.95)}
            >
              <Volume2 size={16} aria-hidden="true" /> Hear it
            </button>
          </>
        )}
        <button type="button" className="rl-btn" disabled={saved} onClick={() => onSave(record)}>
          {saved ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <BookmarkPlus size={16} aria-hidden="true" />
          )}
          {saved ? "Added to learning" : "Save phrase"}
        </button>
      </div>
    </section>
  );
}
