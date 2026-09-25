// Browser-side PDF → plain text.
// Reading the file in the browser means we never ship megabytes of base64 to
// the server, so lecture size stops being a limit.
import { getPageText, loadPdfForText, renderPageToJpegBase64 } from "@/lib/pdf-page-render";

export type PdfProgress = { page: number; pages: number };

export class PdfReadError extends Error {}
/** Thrown when the PDF has no text layer — the pages must be read as pictures. */
export class PdfScanError extends PdfReadError {}

/** Render the first pages of a scanned PDF as JPEGs the AI can read. */
export async function renderPdfPages(
  file: File,
  max = 10,
  onProgress?: (p: PdfProgress) => void,
): Promise<{ base64: string }[]> {
  const doc = await loadPdfForText(file);
  const pages = Math.min(Number(doc?.numPages ?? 0), max);
  const out: { base64: string }[] = [];
  for (let i = 1; i <= pages; i++) {
    onProgress?.({ page: i, pages });
    out.push({ base64: await renderPageToJpegBase64(doc, i, { targetWidth: 1100, quality: 0.65 }) });
    await new Promise((r) => setTimeout(r, 0));
  }
  if (!out.length) throw new PdfReadError("We could not read any page of that PDF.");
  return out;
}


/** Extract selectable text from a PDF file, page by page, with progress. */
export async function extractPdfText(
  file: File,
  onProgress?: (p: PdfProgress) => void,
  maxChars = 400_000,
): Promise<{ text: string; pages: number }> {
  let doc: any;
  try {
    doc = await loadPdfForText(file);
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (/password/i.test(msg)) {
      throw new PdfReadError("That PDF is password-protected. Remove the password and try again.");
    }
    throw new PdfReadError("That file could not be opened as a PDF. Try re-saving it, or paste the text instead.");
  }

  const pages = Number(doc?.numPages ?? 0);
  if (!pages) throw new PdfReadError("That PDF has no pages we can read.");

  const parts: string[] = [];
  let total = 0;
  for (let i = 1; i <= pages; i++) {
    onProgress?.({ page: i, pages });
    const t = await getPageText(doc, i);
    if (t) {
      parts.push(t);
      total += t.length;
    }
    if (total >= maxChars) break;
    // Let the browser breathe so the progress line actually paints on iPad.
    if (i % 5 === 0) await new Promise((r) => setTimeout(r, 0));
  }

  const text = parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length < 200) {
    throw new PdfScanError("This PDF is a scan, so its pages will be read as pictures instead.");
  }

  return { text: text.slice(0, maxChars), pages };
}

/** Turn any thrown value into one calm sentence — never a raw JSON dump. */
export function friendlyError(e: unknown, fallback = "That did not work. Try again."): string {
  if (e instanceof PdfReadError) return e.message;
  const raw = typeof e === "string" ? e : ((e as any)?.message ?? "");
  const msg = String(raw).trim();
  if (!msg) return fallback;
  if (msg.startsWith("[") || msg.startsWith("{")) {
    if (/too_big/i.test(msg)) return "That file is too large to send. It is now read in your browser — try again.";
    return fallback;
  }
  if (/Unauthorized|401/i.test(msg)) return "Please sign in again and retry.";
  if (msg.length > 220) return fallback;
  return msg;
}

/**
 * Books are far bigger than any model can read in one go, and sending the
 * whole thing also blows the request size limit — which is what made very
 * large uploads die a few seconds in. Keep the opening and closing pages and
 * spread the rest of the budget evenly through the middle, so the AI still
 * sees the whole shape of the document.
 */
export function condenseForAi(text: string, limit = 90_000): string {
  const clean = text.replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= limit) return clean;

  const head = Math.round(limit * 0.25);
  const tail = Math.round(limit * 0.15);
  const middleBudget = limit - head - tail;
  const windows = 12;
  const win = Math.floor(middleBudget / windows);

  const midStart = head;
  const midEnd = clean.length - tail;
  const span = midEnd - midStart;
  const parts: string[] = [clean.slice(0, head)];
  for (let i = 0; i < windows; i++) {
    const at = midStart + Math.round((span / windows) * i);
    parts.push(clean.slice(at, at + win));
  }
  parts.push(clean.slice(midEnd));
  return parts.join("\n\n…\n\n").slice(0, limit);
}
