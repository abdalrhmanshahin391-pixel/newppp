import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Eye, EyeOff, FileText, Plus, Share2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/legacy-client";
import { useAuth } from "@/hooks/useAuth";
import { deleteSummary, toggleSummaryPublic } from "@/lib/summaries.functions";
import { SiteHeader } from "@/components/SiteHeader";
import { toast } from "sonner";

export const Route = createFileRoute("/study/pdf")({
  head: () => ({
    meta: [
      { title: "PDF Summaries — RitaJet" },
      {
        name: "description",
        content:
          "Turn any lecture PDF, photo or note into a clean, printable Rita summary sheet.",
      },
      { property: "og:title", content: "PDF Summaries — RitaJet" },
      {
        property: "og:description",
        content: "Turn any lecture PDF, photo or note into a clean printable summary sheet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PdfSummaries,
});

type Row = {
  id: string;
  title: string;
  subtitle: string | null;
  source_type: string;
  is_public: boolean;
  share_slug: string | null;
  created_at: string;
  author_name: string | null;
  is_example?: boolean;
};

const TONES = [
  { soft: "#fbe3c8", dot: "#f0a95c", ink: "#7a4b16" },
  { soft: "#d6e8f6", dot: "#6aa9d8", ink: "#1f4c6d" },
  { soft: "#e4dcf3", dot: "#9b83d1", ink: "#4a3877" },
  { soft: "#d8ecdd", dot: "#6ab887", ink: "#215237" },
  { soft: "#f7d9de", dot: "#dd8496", ink: "#75283a" },
];

const COLS = "id,title,subtitle,source_type,is_public,share_slug,created_at,author_name,is_example";

/** The student's own sheets, with the shared example pinned in front. */
async function fetchMine(userId: string): Promise<Row[]> {
  const [mine, examples] = await Promise.all([
    (supabase.from as any)("summaries")
      .select(COLS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    (supabase.from as any)("summaries").select(COLS).eq("is_example", true),
  ]);
  if (mine.error) throw mine.error;
  const own = (mine.data ?? []) as Row[];
  const ownIds = new Set(own.map((r) => r.id));
  const shared = ((examples.data ?? []) as Row[]).filter((r) => !ownIds.has(r.id));
  return [...shared, ...own];
}

function PdfSummaries() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: rows = [] } = useQuery({
    queryKey: ["my-summaries", user?.id],
    queryFn: () => fetchMine(user!.id),
    enabled: !!user?.id,
  });

  const delFn = useServerFn(deleteSummary);
  const togFn = useServerFn(toggleSummaryPublic);

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-summaries"] });
      toast.success("Summary deleted.");
    },
  });

  const tog = useMutation({
    mutationFn: ({ id, isPublic }: { id: string; isPublic: boolean }) =>
      togFn({ data: { id, isPublic } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-summaries"] }),
  });

  return (
    <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 py-12 md:px-8 md:py-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/70 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-[#4a3877]">
              <FileText size={13} /> One-page summaries
            </span>
            <h1
              className="mt-6 font-display font-black leading-[1.08] tracking-tight"
              style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)" }}
            >
              Turn a long lecture into one page you actually read
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-[#4a453d]">
              Upload a PDF, snap photos of your book or paste your notes — RitaJet writes a clean,
              printable summary sheet in your own course wording.
            </p>
          </div>

          <Link
            to="/summaries/new"
            className="rita-pill inline-flex h-14 items-center justify-center gap-2 rounded-full px-8 text-[17px] font-semibold"
          >
            <Plus size={18} /> Create a summary
          </Link>
        </div>

        {loading ? (
          <div className="mt-12 h-40 animate-pulse rounded-3xl border border-black/[0.07] bg-white" />
        ) : !user ? (
          <div className="mt-12 rounded-3xl border border-black/[0.07] bg-white p-12 text-center">
            <p className="font-display text-2xl font-black">Sign in to make summaries</p>
            <p className="mt-2 text-[#4a453d]">
              Your sheets are saved privately to your own account.
            </p>
            <Link
              to="/login"
              className="rita-pill mt-6 inline-flex h-12 items-center rounded-full px-7 text-sm font-semibold"
            >
              Sign in
            </Link>
          </div>
        ) : (
          <section className="mt-14">
            <div className="flex items-end justify-between">
              <h2 className="font-display text-2xl font-black tracking-tight">Your summaries</h2>
              <span className="text-sm font-bold text-[#6d675e]">
                {rows.filter((r) => !r.is_example).length} total
              </span>
            </div>

            {rows.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-dashed border-black/[0.12] bg-white p-14 text-center">
                <div
                  className="mx-auto grid h-16 w-16 place-items-center rounded-2xl"
                  style={{ background: "#e4dcf3", color: "#9b83d1" }}
                >
                  <FileText size={26} />
                </div>
                <p className="mt-5 font-display text-xl font-black">No summaries yet</p>
                <p className="mt-1 text-[#4a453d]">
                  Your first sheet takes about twenty seconds to build.
                </p>
                <button
                  type="button"
                  onClick={() => navigate({ to: "/summaries/new" })}
                  className="rita-pill mt-6 inline-flex h-12 items-center gap-2 rounded-full px-7 text-sm font-semibold"
                >
                  <Plus size={16} /> Create a summary
                </button>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((r, i) => {
                  const tone = TONES[i % TONES.length]!;
                  return (
                    <article
                      key={r.id}
                      className="group flex flex-col overflow-hidden rounded-3xl border border-black/[0.07] bg-white transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_-18px_rgba(0,0,0,0.18)]"
                    >
                      <Link
                        to="/summaries/$summaryId"
                        params={{ summaryId: r.id }}
                        className="block flex-1 p-7"
                        style={{ background: tone.soft }}
                      >
                        <span
                          className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]"
                          style={{ color: tone.ink }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: tone.dot }}
                          />
                          {r.is_example ? "Example · free to read" : "Summary sheet"}
                        </span>
                        <h3
                          className="mt-5 line-clamp-3 font-display text-2xl font-black leading-tight tracking-tight"
                          style={{ color: tone.ink }}
                        >
                          {r.title}
                        </h3>
                        {r.subtitle && (
                          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#4a453d]">
                            {r.subtitle}
                          </p>
                        )}
                        <p className="mt-6 text-[11px] font-bold uppercase tracking-widest text-[#6d675e]">
                          {new Date(r.created_at).toLocaleDateString()}
                          {r.author_name ? ` · ${r.author_name}` : ""}
                        </p>
                      </Link>

                      {r.is_example ? (
                        <div className="flex items-center gap-2 border-t border-black/[0.06] p-3 text-xs font-bold text-[#6d675e]">
                          <BookOpen size={14} /> Example sheet — read it, it stays here
                        </div>
                      ) : (
                      <div className="flex items-center justify-between gap-2 border-t border-black/[0.06] p-3">
                        <button
                          type="button"
                          onClick={() => tog.mutate({ id: r.id, isPublic: !r.is_public })}
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-bold text-[#4a453d] hover:bg-black/[0.04]"
                        >
                          {r.is_public ? <Eye size={14} /> : <EyeOff size={14} />}
                          {r.is_public ? "Public" : "Private"}
                        </button>
                        <div className="flex items-center gap-1">
                          {r.is_public && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  `${window.location.origin}/summaries/${r.id}`,
                                );
                                toast.success("Link copied.");
                              }}
                              className="grid h-9 w-9 place-items-center rounded-full text-[#4a453d] hover:bg-black/[0.05]"
                              title="Copy share link"
                              aria-label="Copy share link"
                            >
                              <Share2 size={15} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm("Delete this summary?")) del.mutate(r.id);
                            }}
                            className="grid h-9 w-9 place-items-center rounded-full text-[#b4485f] hover:bg-[#f7d9de]"
                            title="Delete"
                            aria-label="Delete summary"
                          >
                            <Trash2 size={15} />
                          </button>
                         </div>
                      </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
