import { useEffect, useRef, useState } from "react";
import { BookOpenText, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { BookObject, CATEGORY_ICON } from "./BookObject";
import { CATEGORY_COLORS, readingHours, type Book, type BookCategory } from "@/lib/books";
import { bookFileLink } from "@/lib/books-data";
import { openWelcome } from "@/lib/auth-dialog";

/** A book's details over the library: the book, what it is, and «ابدأ القراءة». */
export function BookSheet({
  book,
  category,
  languageName,
  signedIn,
  ui,
  onClose,
}: {
  book: Book;
  category: BookCategory | null;
  languageName: string;
  signedIn: boolean;
  ui: "en" | "ar";
  onClose: () => void;
}) {
  const t = (en: string, ar: string) => (ui === "ar" ? ar : en);
  const close = useRef<HTMLButtonElement>(null);
  const [opening, setOpening] = useState(false);
  const tone = CATEGORY_COLORS[category?.color ?? "slate"];
  const Icon = CATEGORY_ICON[category?.icon ?? "book"];
  const hours = readingHours(book.pages);

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
          </div>
        </div>
      </div>
    </div>
  );
}
