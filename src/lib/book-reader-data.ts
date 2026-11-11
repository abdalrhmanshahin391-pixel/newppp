// What the book reader reads, with the reader's own session (row-level security lets signed-in
// readers see prepared pages of published books only). Page pictures come from the private
// book-pages bucket through signed links made for this reader, signed in batches and reused.
import { supabase } from "@/integrations/supabase/legacy-client";
import {
  LINK_LIFETIME_S,
  SIGN_BATCH,
  blockPages,
  linksToSign,
  pruneLinks,
  readManifest,
  readRuns,
  type LinkEntry,
  type ManifestPage,
  type PageRun,
} from "@/lib/books-reader";
import { forgetPictures } from "@/lib/book-pictures";

export type ReaderBook = {
  id: string;
  title: string;
  author: string;
  language: string;
  pageCount: number;
  prepared: boolean;
  filePath: string | null;
};

/** The book, or null when it is not there for this reader (not published, or no such book). */
export async function loadReaderBook(bookId: string): Promise<ReaderBook | null> {
  const { data, error } = await supabase
    .from("books")
    .select("id, title, author, language, page_count, prepared_at, file_path")
    .eq("id", bookId)
    .maybeSingle();
  if (error) {
    // Before the reader migration there are no prepared books.
    if (/42703|does not exist|schema cache/i.test(`${error.code ?? ""} ${error.message}`)) {
      const { data: old } = await supabase
        .from("books")
        .select("id, title, author, language, file_path")
        .eq("id", bookId)
        .maybeSingle();
      return old
        ? {
            id: String(old.id),
            title: String(old.title ?? ""),
            author: String(old.author ?? ""),
            language: String(old.language ?? "en"),
            pageCount: 0,
            prepared: false,
            filePath: (old.file_path as string | null) ?? null,
          }
        : null;
    }
    throw new Error(error.message);
  }
  if (!data) return null;
  return {
    id: String(data.id),
    title: String(data.title ?? ""),
    author: String(data.author ?? ""),
    language: String(data.language ?? "en"),
    pageCount: Number(data.page_count) || 0,
    prepared: Boolean(data.prepared_at),
    filePath: (data.file_path as string | null) ?? null,
  };
}

/** The light part of a page: enough to size the sheet and fetch its picture. */
export type PageMeta = {
  page: number;
  width: number;
  height: number;
  imagePath: string;
  hasText: boolean;
  /** The blurred preview (base64 ThumbHash) and main colour, on books prepared with sizes. */
  thumbhash?: string | null;
  color?: string | null;
};

/** A book's manifest: every page's sizes and preview, its outline and direction (one request). */
export type BookManifest = {
  pages: ManifestPage[];
  outline: [string, number, number][];
  dir: "ltr" | "rtl";
};

/** The book's manifest, or null (prepared before the sizes, or a database without them). */
export async function fetchManifest(bookId: string): Promise<BookManifest | null> {
  const { data, error } = await supabase
    .from("book_manifests")
    .select("pages, outline, dir")
    .eq("book_id", bookId)
    .maybeSingle();
  if (error || !data) return null;
  const pages = readManifest(data.pages);
  if (!pages.length) return null;
  const outline = Array.isArray(data.outline)
    ? (data.outline as unknown[]).filter(
        (item): item is [string, number, number] =>
          Array.isArray(item) && typeof item[0] === "string" && Number(item[1]) > 0,
      )
    : [];
  return { pages, outline, dir: data.dir === "rtl" ? "rtl" : "ltr" };
}

/** A page ready to show: its light part and a signed link to its picture. */
export type PageView = PageMeta & { url: string };

/** The heavy part of a page: its words and where they sit (read after the picture starts). */
export type PageWords = { page: number; text: string; runs: PageRun[] };

const NOT_FOUND = "missing_page";

/** One block of light page info (40 pages) in one request. */
export async function fetchMetaBlock(
  bookId: string,
  block: number,
  total: number,
  signal?: AbortSignal,
): Promise<PageMeta[]> {
  const [from, to] = blockPages(block, total);
  let query = supabase
    .from("book_pages")
    .select("page, width, height, image_path, has_text")
    .eq("book_id", bookId)
    .gte("page", from)
    .lte("page", to)
    .order("page");
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    page: Number(row.page),
    width: Number(row.width),
    height: Number(row.height),
    imagePath: String(row.image_path),
    hasText: Boolean(row.has_text),
  }));
}

