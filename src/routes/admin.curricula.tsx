import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCurriculumAdminData } from "@/components/rita-lessons/admin/book/useCurriculumAdminData";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { guardRedirect } from "@/lib/guard-redirect";
import { BOOK_STEPS, type BookStep } from "@/lib/rita-book-steps";
import { BooksGrid } from "@/components/rita-lessons/admin/book/BooksGrid";
import { BookWorkspace } from "@/components/rita-lessons/admin/book/BookWorkspace";
import { NewBookDialog } from "@/components/rita-lessons/admin/book/NewBookDialog";
import { LanguageCheck } from "@/components/rita-lessons/admin/book/LanguageCheck";
import { ErrorBox } from "@/components/rita-lessons/admin/book/BookBits";

type CurriculaSearch = { book?: string; step?: BookStep };

export const Route = createFileRoute("/admin/curricula")({
  head: () => ({
    meta: [{ title: "Uzyra curriculum — Admin" }, { name: "robots", content: "noindex" }],
  }),
  validateSearch: (search: Record<string, unknown>): CurriculaSearch => {
    const book =
      typeof search.book === "string" && /^[0-9a-f-]{36}$/i.test(search.book) ? search.book : "";
    const step = BOOK_STEPS.find((value) => value === search.step);
    return { ...(book ? { book } : {}), ...(book && step ? { step } : {}) };
  },
  component: AdminCurricula,
});

/**
 * Uzyra's books for admins: the list of books (each with its next step), or one book worked through
 * in four steps. The book and step are in the address, so back and reload keep the place.
 */
function AdminCurricula() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate({ from: "/admin/curricula" });
  const { book: bookId, step } = Route.useSearch();
  const { overview, exercises, exercisesReady, loadError, refresh } =
    useCurriculumAdminData(isAdmin);
  const [newBookOpen, setNewBookOpen] = useState(false);
  const [pdfCache] = useState(() => new Map<string, File>());

  useEffect(() => {
    if (!loading && !isAdmin) guardRedirect(navigate);
  }, [loading, isAdmin, navigate]);

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
      className="edith-premium min-h-screen bg-white pb-24 text-[var(--pp-ink)]"
      style={{ fontFamily: "var(--font-grotesk)" }}
    >
      <header className="border-b border-[var(--pp-line)] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
          <p className="text-[15px] font-semibold">مناهج دروس يوزرا</p>
          <div className="flex items-center gap-1">
            <Link to="/rita-lessons" className="rita-btn rita-btn-quiet rita-btn-sm">
              مسار الطالب
            </Link>
            <Link to="/admin" className="rita-btn rita-btn-soft rita-btn-sm gap-1">
              الإدارة <ArrowLeft size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-4 px-5 pt-6">
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
        ) : overview && selected && !loadError ? (
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
            step={step ?? "read"}
            onStep={(next) => void navigate({ search: { book: selected.id, step: next } })}
            onBack={() => void navigate({ search: {} })}
            onChanged={refresh}
          />
        ) : overview ? (
          <>
            <LanguageCheck onChanged={() => void refresh()} />
            <BooksGrid
              books={overview.curricula}
              windows={overview.windows}
              lessons={overview.lessons}
              missingText={overview.missingText}
              exercises={exercises}
              onOpen={open}
              onNew={() => setNewBookOpen(true)}
            />
          </>
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
