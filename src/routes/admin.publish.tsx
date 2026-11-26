import { useEffect, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Send } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { guardRedirect } from "@/lib/guard-redirect";
import { CEFR } from "@/lib/rita-path-levels";
import { boardStats, lessonBoard, type BoardTab } from "@/lib/rita-lesson-board";
import { useCurriculumAdminData } from "@/components/rita-lessons/admin/book/useCurriculumAdminData";
import { ErrorBox } from "@/components/rita-lessons/admin/book/BookBits";
import {
  PublishBoard,
  type BoardSearch,
} from "@/components/rita-lessons/admin/publish/PublishBoard";
import {
  PublishLesson,
  PublishLessonEdit,
} from "@/components/rita-lessons/admin/publish/PublishLesson";
import {
  usePublishActions,
  type PublishEntry,
} from "@/components/rita-lessons/admin/publish/usePublishActions";
import "@/components/rita-lessons/admin/lesson-admin.css";
import "@/components/rita-lessons/admin/path-content.css";

type PublishSearch = {
  lesson?: string;
  edit?: boolean;
  tab?: BoardTab;
  level?: string;
  book?: string;
  q?: string;
};

const uuid = (value: unknown) =>
  typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : undefined;

export const Route = createFileRoute("/admin/publish")({
  head: () => ({
    meta: [{ title: "المراجعة والنشر — Uzyra Admin" }, { name: "robots", content: "noindex" }],
  }),
  validateSearch: (search: Record<string, unknown>): PublishSearch => {
    const lesson = uuid(search.lesson);
    const book = uuid(search.book);
    const tab = search.tab === "published" ? "published" : undefined;
    const level =
      typeof search.level === "string" && (CEFR as readonly string[]).includes(search.level)
        ? search.level
        : undefined;
    const q = typeof search.q === "string" && search.q.trim() ? search.q.slice(0, 80) : undefined;
    const edit = Boolean(lesson) && (search.edit === true || search.edit === "true");
    return {
      ...(lesson ? { lesson } : {}),
      ...(edit ? { edit: true } : {}),
      ...(tab ? { tab } : {}),
      ...(level ? { level } : {}),
      ...(book ? { book } : {}),
      ...(q ? { q } : {}),
    };
  },
  component: AdminPublish,
});

/**
 * Review and publish: every made lesson, seen as learners see it and published from here. Its own
 * page, apart from the lesson factory (/admin/curricula) where lessons are made. The lesson open,
 * the tab and the filters are in the address, so back and reload keep the place.
 */
function AdminPublish() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate({ from: "/admin/publish" });
  const search = Route.useSearch();
  const { overview, slides, loadError, refresh } = useCurriculumAdminData(isAdmin);
  const actions = usePublishActions(refresh);

  useEffect(() => {
    if (!loading && !isAdmin) guardRedirect(navigate);
  }, [loading, isAdmin, navigate]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [search.lesson, search.edit]);

  const entries = useMemo<PublishEntry[]>(
    () =>
      overview ? lessonBoard({ books: overview.curricula, lessons: overview.lessons, slides }) : [],
    [overview, slides],
  );
  const stats = useMemo(() => boardStats(entries), [entries]);
  const linked = (entry: PublishEntry) => Boolean(slides[entry.book.id]?.[entry.lesson.id]?.linked);
  const selected = search.lesson
    ? entries.find((entry) => entry.lesson.id === search.lesson)
    : undefined;
  const board: BoardSearch = {
    tab: search.tab ?? "ready",
    level: search.level,
    book: search.book,
    query: search.q,
  };

  function setSearch(next: Partial<BoardSearch>) {
    void navigate({
      replace: true,
      search: (prev) => {
        const merged = {
          ...prev,
          ...("tab" in next ? { tab: next.tab === "published" ? "published" : undefined } : {}),
          ...("level" in next ? { level: next.level } : {}),
          ...("book" in next ? { book: next.book } : {}),
          ...("query" in next ? { q: next.query } : {}),
        } as PublishSearch;
        return Object.fromEntries(
          Object.entries(merged).filter(([, value]) => value !== undefined),
        ) as PublishSearch;
      },
    });
  }
  const openLesson = (lesson: string) =>
    void navigate({ search: (prev) => ({ ...prev, lesson, edit: undefined }) });
  const closeLesson = () =>
    void navigate({ search: (prev) => ({ ...prev, lesson: undefined, edit: undefined }) });

  if (loading || !isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <main dir="rtl" className="la edith-premium">
      <div className="la-dots" aria-hidden="true" />
      <header className="la-top">
        <div className="la-wrap la-top-in">
          <Link to="/admin/publish" search={{}} className="la-brand">
            <span className="la-brand-icon is-green" aria-hidden="true">
              <Send size={16} />
            </span>
            المراجعة والنشر
          </Link>
          <nav className="la-nav" aria-label="صفحات الدروس">
            <Link to="/admin/curricula" className="la-btn is-sm">
              مصنع الدروس
            </Link>
            <Link to="/rita-lessons" className="la-btn is-sm is-quiet">
              مسار الطالب
            </Link>
            <Link to="/admin" className="la-btn is-sm is-quiet">
              الإدارة
            </Link>
          </nav>
        </div>
      </header>

      <div className="la-wrap">
        {loadError && (
          <div className="mt-6 space-y-2">
            <ErrorBox hint={`ما قدرنا نحمّل الدروس: ${loadError}`} />
            <button type="button" onClick={() => void refresh()} className="la-btn is-sm">
              أعد المحاولة
            </button>
          </div>
        )}

        {!overview && !loadError ? (
          <div className="grid place-items-center py-24" role="status" aria-label="تحميل">
            <Loader2 className="animate-spin" />
          </div>
        ) : overview && search.lesson ? (
          selected ? (
            search.edit ? (
              <PublishLessonEdit
                entry={selected}
                linked={linked(selected)}
                resources={overview.resources}
                resourcesReady={overview.resourcesReady}
                onBack={() => void navigate({ search: (prev) => ({ ...prev, edit: undefined }) })}
                onChanged={refresh}
              />
            ) : (
              <PublishLesson
                entry={selected}
                linked={linked(selected)}
                actions={actions}
                onBack={closeLesson}
                onEdit={() => void navigate({ search: (prev) => ({ ...prev, edit: true }) })}
              />
            )
          ) : (
            <div className="la-empty mt-10">
              <h3>ما لقينا هالدرس</h3>
              <p>يمكن انحذف، أو كتابه انأرشف.</p>
              <button type="button" className="la-btn is-ink mt-2" onClick={closeLesson}>
                كل الدروس
              </button>
            </div>
          )
        ) : overview ? (
          <PublishBoard
            entries={entries}
            stats={stats}
            search={board}
            linked={linked}
            actions={actions}
            onSearch={setSearch}
            onOpen={openLesson}
          />
        ) : null}
      </div>
    </main>
  );
}
