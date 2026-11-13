// Drawing pages of a reader's own PDF in the browser (pdf.js, opened in parts from a signed link,
// so only the pages being looked at are downloaded). Covers are page 1, drawn small and kept on
// the device: nothing extra is stored on the server.
import { coverKey, type UserBook } from "@/lib/user-books";
import { myBookLink } from "@/lib/user-books-data";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PdfDoc = any;

export async function openMyBook(book: UserBook): Promise<PdfDoc> {
  const { openPdfInParts } = await import("@/lib/pdf-page-render");
  return openPdfInParts(await myBookLink(book));
}

/** Draws one page into the canvas at `cssWidth` (sharp on high-density screens). */
export async function drawPage(
  doc: PdfDoc,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight?: number,
): Promise<{ width: number; height: number }> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const fit = cssHeight
    ? Math.min(cssWidth / base.width, cssHeight / base.height)
    : cssWidth / base.width;
  const ratio = Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
  const viewport = page.getViewport({ scale: fit * ratio });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
  canvas.style.height = `${Math.floor(viewport.height / ratio)}px`;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no canvas");
  await page.render({ canvasContext: context, viewport }).promise;
  page.cleanup?.();
  return { width: viewport.width / ratio, height: viewport.height / ratio };
}

const making = new Map<string, Promise<string | null>>();

/** Page 1 as a small picture, kept on this device; null when it cannot be drawn. */
export function myBookCover(book: UserBook): Promise<string | null> {
  const key = coverKey(book);
  try {
    const kept = window.localStorage.getItem(key);
    if (kept) return Promise.resolve(kept);
  } catch {
    /* storage blocked: draw it */
  }
  if (making.has(key)) return making.get(key)!;
  const job = (async () => {
    let doc: PdfDoc = null;
    try {
      doc = await openMyBook(book);
      const canvas = document.createElement("canvas");
      await drawPage(doc, 1, canvas, 180);
      const url = canvas.toDataURL("image/webp", 0.8);
      try {
        // Old covers of the same book go first.
        for (let i = window.localStorage.length - 1; i >= 0; i--) {
          const k = window.localStorage.key(i);
          if (k?.startsWith(`uzyra-my-book-cover:${book.id}:`) && k !== key)
            window.localStorage.removeItem(k);
        }
        if (url.length < 200_000) window.localStorage.setItem(key, url);
      } catch {
        /* kept for this visit only */
      }
      return url;
    } catch {
      return null;
    } finally {
      void doc?.destroy?.();
      making.delete(key);
    }
  })();
  making.set(key, job);
  return job;
}
