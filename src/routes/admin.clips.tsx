import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { guardRedirect } from "@/lib/guard-redirect";
import { ClipsLibrary } from "@/components/rita-lessons/clips/ClipsLibrary";

export const Route = createFileRoute("/admin/clips")({
  head: () => ({
    meta: [{ title: "Uzyra clips — Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminClips,
});

/** The clips library: video and GIF clips with their sentence, and the clips stops of the path. */
function AdminClips() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate({ from: "/admin/clips" });

  useEffect(() => {
    if (!loading && !isAdmin) guardRedirect(navigate);
  }, [loading, isAdmin, navigate]);

  if (loading || !isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <main
      dir="rtl"
      className="edith-premium min-h-screen bg-white pb-24 text-[var(--pp-ink)]"
      style={{ fontFamily: "var(--font-grotesk)" }}
    >
      <header className="border-b border-[var(--pp-line)] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
          <p className="text-[15px] font-semibold">مكتبة مقاطع يوزرا</p>
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
      <div className="mx-auto max-w-5xl px-5 pt-8">
        <ClipsLibrary />
      </div>
    </main>
  );
}
