// A library book read straight from its PDF, in the same reader as a reader's own books: pdf.js
// opens the file in parts from a signed link (only the pages being read are downloaded), draws
// each page on the device and gives its words, so the words can be selected from the first
// second. Nothing has to be prepared or uploaded after the PDF itself: a book is readable as
// soon as its file is saved. The reading place and bookmarks stay on the reader's account.
//
// After the first page shows, the file is kept on this device (Cache Storage, books up to 50 MB,
// the three most recent), so opening it again does not use the network.
import { openPdfBookSource, type MyBookSource } from "@/components/books/mine/my-book-source";
import type { OpenStage, OpenedBook } from "@/components/books/mine/my-book-pdf";
import { bookFileLink } from "@/lib/books-data";

const CACHE = "uzyra-library-books";
const KEEP_BOOKS = 3;
const KEEP_MAX_BYTES = 50 * 1024 * 1024;

type LibraryFile = { id: string; filePath: string };

function store(): Promise<Cache> | null {
  try {
    return typeof caches === "undefined" ? null : caches.open(CACHE);
  } catch {
    return null;
  }
}

/** The copy's address: a new file for the same book is a new address. */
export function libraryFileKey(book: LibraryFile): string {
  return `/__uzyra-library-book/${encodeURIComponent(book.id)}?file=${encodeURIComponent(book.filePath)}`;
}

function request(book: LibraryFile): Request {
  return new Request(new URL(libraryFileKey(book), window.location.origin).href);
}

async function keptFile(book: LibraryFile): Promise<Blob | null> {
  try {
    const found = await (await store())?.match(request(book));
    if (!found) return null;
    const blob = await found.blob();
    return blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
}

const fetching = new Set<string>();

async function keepFile(book: LibraryFile, link: string): Promise<void> {
  const cache = store();
  if (!cache || fetching.has(book.id)) return;
  fetching.add(book.id);
  try {
    const response = await fetch(link);
    if (!response.ok) return;
    const blob = await response.blob();
    if (!blob.size || blob.size > KEEP_MAX_BYTES) return;
    const open = await cache;
    const mine = new URL(request(book).url).pathname;
    for (const key of await open.keys())
      if (new URL(key.url).pathname === mine) await open.delete(key);
    await open.put(
      request(book),
      new Response(blob, { headers: { "Content-Type": "application/pdf" } }),
    );
    // Only the most recent books stay (keys come back oldest first).
    const keys = await open.keys();
    for (const key of keys.slice(0, Math.max(0, keys.length - KEEP_BOOKS))) await open.delete(key);
  } catch {
    // Full storage or a private window: the book is read from the network next time too.
  } finally {
    fetching.delete(book.id);
  }
}

async function openLibraryFile(
  book: LibraryFile,
  onStage?: (stage: OpenStage) => void,
): Promise<OpenedBook> {
  const { openPdfInParts } = await import("@/lib/pdf-page-render");
  const kept = await keptFile(book);
  if (kept) {
    try {
      onStage?.({ step: "page" });
      return { doc: await openPdfInParts(kept), from: "device", link: null };
    } catch {
      // A damaged copy: read it from the network instead.
    }
  }
  onStage?.({ step: "link" });
  // pdf.js keeps asking for parts while the book is read: the link lasts twelve hours.
  const link = await bookFileLink(book.filePath, 12 * 3600);
  onStage?.({ step: "file", share: null });
  const doc = await openPdfInParts(link, {
    onProgress: (loaded, total) =>
      onStage?.({ step: "file", share: total > 0 ? Math.min(1, loaded / total) : null }),
  });
  onStage?.({ step: "page" });
  return { doc, from: "network", link };
}

/** Opens a library book's PDF for the reader; throws when the file cannot be read. */
export function openLibraryBookSource(
  book: LibraryFile,
  options: { onStage?: (stage: OpenStage) => void; debug?: boolean } = {},
): Promise<MyBookSource> {
  return openPdfBookSource(
    {
      id: book.id,
      kind: "library",
      open: (onStage) => openLibraryFile(book, onStage),
      keepCopy: (link) => void keepFile(book, link),
    },
    options,
  );
}
