// "Your books": a reader's own PDFs, read and written with their own session. The database
// decides who may do what (see 20261118120000_books_user_books.sql); this file only asks it.
import { supabase } from "@/integrations/supabase/legacy-client";
import { UPLOAD_CANCELLED, uploadFile } from "@/lib/books-data";
import {
  freeSlot,
  titleFromFile,
  userBookError,
  userBookFileProblem,
  userBookPath,
  type UserBook,
} from "@/lib/user-books";

export const USER_BOOKS_BUCKET = "user-books";
export const MY_BOOKS_QUERY_KEY = ["library", "my-books"] as const;
const COLUMNS =
  "id, slot, title, page_count, size_bytes, file_path, status, created_at, updated_at";
const NOT_APPLIED = /could not find|does not exist|schema cache|PGRST20[0-9]|42P01/i;

// The table is untyped here until the generated types include it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabase.from as any)("user_books");

/** The reader's books, slot 1 first; null when the database does not have them yet. */
export async function loadMyBooks(): Promise<UserBook[] | null> {
  const { data, error } = await table().select(COLUMNS).order("slot");
  if (error) {
    if (NOT_APPLIED.test(`${error.code ?? ""} ${error.message ?? ""}`)) return null;
    throw new Error(error.message);
  }
  return (data ?? []) as UserBook[];
}

/** Title and page count read from the PDF on the device (best effort: the file name otherwise). */
async function readPdfDetails(file: File): Promise<{ title: string; pages: number | null }> {
  try {
    const { openPdfInParts } = await import("@/lib/pdf-page-render");
    const doc = await openPdfInParts(file);
    try {
      const meta = await doc.getMetadata().catch(() => null);
      const info = (meta?.info ?? {}) as { Title?: unknown };
      return {
        title: titleFromFile(file.name, typeof info.Title === "string" ? info.Title : null),
        pages: Number(doc.numPages) || null,
      };
    } finally {
      void doc.destroy?.();
    }
  } catch {
    return { title: titleFromFile(file.name), pages: null };
  }
}

export type AddResult =
  { ok: true; book: UserBook } | { ok: false; message: string; book?: UserBook };

/**
 * Adds one book: checks the file, takes the free slot, then uploads the PDF to the book's own
 * path. If the upload fails the book stays as "not finished", so it can be tried again or
 * deleted; if the reader cancels, the book is removed at once.
 */
export async function addMyBook(
  userId: string,
  current: UserBook[],
  file: File,
  ui: "en" | "ar",
  onProgress?: (share: number) => void,
  signal?: AbortSignal,
): Promise<AddResult> {
  const problem = userBookFileProblem(file, ui);
  if (problem) return { ok: false, message: problem };
  const slot = freeSlot(current);
  if (!slot) return { ok: false, message: userBookError({ code: "23505" }, ui) };
  const details = await readPdfDetails(file);
  const id = crypto.randomUUID();
  const { data, error } = await table()
    .insert({
      id,
      slot,
      title: details.title,
      page_count: details.pages,
      size_bytes: file.size,
      file_path: userBookPath(userId, id),
    })
    .select(COLUMNS)
    .single();
  if (error || !data) return { ok: false, message: userBookError(error, ui) };
  const book = data as UserBook;
  const sent = await sendFile(book, file, ui, onProgress, signal);
  if (!sent.ok) {
    if (sent.cancelled) {
      await deleteMyBook(book).catch(() => undefined);
      return { ok: false, message: "" };
    }
    return { ok: false, message: sent.message, book };
  }
  return { ok: true, book: sent.book };
}

/** Sends a book's file again (after a failed upload), at the same path. */
export async function retryMyBook(
  book: UserBook,
  file: File,
  ui: "en" | "ar",
  onProgress?: (share: number) => void,
  signal?: AbortSignal,
): Promise<AddResult> {
  const problem = userBookFileProblem(file, ui);
  if (problem) return { ok: false, message: problem, book };
  if (file.size !== book.size_bytes)
    return {
      ok: false,
      book,
      message:
        ui === "ar"
          ? "هاد مش نفس الملف. احذف الكتاب وضيفه من جديد."
          : "This is not the same file. Delete the book and add it again.",
    };
  const sent = await sendFile(book, file, ui, onProgress, signal);
  return sent.ok ? { ok: true, book: sent.book } : { ok: false, message: sent.message, book };
}

async function sendFile(
  book: UserBook,
  file: File,
  ui: "en" | "ar",
  onProgress?: (share: number) => void,
  signal?: AbortSignal,
): Promise<{ ok: true; book: UserBook } | { ok: false; cancelled: boolean; message: string }> {
  // A half-sent file from an earlier try is cleared first, so the new one can take its place.
  await supabase.storage
    .from(USER_BOOKS_BUCKET)
    .remove([book.file_path])
    .catch(() => undefined);
  try {
    await uploadFile(USER_BOOKS_BUCKET, book.file_path, file, onProgress, signal);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "";
    if (message === UPLOAD_CANCELLED) return { ok: false, cancelled: true, message: "" };
    return { ok: false, cancelled: false, message: userBookError({ message }, ui) };
  }
  const { data, error } = await table()
    .update({ status: "ready" })
    .eq("id", book.id)
    .select(COLUMNS)
    .single();
  if (error || !data) return { ok: false, cancelled: false, message: userBookError(error, ui) };
  return { ok: true, book: data as UserBook };
}

/** Deletes the file first, then the book, so no file is left behind taking space. */
export async function deleteMyBook(book: Pick<UserBook, "id" | "file_path">): Promise<void> {
  const { error: fileError } = await supabase.storage
    .from(USER_BOOKS_BUCKET)
    .remove([book.file_path]);
  if (fileError && !/not.?found|404/i.test(fileError.message)) throw new Error(fileError.message);
  const { error } = await table().delete().eq("id", book.id);
  if (error) throw new Error(error.message);
}

export async function renameMyBook(book: Pick<UserBook, "id">, title: string): Promise<void> {
  const clean = title.replace(/\s+/g, " ").trim().slice(0, 200);
  if (!clean) return;
  const { error } = await table().update({ title: clean }).eq("id", book.id);
  if (error) throw new Error(error.message);
}

/** A short-lived link to read the book's file (made with the reader's own session). */
export async function myBookLink(book: Pick<UserBook, "file_path">): Promise<string> {
  const { data, error } = await supabase.storage
    .from(USER_BOOKS_BUCKET)
    .createSignedUrl(book.file_path, 3600);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "no link");
  return data.signedUrl;
}

export async function loadMyBook(id: string): Promise<UserBook | null> {
  const { data, error } = await table().select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as UserBook | null) ?? null;
}
