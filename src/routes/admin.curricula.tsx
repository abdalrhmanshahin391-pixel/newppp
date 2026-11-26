import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCurriculumAdminData } from "@/components/rita-lessons/admin/book/useCurriculumAdminData";
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ProHeader } from "@/components/home/procreate/ProHeader";
import { useAuth } from "@/hooks/useAuth";
import { guardRedirect } from "@/lib/guard-redirect";
import { BOOK_STEPS, type BookStep } from "@/lib/rita-book-steps";
import { FactoryShelf } from "@/components/rita-lessons/admin/factory/FactoryShelf";
import { FactoryBook } from "@/components/rita-lessons/admin/factory/FactoryBook";
import { NewBookDialog } from "@/components/rita-lessons/admin/book/NewBookDialog";
import { LanguageCheck } from "@/components/rita-lessons/admin/book/LanguageCheck";
import { ErrorBox } from "@/components/rita-lessons/admin/book/BookBits";
import "@/components/rita-lessons/admin/lesson-admin.css";

// `step` is still read so older links keep working; the book page shows everything on one page.
type CurriculaSearch = { book?: string; step?: BookStep };

export const Route = createFileRoute("/admin/curricula")({
  head: () => ({
    meta: [{ title: "مصنع الدروس — Uzyra Admin" }, { name: "robots", content: "noindex" }],
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
 * The lesson factory: the shelf of books, or one book whose pages become lessons. Reviewing and
 * publishing the made lessons is its own page, /admin/publish. The book is in the address, so back
 * and reload keep the place.
 */
function AdminCurricula() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate({ from: "/admin/curricula" });
  const { book: bookId } = Route.useSearch();
  const { overview, slides, loadError, refresh } = useCurriculumAdminData(isAdmin);
  const [newBookOpen, setNewBookOpen] = useState(false);
  const [pdfCache] = useState(() => new Map<string, File>());

  useEffect(() => {
    if (!loading && !isAdmin) guardRedirect(navigate);
  }, [loading, isAdmin, navigate]);

  const open = useCallback((id: string) => void navigate({ search: { book: id } }), [navigate]);

  if (loading || !isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const selected = overview?.curricula.find((book) => book.id === bookId) ?? null;

  return (
    <main className="la edith-premium">
      <div className="rita-cream edith-light edith-premium">
        <ProHeader variant="solid" tone="light" />
      </div>

      <div dir="rtl" className="la-wrap">
        {loadError && (
          <div className="mt-6 space-y-2">
            <ErrorBox hint={`ما قدرنا نحمّل الكتب: ${loadError}`} />
            <button type="button" onClick={() => void refresh()} className="la-btn is-sm">
              أعد المحاولة
            </button>
          </div>
        )}
        {overview?.needsMigration && (
          <p className="la-note is-look mt-6">
            بعض الميزات بدها تحديث قاعدة البيانات: طبّق migration ‏20261015120000
            (rita_curriculum_gaps) ثم حدّث الصفحة.
          </p>
        )}

        {!overview && !loadError ? (
          <div className="grid place-items-center py-24" role="status" aria-label="تحميل">
            <Loader2 className="animate-spin" />
          </div>
        ) : overview && selected && !loadError ? (
          <FactoryBook
            key={selected.id}
            book={selected}
            windows={overview.windows.filter((window) => window.curriculum_id === selected.id)}
            lessons={overview.lessons.filter((lesson) => lesson.curriculum_id === selected.id)}
            missingText={overview.missingText[selected.id] ?? []}
            pdfCache={pdfCache}
            onBack={() => void navigate({ search: {} })}
            onChanged={refresh}
          />
        ) : overview ? (
          <>
            <FactoryShelf
              books={overview.curricula}
              windows={overview.windows}
              lessons={overview.lessons}
              slides={slides}
              onOpen={open}
              onNew={() => setNewBookOpen(true)}
            />
            <div className="mt-6">
              <LanguageCheck onChanged={() => void refresh()} />
            </div>
          </>
        ) : null}
      </div>

      <NewBookDialog
        open={newBookOpen}
        onOpenChange={setNewBookOpen}
        pdfCache={pdfCache}
        onCreated={async (id) => {
          await refresh();
          open(id);
        }}
      />
    </main>
  );
}
