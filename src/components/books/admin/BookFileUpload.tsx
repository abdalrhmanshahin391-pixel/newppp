// «ارفع ملف الكتاب»: the admin adds the PDF to a book that has none, from the book's own page in
// the library (the starter shelf's books come without files). The file goes up in resumable parts,
// the book points to it, and the book is prepared for reading straight away (as in the editor).
// Learners never see this: the sheet shows it only to an admin.
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpenCheck, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { MAX_PDF_BYTES, pdfFileProblem, type Book } from "@/lib/books";
import { attachBookPdf, LIBRARY_QUERY_KEY, UPLOAD_CANCELLED } from "@/lib/books-data";
import { isRunning, prepareBook, usePrepareJobs } from "@/lib/book-prepare";
import { PrepareBlock, useReaderStates } from "./ReaderPrepare";

type Phase = "idle" | "uploading" | "error";

/** The button for a book without a file, with its progress and what went wrong, if anything. */
export function BookFileUpload({
  book,
  onUploaded,
}: {
  book: Pick<Book, "id" | "title">;
  /** The book now has this file in the bucket (the sheet then shows its reading actions). */
  onUploaded: (path: string) => void;
}) {
  const queryClient = useQueryClient();
  const readerStates = useReaderStates();
  const input = useRef<HTMLInputElement>(null);
  const stop = useRef<AbortController | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [share, setShare] = useState(0);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const percent = Math.round(share * 100);

  // Closing the tab mid-upload would lose it: the browser asks first.
  useEffect(() => {
    if (phase !== "uploading") return;
    const ask = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", ask);
    return () => window.removeEventListener("beforeunload", ask);
  }, [phase]);

  async function choose(file: File | undefined) {
    if (!file || phase === "uploading") return;
    const problem = pdfFileProblem(file);
    if (problem) {
      setPhase("error");
      setMessage(problem);
      return;
    }
    const controller = new AbortController();
    stop.current = controller;
    setName(file.name);
    setShare(0);
    setMessage("");
    setPhase("uploading");
    try {
      const path = await attachBookPdf(book.id, file, setShare, controller.signal);
      void queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY });
      toast.success(`انرفع ملف «${book.title}».`);
      // Prepared for reading straight away, from the file on this device. The job lives in its own
      // module, so it goes on even if this sheet is closed.
      if (readerStates.data) {
        void prepareBook({ bookId: book.id, filePath: path, file });
        toast.message("بلّشنا نجهّز الكتاب للقراءة. خلّي الصفحة مفتوحة لحد ما يخلص.");
      }
      onUploaded(path);
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "";
      if (text === UPLOAD_CANCELLED) {
        setPhase("idle");
        return;
      }
      setPhase("error");
      setMessage(text || "ما زبط الرفع. جرّب مرة ثانية.");
    } finally {
      stop.current = null;
    }
  }

  const uploading = phase === "uploading";
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        tabIndex={-1}
        aria-hidden="true"
        data-testid="book-pdf-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void choose(file);
        }}
      />
      <button
        type="button"
        className="bk-btn is-primary"
        disabled={uploading}
        onClick={() => input.current?.click()}
      >
        {uploading ? (
          <Loader2 size={17} className="animate-spin" aria-hidden="true" />
        ) : (
          <Upload size={17} aria-hidden="true" />
        )}
        {uploading
          ? `عم نرفع… ${percent}%`
          : phase === "error"
            ? "جرّب مرة ثانية"
            : "ارفع ملف الكتاب"}
      </button>
      {uploading && (
        <button type="button" className="bk-btn" onClick={() => stop.current?.abort()}>
          <X size={17} aria-hidden="true" />
          إلغاء
        </button>
      )}
      <div className="bk-file-note" dir="rtl" lang="ar">
        {uploading ? (
          <>
            <div
              className="bk-file-bar"
              role="progressbar"
              aria-label="رفع ملف الكتاب"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <i style={{ width: `${percent}%` }} />
            </div>
            <p>
              <bdi>{name}</bdi> · خلّي الصفحة مفتوحة لحد ما يخلص.
            </p>
          </>
        ) : phase === "error" ? (
          <p className="is-error" role="alert">
            {message}
          </p>
        ) : (
          <p>
            للأدمن: الكتاب لسا بدون ملف. ارفع PDF (لحد {Math.round(MAX_PDF_BYTES / 1024 / 1024)}{" "}
            ميغا) وبنجهّزه للقراءة تلقائياً.
          </p>
        )}
      </div>
    </>
  );
}

/** For an admin, on a book that has a file: whether it is ready to read in the site, and the button that prepares it. */
export function BookReadingAdmin({
  book,
  onReady,
}: {
  book: Pick<Book, "id" | "title" | "file_path">;
  /** The book became ready to read while the sheet was open. */
  onReady: () => void;
}) {
  const states = useReaderStates();
  const state = states.data?.get(book.id);
  const job = usePrepareJobs().get(book.id);
  const prepared = Boolean(state?.preparedAt);
  const was = useRef(prepared);
  useEffect(() => {
    if (prepared && !was.current) onReady();
    was.current = prepared;
  }, [prepared, onReady]);
  if (!states.data) return null;
  // Ready to read (and no job going): nothing to do here, so the card is not drawn.
  if (prepared && state?.complete !== false && !isRunning(job)) return null;
  return (
    <div className="bk-file-note bk-file-admin" dir="rtl" lang="ar">
      <p className="bk-file-head">
        <BookOpenCheck size={15} aria-hidden="true" /> للأدمن · القراءة داخل الموقع
      </p>
      <PrepareBlock book={book} state={state} />
    </div>
  );
}