/** The page's words and their places. */
export async function fetchPageWords(
  bookId: string,
  page: number,
  signal?: AbortSignal,
): Promise<PageWords> {
  let query = supabase
    .from("book_pages")
    .select("text, runs")
    .eq("book_id", bookId)
    .eq("page", page);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(NOT_FOUND);
  return { page, text: String(data.text ?? ""), runs: readRuns(data.runs) };
}

// ---- signed picture links, reused for the whole visit ---------------------------------------
// Each new signed link is a new address, so nothing is ever cached. Links are kept per tab
// (sessionStorage, gone when the tab closes; never localStorage) and reused until 10 minutes
// before they end, so turning back to a page asks the browser for the very same address.

const LINKS_KEY = "uzyra-book-links:v1";
let links: Record<string, LinkEntry> | null = null;
let linksOwner = "";
const signing = new Map<string, Promise<void>>();

let watchingSignOut = false;

function linkStore(userId: string): Record<string, LinkEntry> {
  if (!watchingSignOut) {
    // Signing out forgets every stored link in this tab.
    watchingSignOut = true;
    supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        forgetPageLinks();
        void forgetPictures();
      }
    });
  }
  if (links && linksOwner === userId) return links;
  linksOwner = userId;
  links = {};
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(`${LINKS_KEY}:${userId}`) ?? "{}");
    if (raw && typeof raw === "object")
      links = pruneLinks(raw as Record<string, LinkEntry>, Date.now());
  } catch {
    /* storage can be blocked: links are then kept in memory only */
  }
  return links;
}

function saveLinks(userId: string) {
  try {
    window.sessionStorage.setItem(
      `${LINKS_KEY}:${userId}`,
      JSON.stringify(pruneLinks(linkStore(userId), Date.now())),
    );
  } catch {
    /* only a convenience */
  }
}

/** The paths among these with no good link yet and none on its way. */
export function linksMissing(userId: string, paths: string[]): string[] {
  return linksToSign(paths, linkStore(userId), Date.now()).filter((path) => !signing.has(path));
}

/** Signed links for these picture paths: reused when still good, the rest signed 50 at a time. */
export async function signPagePaths(
  userId: string,
  paths: string[],
): Promise<Record<string, string>> {
  const store = linkStore(userId);
  const need = linksToSign(paths, store, Date.now()).filter((path) => !signing.has(path));
  for (let i = 0; i < need.length; i += SIGN_BATCH) {
    const batch = need.slice(i, i + SIGN_BATCH);
    const job = (async () => {
      const { data, error } = await supabase.storage
        .from("book-pages")
        .createSignedUrls(batch, LINK_LIFETIME_S);
      if (error) throw new Error(error.message);
      const exp = Date.now() + LINK_LIFETIME_S * 1000;
      for (const item of data ?? []) {
        if (item.path && item.signedUrl && !item.error)
          store[item.path] = { url: item.signedUrl, exp };
      }
      saveLinks(userId);
    })();
    const done = job.finally(() => batch.forEach((path) => signing.delete(path)));
    batch.forEach((path) =>
      signing.set(
        path,
        done.catch(() => undefined),
      ),
    );
  }
  await Promise.all(paths.map((path) => signing.get(path)));
  const out: Record<string, string> = {};
  for (const path of paths) {
    const entry = store[path];
    if (entry) out[path] = entry.url;
  }
  return out;
}

/** Forgets every stored link (signing out). */
export function forgetPageLinks() {
  links = null;
  try {
    for (const key of Object.keys(window.sessionStorage))
      if (key.startsWith(LINKS_KEY)) window.sessionStorage.removeItem(key);
  } catch {
    /* nothing stored */
  }
}

/** The page this reader stopped at, or null. */
export async function loadReadingPlace(bookId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("book_reading_progress")
    .select("page")
    .eq("book_id", bookId)
    .maybeSingle();
  if (error || !data) return null;
  return Number(data.page) || null;
}

/** Remembers the page (one row per reader and book). Failures are quiet: reading goes on. */
export async function saveReadingPlace(userId: string, bookId: string, page: number) {
  await supabase
    .from("book_reading_progress")
    .upsert(
      { user_id: userId, book_id: bookId, page, updated_at: new Date().toISOString() },
      { onConflict: "user_id,book_id" },
    );
}
