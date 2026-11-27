import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState, type CSSProperties } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, LogIn, Unlink, Users } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { useDotField } from "@/components/page-hero/useDotField";
import { SignInRedirect } from "@/components/study/RequireSignIn";
import { plural } from "@/components/spaces/SpaceCard";
import { SpaceMark, Spin, errorText, hexAlpha, toneOf } from "@/components/spaces/shared";
import "@/components/spaces/spaces.css";
import { useAuth } from "@/hooks/useAuth";
import { KIND_LABEL, joinByCode, previewInvite, refreshSpace } from "@/lib/spaces";

export const Route = createFileRoute("/join/$code")({
  head: () => ({
    meta: [
      { title: "Join a classroom or study group | Uzyra" },
      {
        name: "description",
        content:
          "Open your invite link to join a Uzyra classroom or study group and get its shared flashcard decks.",
      },
      { property: "og:title", content: "You're invited to a Uzyra space" },
      {
        property: "og:description",
        content: "Join the classroom or study group and start studying together.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JoinPage,
});

type Invite = Awaited<ReturnType<typeof previewInvite>>;

function JoinPage() {
  const { code } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [joining, setJoining] = useState(false);

  const preview = useQuery({
    enabled: !!user,
    queryKey: ["invite", code],
    queryFn: () => previewInvite(code),
  });
  const invite = preview.data;

  async function join() {
    // Already in? Just open it: joining again is pointless.
    if (invite?.already && invite.id) {
      void navigate({ to: "/spaces/$spaceId", params: { spaceId: invite.id } });
      return;
    }
    setJoining(true);
    try {
      const id = await joinByCode(code);
      // Refresh the space and "Your spaces" before going in, so you land inside it and it is in
      // your list without joining a second time.
      await refreshSpace(qc, id);
      await qc.refetchQueries({ queryKey: ["my-spaces"] });
      toast.success("You're in!");
      void navigate({ to: "/spaces/$spaceId", params: { spaceId: id } });
    } catch (error) {
      toast.error(errorText(error, "Could not join this space."));
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="sp sp-page">
      <SiteHeader />
      <SignInRedirect />
      <main className="sp-wrap sp-joinpage">
        {!user || preview.isLoading ? (
          <section
            className="sp-invitecard sp-hero-skel"
            aria-busy="true"
            aria-label="Checking your invite"
          >
            <span className="sp-bone sp-bone-dark sp-bone-mark-lg sp-center" />
            <span className="sp-bone sp-bone-dark sp-bone-heading sp-center" />
            <span className="sp-bone sp-bone-dark sp-bone-line sp-bone-short sp-center" />
          </section>
        ) : preview.isError || !invite?.valid ? (
          <div className="sp-missing">
            <span className="sp-empty-icon" aria-hidden="true">
              <Unlink size={22} />
            </span>
            <h1 className="sp-h3">
              {preview.isError ? "The invite could not be checked" : "This invite doesn't work"}
            </h1>
            <p className="sp-muted">
              {preview.isError
                ? "Check your connection, then try again."
                : "It may have expired or been replaced. Ask the owner for a fresh link."}
            </p>
            <div className="sp-empty-actions">
              {preview.isError && (
                <button
                  type="button"
                  className="sp-btn sp-btn-dark"
                  onClick={() => void preview.refetch()}
                >
                  Try again
                </button>
              )}
              <Link
                to="/spaces"
                className={`sp-btn ${preview.isError ? "sp-btn-light" : "sp-btn-dark"}`}
              >
                All spaces
              </Link>
            </div>
          </div>
        ) : (
          <>
            <InviteCard invite={invite} joining={joining} onJoin={() => void join()} />
            <p className="sp-joinpage-note">
              Inside you'll find its decks, question sets, members and news. You can leave at any
              time.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function InviteCard({
  invite,
  joining,
  onJoin,
}: {
  invite: Invite;
  joining: boolean;
  onJoin: () => void;
}) {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  useDotField(section, canvas, "#ffffff");
  const tone = toneOf(invite.color);
  const kind = KIND_LABEL[invite.kind ?? "group"].toLowerCase();
  const KindIcon = invite.kind === "classroom" ? GraduationCap : Users;

  return (
    <section
      ref={section}
      className="sp-invitecard"
      style={{ "--sp-glow": hexAlpha(tone.from, 0.45) } as CSSProperties}
      aria-labelledby="sp-invite-name"
    >
      <canvas ref={canvas} className="sp-hero-field" aria-hidden="true" />
      <SpaceMark color={invite.color} emoji={invite.emoji} size={88} />
      <p className="sp-invitecard-kind">
        <KindIcon size={15} aria-hidden="true" />
        {invite.already ? `You're already in this ${kind}` : `You're invited to a ${kind}`}
      </p>
      <h1 id="sp-invite-name" className="sp-invitecard-title" dir="auto">
        {invite.name}
      </h1>
      <p className="sp-invitecard-desc" dir="auto">
        {invite.description?.trim() || "Shared flashcard decks, question sets, members and news."}
      </p>
      <p className="sp-invitecard-meta">
        <Users size={15} aria-hidden="true" />
        {plural(invite.members ?? 0, "member")}
      </p>
      <div>
        <button
          type="button"
          className="sp-btn sp-btn-white sp-invitecard-go"
          onClick={onJoin}
          disabled={joining}
        >
          {joining ? <Spin /> : <LogIn size={17} aria-hidden="true" />}
          {invite.already ? `Open ${kind}` : `Join ${kind}`}
        </button>
      </div>
    </section>
  );
}
