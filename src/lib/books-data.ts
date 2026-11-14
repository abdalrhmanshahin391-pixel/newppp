// Reading and writing the library with the visitor's own session (row-level security decides:
// everyone reads categories and published books, admins write). Covers live in the public
// "book-covers" bucket; PDFs in the private "book-files" bucket, opened with a short signed link.
//
// The page keeps working on a database that only has the first library migration
// (20261108120000): the phase 1 columns and tables are read when they exist (`phase1`).
import { DetailedError, Upload } from "tus-js-client";
import { supabase } from "@/integrations/supabase/legacy-client";
import { getSupabasePublicConfig } from "@/integrations/supabase/config";
import {
  browseLocal,
  contextOf,
  inPeriod,
  newest as newestBooks,
  NO_BROWSE,
  shelves as categoryShelves,
  DIRECT_MAX_BYTES,
  RESUMABLE_FROM_BYTES,
  isSiteCover,
  pdfFileProblem,
  toBook,
  toCategory,
  uploadProblem,
  uploadProblemText,
  type Book,
  type BookCategory,
  type BookShelf,
  type BookStatus,
  type BookTag,
  type BrowseResult,
  type BrowseState,
} from "@/lib/books";
import type { ImportRow } from "@/lib/books-import";

export const COVERS_BUCKET = "book-covers";
export const FILES_BUCKET = "book-files";
export const LIBRARY_QUERY_KEY = ["library"] as const;
export const ADMIN_LIBRARY_QUERY_KEY = ["library", "admin"] as const;
/** Above this a file goes up in resumable 6 MB parts (Supabase's advice for large files). */
export const RESUMABLE_FROM = RESUMABLE_FROM_BYTES;

const NOT_APPLIED = /could not find|does not exist|schema cache|PGRST20[0-9]|42P01|42703/i;
const notApplied = (error: { code?: string; message?: string } | null) =>
  Boolean(error && NOT_APPLIED.test(`${error.code ?? ""} ${error.message ?? ""}`));

const BOOK_COLUMNS_V1 =
  "id, title, author, description, category_id, level, language, pages, year, cover_path, file_path, featured, published, sort, created_at";
const BOOK_COLUMNS = `${BOOK_COLUMNS_V1}, alt_title, isbn, status, rights_checked, featured_from, featured_until`;

export type Library = {
  categories: BookCategory[];
  books: Book[];
  tags: BookTag[];
  /** Shelves on show now (for an admin: every shelf, with its period). */
  shelves: BookShelf[];
  /** The book of the week now (by the server's clock), if any. */
  featuredId: string | null;
  /** False before the library migration is applied: the page explains instead of failing. */
  ready: boolean;
  /** True once the phase 1 migration (status, tags, shelves, import) is applied. */
  phase1: boolean;
};

export type ImportRecord = {
  id: string;
  created_at: string;
  file_name: string;
  result: ImportResult | null;
};

export type EditorialRule = {
  id: string;
  book_id: string;
  /** "discover", or a category id. */
  context: string;
  kind: "pin" | "exclude";
  position: number;
  starts_at: string | null;
  ends_at: string | null;
};

export type AdminLibrary = Library & {
  trash: { id: string; bucket: string; path: string; reason: string; created_at: string }[];
  imports: ImportRecord[];
  editorial: EditorialRule[];
  /** True once the phase 2 migration (search, pages, pins and exclusions) is applied. */
  phase2: boolean;
};

export function coverUrl(path: string | null): string | null {
  if (!path) return null;
  // A cover that ships with the site (the starter library's) is used as it is.
  if (isSiteCover(path)) return path;
  return supabase.storage.from(COVERS_BUCKET).getPublicUrl(path).data.publicUrl;
}

function group<K extends string>(rows: Record<string, unknown>[], key: string, value: string) {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const k = String(row[key]);
    map.set(k, [...(map.get(k) ?? []), String(row[value])]);
  }
  return map as Map<K | string, string[]>;
}

async function loadV1(): Promise<Library> {
  const [cats, books] = await Promise.all([
    supabase
      .from("book_categories")
      .select("id, name_ar, name_en, color, icon, sort")
      .order("sort"),
    supabase.from("books").select(BOOK_COLUMNS_V1).order("created_at", { ascending: false }),
  ]);
  const error = cats.error ?? books.error;
  if (error) {
    if (notApplied(error))
      return {
        categories: [],
        books: [],
        tags: [],
        shelves: [],
        featuredId: null,
        ready: false,
        phase1: false,
      };
    throw new Error(error.message);
  }
  const list = (books.data ?? []).map((row: Record<string, unknown>) =>
    toBook(row, coverUrl((row.cover_path as string | null) ?? null)),
  );
  return {
    categories: (cats.data ?? []).map((row: Record<string, unknown>) => toCategory(row)),
    books: list,
    tags: [],
    shelves: [],
    featuredId: list.find((b) => b.featured && b.published)?.id ?? null,
    ready: true,
    phase1: false,
  };
}

/**
 * Everything the library shows. With `admin`, every shelf (with its period) instead of the ones
 * on show now. Readers get only what row-level security lets them see.
 */
