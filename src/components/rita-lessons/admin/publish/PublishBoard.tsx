// Review and publish, the list, laid out like the home page: the field of marks with the headline,
// the numbers in grey cards, pills for the two tabs (ready, published) and the filters, and one
// grey card per lesson (its picture in a white frame) with «see it as a learner» and «publish».
import type { CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Eye, Loader2, Search, Send, Sparkles, Undo2 } from "lucide-react";
import { boardChoices, boardView, type BoardStats, type BoardTab } from "@/lib/rita-lesson-board";
import { LessonImage } from "@/components/rita-lessons/LessonArt";
import { BidiText } from "../book/BookBits";
import { pagesLabel } from "../book/book-utils";
import { CubeLine, DotHero, Facts, WordsIn } from "../HomeBits";
import type { PublishActions, PublishEntry } from "./usePublishActions";

export type BoardSearch = { tab: BoardTab; level?: string; book?: string; query?: string };

export function PublishBoard({
  entries,
  stats,
  search,
  linked,
  actions,
  onSearch,
  onOpen,
}: {
  entries: PublishEntry[];
  stats: BoardStats;
  search: BoardSearch;
  linked: (entry: PublishEntry) => boolean;
  actions: PublishActions;
  onSearch: (next: Partial<BoardSearch>) => void;
  onOpen: (lessonId: string) => void;
}) {
  const shown = boardView(entries, search);
  const choices = boardChoices(entries, search.tab);
  const ready = search.tab === "ready";

  return (
    <div>
      <DotHero>
        <CubeLine>المراجعة والنشر</CubeLine>
        <WordsIn as="h1" className="la-title" text="شوف الدرس، وانشره للكل." />
        <p className="la-sub">
          شوف كل درس زي ما الطالب بشوفه، وانشره بكبسة. الدرس المنشور بينزل بالمسار بمستواه لحاله.
        </p>
        <div className="la-hero-actions">
          <Link to="/admin/curricula" className="la-btn">
            مصنع الدروس
          </Link>
          <Link to="/rita-lessons" className="la-btn is-quiet">
            مسار الطالب
          </Link>
        </div>
      </DotHero>

      <Facts
        items={[
          {
            label: "جاهزين للنشر",
            value: stats.ready,
            onClick: () => onSearch({ tab: "ready" }),
          },
          { label: "فيهم ملاحظات", value: stats.warnings, note: "شوفهم كطالب قبل النشر" },
          {
            label: "منشورين",
            value: stats.published,
            onClick: () => onSearch({ tab: "published" }),
          },
          {
            label: "مستويات بالمسار",
            value: stats.byLevel.length,
            note: stats.byLevel.length
              ? stats.byLevel.map((item) => `${item.level} · ${item.count}`).join("  ")
              : "لسا ولا درس",
          },
        ]}
      />

      <section className="la-section" aria-labelledby="la-board-title">
        <div className="la-section-head">
          <p className="la-eyebrow">{ready ? "بانتظارك" : "عند الطلاب"}</p>
          <WordsIn
            key={search.tab}
            id="la-board-title"
            className="la-h2"
            text={ready ? "دروس جاهزة للمراجعة." : "دروس منشورة بالمسار."}
          />
        </div>

        {stats.unfinished > 0 && (
          <p className="la-note mb-6 flex flex-wrap items-center gap-2">
            <span className="me-auto">
              {stats.unfinished === 1 ? "درس واحد" : `${stats.unfinished} دروس`} لسا عم ينصنعوا أو
              ما كملوا. بيطلعوا هون أول ما يكملوا.
            </span>
            <Link to="/admin/curricula" className="la-btn is-sm">
              <Sparkles size={14} aria-hidden="true" /> افتح مصنع الدروس
            </Link>
          </p>
        )}

        <div className="la-toolbar">
          <div className="la-pills" role="tablist" aria-label="الدروس">
            <button
              type="button"
              role="tab"
              className="la-pill"
              aria-selected={ready}
              onClick={() => onSearch({ tab: "ready", level: undefined, book: undefined })}
            >
              جاهزين <span className="la-badge">{stats.ready}</span>
            </button>
            <button
              type="button"
              role="tab"
              className="la-pill"
              aria-selected={!ready}
              onClick={() => onSearch({ tab: "published", level: undefined, book: undefined })}
            >
              منشورين <span className="la-badge">{stats.published}</span>
            </button>
          </div>
          {choices.levels.length > 1 && (
            <label className="la-pill">
              <select
                aria-label="المستوى"
                value={search.level ?? "all"}
                onChange={(event) =>
                  onSearch({ level: event.target.value === "all" ? undefined : event.target.value })
                }
              >
                <option value="all">كل المستويات</option>
                {choices.levels.map((level) => (
                  <option key={level}>{level}</option>
                ))}
              </select>
            </label>
          )}
          {(choices.books.length > 1 || search.book) && (
            <label className="la-pill">
              <select
                aria-label="الكتاب"
                value={search.book ?? "all"}
                onChange={(event) =>
                  onSearch({ book: event.target.value === "all" ? undefined : event.target.value })
                }
              >
                <option value="all">كل الكتب</option>
                {choices.books.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.title_ar || book.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="la-pill">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              placeholder="ابحث عن درس"
              aria-label="ابحث عن درس"
              value={search.query ?? ""}
              onChange={(event) => onSearch({ query: event.target.value || undefined })}
            />
          </label>
          {ready && shown.length > 1 && (
            <button
              type="button"
              className="la-btn is-ink"
              disabled={Boolean(actions.busy)}
              onClick={() => {
                if (window.confirm(`نشر ${shown.length} دروس للطلاب؟`)) void actions.publish(shown);
              }}
            >
              {actions.busy === "all" ? (
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              ) : (
                <Send size={15} aria-hidden="true" />
              )}
              انشر الكل ({shown.length})
            </button>
          )}
        </div>

        {actions.progress && actions.progress.total > 1 && (
          <p className="la-note is-ink mb-4" role="status">
            عم ننشر {actions.progress.done} من {actions.progress.total}…
          </p>
        )}

        {shown.length === 0 ? (
          <div className="la-empty">
            <h3>
              {search.query || search.level || search.book
                ? "ما في دروس بهالبحث"
                : ready
                  ? "ما في دروس بانتظار النشر"
                  : "لسا ما انشر ولا درس"}
            </h3>
            <p>
              {search.query || search.level || search.book
                ? "غيّر البحث أو الفلتر."
                : ready
                  ? "الدروس اللي بتنصنع بمصنع الدروس بتوصل هون جاهزة للمراجعة."
                  : "انشر درس من تبويب «جاهزين» وبيطلع هون."}
            </p>
            {ready && !search.query && !search.level && !search.book && (
              <Link to="/admin/curricula" className="la-btn is-ink mt-2">
                <Sparkles size={16} aria-hidden="true" /> افتح مصنع الدروس
              </Link>
            )}
          </div>
        ) : (
          <div className="la-grid">
            {shown.map((entry, i) => (
              <LessonCard
                key={entry.lesson.id}
                index={i}
                entry={entry}
                linked={linked(entry)}
                actions={actions}
                onOpen={() => onOpen(entry.lesson.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function LessonCard({
  index,
  entry,
  linked,
  actions,
  onOpen,
}: {
  index: number;
  entry: PublishEntry;
  linked: boolean;
  actions: PublishActions;
  onOpen: () => void;
}) {
  const { lesson, book } = entry;
  const busy = actions.busy === lesson.id || actions.busy === "all";
  const published = entry.readiness === "published";
  return (
    <article className="la-lesson" style={{ "--i": Math.min(index, 12) } as CSSProperties}>
      <button
        type="button"
        className="la-lesson-cover"
        onClick={onOpen}
        aria-label={`افتح ${lesson.title_ar || lesson.title}`}
      >
        <LessonImage src={lesson.image_url} alt="" className="h-full w-full !rounded-none" />
        <span className="la-chip is-ink">{entry.level}</span>
      </button>
      <div className="la-lesson-body">
        <p className="la-row-sub m-0">
          {book.title_ar || book.title} ·{" "}
          {pagesLabel(lesson.source_from_page, lesson.source_to_page)}
        </p>
        <button type="button" className="la-lesson-title" onClick={onOpen}>
          <BidiText text={lesson.title_ar || lesson.title} />
        </button>
        {lesson.title_ar && (
          <p className="la-lesson-en" dir="ltr">
            {lesson.title}
          </p>
        )}
        <p className="la-lesson-facts">
          <span>{lesson.objectives.length} أهداف</span>
          <span>{lesson.vocabulary.length} كلمة</span>
          <span>الشرائح ✓</span>
          {book.status !== "published" && <span>الكتاب مسودة · بينشر معه</span>}
        </p>
        {entry.notes > 0 && !published && (
          <p className="la-lesson-flag">
            <span className="la-chip is-look">{entry.notes} ملاحظات</span>
            شوفه كطالب قبل النشر
          </p>
        )}
        {published && (
          <p className="la-lesson-flag">
            <Check size={14} aria-hidden="true" /> منشور · بالمسار بمستوى {entry.level}
          </p>
        )}
        <div className="la-lesson-actions">
          {linked && (
            <Link
              to="/rita-study"
              search={{ lesson: lesson.id, preview: true }}
              className="la-btn is-sm"
            >
              <Eye size={15} aria-hidden="true" /> شوفه كطالب
            </Link>
          )}
          {published ? (
            <button
              type="button"
              className="la-btn is-sm"
              disabled={busy}
              onClick={() => void actions.unpublish(entry)}
            >
              <Undo2 size={15} aria-hidden="true" /> إلغاء النشر
            </button>
          ) : (
            <button
              type="button"
              className="la-btn is-sm is-ink"
              disabled={busy}
              onClick={() => void actions.publish([entry])}
            >
              {busy ? (
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              ) : (
                <Send size={15} aria-hidden="true" />
              )}
              انشر
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
