import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { BookOpenText, Heart, Loader2, Star, X } from "lucide-react";
import { toast } from "sonner";
import { BookObject, CATEGORY_ICON } from "./BookObject";
import {
  CATEGORY_COLORS,
  MIN_RATINGS,
  ratingShown,
  readingHours,
  type Book,
  type BookCategory,
} from "@/lib/books";
import { bookFileLink, favoriteBook, rateBook, trackBook } from "@/lib/books-data";
import { openWelcome } from "@/lib/auth-dialog";

/**
 * A book's details over the library: the book, what it is, its rating, «ابدأ القراءة», and (with
 * the phase 3 database) the reader's own stars and favourite. Opening it and starting to read are
 * counted once a day for a signed-in reader.
 */
export function BookSheet({
  book,
  category,
  languageName,
  signedIn,
  ui,
  onClose,
  phase3 = false,
  mine = null,
  onChanged,
}: {
  book: Book;
  category: BookCategory | null;
  languageName: string;
  signedIn: boolean;
  ui: "en" | "ar";
  onClose: () => void;
  phase3?: boolean;
  mine?: { favorite: boolean; rating: number | null } | null;
  onChanged?: () => void;
}) {
  const t = (en: string, ar: string) => (ui === "ar" ? ar : en);
  const close = useRef<HTMLButtonElement>(null);
  const [opening, setOpening] = useState(false);
  const tone = CATEGORY_COLORS[category?.color ?? "slate"];
  const Icon = CATEGORY_ICON[category?.icon ?? "book"];
  const hours = readingHours(book.pages);
  const [numbers, setNumbers] = useState({ count: book.rating_count, avg: book.rating_avg });
  const [myRating, setMyRating] = useState<number | null>(mine?.rating ?? null);
  const [favorite, setFavorite] = useState(Boolean(mine?.favorite));
  const [saving, setSaving] = useState<"" | "rate" | "fav">("");
  useEffect(() => {
    setMyRating(mine?.rating ?? null);
    setFavorite(Boolean(mine?.favorite));
  }, [mine?.rating, mine?.favorite]);

  // Opening the book counts as a view (signed-in readers, once a day).
  useEffect(() => {
    if (signedIn && phase3) void trackBook(book.id, "view");
  }, [book.id, signedIn, phase3]);

  async function rate(value: number | null) {
    if (!signedIn) {
      openWelcome(window.location.pathname + window.location.search);
      return;
    }
    const before = myRating;
    setMyRating(value);
    setSaving("rate");
    try {
      const next = await rateBook(book.id, value);
      setNumbers({ count: next.rating_count, avg: next.rating_avg });
      onChanged?.();
    } catch (cause) {
      setMyRating(before);
      toast.error(cause instanceof Error ? cause.message : t("Not saved.", "ما انحفظ."));
    } finally {
      setSaving("");
    }
  }

  async function toggleFavorite() {
    if (!signedIn) {
      openWelcome(window.location.pathname + window.location.search);
      return;
    }
    const next = !favorite;
    setFavorite(next);
    setSaving("fav");
    try {
      await favoriteBook(book.id, next);
      onChanged?.();
    } catch (cause) {
      setFavorite(!next);
      toast.error(cause instanceof Error ? cause.message : t("Not saved.", "ما انحفظ."));
    } finally {
      setSaving("");
    }
  }

  // Arrow keys move the chosen star (one tab stop for the group).
  function starKeys(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const rtl = ui === "ar";
    const up =
      event.key === "ArrowUp" ||
      (event.key === "ArrowRight" ? !rtl : event.key === "ArrowLeft" && rtl);
    const next = Math.min(5, Math.max(1, (myRating ?? 0) + (up ? 1 : -1)));
    void rate(next);
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]");
    buttons[next - 1]?.focus();
  }

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [onClose]);

  async function read() {
    if (!book.file_path) return;
    if (!signedIn) {
      openWelcome(window.location.pathname + window.location.search);
      return;
    }
    if (phase3) void trackBook(book.id, "read");
    // Opened now, during the tap (Safari blocks a window opened after waiting); filled when the
    // link is ready.
    const win = window.open("", "_blank");
    setOpening(true);
    try {
      const url = await bookFileLink(book.file_path);
      if (win) win.location.href = url;
      else window.location.assign(url);
    } catch (cause) {
      win?.close();
      toast.error(
        cause instanceof Error
          ? cause.message
          : t("Could not open the book.", "ما قدرنا نفتح الكتاب."),
      );
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="bk-sheet-back" onClick={onClose}>
      <div
        className="bk-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bk-sheet-title"
        dir={ui === "ar" ? "rtl" : "ltr"}
        onClick={(event) => event.stopPropagation()}
        style={{ ["--c" as string]: tone.c, ["--soft" as string]: tone.soft }}
      >
        <button
          ref={close}
          type="button"
          className="bk-sheet-x"
          onClick={onClose}
          aria-label={t("Close", "سكّر")}
        >
          <X size={18} />
        </button>
        <div className="bk-sheet-book">
          <BookObject book={book} color={category?.color} size="lg" showLevel={false} />
        </div>
        <div className="bk-sheet-body">
          {category && (
            <span className="bk-tag">
              <Icon size={14} aria-hidden="true" />
              {ui === "ar" ? category.name_ar : category.name_en}
            </span>
          )}
          <h2 id="bk-sheet-title" className="bk-sheet-title" dir="auto">
            {book.title}
          </h2>
          {(book.author || book.year) && (
            <p className="bk-sheet-by" dir="auto">
              {[book.author, book.year].filter(Boolean).join(" · ")}
            </p>
          )}
          <div className="bk-chips">
            <span className="bk-chip is-level">{book.level}</span>
            {book.pages && (
              <span className="bk-chip">
                {book.pages} {t("pages", "صفحة")}
              </span>
            )}
            {hours && (
              <span className="bk-chip">
                {t(`about ${hours} h`, `حوالي ${hours} ${hours === 1 ? "ساعة" : "ساعات"}`)}
              </span>
            )}
            <span className="bk-chip">{languageName}</span>
          </div>
          {phase3 && (
            <p className="bk-rating">
              {ratingShown({ rating_count: numbers.count, rating_avg: numbers.avg }) ? (
                <>
                  <Star
                    size={15}
                    fill="currentColor"
                    aria-hidden="true"
                    className="bk-rating-star"
                  />
                  <b>{numbers.avg?.toFixed(1)}</b>
                  <span>{t(`${numbers.count} ratings`, `${numbers.count} تقييم`)}</span>
                </>
              ) : (
                <span>
                  {t(
                    `Rated by fewer than ${MIN_RATINGS} readers so far`,
                    `قيّمه أقل من ${MIN_RATINGS} قرّاء لهلأ`,
                  )}
                </span>
              )}
            </p>
          )}
          {book.description && (
            <p className="bk-sheet-text" dir="auto">
              {book.description}
            </p>
          )}
          <div className="bk-actions">
            <button
              type="button"
              className="bk-btn is-primary"
              disabled={!book.file_path || opening}
              onClick={() => void read()}
            >
              {opening ? (
                <Loader2 size={17} className="animate-spin" aria-hidden="true" />
              ) : (
                <BookOpenText size={17} aria-hidden="true" />
              )}
              {book.file_path
                ? signedIn
                  ? t("Start reading", "ابدأ القراءة")
                  : t("Sign in to read", "سجّل دخولك واقرأ")
                : t("The file is not ready yet", "الملف لسا مش جاهز")}
            </button>
            {phase3 && (
              <button
                type="button"
                className="bk-btn bk-fav"
                aria-pressed={favorite}
                disabled={saving === "fav"}
                onClick={() => void toggleFavorite()}
              >
                <Heart size={17} aria-hidden="true" fill={favorite ? "currentColor" : "none"} />
                {favorite ? t("In my favourites", "بالمفضلة") : t("Add to favourites", "للمفضلة")}
              </button>
            )}
          </div>
          {phase3 && (
            <div className="bk-rate">
              <span className="bk-rate-label" id={`bk-rate-${book.id}`}>
                {signedIn ? t("Your rating", "تقييمك") : t("Rate this book", "قيّم الكتاب")}
              </span>
              <div
                className="bk-stars"
                role="radiogroup"
                aria-labelledby={`bk-rate-${book.id}`}
                onKeyDown={starKeys}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={myRating === n}
                    aria-label={t(`${n} of 5`, `${n} من 5`)}
                    tabIndex={myRating ? (myRating === n ? 0 : -1) : n === 1 ? 0 : -1}
                    className={`bk-star${myRating && n <= myRating ? " is-on" : ""}`}
                    disabled={saving === "rate"}
                    onClick={() => void rate(myRating === n ? null : n)}
                  >
                    <Star
                      size={22}
                      aria-hidden="true"
                      fill={myRating && n <= myRating ? "currentColor" : "none"}
                    />
                  </button>
                ))}
              </div>
              {!signedIn && (
                <span className="bk-rate-hint">{t("Sign in to rate", "سجّل دخولك لتقيّم")}</span>
              )}
              {signedIn && myRating && (
                <span className="bk-rate-hint">
                  {t("Tap again to remove", "اضغط مرة ثانية لتشيله")}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
