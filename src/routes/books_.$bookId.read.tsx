import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2 } from "lucide-react";
import type { OpenStage } from "@/components/books/mine/my-book-pdf";
import type { MyBookSource } from "@/components/books/mine/my-book-source";
import { BookOpening } from "@/components/books/reader/BookOpening";
import { BookReader } from "@/components/books/reader/BookReader";
import { openLibraryBookSource } from "@/components/books/reader/library-book-source";
import { useAuth } from "@/hooks/useAuth";
import { loadReaderBook, loadReadingPlace, type ReaderBook } from "@/lib/book-reader-data";
import { clampPage } from "@/lib/user-books";

type ReaderSearch = { page?: number };

export const Route = createFileRoute("/books_/$bookId/read")({
  validateSearch: (search: Record<string, unknown>): ReaderSearch => {
    const page = Math.floor(Number(search.page));
    return Number.isFinite(page) && page >= 1 && page <= 5000 ? { page } : {};
  },
  head: () => ({
    meta: [{ title: "Reading — Uzyra" }, { name: "robots", content: "noindex" }],
  }),
  component: ReaderRoute,
});

function ReaderRoute() {
  const { bookId } = Route.useParams();
  const { page } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/login" });
  }, [loading, navigate, user]);

  const book = useQuery({
    queryKey: ["book-reader", bookId],
    queryFn: () => loadReaderBook(bookId),
    enabled: Boolean(user),
    staleTime: 60_000,
  });
  // A book with a file is read straight from its PDF (its words can be selected at once, and
  // nothing has to be prepared first); a book prepared before, with no file, reads its pictures.
  const filePath = book.data?.filePath ?? null;
  const fromPdf = Boolean(filePath);
  const canRead = Boolean(book.data && (filePath || book.data.prepared));

  // Where this reader stopped, unless the address names a page (a refresh, a shared link).
  const [start, setStart] = useState<number | null>(page ?? null);
  // True when the reader is taken back to where they stopped (for «رجعتك لصفحة n»).
  const [resumed, setResumed] = useState(false);
  useEffect(() => {
    if (start !== null || !user || !canRead) return;
    let live = true;
    void loadReadingPlace(bookId).then((place) => {
      if (!live) return;
      setResumed(Boolean(place && place > 1));
      setStart(place ?? 1);
    });
    return () => {
      live = false;
    };
  }, [canRead, bookId, start, user]);

  // The PDF is opened once per visit, and closed (its drawn pages let go) on leaving.
  const [source, setSource] = useState<MyBookSource | null>(null);
  const [openFailed, setOpenFailed] = useState(false);
  const [stage, setStage] = useState<OpenStage | null>(null);
  useEffect(() => {
    if (!filePath || !user) return;
    let live = true;
    let opened: MyBookSource | null = null;
    setOpenFailed(false);
    openLibraryBookSource(
      { id: bookId, filePath },
      { onStage: (next) => live && setStage(next) },
    ).then(
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
  }, [bookId, filePath, user]);

  const reader: ReaderBook | null = useMemo(
    () =>
      book.data && source
        ? {
            ...book.data,
            language: book.data.language || (source.manifest.dir === "rtl" ? "ar" : ""),
            pageCount: source.total,
          }
        : null,
    [book.data, source],
  );

  if (fromPdf && reader && source && start !== null && user)
    return (
      <BookReader
        key={bookId}
        book={reader}
        userId={user.id}
        startPage={clampPage(start, source.total)}
        resumed={resumed}
        source={source}
      />
    );
  if (!fromPdf && book.data && book.data.prepared && start !== null && user)
    return (
      <BookReader
        key={bookId}
        book={book.data}
        userId={user.id}
        startPage={start}
        resumed={resumed}
      />
    );

  const message = book.isError
    ? "ما قدرت أفتح الكتاب. تأكد من النت وجرّب كمان مرة."
    : book.data === null || (book.data && !canRead)
      ? "هاد الكتاب مش متاح."
      : openFailed
        ? "ما قدرت أفتح ملف الكتاب. تأكد من النت وجرّب كمان مرة."
        : "";
  if (!message && fromPdf)
    return <BookOpening title={book.data?.title ?? ""} status={openingLine(stage)} />;

  return (
    <div
      className="edith-premium grid min-h-[100dvh] place-items-center bg-[#f4f4f8] p-6 text-[var(--pp-ink)]"
      dir="rtl"
    >
      {message ? (
        <div className="grid max-w-sm justify-items-center gap-4 text-center">
          <p className="text-[16px]">{message}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link to="/books" className="rita-btn rita-btn-soft gap-2">
              <ArrowRight size={15} aria-hidden="true" /> المكتبة
            </Link>
          </div>
        </div>
      ) : (
        <Loader2
          size={24}
          className="animate-spin text-[var(--pp-muted)]"
          aria-label="جاري فتح الكتاب"
        />
      )}
    </div>
  );
}

/** One line under the cube while the book opens. */
function openingLine(stage: OpenStage | null): string {
  if (stage?.step === "file")
    return stage.share !== null && stage.share > 0 && stage.share < 1
      ? `عم بنزّل الكتاب… ${Math.round(stage.share * 100)}%`
      : "عم بفتح الكتاب…";
  if (stage?.step === "page") return "عم بجهّز أول صفحة…";
  return "عم بفتح الكتاب…";
}
