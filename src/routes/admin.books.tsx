import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as Tabs from "@radix-ui/react-tabs";
import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { guardRedirect } from "@/lib/guard-redirect";
import type { Book } from "@/lib/books";
import { ADMIN_LIBRARY_QUERY_KEY, LIBRARY_QUERY_KEY, loadAdminLibrary } from "@/lib/books-data";
import { Notice, type Run } from "@/components/books/admin/admin-ui";
import { BooksTab } from "@/components/books/admin/BooksTab";
import { ClassifyTab } from "@/components/books/admin/ClassifyTab";
import { ArrangeTab } from "@/components/books/admin/ArrangeTab";
import { ImportTab } from "@/components/books/admin/ImportTab";
import { BookEditor } from "@/components/books/admin/BookEditor";

const TABS = ["books", "classify", "arrange", "import"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/admin/books")({
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } =>
    TABS.includes(search.tab as Tab) && search.tab !== "books" ? { tab: search.tab as Tab } : {},
  head: () => ({
    meta: [{ title: "Library — Administration Site" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminBooks,
});

function AdminBooks() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const tab: Tab = search.tab ?? "books";
  const queryClient = useQueryClient();
  const library = useQuery({
    queryKey: ADMIN_LIBRARY_QUERY_KEY,
    queryFn: loadAdminLibrary,
    enabled: isAdmin,
  });
  const [editing, setEditing] = useState<Book | "new" | null>(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!loading && !isAdmin) guardRedirect(navigate);
  }, [loading, isAdmin, navigate]);

  // Both the admin's lists and the reader's library ("library" is the prefix of both keys).
  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY }),
    [queryClient],
  );
  const run: Run = useCallback(
    async (key, task, done) => {
      setBusy(key);
      try {
        await task();
        if (done) toast.success(done);
        return true;
      } catch (cause) {
        toast.error(cause instanceof Error ? cause.message : "ما زبط الحفظ.");
        return false;
      } finally {
        await refresh();
        setBusy("");
      }
    },
    [refresh],
  );

  if (loading || !isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const data = library.data;
  const setTab = (next: string) =>
    void navigate({
      to: "/admin/books",
      search: next === "books" ? {} : { tab: next as Tab },
      replace: true,
    });

  return (
    <main
      dir="rtl"
      className="edith-premium min-h-screen bg-white pb-24 text-[var(--pp-ink)]"
      style={{ fontFamily: "var(--font-grotesk)" }}
    >
      <header className="border-b border-[var(--pp-line)] bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-[var(--pp-accent-text)]">لوحة الإدارة</p>
            <h1 className="text-[26px] font-semibold leading-tight">المكتبة</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/books" className="rita-btn rita-btn-soft">
              شوف المكتبة
            </Link>
            <Link to="/admin" className="rita-btn rita-btn-quiet gap-1">
              الإدارة <ArrowLeft size={15} />
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-5 pt-6">
        {library.isLoading && (
          <div className="grid place-items-center py-16">
            <Loader2 className="animate-spin" />
          </div>
        )}
        {library.isError && (
          <p className="rounded-xl bg-[#fbe9ed] p-4 text-[15px] font-semibold text-[#8c1a31]">
            ما انفتحت بيانات المكتبة: {(library.error as Error).message}
          </p>
        )}
        {data && !data.ready && (
          <Notice>
            جداول المكتبة مش موجودة لسا. طبّق تحديث قاعدة البيانات ‏20261108120000 (‏books_library)
            بـ Lovable Cloud، وبعدين حدّث الصفحة.
          </Notice>
        )}
        {data?.ready && !data.phase1 && (
          <Notice>
            شغّال على النسخة الأولى من المكتبة. الحالات (مسودة / منشور / مؤرشف)، الوسوم، الرفوف
            اليدوية، الاستيراد ومراجعة الحقوق بيشتغلوا بعد ما يتطبّق تحديث قاعدة البيانات
            ‏20261109120000 (‏books_admin_foundation).
          </Notice>
        )}

        {data?.ready && (
          <Tabs.Root value={tab} onValueChange={setTab} className="min-w-0" dir="rtl">
            <Tabs.List aria-label="أقسام المكتبة" className="rita-tabs-list">
              <Tabs.Trigger value="books" className="rita-tab">
                الكتب ({data.books.length})
              </Tabs.Trigger>
              <Tabs.Trigger value="classify" className="rita-tab">
                التصنيف
              </Tabs.Trigger>
              <Tabs.Trigger value="arrange" className="rita-tab">
                ترتيب المكتبة
              </Tabs.Trigger>
              <Tabs.Trigger value="import" className="rita-tab">
                الاستيراد والجودة
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="books" className="rita-tab-panel pt-6">
              <BooksTab
                books={data.books}
                categories={data.categories}
                tags={data.tags}
                featuredId={data.featuredId}
                phase1={data.phase1}
                busy={busy}
                run={run}
                onEdit={setEditing}
                onNew={() => setEditing("new")}
              />
            </Tabs.Content>
            <Tabs.Content value="classify" className="rita-tab-panel pt-6">
              <ClassifyTab
                categories={data.categories}
                tags={data.tags}
                books={data.books}
                phase1={data.phase1}
                busy={busy}
                run={run}
              />
            </Tabs.Content>
            <Tabs.Content value="arrange" className="rita-tab-panel pt-6">
              <ArrangeTab
                books={data.books}
                shelves={data.shelves}
                categories={data.categories}
                editorial={data.editorial}
                phase2={data.phase2}
                featuredId={data.featuredId}
                phase1={data.phase1}
                busy={busy}
                run={run}
              />
            </Tabs.Content>
            <Tabs.Content value="import" className="rita-tab-panel pt-6">
              {data.phase1 ? (
                <ImportTab library={data} busy={busy} run={run} onEdit={setEditing} />
              ) : (
                <Notice tone="info">
                  الاستيراد والجودة بيشتغلوا بعد تحديث قاعدة البيانات ‏20261109120000.
                </Notice>
              )}
            </Tabs.Content>
          </Tabs.Root>
        )}
      </div>

      {editing && data && (
        <BookEditor
          key={editing === "new" ? "new" : editing.id}
          book={editing === "new" ? null : editing}
          categories={data.categories}
          tags={data.tags}
          shelves={data.shelves}
          featuredId={data.featuredId}
          phase1={data.phase1}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await refresh();
            setEditing(null);
          }}
        />
      )}
    </main>
  );
}
