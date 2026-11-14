import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpening } from "@/components/books/reader/BookOpening";
import { BookReader } from "@/components/books/reader/BookReader";
import type { OpenStage } from "@/components/books/mine/my-book-pdf";
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

type MineSearch = { page?: number; debug?: 1 };

export const Route = createFileRoute("/books_/mine/$bookId")({
  validateSearch: (search: Record<string, unknown>): MineSearch => {
    const page = Math.floor(Number(search.page));
    return {
      ...(Number.isFinite(page) && page >= 1 && page <= 5000 ? { page } : {}),
      ...(String(search.debug) === "1" ? { debug: 1 as const } : {}),
    };
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
  const search = Route.useSearch();
  const { page } = search;
  // Read once: the reader rewrites the address with the page number as pages turn.
  const [debug] = useState(Boolean(search.debug));
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
  const [stage, setStage] = useState<OpenStage | null>(null);
  useEffect(() => {
    if (!ready) return;
    let live = true;
    let opened: MyBookSource | null = null;
    setOpenFailed(false);
    openMyBookSource(ready, {
      onStage: (next) => live && setStage(next),
      debug: Boolean(debug),
    }).then(
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
      <>
        <BookReader
          key={reader.id}
          book={reader}
          userId={user.id}
          startPage={clampPage(start.page, source.total)}
          resumed={start.resumed}
          source={source}
        />
        {debug && <DebugPanel source={source} />}
      </>
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
  if (!message)
    return <BookOpening title={book.data?.title ?? ""} status={openingLine(stage, ui === "ar")} />;
  return (
    <div
      className="edith-premium grid min-h-[100dvh] place-items-center bg-[#f4f4f8] p-6 text-[var(--pp-ink)]"
      dir={ui === "ar" ? "rtl" : "ltr"}
    >
      <div className="grid max-w-sm justify-items-center gap-4 text-center">
        <p className="text-[16px]">{message}</p>
        <Link to="/books" className="bk-btn">
          {ui === "ar" ? "المكتبة" : "The library"}
        </Link>
      </div>
    </div>
  );
}

/** One line under the cube while the book opens. */
function openingLine(stage: OpenStage | null, ar: boolean): string {
  if (stage?.step === "file")
    return stage.share !== null && stage.share > 0 && stage.share < 1
      ? ar
        ? `عم بنزّل الكتاب… ${Math.round(stage.share * 100)}%`
        : `Downloading the book… ${Math.round(stage.share * 100)}%`
      : ar
        ? "عم بنزّل الكتاب…"
        : "Downloading the book…";
  if (stage?.step === "page") return ar ? "عم بجهّز أول صفحة…" : "Getting the first page ready…";
  return ar ? "عم بفتح الكتاب…" : "Opening the book…";
}

/** `?debug=1`: where the time went on this device, so a slow book can be explained. */
function DebugPanel({ source }: { source: MyBookSource }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const d = source.debug;
  const words = Object.entries(d.words)
    .slice(-6)
    .map(([p, n]) => `${p}:${n}`)
    .join(" ");
  return (
    <div className="bkr-debug" dir="ltr" aria-hidden="true">
      {[
        `pdf.js: ${d.mode === "worker" ? "worker ✓" : d.mode === "page" ? "ON THE PAGE (slow)" : "?"}`,
        `file: ${d.from}${d.from === "network" ? ` · parts ${d.parts}` : ""}`,
        `open ${d.openMs} ms · first page ${d.firstPageMs ?? "…"} ms`,
        `slowest page drawing ${d.slowestDrawMs} ms`,
        `words per page: ${words || "…"}`,
      ].join("\n")}
    </div>
  );
}
