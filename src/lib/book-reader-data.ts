// What the book reader reads, with the reader's own session (row-level security lets signed-in
// readers see prepared pages of published books only). Page pictures come from the private
// book-pages bucket through signed links made for this reader, an hour at a time.
import { supabase } from "@/integrations/supabase/legacy-client";
import { readRuns, type PageRun } from "@/lib/books-reader";

export type ReaderBook = {
  id: string;
  title: string;
  author: string;
  language: string;
  pageCount: number;
  prepared: boolean;
  filePath: string | null;
};

export type ReaderPage = {
  page: number;
  width: number;
  height: number;
  text: string;
  runs: PageRun[];
  hasText: boolean;
  url: string;
};

const LINK_SECONDS = 3600;

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

/** One page: its size, words and a signed link to its picture. */
export async function loadReaderPage(bookId: string, page: number): Promise<ReaderPage> {
  const { data, error } = await supabase
    .from("book_pages")
    .select("page, width, height, image_path, text, runs, has_text")
    .eq("book_id", bookId)
    .eq("page", page)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("missing_page");
  const { data: link, error: linkError } = await supabase.storage
    .from("book-pages")
    .createSignedUrl(String(data.image_path), LINK_SECONDS);
  if (linkError || !link?.signedUrl) throw new Error(linkError?.message ?? "no_link");
  return {
    page: Number(data.page),
    width: Number(data.width),
    height: Number(data.height),
    text: String(data.text ?? ""),
    runs: readRuns(data.runs),
    hasText: Boolean(data.has_text),
    url: link.signedUrl,
  };
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
