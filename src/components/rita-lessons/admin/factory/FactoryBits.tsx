import type { CurriculumRow } from "@/lib/rita-curriculum.functions";

// Black and greys only, like the rest of the page.
const COVER_COLOURS = ["#121212", "#2a2a2e", "#3d3d43", "#55555c", "#1c1c20", "#47474d"];

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

export function Bar({ value, max }: { value: number; max: number }) {
  const share = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <span className="la-bar" aria-hidden="true">
      <span style={{ width: `${share * 100}%` }} />
    </span>
  );
}
