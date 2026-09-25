import { Flag, GraduationCap, Shuffle } from "lucide-react";

export type SessionScope = "all" | "flagged";

/** Right-hand panel: real card count + the study-session launchers. */
export function SessionStarter({
  totalCards = 0,
  flaggedCount = 0,
  scope = "all",
  onScopeChange,
  scopeLabel = "your whole board",
  onStudy,
}: {
  totalCards?: number;
  flaggedCount?: number;
  scope?: SessionScope;
  onScopeChange?: (s: SessionScope) => void;
  scopeLabel?: string;
  onStudy?: (shuffle: boolean) => void;
}) {
  const empty = totalCards === 0;

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-[#fbf5e9] p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b3aa9c]">Session</p>
      <p className="mt-2 text-[26px] font-black leading-none tracking-tight text-[#23201d]">
        {totalCards}
        <span className="ml-1.5 text-[13px] font-bold text-[#a29a8d]">
          card{totalCards === 1 ? "" : "s"} ready
        </span>
      </p>
      <p className="mt-1.5 text-[12.5px] font-semibold text-[#a29a8d]">from {scopeLabel}</p>

      <div className="mt-4 flex gap-1.5 rounded-xl bg-white p-1">
        <button
          type="button"
          onClick={() => onScopeChange?.("all")}
          className="h-8 flex-1 rounded-lg text-[12px] font-extrabold transition-colors"
          style={
            scope === "all"
              ? { background: "#f4eddf", color: "#23201d" }
              : { color: "#a29a8d" }
          }
        >
          All ticked
        </button>
        <button
          type="button"
          onClick={() => onScopeChange?.("flagged")}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg text-[12px] font-extrabold transition-colors"
          style={
            scope === "flagged"
              ? { background: "#f6ddd5", color: "#7d3421" }
              : { color: "#a29a8d" }
          }
        >
          <Flag size={12} />
          Flagged {flaggedCount > 0 ? flaggedCount : ""}
        </button>
      </div>


      <div className="mt-5 flex flex-col gap-2.5">
        <button
          type="button"
          disabled={empty}
          onClick={() => onStudy?.(false)}
          className="rita-pill flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[13.5px] font-extrabold disabled:opacity-40"
        >
          <GraduationCap size={16} className="opacity-80" />
          Study mode
        </button>
        <button
          type="button"
          disabled={empty}
          onClick={() => onStudy?.(true)}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-white text-[13.5px] font-extrabold text-[#23201d] transition-colors hover:bg-black/[0.03] disabled:opacity-40"
        >
          <Shuffle size={15} className="opacity-70" />
          Shuffle and study
        </button>
      </div>

      {empty && (
        <p className="mt-4 border-t border-black/[0.06] pt-4 text-[12.5px] font-semibold text-[#b3aa9c]">
          Add flashcards in “Edit and adjust study view” and they show up here.
        </p>
      )}
    </div>
  );
}

/** Placeholder panel for tools that don't run flashcard sessions yet. */
export function EmptySessionPanel({ note }: { note: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/10 bg-[#fbf5e9] p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b3aa9c]">Session</p>
      <p className="mt-3 text-[13.5px] font-semibold text-[#a29a8d]">{note}</p>
    </div>
  );
}
