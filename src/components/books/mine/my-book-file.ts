// A copy of the reader's own PDF kept on this device (the browser's Cache Storage), so the book
// opens from the device instead of the network after the first time. It is put there right after
// an upload (the file is still on the device) or, the first time a book is read on another
// device, downloaded in the background once its first page is on screen. It goes when the book
// is deleted. Nothing here leaves the device.
import { myBookFileKey, USER_BOOK_MAX_BYTES, type UserBook } from "@/lib/user-books";

const CACHE = "uzyra-my-books";

function store(): Promise<Cache> | null {
  try {
    return typeof caches === "undefined" ? null : caches.open(CACHE);
  } catch {
    return null;
  }
}

function request(book: Pick<UserBook, "id" | "file_path">): Request {
  return new Request(new URL(myBookFileKey(book), window.location.origin).href);
}

/** The book's file from this device, or null (never kept, cleared, or storage blocked). */
export async function keptMyBookFile(
  book: Pick<UserBook, "id" | "file_path">,
): Promise<Blob | null> {
  try {
    const cache = await store();
    const found = await cache?.match(request(book));
    if (!found) return null;
    const blob = await found.blob();
    return blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
}

/** Keeps the file on this device (an older copy of the same book goes first). */
export async function keepMyBookFile(
  book: Pick<UserBook, "id" | "file_path">,
  file: Blob,
): Promise<boolean> {
  if (!file.size || file.size > USER_BOOK_MAX_BYTES) return false;
  try {
    const cache = await store();
    if (!cache) return false;
    await forgetMyBookFile(book.id);
    await cache.put(
      request(book),
      new Response(file, { headers: { "Content-Type": "application/pdf" } }),
    );
    return true;
  } catch {
    // Full storage or a private window: the book is read from the network next time too.
    return false;
  }
}

const fetching = new Set<string>();

/** Downloads the whole file once (in the background) and keeps it on this device. */
export async function keepMyBookFileFrom(
  book: Pick<UserBook, "id" | "file_path">,
  link: string,
): Promise<void> {
  if (fetching.has(book.id) || !store()) return;
  fetching.add(book.id);
  try {
    const response = await fetch(link);
    if (!response.ok) return;
    await keepMyBookFile(book, await response.blob());
  } catch {
    /* tried again on the next visit */
  } finally {
    fetching.delete(book.id);
  }
}

/** Drops every copy of this book kept on this device. */
export async function forgetMyBookFile(bookId: string): Promise<void> {
  try {
    const cache = await store();
    if (!cache) return;
    const prefix = new URL(myBookFileKey({ id: bookId, file_path: "" }), window.location.origin)
      .pathname;
    for (const key of await cache.keys()) {
      if (new URL(key.url).pathname === prefix) await cache.delete(key);
    }
  } catch {
    /* nothing kept */
  }
}