export async function loadLibrary(options: { admin?: boolean } = {}): Promise<Library> {
  const [cats, books, tags, tagLinks, secondary, shelves, items, featured] = await Promise.all([
    supabase
      .from("book_categories")
      .select("id, name_ar, name_en, color, icon, sort")
      .order("sort"),
    supabase.from("books").select(BOOK_COLUMNS).order("created_at", { ascending: false }),
    supabase.from("book_tags").select("id, name_ar, name_en").order("name_ar"),
    supabase.from("book_tag_links").select("book_id, tag_id"),
    supabase.from("book_secondary_categories").select("book_id, category_id"),
    supabase
      .from(options.admin ? "book_shelves" : "book_shelves_now")
      .select("id, name_ar, name_en, visible, starts_at, ends_at, sort")
      .order("sort"),
    supabase.from("book_shelf_items").select("shelf_id, book_id, position").order("position"),
    supabase.from("book_featured_now").select("id"),
  ]);
  // The phase 1 tables are missing: fall back to the first library migration's shape.
  if ([books, tags, shelves, featured].some((r) => notApplied(r.error))) return loadV1();
  const error =
    cats.error ??
    books.error ??
    tags.error ??
    tagLinks.error ??
    secondary.error ??
    shelves.error ??
    items.error ??
    featured.error;
  if (error) throw new Error(error.message);

  const tagsByBook = group((tagLinks.data ?? []) as Record<string, unknown>[], "book_id", "tag_id");
  const secondaryByBook = group(
    (secondary.data ?? []) as Record<string, unknown>[],
    "book_id",
    "category_id",
  );
  const itemsByShelf = group(
    (items.data ?? []) as Record<string, unknown>[],
    "shelf_id",
    "book_id",
  );

  return {
    categories: (cats.data ?? []).map((row: Record<string, unknown>) => toCategory(row)),
    books: (books.data ?? []).map((row: Record<string, unknown>) =>
      toBook(row, coverUrl((row.cover_path as string | null) ?? null), {
        tag_ids: tagsByBook.get(String(row.id)) ?? [],
        secondary_category_ids: secondaryByBook.get(String(row.id)) ?? [],
      }),
    ),
    tags: (tags.data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      name_ar: String(row.name_ar),
      name_en: String(row.name_en),
    })),
    shelves: (shelves.data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      name_ar: String(row.name_ar),
      name_en: String(row.name_en),
      visible: row.visible !== false,
      starts_at: (row.starts_at as string | null) ?? null,
      ends_at: (row.ends_at as string | null) ?? null,
      sort: Number(row.sort) || 0,
      book_ids: itemsByShelf.get(String(row.id)) ?? [],
    })),
    featuredId: ((featured.data ?? [])[0] as { id?: string } | undefined)?.id ?? null,
    ready: true,
    phase1: true,
  };
}

export async function loadAdminLibrary(): Promise<AdminLibrary> {
  const library = await loadLibrary({ admin: true });
  if (!library.phase1) return { ...library, trash: [], imports: [], editorial: [], phase2: false };
  const [trash, imports, editorial] = await Promise.all([
    supabase
      .from("book_file_trash")
      .select("id, bucket, path, reason, created_at")
      .order("created_at"),
    supabase
      .from("book_imports")
      .select("id, created_at, file_name, result")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("book_editorial")
      .select("id, book_id, context, kind, position, starts_at, ends_at")
      .order("position"),
  ]);
  const error = trash.error ?? imports.error;
  if (error) throw new Error(error.message);
  const phase2 = !notApplied(editorial.error);
  if (phase2 && editorial.error) throw new Error(editorial.error.message);
  return {
    ...library,
    trash: (trash.data ?? []) as AdminLibrary["trash"],
    imports: (imports.data ?? []) as ImportRecord[],
    editorial: phase2 ? ((editorial.data ?? []) as EditorialRule[]) : [],
    phase2,
  };
}

// ---- reading: discover and browse (phase 2, with a fallback) ---------------------------------

const MISSING_FUNCTION = /PGRST202|42883|could not find the function|function .* does not exist/i;
const missingFunction = (error: { code?: string; message?: string } | null) =>
  Boolean(error && MISSING_FUNCTION.test(`${error.code ?? ""} ${error.message ?? ""}`));

/** A book as books_browse / books_discover send it. */
function fromCard(row: Record<string, unknown>): Book {
  const ids = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);
  return toBook(row, coverUrl((row.cover_path as string | null) ?? null), {
    tag_ids: ids(row.tag_ids),
    secondary_category_ids: ids(row.secondary_category_ids),
  });
}

/**
 * Categories and tags (small lists the filters and chips need), and whether the phase 3
 * numbers (ratings, favourites, trends) are in the database.
 */
export type Catalog = {
  categories: BookCategory[];
  tags: BookTag[];
  ready: boolean;
  phase3: boolean;
};

