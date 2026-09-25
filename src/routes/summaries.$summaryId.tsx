import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/legacy-client";
import { SiteHeader } from "@/components/SiteHeader";
import { SummaryView } from "@/components/summary/SummaryView";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import type { SummaryContent } from "@/lib/summaries.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/summaries/$summaryId")({
  head: () => ({
    meta: [
      { title: "Summary sheet — RitaJet" },
      {
        name: "description",
        content: "A printable one-page Rita summary built from your own study material.",
      },
      { property: "og:title", content: "Summary sheet — RitaJet" },
      {
        property: "og:description",
        content: "A printable one-page Rita summary built from your own study material.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SummaryViewer,
});

type Row = {
  id: string;
  title: string;
  subtitle: string | null;
  author_name: string | null;
  content: SummaryContent;
  created_at: string;
  is_public: boolean;
  share_slug: string | null;
};

function SummaryViewer() {
  const { summaryId } = Route.useParams();
  const settings = useSiteSettings();
  const { data, isLoading, error } = useQuery({
    queryKey: ["summary", summaryId],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("summaries")
        .select("id,title,subtitle,author_name,content,created_at,is_public,share_slug")
        .eq("id", summaryId)
        .maybeSingle();
      if (error) throw error;
      return data as Row | null;
    },
  });

  return (
    <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
      <SiteHeader />

      {/* Toolbar */}
      <div className="sticky top-0 z-30 border-b border-black/[0.07] bg-[#fbf5e9]/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[920px] items-center justify-between px-4 py-3">
          <Link
            to="/study/pdf"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-[#4a453d] hover:text-[#23201d]"
          >
            <ArrowLeft size={14} /> All summaries
          </Link>
          <div className="flex items-center gap-2">
            {data?.is_public && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success("Link copied.");
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-4 py-2 text-xs font-bold text-[#4a453d] hover:bg-white/70"
              >
                <Share2 size={13} /> Share
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="rita-pill inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-semibold"
            >
              <Printer size={13} /> Save as PDF
            </button>
          </div>
        </div>
      </div>

      {isLoading && <div className="py-32 text-center text-[#6d675e]">Loading…</div>}
      {error && <div className="py-32 text-center text-[#b4485f]">Error loading summary.</div>}
      {!isLoading && !data && (
        <div className="py-32 text-center text-[#6d675e]">
          Summary not found or you don't have access.
        </div>
      )}

      {data && (
        <SummaryView
          content={data.content}
          siteName="Rita"
          tagline={settings.tagline}
          authorName={data.author_name ?? undefined}
          createdAt={data.created_at}
        />
      )}
    </div>
  );
}
