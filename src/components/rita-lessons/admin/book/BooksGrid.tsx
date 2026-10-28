import { ArrowLeft, Plus } from "lucide-react";
import { bookProgress, lessonPlan, type BookStep, type ExercisesState } from "@/lib/rita-book-flow";
import type { CurriculumRow, LessonRow, WindowRow } from "@/lib/rita-curriculum.functions";
import { KindBadge } from "./BookBits";

/** All books, each with where it is and one button for its next step. */
export function BooksGrid({
  books,
  windows,
  lessons,
  missingText,
  exercises,
  onOpen,
  onNew,
}: {
  books: CurriculumRow[];
  windows: WindowRow[];
  lessons: LessonRow[];
  missingText: Record<string, number[]>;
  exercises: Record<string, Record<string, ExercisesState>>;
  onOpen: (bookId: string, step: BookStep) => void;
  onNew: () => void;
}) {
  const live = books.filter((book) => book.status !== "archived");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="me-auto">
          <h1 className="uz-title">الكتب</h1>
          <p className="mt-2 text-[15px] text-[var(--pp-muted)]">
            افتح الكتاب، وريتا بتصنع دروسه كاملة بكبسة وحدة.
          </p>
        </div>
        <button type="button" onClick={onNew} className="uz-btn uz-btn-accent uz-btn-lg">
          <Plus size={18} aria-hidden="true" />
          كتاب جديد
        </button>
      </div>

      {live.length === 0 ? (
        <div className="uz-card p-10 text-center">
          <p className="text-[18px] font-semibold">لسا ما في كتب.</p>
          <p className="mt-1 text-[15px] text-[var(--pp-muted)]">
            أضف كتاب القواعد أو كتاب الكلمات (PDF) لتبلش.
          </p>
          <button type="button" onClick={onNew} className="uz-btn uz-btn-accent uz-btn-lg mt-4">
            <Plus size={18} aria-hidden="true" /> كتاب جديد
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {live.map((book) => {
            const bookLessons = lessons.filter((lesson) => lesson.curriculum_id === book.id);
            const open = lessonPlan({
              suggestions: windows
                .filter((window) => window.curriculum_id === book.id)
                .flatMap((window) => window.summary.suggested_lessons),
              lessons: bookLessons,
              readCursor: book.read_cursor,
            }).length;
            const progress = bookProgress({
              book,
              lessons: bookLessons,
              missingPages: missingText[book.id]?.length ?? 0,
              exercises: exercises[book.id] ?? {},
              openSuggestions: open,
            });
            return (
              <li key={book.id} className="uz-card flex min-w-0 flex-col gap-4">
                <button
                  type="button"
                  onClick={() => onOpen(book.id, progress.next.step)}
                  className="min-w-0 text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--pp-ink)]"
                >
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[18px] font-bold tracking-[-0.01em]">
                      {book.title_ar || book.title}
                    </span>
                    <KindBadge kind={book.kind} />
                  </span>
                  <span className="mt-1 block truncate text-[14px] text-[var(--pp-muted)]">
                    <span dir="ltr">{book.title}</span> · {book.target_language.toUpperCase()} ·{" "}
                    {book.status === "published" ? "منشور" : "مسودة"}
                  </span>
                </button>
                <p className="text-[13.5px] tabular-nums text-[var(--pp-muted)]">
                  {progress.readDone
                    ? `${progress.lessons} درس · ${progress.publishedLessons} منشور`
                    : `انقرأ ${progress.pagesRead} من ${progress.pageCount} صفحة`}
                </p>
                <button
                  type="button"
                  onClick={() => onOpen(book.id, progress.next.step)}
                  className={`uz-btn self-start ${progress.done.publish ? "uz-btn-soft" : "uz-btn-accent"}`}
                >
                  {progress.done.publish
                    ? "افتح"
                    : progress.next.step === "read"
                      ? progress.next.label
                      : progress.next.step === "publish"
                        ? "انشر"
                        : "كمّل الدروس"}
                  <ArrowLeft size={15} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