export async function loadCatalog(): Promise<Catalog> {
  const [cats, tags, stats] = await Promise.all([
    supabase
      .from("book_categories")
      .select("id, name_ar, name_en, color, icon, sort")
      .order("sort"),
    supabase.from("book_tags").select("id, name_ar, name_en").order("name_ar"),
    supabase.from("book_stats").select("book_id").limit(1),
  ]);
  if (cats.error) {
    if (notApplied(cats.error)) return { categories: [], tags: [], ready: false, phase3: false };
    throw new Error(cats.error.message);
  }
  return {
    categories: (cats.data ?? []).map((row: Record<string, unknown>) => toCategory(row)),
    tags: tags.error ? [] : ((tags.data ?? []) as BookTag[]),
    ready: true,
    phase3: !stats.error,
  };
}

// The whole library, read once a minute at most, for when the phase 2 calls are missing.
let fallback: { key: string; at: number; library: Promise<Library> } | null = null;
function fallbackLibrary(asOf: string | null): Promise<Library> {
  const key = asOf ?? "now";
  if (!fallback || fallback.key !== key || Date.now() - fallback.at > 60_000) {
    const library = loadLibrary({ admin: Boolean(asOf) }).then((lib) =>
      asOf ? libraryAt(lib, new Date(asOf)) : lib,
    );
    fallback = { key, at: Date.now(), library };
    library.catch(() => {
      fallback = null;
    });
  }
  return fallback.library;
}

export type DiscoverResult = {
  asOf: string;
  total: number;
  featured: Book | null;
  picks: Book[];
  newest: Book[];
  loose: Book[];
  shelves: { id: string; name_ar: string; name_en: string; books: Book[] }[];
  categories: { id: string; total: number; books: Book[] }[];
  /** False when this came from the fallback (the phase 2 migration is not applied). */
  phase2: boolean;
};

const PER_SHELF = 12;

/**
 * The discover page: the book of the week, the admin's shelves, picks in this visit's order
 * (`seed`), the newest books and one shelf per category. `asOf` is an admin's preview time.
 */
export async function loadDiscover(
  seed: string,
  asOf: string | null,
  signal?: AbortSignal,
): Promise<DiscoverResult> {
  let call = supabase.rpc("books_discover", { p_seed: seed, p_as_of: asOf, p_per: PER_SHELF });
  if (signal) call = call.abortSignal(signal);
  const { data, error } = await call;
  if (error && !missingFunction(error)) throw new Error(error.message);
  if (!error && data) {
    const raw = data as {
      as_of: string;
      total: number;
      featured_id: string | null;
      picks: string[];
      newest: string[];
      loose: string[];
      shelves: { id: string; name_ar: string; name_en: string; ids: string[] }[];
      categories: { id: string; total: number; ids: string[] }[];
      books: Record<string, Record<string, unknown>>;
    };
    const byId = new Map(Object.entries(raw.books ?? {}).map(([id, row]) => [id, fromCard(row)]));
    const pick = (ids: string[] | null | undefined) =>
      (ids ?? []).map((id) => byId.get(id)).filter((b): b is Book => Boolean(b));
    return {
      asOf: raw.as_of,
      total: raw.total ?? 0,
      featured: raw.featured_id ? (byId.get(raw.featured_id) ?? null) : null,
      picks: pick(raw.picks),
      newest: pick(raw.newest),
      loose: pick(raw.loose),
      shelves: (raw.shelves ?? []).map((s) => ({ ...s, books: pick(s.ids) })),
      categories: (raw.categories ?? []).map((c) => ({
        id: c.id,
        total: c.total,
        books: pick(c.ids),
      })),
      phase2: true,
    };
  }
  const library = await fallbackLibrary(asOf);
  const books = library.books.filter((b) => b.published);
  const byId = new Map(books.map((b) => [b.id, b]));
  const known = new Set(library.categories.map((c) => c.id));
  return {
    asOf: asOf ?? new Date().toISOString(),
    total: books.length,
    featured: (library.featuredId && byId.get(library.featuredId)) || null,
    picks: browseLocal(books, { ...NO_BROWSE, sort: "discover" }, { seed }).items.slice(
      0,
      PER_SHELF,
    ),
    newest: newestBooks(books, PER_SHELF),
    loose: books.filter((b) => !b.category_id || !known.has(b.category_id)).slice(0, PER_SHELF),
    shelves: library.shelves
      .map((s) => ({
        id: s.id,
        name_ar: s.name_ar,
        name_en: s.name_en,
        books: s.book_ids.map((id) => byId.get(id)).filter((b): b is Book => Boolean(b)),
      }))
      .filter((s) => s.books.length > 0),
    categories: categoryShelves(library.categories, books).map((row) => ({
      id: row.category.id,
      total: row.books.length,
      books: row.books.slice(0, PER_SHELF),
    })),
    phase2: false,
  };
}

/**
 * One page of books for a search, a category or the whole library, with the facet counts.
 * `asOf` keeps the pages of one browse steady (pass the first page's `asOf` to the next ones).
 */
