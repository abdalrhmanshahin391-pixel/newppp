// The lesson factory's first page: every book on a shelf, each with how far it is and one button
// for what comes next, and the numbers of the whole factory above them.
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Plus, Sparkles } from "lucide-react";
import { lessonPlan, lessonReadiness, type SlidesState } from "@/lib/rita-book-flow";
import type { CurriculumRow, LessonRow, WindowRow } from "@/lib/rita-curriculum.functions";
import { Bar, BookCover, kindName } from "./FactoryBits";

type Shelf = {
  book: CurriculumRow;
  read: number;
  readDone: boolean;
  lessons: number;
  ready: number;
  published: number;
  unfinished: number;
  suggestions: number;
};

export function FactoryShelf({
  books,
  windows,
  lessons,
  slides,
  onOpen,
  onNew,
}: {
  books: CurriculumRow[];
  windows: WindowRow[];
  lessons: LessonRow[];
  slides: Record<string, Record<string, SlidesState>>;
  onOpen: (bookId: string) => void;
  onNew: () => void;
}) {
  const shelf: Shelf[] = books
    .filter((book) => book.status !== "archived")
    .map((book) => {
      const own = lessons.filter(
        (lesson) => lesson.curriculum_id === book.id && lesson.status !== "archived",
      );
      const states = own.map((lesson) => lessonReadiness(lesson, slides[book.id]?.[lesson.id]));
      return {
        book,
        read: Math.min(book.read_cursor, book.page_count),
        readDone: book.page_count > 0 && book.read_cursor >= book.page_count,
        lessons: own.length,
        ready: states.filter((state) => state === "ready" || state === "warnings").length,
        published: states.filter((state) => state === "published").length,
        unfinished: states.filter((state) => state === "no_slides").length,
        suggestions: lessonPlan({
          suggestions: windows
            .filter((window) => window.curriculum_id === book.id)
            .flatMap((window) => window.summary.suggested_lessons),
          lessons: lessons.filter((lesson) => lesson.curriculum_id === book.id),
          readCursor: book.read_cursor,
        }).length,
      };
    });
  const total = shelf.reduce(
    (sum, item) => ({
      pages: sum.pages + item.book.page_count,
      read: sum.read + item.read,
      lessons: sum.lessons + item.lessons,
      ready: sum.ready + item.ready,
    }),
    { pages: 0, read: 0, lessons: 0, ready: 0 },
  );

  return (
    <div>
      <section className="la-hero">
        <span className="la-hero-icon is-blue" aria-hidden="true">
          <Sparkles size={32} />
        </span>
        <div className="min-w-0">
          <p className="la-eyebrow">للأدمن · من الكتاب للدرس</p>
          <h1 className="la-title">مصنع الدروس</h1>
          <p className="la-sub">
            ارفع كتاب، خلّينا نقرأه، واختار الدروس اللي بدك إياها. كل درس بينصنع كامل لحاله، وبعدين
            بتراجعه وبتنشره من صفحة المراجعة والنشر.
          </p>
        </div>
      </section>

      <div className="la-stats">
        <div className="la-stat">
          <span>كتب</span>
          <b>{shelf.length}</b>
        </div>
        <div className="la-stat">
          <span>صفحات مقروءة</span>
          <b>{total.read}</b>
          <small>من {total.pages}</small>
        </div>
        <div className="la-stat">
          <span>دروس انصنعت</span>
          <b>{total.lessons}</b>
        </div>
        <Link to="/admin/publish" className="la-stat">
          <span>جاهزين للنشر</span>
          <b>{total.ready}</b>
          <small>افتح المراجعة والنشر ←</small>
        </Link>
      </div>

      <div className="la-shelf">
        {shelf.map((item) => (
          <article key={item.book.id} className="la-book">
            <button type="button" className="la-book-top" onClick={() => onOpen(item.book.id)}>
              <BookCover book={item.book} />
              <span className="min-w-0">
                <span className="la-book-title block">{item.book.title_ar || item.book.title}</span>
                <span className="la-chips">
                  <span className="la-chip">{item.book.level}</span>
                  <span className="la-chip">{kindName(item.book.kind)}</span>
                  <span className="la-chip">{item.book.target_language.toUpperCase()}</span>
                  {item.book.status === "published" && (
                    <span className="la-chip is-green">منشور</span>
                  )}
                </span>
              </span>
            </button>

            <div className="la-book-meta">
              <p>
                <span>{item.readDone ? "انقرأ كامل" : "القراءة"}</span>
                <span>
                  {item.read} / {item.book.page_count}
                </span>
              </p>
              <Bar value={item.read} max={item.book.page_count} tone="blue" />
              <p>
                <span>
                  {item.lessons} درس · {item.published} منشور
                </span>
                {item.ready > 0 && <span className="la-chip is-blue">{item.ready} جاهز</span>}
              </p>
            </div>

            {!item.readDone ? (
              <button
                type="button"
                className="la-btn is-ink is-wide"
                onClick={() => onOpen(item.book.id)}
              >
                {item.read > 0 ? "كمّل القراءة" : "اقرأ الكتاب"}
                <ArrowLeft size={16} aria-hidden="true" />
              </button>
            ) : item.suggestions > 0 || item.unfinished > 0 ? (
              <button
                type="button"
                className="la-btn is-ink is-wide"
                onClick={() => onOpen(item.book.id)}
              >
                {item.suggestions > 0
                  ? `اصنع ${item.suggestions} ${item.suggestions === 1 ? "درس" : "دروس"}`
                  : `كمّل ${item.unfinished} ${item.unfinished === 1 ? "درس" : "دروس"}`}
                <ArrowLeft size={16} aria-hidden="true" />
              </button>
            ) : item.ready > 0 ? (
              <Link
                to="/admin/publish"
                search={{ book: item.book.id }}
                className="la-btn is-green is-wide"
              >
                راجع وانشر ({item.ready})
                <ArrowLeft size={16} aria-hidden="true" />
              </Link>
            ) : (
              <button type="button" className="la-btn is-wide" onClick={() => onOpen(item.book.id)}>
                افتح الكتاب
              </button>
            )}
          </article>
        ))}
        <button type="button" className="la-book-new" onClick={onNew}>
          <Plus size={28} aria-hidden="true" />
          كتاب جديد
          <span className="text-[13px] font-medium">كتاب قواعد أو كلمات (PDF)</span>
        </button>
      </div>
    </div>
  );
}
