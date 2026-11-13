// «كتبك الخاصة»: the reader's own PDFs, at the top of the library, styled like any other shelf.
// Adding is one tap (choose a PDF; it uploads at once, its name taken from the file); deleting is
// the bin on the cover or in the book's window, with one confirmation. Two books at most: with
// two, the add card says to delete one first and points at the bins.
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Lock, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { BookObject, UzyraIcon } from "@/components/books/BookObject";
import { megabytes, USER_BOOK_SLOTS, type UserBook } from "@/lib/user-books";
import {
  addMyBook,
  deleteMyBook,
  loadMyBooks,
  MY_BOOKS_QUERY_KEY,
  renameMyBook,
  retryMyBook,
} from "@/lib/user-books-data";
import { coverFromFile, myBookCover } from "./my-book-pdf";
import "./my-books.css";

type Lang = "en" | "ar";
type Sending = { share: number; stop: AbortController; retryOf?: string } | null;

export function MyBooksShelf({ ui, userId }: { ui: Lang; userId: string }) {
  const t = (en: string, ar: string) => (ui === "ar" ? ar : en);
  const queryClient = useQueryClient();
  const books = useQuery({ queryKey: MY_BOOKS_QUERY_KEY, queryFn: loadMyBooks, staleTime: 30_000 });
  const list = books.data ?? [];
  const input = useRef<HTMLInputElement>(null);
  const retryFor = useRef<UserBook | null>(null);
  const [sending, setSending] = useState<Sending>(null);
  const [message, setMessage] = useState<string>("");
  const [pointBins, setPointBins] = useState(false);
  const [open, setOpen] = useState<UserBook | null>(null);
  const [confirm, setConfirm] = useState<UserBook | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pointBins) return;
    const timer = window.setTimeout(() => setPointBins(false), 2400);
    return () => window.clearTimeout(timer);
  }, [pointBins]);

  // The database does not have private books yet: nothing to show.
  if (books.data === null || books.isError) return null;

  const refresh = () => queryClient.invalidateQueries({ queryKey: MY_BOOKS_QUERY_KEY });
  const full = list.length >= USER_BOOK_SLOTS.length;

  const pick = (book: UserBook | null) => {
    if (sending) return;
    retryFor.current = book;
    setMessage("");
    input.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const stop = new AbortController();
    const retry = retryFor.current;
    setSending({ share: 0, stop, retryOf: retry?.id });
    const progress = (share: number) => setSending((s) => (s ? { ...s, share } : s));
    const result = retry
      ? await retryMyBook(retry, file, ui, progress, stop.signal)
      : await addMyBook(userId, list, file, ui, progress, stop.signal);
    setSending(null);
    retryFor.current = null;
    if (!result.ok && result.message) setMessage(result.message);
    // The cover is drawn from the file still on this device, so it shows at once.
    if (result.ok) void coverFromFile(result.book, file);
    await refresh();
  };

  const remove = async (book: UserBook) => {
    setBusy(true);
    try {
      await deleteMyBook(book);
      setConfirm(null);
      setOpen(null);
      setMessage("");
    } catch {
      setMessage(
        t("The book could not be deleted. Try again.", "ما قدرنا نحذف الكتاب. جرّب كمان مرة."),
      );
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  const count = books.isLoading ? null : list.length;
  return (
    <section className="bk-shelf my-shelf" aria-labelledby="my-books-title">
      <div className="bk-shelf-head">
        <span className="bk-shelf-icon" aria-hidden="true">
          <UzyraIcon size={16} />
        </span>
        <h2 id="my-books-title" className="bk-shelf-title">
          {t("Your books", "كتبك الخاصة")}
        </h2>
        {count !== null && (
          <span className="bk-shelf-count">{t(`${count} of 2`, `${count} من 2`)}</span>
        )}
        <span className="my-private">
          <Lock size={12} aria-hidden="true" />
          {t("Only you can see them", "إلك إنت بس")}
        </span>
      </div>

      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void onFile(file);
        }}
      />

      <div className="bk-row my-row">
        {list.map((book) => {
          const unfinished = book.status !== "ready";
          const retrying = sending?.retryOf === book.id;
          return (
            <div key={book.id} className="bk-item my-item" data-point={pointBins || undefined}>
              <button
                type="button"
                className="my-open"
                onClick={() => (unfinished ? pick(book) : setOpen(book))}
                aria-label={
                  unfinished
                    ? t(
                        `${book.title}: the upload did not finish. Try again`,
                        `${book.title}: ما كمل الرفع. جرّب مرة ثانية`,
                      )
                    : book.title
                }
              >
                <MyCover book={book} />
                <span className="bk-item-title" dir="auto">
                  {book.title}
                </span>
                <span className="bk-item-author">
                  {unfinished
                    ? t("Upload not finished", "ما كمل الرفع")
                    : book.page_count
                      ? t(`${book.page_count} pages`, `${book.page_count} صفحة`)
                      : t("Private", "خاص")}
                </span>
              </button>
              {retrying && sending ? (
                <Progress share={sending.share} onStop={() => sending.stop.abort()} ui={ui} />
              ) : unfinished ? (
                <span className="my-unfinished" aria-hidden="true">
                  <RotateCcw size={16} />
                </span>
              ) : null}
              <button
                type="button"
                className="my-bin"
                onClick={() => setConfirm(book)}
                aria-label={t(`Delete ${book.title}`, `احذف ${book.title}`)}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
          );
        })}

        {sending && !sending.retryOf ? (
          <div className="bk-item my-add is-sending" role="status">
            <span className="my-add-box">
              <Progress share={sending.share} onStop={() => sending.stop.abort()} ui={ui} />
            </span>
            <span className="bk-item-title">{t("Adding your book…", "عم نضيف كتابك…")}</span>
          </div>
        ) : !books.isLoading ? (
          <button
            type="button"
            className="bk-item my-add"
            data-full={full || undefined}
            onClick={() => (full ? setPointBins(true) : pick(null))}
          >
            <span className="my-add-box">
              {full ? (
                <Trash2 size={22} aria-hidden="true" />
              ) : (
                <Plus size={26} aria-hidden="true" />
              )}
              <span className="my-add-label">
                {full
                  ? t("Two books is the limit", "الحد كتابين")
                  : t("Add your book", "ضيف كتابك")}
              </span>
            </span>
            <span className="bk-item-title">
              {full
                ? t("Delete one to add a new one.", "احذف واحد منهم لتضيف كتاب جديد.")
                : list.length === 1
                  ? t("One more left. PDF, up to 50 MB.", "باقيلك كتاب واحد. PDF لحد 50 ميغا.")
                  : t("Two books, PDF, up to 50 MB each.", "كتابين، PDF، لحد 50 ميغا لكل واحد.")}
            </span>
          </button>
        ) : null}
      </div>
      <p className="my-message" role="status" aria-live="polite">
        {pointBins
          ? t(
              "You have two books. To add a new one, delete one of them (the bin on its cover).",
              "عندك كتابين. لتضيف كتاب جديد، احذف واحد منهم (السلة على الغلاف).",
            )
          : message}
      </p>
      <div className="bk-board" aria-hidden="true" />

      {open && (
        <MyBookSheet
          book={open}
          ui={ui}
          onClose={() => setOpen(null)}
          onDelete={() => setConfirm(open)}
          onRenamed={async (title) => {
            await renameMyBook(open, title).catch(() =>
              setMessage(t("The name was not saved. Try again.", "ما انحفظ الاسم. جرّب كمان مرة.")),
            );
            setOpen({ ...open, title });
            await refresh();
          }}
        />
      )}
      {confirm && (
        <ConfirmDelete
          book={confirm}
          ui={ui}
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void remove(confirm)}
        />
      )}
    </section>
  );
}

