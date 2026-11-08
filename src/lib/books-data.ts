// Reading and writing the library with the visitor's own session (row-level security decides:
// everyone reads categories and published books, admins write). Covers live in the public
// "book-covers" bucket; PDFs in the private "book-files" bucket, opened with a short signed link.
import { supabase } from "@/integrations/supabase/legacy-client";
import { toBook, toCategory, type Book, type BookCategory } from "@/lib/books";

export const COVERS_BUCKET = "book-covers";
export const FILES_BUCKET = "book-files";
export const LIBRARY_QUERY_KEY = ["library"] as const;

const NOT_APPLIED = /could not find|does not exist|schema cache|PGRST20[0-9]|42P01/i;

export type Library = {
  categories: BookCategory[];
  books: Book[];
  /** False before the library migration is applied: the page explains instead of failing. */
  ready: boolean;
};

export function coverUrl(path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from(COVERS_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Everything the page shows. Admins also get unpublished books (marked in the admin page). */
export async function loadLibrary(): Promise<Library> {
  const [cats, books] = await Promise.all([
    supabase
      .from("book_categories")
      .select("id, name_ar, name_en, color, icon, sort")
      .order("sort"),
    supabase
      .from("books")
      .select(
        "id, title, author, description, category_id, level, language, pages, year, cover_path, file_path, featured, published, sort, created_at",
      )
      .order("created_at", { ascending: false }),
  ]);
  const error = cats.error ?? books.error;
  if (error) {
    if (NOT_APPLIED.test(`${error.code ?? ""} ${error.message ?? ""}`))
      return { categories: [], books: [], ready: false };
    throw new Error(error.message);
  }
  return {
    categories: (cats.data ?? []).map((row: Record<string, unknown>) => toCategory(row)),
    books: (books.data ?? []).map((row: Record<string, unknown>) =>
      toBook(row, coverUrl((row.cover_path as string | null) ?? null)),
    ),
    ready: true,
  };
}

/** A link to the book's PDF that works for ten minutes. */
export async function bookFileLink(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(FILES_BUCKET).createSignedUrl(path, 600);
  if (error || !data?.signedUrl) throw new Error("ما قدرنا نفتح الكتاب. جرّب مرة ثانية.");
  return data.signedUrl;
}

// ---- admin ----

export type CategoryInput = Pick<BookCategory, "name_ar" | "name_en" | "color" | "icon">;

export async function saveCategory(input: CategoryInput, id?: string, sort?: number) {
  const row = {
    name_ar: input.name_ar.trim(),
    name_en: input.name_en.trim(),
    color: input.color,
    icon: input.icon,
    ...(sort === undefined ? {} : { sort }),
  };
  const result = id
    ? await supabase.from("book_categories").update(row).eq("id", id)
    : await supabase.from("book_categories").insert(row);
  if (result.error) throw new Error(result.error.message);
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from("book_categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Saves a new order: each id gets its index. */
export async function saveCategoryOrder(ids: string[]) {
  const results = await Promise.all(
    ids.map((id, sort) => supabase.from("book_categories").update({ sort }).eq("id", id)),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);
}

export type BookInput = {
  title: string;
  author: string;
  description: string;
  category_id: string | null;
  level: Book["level"];
  language: string;
  pages: number | null;
  year: number | null;
  published: boolean;
  featured: boolean;
};

function extension(file: File, fallback: string) {
  const match = /\.([a-z0-9]{2,5})$/i.exec(file.name);
  return (match?.[1] ?? fallback).toLowerCase();
}

/**
 * Creates or updates a book, uploading a new cover or PDF when given. Marking a book as the book
 * of the week takes the mark off the one that had it. A failed upload leaves the book saved and
 * says which file did not go up.
 */
export async function saveBook(
  input: BookInput,
  files: { cover?: File | null; pdf?: File | null },
  existing?: Book,
): Promise<string> {
  const row = {
    title: input.title.trim(),
    author: input.author.trim(),
    description: input.description.trim(),
    category_id: input.category_id,
    level: input.level,
    language: input.language,
    pages: input.pages,
    year: input.year,
    published: input.published,
    featured: input.featured,
  };
  if (input.featured) {
    let clear = supabase.from("books").update({ featured: false }).eq("featured", true);
    if (existing) clear = clear.neq("id", existing.id);
    const cleared = await clear;
    if (cleared.error) throw new Error(cleared.error.message);
  }
  let id = existing?.id ?? "";
  if (existing) {
    const { error } = await supabase.from("books").update(row).eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase.from("books").insert(row).select("id").single();
    if (error || !data) throw new Error(error?.message ?? "ما انحفظ الكتاب.");
    id = String(data.id);
  }

  const stamp = Date.now();
  const paths: { cover_path?: string; file_path?: string } = {};
  const problems: string[] = [];
  if (files.cover) {
    const path = `${id}/cover-${stamp}.${extension(files.cover, "jpg")}`;
    const up = await supabase.storage
      .from(COVERS_BUCKET)
      .upload(path, files.cover, { contentType: files.cover.type, upsert: false });
    if (up.error) problems.push(`الغلاف: ${up.error.message}`);
    else paths.cover_path = path;
  }
  if (files.pdf) {
    const path = `${id}/book-${stamp}.pdf`;
    const up = await supabase.storage
      .from(FILES_BUCKET)
      .upload(path, files.pdf, { contentType: "application/pdf", upsert: false });
    if (up.error) problems.push(`ملف الكتاب: ${up.error.message}`);
    else paths.file_path = path;
  }
  if (paths.cover_path || paths.file_path) {
    const { error } = await supabase.from("books").update(paths).eq("id", id);
    if (error) throw new Error(error.message);
    // The replaced files are no longer used.
    const old = [
      paths.cover_path && existing?.cover_path
        ? { bucket: COVERS_BUCKET, path: existing.cover_path }
        : null,
      paths.file_path && existing?.file_path
        ? { bucket: FILES_BUCKET, path: existing.file_path }
        : null,
    ].filter(Boolean) as { bucket: string; path: string }[];
    await Promise.all(old.map((item) => supabase.storage.from(item.bucket).remove([item.path])));
  }
  if (problems.length) throw new Error(`انحفظ الكتاب، بس ما انرفع: ${problems.join(" · ")}`);
  return id;
}

export async function setBookFlags(book: Book, flags: { published?: boolean; featured?: boolean }) {
  if (flags.featured) {
    const cleared = await supabase
      .from("books")
      .update({ featured: false })
      .eq("featured", true)
      .neq("id", book.id);
    if (cleared.error) throw new Error(cleared.error.message);
  }
  const { error } = await supabase.from("books").update(flags).eq("id", book.id);
  if (error) throw new Error(error.message);
}

export async function saveBookOrder(ids: string[]) {
  const results = await Promise.all(
    ids.map((id, sort) => supabase.from("books").update({ sort }).eq("id", id)),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);
}

export async function deleteBook(book: Book) {
  const { error } = await supabase.from("books").delete().eq("id", book.id);
  if (error) throw new Error(error.message);
  await Promise.all([
    book.cover_path ? supabase.storage.from(COVERS_BUCKET).remove([book.cover_path]) : null,
    book.file_path ? supabase.storage.from(FILES_BUCKET).remove([book.file_path]) : null,
  ]);
}
