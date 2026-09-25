import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { parseQuestionBlock, type ParsedQuestion } from "@/lib/my-archive";

const SAMPLE = `Which vessel carries deoxygenated blood?
- Aorta
* Pulmonary artery
- Pulmonary vein
> The only artery that carries deoxygenated blood.`;

/** Paste-a-block question writer for a student's own sub-subject. */
export function AddQuestionsDialog({
  open,
  onOpenChange,
  subjectName,
  busy,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subjectName: string;
  busy?: boolean;
  onSave: (questions: ParsedQuestion[]) => void;
}) {
  const [text, setText] = useState("");
  const parsed = useMemo(() => parseQuestionBlock(text), [text]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl border border-black/[0.07] bg-[#fbf5e9] text-[#23201d] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-[22px] font-black tracking-tight">
            Add questions
          </DialogTitle>
          <DialogDescription className="text-[13px] font-semibold text-[#a29a8d]">
            Into “{subjectName}”. One question per block, a blank line between them.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-black/[0.06] bg-white/70 px-3.5 py-2.5 text-[12px] font-semibold leading-relaxed text-[#6b645b]">
          Start with the question. Put each answer on its own line with <b>-</b>, and mark the right
          one with <b>*</b>. A line starting with <b>&gt;</b> is the explanation.
        </div>

        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          placeholder={SAMPLE}
          className="w-full rounded-2xl border border-black/10 bg-white px-3.5 py-3 font-mono text-[13px] leading-relaxed text-[#23201d] outline-none focus:border-[#f0a95c] focus:ring-2 focus:ring-[#f0a95c]/25"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] font-extrabold text-[#6b645b]">
            {parsed.length} question{parsed.length === 1 ? "" : "s"} ready
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenChange(false)}
              className="h-11 rounded-xl px-5 text-[13.5px] font-bold text-[#a29a8d] hover:bg-black/[0.05]"
            >
              Cancel
            </button>
            <button
              disabled={!parsed.length || busy}
              onClick={() => {
                onSave(parsed);
                setText("");
              }}
              className="h-11 rounded-xl bg-[#23201d] px-5 text-[13.5px] font-extrabold text-white disabled:opacity-40"
            >
              {busy ? "Saving…" : `Save ${parsed.length || ""}`.trim()}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
