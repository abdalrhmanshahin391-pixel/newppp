import { Flag } from "lucide-react";

/**
 * The red flag a student raises mid-session: "come back to this one".
 * Purely presentational — the caller owns the state and the save.
 */
export function FlagButton({
  flagged,
  busy,
  onToggle,
  label = true,
}: {
  flagged: boolean;
  busy?: boolean;
  onToggle: () => void;
  label?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onToggle}
      title={flagged ? "Flagged — click to clear" : "Flag this card for later"}
      aria-pressed={flagged}
      className="inline-flex h-11 min-w-11 touch-manipulation items-center justify-center gap-1.5 rounded-full border-2 px-3 text-[14px] font-semibold transition-colors disabled:opacity-50"
      style={
        flagged
          ? { background: "#fbd9e0", borderColor: "#961a34", color: "#961a34" }
          : { background: "transparent", borderColor: "#bdbdcc", color: "#4b4a5c" }
      }
    >
      <Flag size={14} fill={flagged ? "#c4314f" : "none"} strokeWidth={2.2} />
      {label && (flagged ? "Flagged" : "Flag")}
    </button>
  );
}
