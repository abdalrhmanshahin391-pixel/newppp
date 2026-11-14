// «ارفع ملف الكتاب»: the admin adds the PDF to a book that has none, from the book's own page in
// the library (the starter shelf's books come without files). The file goes up in resumable parts,
// the book points to it, and it can be read in the site at once (straight from the PDF).
// Learners never see this: the sheet shows it only to an admin.
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { MAX_PDF_BYTES, pdfFileProblem, type Book } from "@/lib/books";
import { attachBookPdf, LIBRARY_QUERY_KEY, UPLOAD_CANCELLED } from "@/lib/books-data";

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
            ميغا) وبيصير يتقرأ داخل الموقع على طول.
          </p>
        )}
      </div>
    </>
  );
}
