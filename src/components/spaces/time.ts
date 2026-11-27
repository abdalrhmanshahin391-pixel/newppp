// Small date words for the classroom pages: "just now", "3 hours ago", "Yesterday", "27 Nov".
// English, like the rest of these pages; the full date and time go in a `title` for hover.

const relative =
  typeof Intl !== "undefined" && "RelativeTimeFormat" in Intl
    ? new Intl.RelativeTimeFormat("en", { numeric: "auto" })
    : null;

const DAY = 86_400_000;

function when(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : Number.NaN;
}

/** "27 Nov", or "27 Nov 2025" when it is not this year. */
export function shortDate(iso: string, now = Date.now()): string {
  const t = when(iso);
  if (Number.isNaN(t)) return "";
  const date = new Date(t);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString(
    "en-GB",
    sameYear
      ? { day: "numeric", month: "short" }
      : { day: "numeric", month: "short", year: "numeric" },
  );
}

/** "just now", "5 minutes ago", "3 hours ago", "yesterday", "4 days ago", then a short date. */
export function timeAgo(iso: string, now = Date.now()): string {
  const t = when(iso);
  if (Number.isNaN(t)) return "";
  const seconds = Math.round((t - now) / 1000);
  const size = Math.abs(seconds);
  if (size < 45) return "just now";
  if (!relative) return shortDate(iso, now);
  if (size < 3600) return relative.format(Math.round(seconds / 60), "minute");
  if (size < 86_400) return relative.format(Math.round(seconds / 3600), "hour");
  if (size < 7 * 86_400) return relative.format(Math.round(seconds / 86_400), "day");
  return shortDate(iso, now);
}

/** "27 Nov 2026, 18:25", for a `title`. */
export function fullDate(iso: string): string {
  const t = when(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

/** "18:25". */
export function clockTime(iso: string): string {
  const t = when(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** The day a chat message belongs to: "Today", "Yesterday", or a short date. */
export function dayLabel(iso: string, now = Date.now()): string {
  const t = when(iso);
  if (Number.isNaN(t)) return "";
  const start = (ms: number) => {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const days = Math.round((start(now) - start(t)) / DAY);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return shortDate(iso, now);
}

/** A key that is the same for every moment of one local day. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
