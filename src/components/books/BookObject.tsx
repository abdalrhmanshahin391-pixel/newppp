import { useState, type ReactElement } from "react";
import { UzyraMark } from "@/components/brand/UzyraMark";
import { CATEGORY_COLORS, type Book, type CategoryColor, type CategoryIcon } from "@/lib/books";

/** A small Uzyra mark: the one sign shown for every category and shelf (no per-category icons). */
export function UzyraIcon({
  size = 16,
  className = "",
}: {
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <span
      className={className}
      style={{ display: "inline-grid", placeItems: "center", width: size, height: size }}
      aria-hidden="true"
    >
      <UzyraMark className="h-full w-auto" />
    </span>
  );
}

type IconComponent = (props: {
  size?: number;
  strokeWidth?: number;
  className?: string;
}) => ReactElement;

/** Every category shows the Uzyra mark; the saved icon name is kept but no longer drawn. */
export const CATEGORY_ICON: Record<CategoryIcon, IconComponent> = {
  book: UzyraIcon,
  heart: UzyraIcon,
  flask: UzyraIcon,
  mountain: UzyraIcon,
  search: UzyraIcon,
  rocket: UzyraIcon,
  landmark: UzyraIcon,
  brain: UzyraIcon,
  globe: UzyraIcon,
  feather: UzyraIcon,
};

/**
 * One book on a shelf: the same frame for every book (the binding's shadow, the page edges under
 * and beside the cover, a soft shadow on the shelf); only the cover picture changes. A book
 * without a picture gets a cloth cover in its category's colour with the title on it.
 */
export function BookObject({
  book,
  color = "slate",
  size = "md",
  showLevel = true,
  progress,
}: {
  book: Pick<Book, "title" | "author" | "cover_url" | "level">;
  color?: CategoryColor;
  size?: "sm" | "md" | "lg";
  showLevel?: boolean;
  /** 0–100: how far the reader got (a thin bar under the book). */
  progress?: number;
}) {
  const [failed, setFailed] = useState(false);
  const tone = CATEGORY_COLORS[color];
  return (
    <span className="bk-book" data-size={size}>
      <span className="bk-obj">
        <span className="bk-pages bk-pages-side" aria-hidden="true" />
        <span className="bk-pages" aria-hidden="true" />
        <span className="bk-ground" aria-hidden="true" />
        <span className="bk-cover">
          {book.cover_url && !failed ? (
            <img
              src={book.cover_url}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              onError={() => setFailed(true)}
            />
          ) : (
            <span className="bk-cloth" style={{ background: tone.c }} aria-hidden="true">
              <span className="bk-cloth-rule" />
              <span className="bk-cloth-title" dir="auto">
                {book.title}
              </span>
              <span className="bk-cloth-author" dir="auto">
                {book.author}
              </span>
              <span className="bk-cloth-rule" />
            </span>
          )}
        </span>
        {showLevel && <span className="bk-level">{book.level}</span>}
      </span>
      {progress !== undefined && progress > 0 && (
        <span className="bk-progress" aria-hidden="true">
          <i style={{ width: `${Math.min(100, progress)}%` }} />
        </span>
      )}
    </span>
  );
}
