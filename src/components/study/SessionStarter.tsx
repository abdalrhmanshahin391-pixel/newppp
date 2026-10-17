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
    <div className="rounded-[20px] bg-white p-5" style={{ border: "2px solid #121117" }}>
      <p className="text-[14px] font-semibold text-[#6a697c]">Session</p>
      <p className="mt-2 text-[34px] font-bold leading-none tracking-[-0.03em] text-[#121117]">
        {totalCards}
        <span className="ml-1.5 text-[14px] font-semibold text-[#6a697c]">
          card{totalCards === 1 ? "" : "s"} ready
        </span>
      </p>
      <p className="mt-1.5 text-[14px] font-medium text-[#6a697c]">from {scopeLabel}</p>

      <div className="mt-4 flex gap-1.5 rounded-xl bg-[#f4f4f8] p-1">
        <button
          type="button"
          onClick={() => onScopeChange?.("all")}
          className="h-9 flex-1 rounded-lg text-[14px] font-semibold transition-colors"
          style={
            scope === "all"
              ? { background: "#ffffff", color: "#121117", border: "2px solid #121117" }
              : { color: "#6a697c", border: "2px solid transparent" }
          }
        >
          All ticked
        </button>
        <button
          type="button"
          onClick={() => onScopeChange?.("flagged")}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg text-[14px] font-semibold transition-colors"
          style={
            scope === "flagged"
              ? { background: "#ffe5f0", color: "#121117", border: "2px solid #121117" }
              : { color: "#6a697c", border: "2px solid transparent" }
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
          className="rita-pill flex h-12 w-full items-center justify-center gap-2 text-[15px] font-semibold disabled:opacity-40"
        >
          <GraduationCap size={16} className="opacity-80" />
          Study mode
        </button>
        <button
          type="button"
          disabled={empty}
          onClick={() => onStudy?.(true)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[10px] border-2 border-[#121117] bg-white text-[15px] font-semibold text-[#121117] transition-colors hover:bg-[#f4f4f8] disabled:opacity-40"
        >
          <Shuffle size={15} className="opacity-70" />
          Shuffle and study
        </button>
      </div>

      {empty && (
        <p className="mt-4 border-t border-[#dcdce5] pt-4 text-[14px] font-medium text-[#6a697c]">
          Add flashcards in “Edit and adjust study view” and they show up here.
        </p>
      )}
    </div>
  );
}

/** Placeholder panel for tools that don't run flashcard sessions yet. */
export function EmptySessionPanel({ note }: { note: string }) {
  return (
    <div className="rounded-[20px] border-2 border-dashed border-[#121117] bg-white p-5">
      <p className="text-[14px] font-semibold text-[#6a697c]">Session</p>
      <p className="mt-3 text-[14.5px] font-medium text-[#4b4a5c]">{note}</p>
    </div>
  );
}
