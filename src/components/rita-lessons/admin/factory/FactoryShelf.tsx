// The lesson factory's first page, laid out like the home page: the field of marks with the
// headline, the factory's numbers in grey cards, then every book in a grey frame (like the
// library window on the home), each with how far it is and one black pill for what comes next.
import type { CSSProperties } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Plus } from "lucide-react";
import { lessonPlan, lessonReadiness, type SlidesState } from "@/lib/rita-book-flow";
import type { CurriculumRow, LessonRow, WindowRow } from "@/lib/rita-curriculum.functions";
import { CubeLine, DotHero, Facts, WordsIn } from "../HomeBits";
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
  const navigate = useNavigate();
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
      <DotHero>
        <CubeLine>مصنع الدروس</CubeLine>
        <WordsIn as="h1" className="la-title" text="من الكتاب للدرس." />
        <p className="la-sub">
          ارفع كتاب، خلّينا نقرأه، واختار الدروس اللي بدك إياها. كل درس بينصنع كامل لحاله، وبعدين
          بتراجعه وبتنشره من صفحة المراجعة والنشر.
        </p>
        <div className="la-hero-actions">
          <button type="button" className="la-btn is-ink" onClick={onNew}>
            <Plus size={17} aria-hidden="true" /> كتاب جديد
          </button>
          <Link to="/admin/publish" className="la-btn">
            المراجعة والنشر
            {total.ready > 0 && <span className="la-badge">{total.ready}</span>}
          </Link>
        </div>
      </DotHero>

      <Facts
        items={[
          { label: "كتب", value: shelf.length },
          { label: "صفحات مقروءة", value: total.read, note: `من ${total.pages}` },
          { label: "دروس انصنعت", value: total.lessons },
          {
            label: "جاهزين للنشر",
            value: total.ready,
            note: "افتح المراجعة والنشر ←",
            onClick: () => void navigate({ to: "/admin/publish" }),
          },
        ]}
      />

      <section className="la-section" aria-labelledby="la-shelf-title">
        <div className="la-section-head">
          <p className="la-eyebrow">المكتبة</p>
          <WordsIn id="la-shelf-title" className="la-h2" text="كتبك، وكل كتاب وين وصل." />
          <p className="la-lead">
            افتح كتاب لتقرأه وتصنع دروسه. الزر تحت كل كتاب هو الخطوة الجاية.
          </p>
        </div>

        <div className="la-frame">
          <div className="la-shelf">
            {shelf.map((item, i) => (
              <article key={item.book.id} className="la-book" style={{ "--i": i } as CSSProperties}>
                <button type="button" className="la-book-top" onClick={() => onOpen(item.book.id)}>
                  <BookCover book={item.book} />
                  <span className="min-w-0">
                    <span className="la-book-title">{item.book.title_ar || item.book.title}</span>
                    <span className="la-chips">
                      <span className="la-chip">{item.book.level}</span>
                      <span className="la-chip">{kindName(item.book.kind)}</span>
                      <span className="la-chip">{item.book.target_language.toUpperCase()}</span>
                      {item.book.status === "published" && (
                        <span className="la-chip is-ink">منشور</span>
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
                  <Bar value={item.read} max={item.book.page_count} />
                  <p>
                    <span>
                      {item.lessons} درس · {item.published} منشور
                    </span>
                    {item.ready > 0 && <span className="la-chip is-line">{item.ready} جاهز</span>}
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
                    className="la-btn is-ink is-wide"
                  >
                    راجع وانشر ({item.ready})
                    <ArrowLeft size={16} aria-hidden="true" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="la-btn is-wide"
                    onClick={() => onOpen(item.book.id)}
                  >
                    افتح الكتاب
                  </button>
                )}
              </article>
            ))}
            <button
              type="button"
              className="la-book-new"
              style={{ "--i": shelf.length } as CSSProperties}
              onClick={onNew}
            >
              <Plus size={28} aria-hidden="true" />
              كتاب جديد
              <small>كتاب قواعد أو كلمات (PDF)</small>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