export async function browseBooks(
  state: BrowseState,
  options: { seed: string; asOf: string | null; signal?: AbortSignal },
): Promise<BrowseResult & { phase2: boolean }> {
  let call = supabase.rpc("books_browse", {
    p_query: state.q,
    p_categories: state.cat,
    p_levels: state.level,
    p_languages: state.lang,
    p_lengths: state.len,
    p_tags: state.tag,
    p_sort: state.sort,
    p_context: contextOf(state),
    p_seed: options.seed,
    p_as_of: options.asOf,
    p_limit: state.size,
    p_offset: (state.page - 1) * state.size,
    // Sent only when asked: a database without phase 3 does not know it.
    ...(state.view === "favorites" ? { p_favorites: true } : {}),
  });
  if (options.signal) call = call.abortSignal(options.signal);
  const { data, error } = await call;
  if (error && !missingFunction(error)) throw new Error(error.message);
  if (!error && data) {
    const raw = data as {
      total: number;
      items: Record<string, unknown>[];
      facets: BrowseResult["facets"];
      as_of: string;
      sort: BrowseResult["sort"];
    };
    return {
      total: raw.total ?? 0,
      items: (raw.items ?? []).map(fromCard),
      facets: raw.facets ?? { category: {}, level: {}, language: {}, length: {}, tag: {} },
      asOf: raw.as_of,
      sort: raw.sort,
      phase2: true,
    };
  }
  const library = await fallbackLibrary(options.asOf);
  const result = browseLocal(
    library.books.filter((b) => b.published),
    state,
    { seed: options.seed },
  );
  return { ...result, asOf: options.asOf ?? new Date().toISOString(), phase2: false };
}

/**
 * What the library shows at a given moment (an admin's preview of a date): the shelves and the
 * book of the week whose periods contain it. Uses the admin's full lists.
 */
export function libraryAt(library: Library, at: Date): Library {
  const featured = library.books.find(
    (b) =>
      b.featured && b.status === "published" && inPeriod(b.featured_from, b.featured_until, at),
  );
  return {
    ...library,
    books: library.books.filter((b) => b.status === "published"),
    shelves: library.shelves.filter((s) => s.visible && inPeriod(s.starts_at, s.ends_at, at)),
    featuredId: featured?.id ?? null,
  };
}

/** A signed link to the book's file; the reader asks for one that lasts a long reading session. */
export async function bookFileLink(path: string, seconds = 600): Promise<string> {
  const { data, error } = await supabase.storage.from(FILES_BUCKET).createSignedUrl(path, seconds);
  if (error || !data?.signedUrl) throw new Error("ما قدرنا نفتح الكتاب. جرّب مرة ثانية.");
  return data.signedUrl;
}

// ---- files ----------------------------------------------------------------------------------

/** The type sent with a file: a PDF the browser gave no type to still goes up as a PDF. */
function uploadType(file: File): string {
  return file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : "application/octet-stream");
}

/** The error an upload stopped by the admin ends with. */
export const UPLOAD_CANCELLED = "upload_cancelled";

/** One plain request (Supabase's standard upload). */
async function directUpload(bucket: string, path: string, file: File) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: uploadType(file), upsert: false });
  if (error) {
    const status = Number((error as { statusCode?: string | number }).statusCode) || null;
    throw new Error(
      uploadProblemText(uploadProblem(status, error.message), file.size, error.message),
    );
  }
}

