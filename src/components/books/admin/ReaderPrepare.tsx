// «جهّز الكتاب للقراءة»: the admin's browser turns the book's PDF into light page pictures and
// words, so readers open it page by page inside the site (see src/lib/book-prepare.ts). The block
// sits in the book editor, and the list of books still waiting sits in «الاستيراد والجودة».
import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenCheck, Loader2, Square } from "lucide-react";
import { toast } from "sonner";
import type { Book } from "@/lib/books";
import {
  isRunning,
  loadReaderStates,
  prepareBook,
  stopPreparing,
  usePrepareJobs,
  type PrepareJob,
  type ReaderState,
} from "@/lib/book-prepare";
import { muted, sectionTitle } from "./admin-ui";

export const READER_QUERY_KEY = ["library", "reader"] as const;

/** Each book's reader state (null before the reader migration is applied). */
export function useReaderStates() {
  return useQuery({ queryKey: READER_QUERY_KEY, queryFn: loadReaderStates, staleTime: 10_000 });
}

/** When a job ends, the states are read again (and the admin hears how it went). */
function useJobEnd(job: PrepareJob | undefined, title: string) {
  const queryClient = useQueryClient();
  const last = useRef(job?.stage);
  useEffect(() => {
    const was = last.current;
    last.current = job?.stage;
    if (!job || was === job.stage || isRunning(job)) return;
    if (was === undefined) return;
    void queryClient.invalidateQueries({ queryKey: READER_QUERY_KEY });
    if (job.stage === "done") toast.success(`«${title}» جاهز للقراءة: ${job.total} صفحة.`);
    else if (job.stage === "failed") toast.error(job.message);
  }, [job, queryClient, title]);
}

function Bar({ done, total }: { done: number; total: number }) {
  const share = total ? Math.round((done / total) * 100) : 0;
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-[var(--pp-grey)]"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total || 1}
      aria-valuenow={done}
      aria-label="تجهيز الصفحات"
    >
      <div
        className="h-full rounded-full bg-[var(--pp-accent)] transition-[width] duration-300 ease-out"
        style={{ width: `${share}%` }}
      />
    </div>
  );
}

/** One book's reading state, with the button that prepares it. */
export function PrepareBlock({
  book,
  state,
  file,
  compact,
}: {
  book: Pick<Book, "id" | "title" | "file_path">;
  state: ReaderState | undefined;
  /** The PDF on this device, when the admin just picked it (opened without downloading). */
  file?: File | null;
  compact?: boolean;
}) {
  const job = usePrepareJobs().get(book.id);
  useJobEnd(job, book.title);
  const running = isRunning(job);
  const prepared = Boolean(state?.preparedAt) && job?.stage !== "failed";
  const started = !prepared && Boolean(state?.pageCount);
  const start = (again: boolean) => {
    if (!book.file_path) return;
    void prepareBook({ bookId: book.id, filePath: book.file_path, file, again });
  };

  if (!book.file_path)
    return compact ? null : (
      <p className={muted}>ارفع ملف PDF واحفظ الكتاب، بعدين جهّزه للقراءة.</p>
    );

  return (
    <div className="grid gap-2">
      {!compact && (
        <p className="text-[14px]">
          {running
            ? job!.stage === "opening"
              ? "جاري فتح الملف…"
              : job!.stage === "finishing"
                ? "آخر خطوة…"
                : `جاري تجهيز الصفحات: ${job!.done} من ${job!.total}`
            : prepared
              ? `جاهز للقراءة داخل الموقع: ${state?.pageCount ?? job?.total ?? 0} صفحة.`
              : started
                ? `تجهّز ${state?.done ?? 0} من ${state?.pageCount} صفحة. كمّل من وين وقفت.`
                : "القرّاء بيفتحوه صفحة صفحة بدون ما ينزّلوا الملف كله. التجهيز بيصير مرة وحدة من جهازك."}
        </p>
      )}
      {running && (
        <>
          <Bar done={job!.done} total={job!.total} />
          <p className={muted}>
            خلّي الصفحة مفتوحة لحد ما يخلص. إذا وقف، بتكمّل بعدين من نفس المكان.
            {job!.scanned > 0 && ` ${job!.scanned} صفحة صور بدون نص.`}
          </p>
        </>
      )}
      {!running && job?.stage === "stopped" && <p className={muted}>{job.message}</p>}
      {!running && job?.stage === "failed" && (
        <p className="text-[14px] text-[#8c1a31]" role="alert">
          {job.message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {running ? (
          <button
            type="button"
            className="rita-btn rita-btn-soft gap-2"
            onClick={() => stopPreparing(book.id)}
          >
            <Square size={13} fill="currentColor" aria-hidden="true" /> وقّف
          </button>
        ) : prepared ? (
          !compact && (
            <button
              type="button"
              className="rita-btn rita-btn-soft gap-2"
              onClick={() => start(true)}
            >
              <BookOpenCheck size={15} aria-hidden="true" /> جهّز مرة ثانية
            </button>
          )
        ) : (
          <button
            type="button"
            className="rita-btn rita-btn-primary gap-2"
            onClick={() => start(false)}
          >
            {job?.stage === "opening" ? (
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            ) : (
              <BookOpenCheck size={15} aria-hidden="true" />
            )}
            {started || job?.stage === "stopped" ? "كمّل التجهيز" : "جهّز الكتاب للقراءة"}
          </button>
        )}
      </div>
    </div>
  );
}

/** «جاهزية القراءة»: books with a PDF that readers cannot open in the site yet. */
export function ReadingQuality({ books, onEdit }: { books: Book[]; onEdit: (book: Book) => void }) {
  const states = useReaderStates();
  const jobs = usePrepareJobs();
  if (states.data === null)
    return (
      <section className="space-y-2">
        <h2 className={sectionTitle}>جاهزية القراءة</h2>
        <p className={muted}>
          القراءة داخل الموقع بتشتغل بعد تطبيق ملف قاعدة البيانات الجديد (القارئ).
        </p>
      </section>
    );
  if (!states.data) return null;
  const waiting = books.filter(
    (b) =>
      b.file_path &&
      b.status !== "archived" &&
      (!states.data!.get(b.id)?.preparedAt || isRunning(jobs.get(b.id))),
  );
  return (
    <section className="space-y-3">
      <div>
        <h2 className={sectionTitle}>جاهزية القراءة ({waiting.length})</h2>
        <p className={muted}>
          كتب فيها PDF بس لسا ما تجهّزت للقراءة داخل الموقع. لحد ما تتجهّز، القارئ بيفتح ملف الـ PDF
          نفسه.
        </p>
      </div>
      {waiting.length > 0 && (
        <ul className="divide-y divide-[var(--pp-line)] rounded-2xl border border-[var(--pp-line)]">
          {waiting.map((book) => (
            <li
              key={book.id}
              className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:items-center"
            >
              <button
                type="button"
                className="min-h-11 text-start text-[15px] font-semibold hover:underline"
                dir="auto"
                onClick={() => onEdit(book)}
              >
                {book.title}
              </button>
              <PrepareBlock book={book} state={states.data!.get(book.id)} compact />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
