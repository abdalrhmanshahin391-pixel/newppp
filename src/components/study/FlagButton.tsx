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
      className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-extrabold transition-colors disabled:opacity-50"
      style={
        flagged
          ? { background: "#f6ddd5", borderColor: "#e2b6a8", color: "#7d3421" }
          : { background: "transparent", borderColor: "rgba(0,0,0,0.12)", color: "#8c8375" }
      }
    >
      <Flag size={14} fill={flagged ? "#c4573a" : "none"} strokeWidth={2.2} />
      {label && (flagged ? "Flagged" : "Flag")}
    </button>
  );
}
