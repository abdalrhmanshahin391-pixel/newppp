import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { BookReader } from "@/components/books/reader/BookReader";
import {
  openMyBookSource,
  readPlace,
  type MyBookSource,
} from "@/components/books/mine/my-book-source";
import { useUiLanguage } from "@/components/language/useUiLanguage";
import { useAuth } from "@/hooks/useAuth";
import type { ReaderBook } from "@/lib/book-reader-data";
import { clampPage } from "@/lib/user-books";
import { loadMyBook } from "@/lib/user-books-data";

type MineSearch = { page?: number };

export const Route = createFileRoute("/books_/mine/$bookId")({
  validateSearch: (search: Record<string, unknown>): MineSearch => {
    const page = Math.floor(Number(search.page));
    return Number.isFinite(page) && page >= 1 && page <= 5000 ? { page } : {};
  },
  head: () => ({
    meta: [{ title: "Your book — Uzyra" }, { name: "robots", content: "noindex" }],
  }),
  component: MyBookRoute,
});

/**
 * One of the reader's own books, in the same full reader as the library's books: the pages are
 * drawn on this device from the PDF (my-book-source.ts).
 */
function MyBookRoute() {
  const { bookId } = Route.useParams();
  const { page } = Route.useSearch();
  const navigate = useNavigate();
  const ui = useUiLanguage();
  const { user, loading } = useAuth();
  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/login" });
  }, [loading, navigate, user]);
  const book = useQuery({
    queryKey: ["library", "my-book", bookId],
    queryFn: () => loadMyBook(bookId),
    enabled: Boolean(user),
  });
  const ready = book.data && book.data.status === "ready" ? book.data : null;

  // The file is opened once per visit, and closed (its pictures let go) on leaving.
  const [source, setSource] = useState<MyBookSource | null>(null);
  const [openFailed, setOpenFailed] = useState(false);
  useEffect(() => {
    if (!ready) return;
    let live = true;
    let opened: MyBookSource | null = null;
    setOpenFailed(false);
    openMyBookSource(ready).then(
      (s) => {
        if (!live) return s.close();
        opened = s;
        setSource(s);
      },
      () => live && setOpenFailed(true),
    );
    return () => {
      live = false;
      opened?.close();
      setSource(null);
    };
    // The same book (id and file) is opened once; a rename does not reopen it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready?.id, ready?.file_path, ready?.updated_at]);

  // Where to start: the page in the address (a refresh), else where this device stopped.
  const [start] = useState(() => {
    const saved = typeof window === "undefined" ? null : readPlace(bookId);
    return { page: page ?? saved ?? 1, resumed: !page && Boolean(saved && saved > 1) };
  });
  const reader: ReaderBook | null = useMemo(
    () =>
      ready && source
        ? {
            id: ready.id,
            title: ready.title,
            author: "",
            language: source.manifest.dir === "rtl" ? "ar" : "",
            pageCount: source.total,
            prepared: true,
            filePath: null,
          }
        : null,
    [ready, source],
  );

  if (reader && source && user)
    return (
      <BookReader
        key={reader.id}
        book={reader}
        userId={user.id}
        startPage={clampPage(start.page, source.total)}
        resumed={start.resumed}
        source={source}
      />
    );

  const missing = book.isError || book.data === null || (book.data && book.data.status !== "ready");
  const message = missing
    ? ui === "ar"
      ? "هاد الكتاب مش موجود أو ما كمل رفعه."
      : "This book is not here, or its upload did not finish."
    : openFailed
      ? ui === "ar"
        ? "ما قدرت أفتح ملف الكتاب. تأكد من النت وجرّب كمان مرة."
        : "The book's file could not be opened. Check the connection and try again."
      : "";
  return (
    <div
      className="edith-premium grid min-h-[100dvh] place-items-center bg-[#f4f4f8] p-6 text-[var(--pp-ink)]"
      dir={ui === "ar" ? "rtl" : "ltr"}
    >
      {message ? (
        <div className="grid max-w-sm justify-items-center gap-4 text-center">
          <p className="text-[16px]">{message}</p>
          <Link to="/books" className="bk-btn">
            {ui === "ar" ? "المكتبة" : "The library"}
          </Link>
        </div>
      ) : (
        <Loader2 size={24} className="animate-spin text-[var(--pp-muted)]" aria-label="…" />
      )}
    </div>
  );
}
