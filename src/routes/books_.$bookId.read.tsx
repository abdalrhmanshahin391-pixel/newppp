import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2 } from "lucide-react";
import { BookReader } from "@/components/books/reader/BookReader";
import { useAuth } from "@/hooks/useAuth";
import { bookFileLink } from "@/lib/books-data";
import { loadReaderBook, loadReadingPlace } from "@/lib/book-reader-data";

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
  // Where this reader stopped, unless the address names a page (a refresh, a shared link).
  const [start, setStart] = useState<number | null>(page ?? null);
  useEffect(() => {
    if (start !== null || !user || !book.data?.prepared) return;
    let live = true;
    void loadReadingPlace(bookId).then((place) => live && setStart(place ?? 1));
    return () => {
      live = false;
    };
  }, [book.data?.prepared, bookId, start, user]);

  if (book.data && book.data.prepared && start !== null && user)
    return <BookReader key={bookId} book={book.data} userId={user.id} startPage={start} />;

  const message = book.isError
    ? "ما قدرت أفتح الكتاب. تأكد من النت وجرّب كمان مرة."
    : book.data === null
      ? "هاد الكتاب مش متاح."
      : book.data && !book.data.prepared
        ? "هاد الكتاب لسا مش جاهز للقراءة هون. بتقدر تفتح ملف الـ PDF."
        : "";

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
            {book.data && !book.data.prepared && book.data.filePath && (
              <button
                type="button"
                className="rita-btn rita-btn-primary"
                onClick={() => {
                  const path = book.data?.filePath;
                  if (path) void bookFileLink(path).then((url) => window.location.assign(url));
                }}
              >
                افتح ملف PDF
              </button>
            )}
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
