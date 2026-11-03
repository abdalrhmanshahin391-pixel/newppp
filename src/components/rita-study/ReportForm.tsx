import { useState } from "react";
import { MAX_NOTE_CHARS } from "@/lib/study/study-limits";

/** "Is there a mistake?": a short note about the selected part, sent to the admins. */
export function ReportForm({
  quote,
  busy,
  onSend,
  onBack,
}: {
  quote: string;
  busy: boolean;
  onSend: (note: string) => void;
  onBack: () => void;
}) {
  const [note, setNote] = useState("");
  return (
    <form
      className="space-y-2 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSend(note.trim());
      }}
    >
      <p className="text-[15px] font-bold">في غلط بهالجزء؟</p>
      <p className="line-clamp-2 text-[13px] text-[var(--pp-muted)]" dir="auto">
        «{quote}»
      </p>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value.slice(0, MAX_NOTE_CHARS))}
        rows={3}
        autoFocus
        placeholder="شو الغلط؟ (اختياري)"
        className="w-full rounded-xl border border-[var(--pp-line)] p-2 text-[16px]"
      />
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="rita-btn rita-btn-primary rita-btn-sm">
          ابعت البلاغ
        </button>
        <button type="button" onClick={onBack} className="rita-btn rita-btn-quiet rita-btn-sm">
          رجوع
        </button>
      </div>
    </form>
  );
}
