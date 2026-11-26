// Review and publish, the list: the numbers, two tabs (ready, published), filters, and one card per
// lesson with «see it as a learner» and «publish».
import { Link } from "@tanstack/react-router";
import { Check, Eye, Loader2, Search, Send, Sparkles, Undo2 } from "lucide-react";
import { boardChoices, boardView, type BoardStats, type BoardTab } from "@/lib/rita-lesson-board";
import { LessonImage } from "@/components/rita-lessons/LessonArt";
import { BidiText } from "../book/BookBits";
import { pagesLabel } from "../book/book-utils";
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
      <section className="la-hero">
        <span className="la-hero-icon is-green" aria-hidden="true">
          <Send size={30} />
        </span>
        <div className="min-w-0">
          <p className="la-eyebrow">للأدمن · آخر خطوة</p>
          <h1 className="la-title">المراجعة والنشر</h1>
          <p className="la-sub">
            شوف كل درس زي ما الطالب بشوفه، وانشره للكل بكبسة. الدرس المنشور بينزل بالمسار بمستواه
            لحاله.
          </p>
        </div>
      </section>

      <div className="la-stats">
        <button type="button" className="la-stat" onClick={() => onSearch({ tab: "ready" })}>
          <span>جاهزين للنشر</span>
          <b>{stats.ready}</b>
        </button>
        <div className="la-stat">
          <span>فيهم ملاحظات</span>
          <b>{stats.warnings}</b>
          <small>شوفهم كطالب قبل النشر</small>
        </div>
        <button type="button" className="la-stat" onClick={() => onSearch({ tab: "published" })}>
          <span>منشورين</span>
          <b>{stats.published}</b>
        </button>
        <div className="la-stat">
          <span>بالمسار</span>
          {stats.byLevel.length ? (
            <span className="la-chips mt-1.5">
              {stats.byLevel.map((item) => (
                <span key={item.level} className="la-chip">
                  {item.level} · {item.count}
                </span>
              ))}
            </span>
          ) : (
            <small className="mt-1.5">لسا ولا درس</small>
          )}
        </div>
      </div>

      {stats.unfinished > 0 && (
        <p className="la-note mb-4 flex flex-wrap items-center gap-2">
          <span className="me-auto">
            {stats.unfinished === 1 ? "درس واحد" : `${stats.unfinished} دروس`} لسا عم ينصنعوا أو ما
            كملوا. بيطلعوا هون أول ما يكملوا.
          </span>
          <Link to="/admin/curricula" className="la-btn is-sm">
            <Sparkles size={14} aria-hidden="true" /> افتح مصنع الدروس
          </Link>
        </p>
      )}

      <div className="la-toolbar">
        <div className="la-tabs" role="tablist" aria-label="الدروس">
          <button
            type="button"
            role="tab"
            aria-selected={ready}
            onClick={() => onSearch({ tab: "ready", level: undefined, book: undefined })}
          >
            جاهزين <span className="la-badge">{stats.ready}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!ready}
            onClick={() => onSearch({ tab: "published", level: undefined, book: undefined })}
          >
            منشورين <span className="la-badge">{stats.published}</span>
          </button>
        </div>
        {choices.levels.length > 1 && (
          <select
            className="la-filter"
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
        )}
        {(choices.books.length > 1 || search.book) && (
          <select
            className="la-filter"
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
        )}
        <label className="la-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            placeholder="ابحث عن درس"
            aria-label="ابحث عن درس"
            value={search.query ?? ""}
            onChange={(event) => onSearch({ query: event.target.value || undefined })}
          />
        </label>
        <span className="me-auto" />
        {ready && shown.length > 1 && (
          <button
            type="button"
            className="la-btn is-green is-sm"
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
        <p className="la-note is-green mb-4" role="status">
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
          {shown.map((entry) => (
            <LessonCard
              key={entry.lesson.id}
              entry={entry}
              linked={linked(entry)}
              actions={actions}
              onOpen={() => onOpen(entry.lesson.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LessonCard({
  entry,
  linked,
  actions,
  onOpen,
}: {
  entry: PublishEntry;
  linked: boolean;
  actions: PublishActions;
  onOpen: () => void;
}) {
  const { lesson, book } = entry;
  const busy = actions.busy === lesson.id || actions.busy === "all";
  const published = entry.readiness === "published";
  return (
    <article className="la-lesson">
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
          <p className="m-0 text-[13px] font-bold text-[var(--la-amber)]">
            {entry.notes} ملاحظات بمراجعة الشرائح · شوفه قبل النشر
          </p>
        )}
        {published && (
          <p className="m-0 flex items-center gap-1 text-[13px] font-bold text-[var(--la-green)]">
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
              className="la-btn is-sm is-green"
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
