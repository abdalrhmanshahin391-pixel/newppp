import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { MyBookReader } from "@/components/books/mine/MyBookReader";
import { useUiLanguage } from "@/components/language/useUiLanguage";
import { useAuth } from "@/hooks/useAuth";
import { loadMyBook } from "@/lib/user-books-data";

export const Route = createFileRoute("/books_/mine/$bookId")({
  head: () => ({
    meta: [{ title: "Your book — Uzyra" }, { name: "robots", content: "noindex" }],
  }),
  component: MyBookRoute,
});

function MyBookRoute() {
  const { bookId } = Route.useParams();
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
  if (book.data && book.data.status === "ready") return <MyBookReader book={book.data} ui={ui} />;
  const missing = book.isError || book.data === null || (book.data && book.data.status !== "ready");
  return (
    <div
      className="edith-premium grid min-h-[100dvh] place-items-center bg-[#f4f4f8] p-6 text-[var(--pp-ink)]"
      dir={ui === "ar" ? "rtl" : "ltr"}
    >
      {missing ? (
        <div className="grid max-w-sm justify-items-center gap-4 text-center">
          <p className="text-[16px]">
            {ui === "ar"
              ? "هاد الكتاب مش موجود أو ما كمل رفعه."
              : "This book is not here, or its upload did not finish."}
          </p>
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
