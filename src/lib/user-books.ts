// "Your books": the rules for a reader's own PDFs in the library, with no network and no DOM so
// they are tested on their own. The database enforces the same limits (two books, 50 MB, PDF,
// the file at the book's own path, 10 adds a day): these give the reader the reason before
// anything is sent.

export const USER_BOOK_SLOTS = [1, 2] as const;
export type UserBookSlot = (typeof USER_BOOK_SLOTS)[number];
export const USER_BOOK_MAX_BYTES = 50 * 1024 * 1024;

export type UserBook = {
  id: string;
  slot: UserBookSlot;
  title: string;
  page_count: number | null;
  size_bytes: number;
  file_path: string;
  status: "uploading" | "ready";
  created_at: string;
  updated_at: string;
};

/** Why a picked file cannot be one of your books (null when it can). */
export function userBookFileProblem(
  file: { name: string; type: string; size: number },
  ui: "en" | "ar",
): string | null {
  const t = (en: string, ar: string) => (ui === "ar" ? ar : en);
  const looksPdf =
    file.type === "application/pdf" ||
    (["", "application/octet-stream"].includes(file.type) && /\.pdf$/i.test(file.name));
  if (!looksPdf) return t("Choose a PDF file.", "اختار ملف PDF.");
  if (file.size <= 0) return t("This file is empty.", "هالملف فاضي.");
  if (file.size > USER_BOOK_MAX_BYTES)
    return t(
      `This file is ${megabytes(file.size)} MB. Your books can be up to 50 MB each.`,
      `هالملف ${megabytes(file.size)} ميغا. كل كتاب من كتبك لحد 50 ميغا.`,
    );
  return null;
}

export const megabytes = (bytes: number) => Math.max(1, Math.round(bytes / (1024 * 1024)));

/**
 * A book's name from its file: the PDF's own title when it has a real one, else the file name
 * without ".pdf", with dashes and underscores as spaces. Never empty, at most 200 characters.
 */
export function titleFromFile(fileName: string, pdfTitle?: string | null): string {
  const tidy = (s: string) => s.replace(/\s+/g, " ").trim();
  const meta = tidy(pdfTitle ?? "");
  // Titles like "Microsoft Word - x.docx" or "untitled" are what a program wrote, not the book's.
  const usable =
    meta.length >= 2 &&
    !/^(untitled|document|microsoft word|title|\d+)$/i.test(meta) &&
    !/\.(docx?|pdf|indd|pages)$/i.test(meta) &&
    !/^microsoft word\s*-/i.test(meta);
  const fromName = tidy(fileName.replace(/\.pdf$/i, "").replace(/[_]+|(?<=\S)-(?=\S)/g, " "));
  const title = usable ? meta : fromName;
  return (title || "My book").slice(0, 200);
}

/** The free slot for a new book, or null when both are taken. */
export function freeSlot(books: readonly Pick<UserBook, "slot">[]): UserBookSlot | null {
  return USER_BOOK_SLOTS.find((slot) => !books.some((b) => b.slot === slot)) ?? null;
}

/** The book's file path, as the database requires it. */
export const userBookPath = (userId: string, bookId: string) => `${userId}/${bookId}/book.pdf`;

/** A database refusal, in the reader's words. */
export function userBookError(
  error: { code?: string; message?: string; hint?: string } | null,
  ui: "en" | "ar",
): string {
  const t = (en: string, ar: string) => (ui === "ar" ? ar : en);
  const text = `${error?.code ?? ""} ${error?.message ?? ""} ${error?.hint ?? ""}`;
  if (/23505|user_books_one_per_slot|duplicate key/i.test(text))
    return t(
      "You already have two books. Delete one of them to add a new one.",
      "عندك كتابين. لتضيف كتاب جديد، احذف واحد منهم.",
    );
  if (/user_books_daily_limit|too many books added today/i.test(text))
    return t(
      "You have added many books today. Try again tomorrow.",
      "ضفت كتب كتير اليوم. جرّب بكرا.",
    );
  if (/exceed|too large|maximum allowed size|413/i.test(text))
    return t("The file is over 50 MB.", "الملف أكبر من 50 ميغا.");
  if (/42501|row-level security|permission/i.test(text))
    return t("Sign in again, then try once more.", "سجّل دخول من جديد وجرّب كمان مرة.");
  return t("That did not work. Try again.", "ما زبطت. جرّب كمان مرة.");
}

/** Where a reader stopped in one of their books (kept on the device). */
export const placeKey = (bookId: string) => `uzyra-my-book-page:${bookId}`;
export const coverKey = (book: Pick<UserBook, "id" | "updated_at">) =>
  `uzyra-my-book-cover:${book.id}:${book.updated_at}`;

export function clampPage(page: number, total: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(1, Math.round(page)), Math.max(1, total));
}
