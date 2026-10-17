export const BADGE_PRESETS: { label: string; color: string }[] = [
  { label: "NEW", color: "#ff7aac" },
  { label: "HOT OFFER", color: "#b3213f" },
  { label: "MOST WANTED", color: "#ff7aac" },
  { label: "LIMITED", color: "#121117" },
  { label: "FREE", color: "#ff7aac" },
];

export function badgeIsLive(expires?: string | null) {
  if (!expires) return true;
  return new Date(expires).getTime() > Date.now();
}

/** Chunky attention badge shown on the corner of a course card. */
export function CourseBadge({
  label,
  color,
  expiresAt,
}: {
  label?: string | null;
  color?: string | null;
  expiresAt?: string | null;
}) {
  if (!label || !badgeIsLive(expiresAt)) return null;
  const c = color || "#b3213f";
  return (
    <span
      className="course-badge absolute top-2.5 left-2.5 z-10 inline-flex items-center overflow-hidden text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full"
      style={{
        background: c,
        color: c === "#ff7aac" ? "#121117" : "#ffffff",
        border: "2px solid #121117",
      }}
    >
      {label}
    </span>
  );
}