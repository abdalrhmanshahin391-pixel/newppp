import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft, Key, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import { guardRedirect } from "@/lib/guard-redirect";
import { AiEnginePanel } from "@/components/admin/AiEnginePanel";

export const Route = createFileRoute("/admin/ai")({
  head: () => ({
    meta: [
      { title: "AI engine — RitaJet admin" },
      {
        name: "description",
        content: "One page to give every RitaJet AI tool its Gemini key, model and live test.",
      },
      { property: "og:title", content: "AI engine — RitaJet admin" },
      {
        property: "og:description",
        content: "Keys, models and live tests for every RitaJet AI tool.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AiEnginePage,
});

function AiEnginePage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
    else if (!loading && user && !isAdmin) guardRedirect(navigate);
  }, [loading, user, isAdmin, navigate]);

  if (loading || !user || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-[#07070b] text-white">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link
          to="/admin"
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-white/60 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to admin
        </Link>

        <header className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500">
            <Sparkles className="h-6 w-6 text-black" />
          </div>
          <div>
            <h1 className="text-2xl font-black">AI engine</h1>
            <p className="text-sm text-white/55">
              Every AI tool on the site and the key it uses right now.
            </p>
          </div>
        </header>

        <AiEnginePanel />

        <Link
          to="/admin/ai-keys"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-3 text-sm font-bold text-white/80 hover:bg-white/5"
        >
          <Key className="h-4 w-4" /> Advanced: shared key pool, models and rate limits
        </Link>
      </main>
    </div>
  );
}