function Progress({ share, onStop, ui }: { share: number; onStop: () => void; ui: Lang }) {
  const percent = Math.round(share * 100);
  return (
    <span className="my-progress">
      <span className="my-progress-n">{percent}%</span>
      <span className="my-progress-track" aria-hidden="true">
        <span className="my-progress-fill" style={{ transform: `scaleX(${share})` }} />
      </span>
      <button
        type="button"
        className="my-progress-x"
        onClick={onStop}
        aria-label={ui === "ar" ? "وقّف الرفع" : "Stop the upload"}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </span>
  );
}

/** The book with page 1 as its cover once drawn (a plain cover with its name until then). */
function MyCover({ book, size = "md" }: { book: UserBook; size?: "md" | "lg" }) {
  const [cover, setCover] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (book.status === "ready") void myBookCover(book).then((url) => live && setCover(url));
    return () => {
      live = false;
    };
  }, [book]);
  return (
    <BookObject
      book={{ title: book.title, author: "", cover_url: cover, level: "B1" }}
      color="slate"
      size={size}
      showLevel={false}
    />
  );
}

/** The book's window: read it, rename it, or delete it. */
function MyBookSheet({
  book,
  ui,
  onClose,
  onDelete,
  onRenamed,
}: {
  book: UserBook;
  ui: Lang;
  onClose: () => void;
  onDelete: () => void;
  onRenamed: (title: string) => Promise<void>;
}) {
  const t = (en: string, ar: string) => (ui === "ar" ? ar : en);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(book.title);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="bk-sheet-back" onClick={onClose}>
      <div
        className="bk-sheet my-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="my-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          ref={close}
          type="button"
          className="bk-sheet-x"
          onClick={onClose}
          aria-label={t("Close", "سكّر")}
        >
          <X size={20} aria-hidden="true" />
        </button>
        <div className="bk-sheet-book">
          <MyCover book={book} size="lg" />
        </div>
        <div className="bk-sheet-body">
          <span className="bk-tag">
            <Lock size={13} aria-hidden="true" />
            {t("Your book · private", "كتابك · خاص")}
          </span>
          {editing ? (
            <form
              className="my-rename"
              onSubmit={(event) => {
                event.preventDefault();
                setEditing(false);
                if (title.trim() && title.trim() !== book.title) void onRenamed(title.trim());
              }}
            >
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                autoFocus
                dir="auto"
                aria-label={t("The book's name", "اسم الكتاب")}
              />
              <button type="submit" className="bk-btn is-primary">
                {t("Save", "احفظ")}
              </button>
            </form>
          ) : (
            <h2 id="my-sheet-title" className="bk-sheet-title" dir="auto">
              {book.title}
            </h2>
          )}
          <p className="bk-sheet-by">
            {[
              book.page_count ? t(`${book.page_count} pages`, `${book.page_count} صفحة`) : null,
              t(`${megabytes(book.size_bytes)} MB`, `${megabytes(book.size_bytes)} ميغا`),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <div className="my-actions">
            <Link
              to="/books/mine/$bookId"
              params={{ bookId: book.id }}
              className="bk-btn is-primary my-read"
            >
              <BookOpen size={17} aria-hidden="true" />
              {t("Read", "اقرأ")}
            </Link>
            {!editing && (
              <button type="button" className="bk-btn" onClick={() => setEditing(true)}>
                <Pencil size={15} aria-hidden="true" />
                {t("Rename", "غيّر الاسم")}
              </button>
            )}
            <button type="button" className="bk-btn my-danger" onClick={onDelete}>
              <Trash2 size={15} aria-hidden="true" />
              {t("Delete the book", "احذف الكتاب")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmDelete({
  book,
  ui,
  busy,
  onCancel,
  onConfirm,
}: {
  book: UserBook;
  ui: Lang;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = (en: string, ar: string) => (ui === "ar" ? ar : en);
  const no = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    no.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div className="bk-sheet-back my-confirm-back" onClick={onCancel}>
      <div
        className="my-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="my-confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <p id="my-confirm-title" className="my-confirm-title">
          {t("Delete this book?", "متأكد بدك تحذف الكتاب؟")}
        </p>
        <p className="my-confirm-name" dir="auto">
          «{book.title}»
        </p>
        <p className="my-confirm-line">
          {t(
            "The file is removed from Uzyra. This cannot be undone.",
            "الملف بينحذف من يوزرا وما بيرجع.",
          )}
        </p>
        <div className="my-confirm-actions">
          <button
            type="button"
            className="bk-btn my-danger is-solid"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? t("Deleting…", "عم نحذف…") : t("Delete", "احذف")}
          </button>
          <button ref={no} type="button" className="bk-btn" onClick={onCancel} disabled={busy}>
            {t("No", "لا")}
          </button>
        </div>
      </div>
    </div>
  );
}