/** Resumable 6 MB parts (TUS); rejects with the HTTP status when the server answered. */
async function resumableUpload(
  bucket: string,
  path: string,
  file: File,
  onProgress?: (share: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("لازم تكون مسجّل دخول.");
  const { url, publishableKey } = getSupabasePublicConfig();
  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: `${url}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000],
      headers: { authorization: `Bearer ${token}`, apikey: publishableKey, "x-upsert": "false" },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType: uploadType(file),
        cacheControl: "3600",
      },
      chunkSize: RESUMABLE_FROM_BYTES,
      onError: (error) => reject(error),
      onProgress: (sent, total) => onProgress?.(total ? sent / total : 0),
      onSuccess: () => resolve(),
    });
    // Stopping also removes the part already sent, so no half file stays in the bucket.
    signal?.addEventListener(
      "abort",
      () => {
        void upload.abort(true).catch(() => undefined);
        reject(new Error(UPLOAD_CANCELLED));
      },
      { once: true },
    );
    void upload.findPreviousUploads().then((previous) => {
      if (signal?.aborted) return;
      if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    });
  });
}

/**
 * Uploads one file. Up to 6 MB in one request; larger files (book PDFs up to 500 MB) in resumable
 * 6 MB parts (TUS), which pick up where they stopped if the connection drops. If the project has
 * no resumable endpoint, files up to 50 MB fall back to one request. `onProgress` gets 0–1.
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: File,
  onProgress?: (share: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) throw new Error(UPLOAD_CANCELLED);
  if (file.size <= RESUMABLE_FROM_BYTES) {
    await directUpload(bucket, path, file);
    onProgress?.(1);
    return;
  }
  try {
    await resumableUpload(bucket, path, file, onProgress, signal);
  } catch (cause) {
    if (cause instanceof Error && cause.message === UPLOAD_CANCELLED) throw cause;
    const status =
      cause instanceof DetailedError ? (cause.originalResponse?.getStatus() ?? null) : null;
    const message = cause instanceof Error ? cause.message : "";
    const problem = uploadProblem(status, message);
    if (problem === "missing" && file.size <= DIRECT_MAX_BYTES) {
      await directUpload(bucket, path, file);
      onProgress?.(1);
      return;
    }
    throw new Error(uploadProblemText(problem, file.size, message));
  }
}

/** Removes files; any that cannot be removed now go on the cleanup list (retried by the admin). */
async function removeOrRemember(bucket: string, paths: string[], reason: string) {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (!error) return;
  await supabase.from("book_file_trash").upsert(
    paths.map((path) => ({ bucket, path, reason })),
    { onConflict: "bucket,path", ignoreDuplicates: true },
  );
}

/** Tries again to remove every file on the cleanup list; returns how many are left. */
export async function cleanFileTrash(trash: AdminLibrary["trash"]): Promise<number> {
  let left = 0;
  for (const item of trash) {
    const { error } = await supabase.storage.from(item.bucket).remove([item.path]);
    if (error) {
      left += 1;
      continue;
    }
    await supabase.from("book_file_trash").delete().eq("id", item.id);
  }
  return left;
}

// ---- admin: categories and tags --------------------------------------------------------------

export type CategoryInput = Pick<BookCategory, "name_ar" | "name_en" | "color" | "icon">;

/** A database message about the library in words (codes the functions and triggers raise). */
export function explainBookError(message: string): string {
  const known: Record<string, string> = {
    category_has_books: "التصنيف فيه كتب: اختار وين تروح قبل الحذف.",
    featured_not_published: "كتاب الأسبوع لازم يكون منشور.",
    featured_period: "نهاية المدة لازم تكون بعد بدايتها.",
    shelves_period: "نهاية مدة الرف لازم تكون بعد بدايتها.",
    import_in_progress: "الاستيراد لسا شغال. استنى شوي.",
    book_editorial_period: "نهاية مدة القاعدة لازم تكون بعد بدايتها.",
    too_many_rows: "الملف فيه أكثر من 2000 صف.",
    books_isbn_unique: "الـ ISBN لكتاب ثاني.",
    books_isbn_shape: "شكل الـ ISBN غلط.",
  };
  for (const [code, text] of Object.entries(known)) if (message.includes(code)) return text;
  const ready = /book_not_ready:([a-z,]+)/.exec(message);
  if (ready) {
    const words: Record<string, string> = {
      title: "العنوان",
      category: "التصنيف",
      rights: "مراجعة الحقوق",
    };
    return `ما بينشر قبل: ${ready[1]
      .split(",")
      .map((k) => words[k] ?? k)
      .join("، ")}.`;
  }
  return message;
}

function friendly(error: { code?: string; message: string }): Error {
  if (error.code === "23505" && !/isbn/i.test(error.message))
    return new Error("الاسم موجود من قبل.");
  if (error.code === "42501") return new Error("هاد للأدمن بس.");
  return new Error(explainBookError(error.message));
}

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
  if (result.error) throw friendly(result.error);
}

/** Deletes a category; its books move to `moveTo` first (required when it has books). */
export async function deleteCategory(id: string, moveTo: string | null, phase1: boolean) {
  if (phase1) {
    const { error } = await supabase.rpc("books_delete_category", {
      p_category: id,
      p_move_to: moveTo,
    });
    if (error) throw friendly(error);
    return;
  }
  const { error } = await supabase.from("book_categories").delete().eq("id", id);
  if (error) throw friendly(error);
}

export async function saveCategoryOrder(ids: string[]) {
  const results = await Promise.all(
    ids.map((id, sort) => supabase.from("book_categories").update({ sort }).eq("id", id)),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw friendly(failed.error);
}

export async function saveTag(input: { name_ar: string; name_en: string }, id?: string) {
  const row = { name_ar: input.name_ar.trim(), name_en: input.name_en.trim() };
  const result = id
    ? await supabase.from("book_tags").update(row).eq("id", id)
    : await supabase.from("book_tags").insert(row);
  if (result.error) throw friendly(result.error);
}

export async function deleteTag(id: string) {
  const { error } = await supabase.from("book_tags").delete().eq("id", id);
  if (error) throw friendly(error);
}

// ---- admin: books -----------------------------------------------------------------------------

export type BookInput = {
  title: string;
  alt_title: string;
  author: string;
  isbn: string | null;
  description: string;
  category_id: string | null;
  secondary_category_ids: string[];
  tag_ids: string[];
  level: Book["level"];
  language: string;
  pages: number | null;
  year: number | null;
  status: BookStatus;
  rights_checked: boolean;
};

export type SaveProgress = { cover?: number; pdf?: number };

async function replaceLinks(
  table: "book_tag_links" | "book_secondary_categories",
  column: "tag_id" | "category_id",
  bookId: string,
  ids: string[],
) {
  const { error: removeError } = await supabase.from(table).delete().eq("book_id", bookId);
  if (removeError) throw friendly(removeError);
  if (!ids.length) return;
  const { error } = await supabase
    .from(table)
    .insert(ids.map((id) => ({ book_id: bookId, [column]: id })));
  if (error) throw friendly(error);
}

/**
 * Creates or updates a book, then uploads a new cover or PDF when given. A file is replaced in a
 * safe order: the new file goes up, the book points to it, and only then the old file is removed
 * (if that removal fails it goes on the cleanup list). If the book cannot point to the new file,
 * the new file is removed and the old one stays. A failed upload leaves the book saved and says
 * which file did not go up.
 */
export async function saveBook(
  input: BookInput,
  files: { cover?: File | null; pdf?: File | null },
  existing: Book | undefined,
  phase1: boolean,
  onProgress?: (progress: SaveProgress) => void,
): Promise<string> {
  const base = {
    title: input.title.trim(),
    author: input.author.trim(),
    description: input.description.trim(),
    category_id: input.category_id,
    level: input.level,
    language: input.language,
    pages: input.pages,
    year: input.year,
  };
  // Publishing waits until the files are up, so a book is never public half-saved.
  const publishAfter = input.status === "published" && existing?.status !== "published";
  const row: Record<string, unknown> = phase1
    ? {
        ...base,
        alt_title: input.alt_title.trim(),
        isbn: input.isbn,
        rights_checked: input.rights_checked,
        status: publishAfter ? (existing?.status ?? "draft") : input.status,
      }
    : { ...base, published: input.status === "published" };

  let id = existing?.id ?? "";
  if (existing) {
    const { error } = await supabase.from("books").update(row).eq("id", existing.id);
    if (error) throw friendly(error);
  } else {
    const { data, error } = await supabase.from("books").insert(row).select("id").single();
    if (error || !data) throw error ? friendly(error) : new Error("ما انحفظ الكتاب.");
    id = String(data.id);
  }
  if (phase1) {
    await replaceLinks("book_tag_links", "tag_id", id, input.tag_ids);
    await replaceLinks(
      "book_secondary_categories",
      "category_id",
      id,
      input.secondary_category_ids.filter((c) => c !== input.category_id),
    );
  }

  const stamp = Date.now();
  const progress: SaveProgress = {};
  const problems: string[] = [];
  const uploads: { kind: "cover" | "pdf"; bucket: string; path: string; file: File }[] = [];
  if (files.cover) {
    const ext = (/\.([a-z0-9]{2,5})$/i.exec(files.cover.name)?.[1] ?? "jpg").toLowerCase();
    uploads.push({
      kind: "cover",
      bucket: COVERS_BUCKET,
      path: `${id}/cover-${stamp}.${ext}`,
      file: files.cover,
    });
  }
  if (files.pdf) {
    uploads.push({
      kind: "pdf",
      bucket: FILES_BUCKET,
      path: `${id}/book-${stamp}.pdf`,
      file: files.pdf,
    });
  }
  const done: typeof uploads = [];
  for (const up of uploads) {
    try {
      await uploadFile(up.bucket, up.path, up.file, (share) => {
        progress[up.kind] = share;
        onProgress?.({ ...progress });
      });
      done.push(up);
    } catch (cause) {
      problems.push(
        `${up.kind === "cover" ? "الغلاف" : "ملف الكتاب"}: ${cause instanceof Error ? cause.message : ""}`,
      );
    }
  }
  if (done.length) {
    const paths: Record<string, string> = {};
    for (const up of done) paths[up.kind === "cover" ? "cover_path" : "file_path"] = up.path;
    const { error } = await supabase.from("books").update(paths).eq("id", id);
    if (error) {
      // The book still points to its old files: the new ones are not needed.
      for (const up of done) await removeOrRemember(up.bucket, [up.path], "upload not saved");
      throw friendly(error);
    }
    for (const up of done) {
      const old = up.kind === "cover" ? existing?.cover_path : existing?.file_path;
      // A cover that ships with the site is not in the bucket: nothing to remove.
      if (old && !isSiteCover(old)) await removeOrRemember(up.bucket, [old], "replaced");
    }
  }
  if (publishAfter) {
    const { error } = await supabase.from("books").update({ status: "published" }).eq("id", id);
    if (error) {
      const message = friendly(error).message;
      throw new Error(`انحفظ الكتاب كمسودة. ${message}`);
    }
  }
  if (problems.length) throw new Error(`انحفظ الكتاب، بس ما انرفع: ${problems.join(" · ")}`);
  return id;
}

/**
 * Adds the PDF to a book that has none (the «ارفع ملف الكتاب» button on its page): the file goes
 * up, then the book points to it, but only while it still has no file (so two admins never
 * overwrite each other). If the book cannot point to the new file, the new file is removed.
 * Returns the file's path in the bucket.
 */
export async function attachBookPdf(
  bookId: string,
  file: File,
  onProgress?: (share: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  const problem = pdfFileProblem(file);
  if (problem) throw new Error(problem);
  const path = `${bookId}/book-${Date.now()}.pdf`;
  await uploadFile(FILES_BUCKET, path, file, onProgress, signal);
  const { data, error } = await supabase
    .from("books")
    .update({ file_path: path })
    .eq("id", bookId)
    .is("file_path", null)
    .select("id");
  if (error || !data?.length) {
    await removeOrRemember(FILES_BUCKET, [path], "upload not saved");
    if (error) throw friendly(error);
    throw new Error("الكتاب إله ملف من قبل، أو انحذف. حدّث الصفحة وجرّب.");
  }
  return path;
}

export async function setBookStatus(book: Book, status: BookStatus, phase1: boolean) {
  const row = phase1 ? { status } : { published: status === "published" };
  const { error } = await supabase.from("books").update(row).eq("id", book.id);
  if (error) throw friendly(error);
}

/** The book of the week, in one atomic call (null clears it). */
export async function setFeatured(
  bookId: string | null,
  period: { from: string | null; until: string | null },
  phase1: boolean,
) {
  if (phase1) {
    const { error } = await supabase.rpc("books_set_featured", {
      p_book: bookId,
      p_from: period.from,
      p_until: period.until,
    });
    if (error) throw friendly(error);
    return;
  }
  const cleared = await supabase.from("books").update({ featured: false }).eq("featured", true);
  if (cleared.error) throw friendly(cleared.error);
  if (bookId) {
    const { error } = await supabase.from("books").update({ featured: true }).eq("id", bookId);
    if (error) throw friendly(error);
  }
}

export type BulkAction =
  "publish" | "draft" | "archive" | "set_category" | "add_tag" | "remove_tag";

/** One action on many books in one transaction; books that are not ready are skipped. */
export async function bulkUpdate(
  ids: string[],
  action: BulkAction,
  extra: { category?: string; tag?: string } = {},
): Promise<{ updated: number; skipped: { id: string; reason: string }[] }> {
  const { data, error } = await supabase.rpc("books_bulk_update", {
    p_ids: ids,
    p_action: action,
    p_category: extra.category ?? null,
    p_tag: extra.tag ?? null,
  });
  if (error) throw friendly(error);
  return data as { updated: number; skipped: { id: string; reason: string }[] };
}

export async function saveBookOrder(ids: string[]) {
  const results = await Promise.all(
    ids.map((id, sort) => supabase.from("books").update({ sort }).eq("id", id)),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw friendly(failed.error);
}

export async function deleteBook(book: Book) {
  const { error } = await supabase.from("books").delete().eq("id", book.id);
  if (error) throw friendly(error);
  if (book.cover_path && !isSiteCover(book.cover_path))
    await removeOrRemember(COVERS_BUCKET, [book.cover_path], "book deleted");
  if (book.file_path) await removeOrRemember(FILES_BUCKET, [book.file_path], "book deleted");
  // The page pictures the reader used (their rows went with the book). Before the reader
  // migration the bucket does not exist and this finds nothing.
  for (let round = 0; round < 10; round++) {
    const { data } = await supabase.storage.from("book-pages").list(book.id, { limit: 1000 });
    if (!data?.length) break;
    const { error } = await supabase.storage
      .from("book-pages")
      .remove(data.map((item) => `${book.id}/${item.name}`));
    if (error) break;
  }
}

// ---- admin: shelves ---------------------------------------------------------------------------

export type ShelfInput = {
  name_ar: string;
  name_en: string;
  visible: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

export async function saveShelf(input: ShelfInput, id?: string, sort?: number): Promise<string> {
  const row = {
    name_ar: input.name_ar.trim(),
    name_en: input.name_en.trim(),
    visible: input.visible,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    ...(sort === undefined ? {} : { sort }),
  };
  if (id) {
    const { error } = await supabase.from("book_shelves").update(row).eq("id", id);
    if (error) throw friendly(error);
    return id;
  }
  const { data, error } = await supabase.from("book_shelves").insert(row).select("id").single();
  if (error || !data) throw error ? friendly(error) : new Error("ما انحفظ الرف.");
  return String(data.id);
}

export async function deleteShelf(id: string) {
  const { error } = await supabase.from("book_shelves").delete().eq("id", id);
  if (error) throw friendly(error);
}

export async function saveShelfOrder(ids: string[]) {
  const results = await Promise.all(
    ids.map((id, sort) => supabase.from("book_shelves").update({ sort }).eq("id", id)),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw friendly(failed.error);
}

/** Sets a shelf's books, in this order. */
export async function saveShelfBooks(shelfId: string, bookIds: string[]) {
  const { error: removeError } = await supabase
    .from("book_shelf_items")
    .delete()
    .eq("shelf_id", shelfId);
  if (removeError) throw friendly(removeError);
  if (!bookIds.length) return;
  const { error } = await supabase
    .from("book_shelf_items")
    .insert(bookIds.map((book_id, position) => ({ shelf_id: shelfId, book_id, position })));
  if (error) throw friendly(error);
}

// ---- admin: import ----------------------------------------------------------------------------

export type ImportRowResult = {
  row: number;
  action: "create" | "update" | "skip" | "error";
  title: string;
  existing_id: string | null;
  book_id: string | null;
  errors: string[];
  warnings: string[];
};

export type ImportResult = {
  dry_run: boolean;
  total: number;
  create: number;
  update: number;
  skip: number;
  errors: number;
  rows: ImportRowResult[];
  replayed?: boolean;
};

/**
 * Runs the import in the database. A dry run writes nothing. A real run is recorded under
 * `operation`: sending the same operation again (a retry) returns the first result.
 */
export async function runImport(
  operation: string,
  rows: ImportRow[],
  onDuplicate: "skip" | "update" | "create",
  dryRun: boolean,
  fileName: string,
): Promise<ImportResult> {
  const { data, error } = await supabase.rpc("books_import", {
    p_operation: operation,
    p_rows: rows,
    p_on_duplicate: onDuplicate,
    p_dry_run: dryRun,
    p_file_name: fileName,
  });
  if (error) throw friendly(error);
  return data as ImportResult;
}

// ---- admin: pins and exclusions (phase 2) -----------------------------------------------------

export type RuleInput = Omit<EditorialRule, "id">;

export async function saveRule(input: RuleInput, id?: string) {
  const result = id
    ? await supabase.from("book_editorial").update(input).eq("id", id)
    : await supabase.from("book_editorial").insert(input);
  if (result.error) {
    if (result.error.code === "23505") throw new Error("هالكتاب إله قاعدة بنفس المكان من قبل.");
    throw friendly(result.error);
  }
}

export async function deleteRule(id: string) {
  const { error } = await supabase.from("book_editorial").delete().eq("id", id);
  if (error) throw friendly(error);
}

/** Sets the order of the pins in one place. */
export async function saveRuleOrder(ids: string[]) {
  const results = await Promise.all(
    ids.map((id, position) => supabase.from("book_editorial").update({ position }).eq("id", id)),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw friendly(failed.error);
}

// ---- popularity (phase 3) ---------------------------------------------------------------------

export type Popular = { topRated: Book[]; trending: Book[]; phase3: boolean };

/** The two discover shelves: top rated (at least 3 ratings) and trending this week. */
export async function loadPopular(asOf: string | null, signal?: AbortSignal): Promise<Popular> {
  let call = supabase.rpc("books_popular", { p_as_of: asOf, p_per: 12 });
  if (signal) call = call.abortSignal(signal);
  const { data, error } = await call;
  if (error) {
    if (missingFunction(error)) return { topRated: [], trending: [], phase3: false };
    throw new Error(error.message);
  }
  const raw = data as {
    top_rated: string[];
    trending: string[];
    books: Record<string, Record<string, unknown>>;
  };
  const byId = new Map(Object.entries(raw.books ?? {}).map(([id, row]) => [id, fromCard(row)]));
  const pick = (ids: string[] | null | undefined) =>
    (ids ?? []).map((id) => byId.get(id)).filter((b): b is Book => Boolean(b));
  return { topRated: pick(raw.top_rated), trending: pick(raw.trending), phase3: true };
}

export type Mine = { favorites: string[]; ratings: Record<string, number>; phase3: boolean };

/** The signed-in reader's own favourites and ratings. */
export async function loadMine(): Promise<Mine> {
  const [favorites, ratings] = await Promise.all([
    supabase.from("book_favorites").select("book_id"),
    supabase.from("book_ratings").select("book_id, rating"),
  ]);
  const error = favorites.error ?? ratings.error;
  if (error) {
    if (notApplied(error)) return { favorites: [], ratings: {}, phase3: false };
    throw new Error(error.message);
  }
  return {
    favorites: ((favorites.data ?? []) as { book_id: string }[]).map((row) => row.book_id),
    ratings: Object.fromEntries(
      ((ratings.data ?? []) as { book_id: string; rating: number }[]).map((row) => [
        row.book_id,
        row.rating,
      ]),
    ),
    phase3: true,
  };
}

/** Counts that a signed-in reader opened ("view") or started ("read") a book; once a day. */
export async function trackBook(bookId: string, kind: "view" | "read"): Promise<void> {
  // Counting must never get in the reader's way: errors are ignored.
  try {
    await supabase.rpc("books_track", { p_book: bookId, p_kind: kind });
  } catch {
    // ignored
  }
}

/** Sets (1–5) or removes (null) the reader's rating; returns the book's new numbers. */
export async function rateBook(
  bookId: string,
  rating: number | null,
): Promise<{ rating_count: number; rating_avg: number | null }> {
  const { data, error } = await supabase.rpc("books_rate", { p_book: bookId, p_rating: rating });
  if (error) throw new Error("ما انحفظ التقييم. جرّب مرة ثانية.");
  const raw = data as { rating_count: number; rating_avg: number | string | null };
  return {
    rating_count: Number(raw.rating_count) || 0,
    rating_avg: raw.rating_avg === null ? null : Number(raw.rating_avg),
  };
}

export async function favoriteBook(bookId: string, on: boolean): Promise<void> {
  const { error } = await supabase.rpc("books_favorite", { p_book: bookId, p_on: on });
  if (error) throw new Error("ما انحفظت المفضلة. جرّب مرة ثانية.");
}

export type Analytics = {
  days: number;
  now: { views: number; reads: number; favorites: number; ratings: number };
  before: { views: number; reads: number; favorites: number; ratings: number };
  trending: { id: string; title: string; score: number; views: number; reads: number }[];
  top_rated: { id: string; title: string; score: number; average: number; count: number }[];
  stars: Record<"1" | "2" | "3" | "4" | "5", number>;
  unopened_count: number;
  unopened: { id: string; title: string }[];
};

/** The admin's numbers for the last 7 or 30 days and the days before them (null before phase 3). */
export async function loadAnalytics(days: 7 | 30): Promise<Analytics | null> {
  const { data, error } = await supabase.rpc("books_analytics", { p_days: days });
  if (error) {
    if (missingFunction(error)) return null;
    throw friendly(error);
  }
  return data as Analytics;
}
