import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { guardRedirect } from "@/lib/guard-redirect";
import { BOOK_STEPS, type BookStep, type ExercisesState } from "@/lib/rita-book-flow";
import { adminCurriculumOverview, adminExercisesSummary } from "@/lib/rita-curriculum.functions";
import { BooksGrid } from "@/components/rita-lessons/admin/book/BooksGrid";
import { BookWorkspace } from "@/components/rita-lessons/admin/book/BookWorkspace";
import { NewBookDialog } from "@/components/rita-lessons/admin/book/NewBookDialog";
import { ErrorBox } from "@/components/rita-lessons/admin/book/BookBits";
import { errorText } from "@/components/rita-lessons/admin/book/book-utils";

type CurriculaSearch = { book?: string; step?: BookStep };

export const Route = createFileRoute("/admin/curricula")({
  head: () => ({
    meta: [{ title: "Rita curriculum — Admin" }, { name: "robots", content: "noindex" }],
  }),
  validateSearch: (search: Record<string, unknown>): CurriculaSearch => {
    const book =
      typeof search.book === "string" && /^[0-9a-f-]{36}$/i.test(search.book) ? search.book : "";
    const step = BOOK_STEPS.find((value) => value === search.step);
    return { ...(book ? { book } : {}), ...(book && step ? { step } : {}) };
  },
  component: AdminCurricula,
});

type Overview = Awaited<ReturnType<typeof adminCurriculumOverview>>;

/**
 * Rita's books for admins: the list of books, or one book on one page (its lessons in one list,
 * one button each). The book is in the address, so back and reload keep the place.
 */
function AdminCurricula() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate({ from: "/admin/curricula" });
  const { book: bookId } = Route.useSearch();
  const overviewFn = useServerFn(adminCurriculumOverview);
  const summaryFn = useServerFn(adminExercisesSummary);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [exercises, setExercises] = useState<Record<string, Record<string, ExercisesState>>>({});
  const [exercisesReady, setExercisesReady] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [newBookOpen, setNewBookOpen] = useState(false);
  const [pdfCache] = useState(() => new Map<string, File>());

  useEffect(() => {
    if (!loading && !isAdmin) guardRedirect(navigate);
  }, [loading, isAdmin, navigate]);

  const refresh = useCallback(async () => {
    setLoadError("");
    try {
      const next = await overviewFn();
      setOverview(next);
      const books = next.curricula.filter((book) => book.status !== "archived");
      const summaries = await Promise.all(
        books.map((book) =>
          summaryFn({ data: { curriculumId: book.id } }).catch(() => ({
            ready: true,
            byLesson: {},
          })),
        ),
      );
      setExercises(
        Object.fromEntries(books.map((book, index) => [book.id, summaries[index].byLesson])),
      );
      setExercisesReady(summaries.every((summary) => summary.ready));
    } catch (error) {
      // A failed load must never leave a silent spinner: show the error and a retry.
      setOverview(null);
      setLoadError(errorText(error));
    }
  }, [overviewFn, summaryFn]);

  useEffect(() => {
    if (isAdmin) void refresh();
  }, [isAdmin, refresh]);

  const open = useCallback(
    (id: string, nextStep: BookStep) => void navigate({ search: { book: id, step: nextStep } }),
    [navigate],
  );

  if (loading || !isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const selected = overview?.curricula.find((book) => book.id === bookId) ?? null;

  return (
    <main
      dir="rtl"
      className="edith-premium uz-glow min-h-screen pb-24 text-[var(--pp-ink)]"
      style={{ fontFamily: "var(--font-grotesk), 'Noto Sans Arabic', sans-serif" }}
    >
      <header className="uz-topbar">
        <div className="mx-auto flex h-[52px] max-w-5xl items-center gap-4 px-5">
          <span className="uz-wordmark" dir="ltr">
            UZYRA
          </span>
          <span className="text-[13.5px] text-white/55">دروس ريتا</span>
          <nav className="ms-auto flex items-center gap-4 text-[13.5px] font-semibold">
            <Link to="/rita-lessons">مسار الطالب</Link>
            <Link to="/admin" className="inline-flex items-center gap-1">
              الإدارة <ArrowLeft size={14} aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-[920px] space-y-4 px-4 pt-8 sm:px-6">
        {loadError && (
          <div className="space-y-2">
            <ErrorBox hint={`ما قدرنا نحمّل الكتب: ${loadError}`} />
            <button
              type="button"
              onClick={() => void refresh()}
              className="rita-btn rita-btn-soft rita-btn-sm"
            >
              أعد المحاولة
            </button>
          </div>
        )}
        {overview?.needsMigration && (
          <p className="rounded-xl bg-[#fff6e5] p-3 text-[14px] text-[#6b4100]">
            بعض الميزات بدها تحديث قاعدة البيانات: طبّق migration ‏20261015120000
            (rita_curriculum_gaps) بـ Lovable Cloud ثم حدّث الصفحة.
          </p>
        )}

        {!overview && !loadError ? (
          <div className="grid place-items-center py-24">
            <Loader2 className="animate-spin text-[var(--pp-accent-text)]" />
          </div>
        ) : overview && selected ? (
          <BookWorkspace
            key={selected.id}
            book={selected}
            windows={overview.windows.filter((window) => window.curriculum_id === selected.id)}
            lessons={overview.lessons.filter((lesson) => lesson.curriculum_id === selected.id)}
            allLessons={overview.lessons}
            missingText={overview.missingText[selected.id] ?? []}
            exercises={exercises[selected.id] ?? {}}
            exercisesReady={exercisesReady}
            slides={overview.slides}
            slidesReady={overview.slidesReady}
            slidesShared={overview.slidesShared}
            sharedReady={overview.sharedReady}
            resources={overview.resources}
            resourcesReady={overview.resourcesReady}
            pdfCache={pdfCache}
            onBack={() => void navigate({ search: {} })}
            onChanged={refresh}
          />
        ) : overview ? (
          <BooksGrid
            books={overview.curricula}
            windows={overview.windows}
            lessons={overview.lessons}
            missingText={overview.missingText}
            exercises={exercises}
            onOpen={open}
            onNew={() => setNewBookOpen(true)}
          />
        ) : null}
      </div>

      <NewBookDialog
        open={newBookOpen}
        onOpenChange={setNewBookOpen}
        pdfCache={pdfCache}
        onCreated={async (id) => {
          await refresh();
          open(id, "read");
        }}
      />
    </main>
  );
}
