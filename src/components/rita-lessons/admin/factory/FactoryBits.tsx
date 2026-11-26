import type { CurriculumRow } from "@/lib/rita-curriculum.functions";

const COVER_COLOURS = ["#2f6fe4", "#0e8fb0", "#7c5cff", "#d6336c", "#15803d", "#e08a10"];

/** A colour that stays the same for a book, for its cover when it has no picture. */
export function coverColour(id: string) {
  let sum = 0;
  for (const char of id) sum = (sum + char.charCodeAt(0)) % 997;
  return COVER_COLOURS[sum % COVER_COLOURS.length];
}

export function BookCover({ book, big = false }: { book: CurriculumRow; big?: boolean }) {
  return (
    <span
      className={big ? "la-cover is-big" : "la-cover"}
      style={{ background: coverColour(book.id) }}
      aria-hidden="true"
    >
      {book.image_url ? <img src={book.image_url} alt="" loading="lazy" /> : book.level || "A1"}
    </span>
  );
}

export const kindName = (kind: CurriculumRow["kind"]) => (kind === "grammar" ? "قواعد" : "كلمات");

export function Bar({ value, max, tone }: { value: number; max: number; tone?: "blue" | "green" }) {
  const share = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <span className={tone ? `la-bar is-${tone}` : "la-bar"} aria-hidden="true">
      <span style={{ width: `${share * 100}%` }} />
    </span>
  );
}
