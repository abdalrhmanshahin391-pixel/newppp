import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import { KIND_LABEL, joinByCode, previewInvite, refreshSpace, spaceTone } from "@/lib/spaces";

export const Route = createFileRoute("/join/$code")({
  head: () => ({
    meta: [
      { title: "Join a classroom or study group | RitaJet" },
      {
        name: "description",
        content:
          "Open your invite link to join a RitaJet classroom or study group and get its shared flashcard decks.",
      },
      { property: "og:title", content: "You're invited to a RitaJet space" },
      { property: "og:description", content: "Join the classroom or study group and start studying together." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { code } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [joining, setJoining] = useState(false);

  const preview = useQuery({
    enabled: !!user,
    queryKey: ["invite", code],
    queryFn: () => previewInvite(code),
  });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  async function join() {
    // Already a member? Just open it — joining again is pointless.
    if (preview.data?.already && preview.data.id) {
      navigate({ to: "/spaces/$spaceId", params: { spaceId: preview.data.id } });
      return;
    }
    setJoining(true);
    try {
      const id = await joinByCode(code);
      // Refresh the space and "My spaces" BEFORE navigating, so you land
      // inside it and it stays in your list without joining a second time.
      await refreshSpace(qc, id);
      await qc.refetchQueries({ queryKey: ["my-spaces"] });
      toast.success("You're in!");
      navigate({ to: "/spaces/$spaceId", params: { spaceId: id } });
    } catch (e: any) {
      toast.error(e?.message || "Could not join this space.");
    } finally {
      setJoining(false);
    }
  }

  const p = preview.data;

  return (
    <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
      <SiteHeader />
      <main className="mx-auto grid max-w-xl place-items-center px-4 py-20">
        <div className="w-full overflow-hidden rounded-[28px] border border-black/[0.07] bg-white">
          {preview.isLoading ? (
            <p className="p-10 text-center text-[#6b655c]">Checking your invite…</p>
          ) : !p?.valid ? (
            <div className="p-10 text-center">
              <h1 className="font-display text-2xl font-black">This invite doesn't work</h1>
              <p className="mt-2 text-[15px] text-[#6b655c]">
                It may have expired or been replaced. Ask the owner for a fresh link.
              </p>
              <Link
                to="/spaces"
                className="mt-6 inline-flex rounded-full bg-[#23201d] px-6 py-3 text-sm font-black text-white"
              >
                My spaces
              </Link>
            </div>
          ) : (
            <>
              <div className="grid h-32 place-items-center" style={{ background: spaceTone(p.color) }}>
                <span className="text-5xl">{p.emoji || "🎓"}</span>
              </div>
              <div className="p-8 text-center">
                <span className="rounded-full bg-black/[0.06] px-3 py-1 text-[11px] font-black uppercase tracking-[0.15em]">
                  {KIND_LABEL[p.kind ?? "group"]}
                </span>
                <h1 className="mt-4 font-display text-3xl font-black">{p.name}</h1>
                <p className="mt-2 text-[15px] text-[#6b655c]">
                  {p.description || "Shared flashcard decks, members and announcements."}
                </p>
                <p className="mt-2 text-[13px] font-bold text-[#a29a8d]">{p.members} members</p>
                <button
                  onClick={join}
                  disabled={joining}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#8ec63f] px-7 py-3.5 text-[15px] font-black text-white disabled:opacity-50"
                >
                  {joining ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                  {p.already ? "Open it" : "Join now"}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
