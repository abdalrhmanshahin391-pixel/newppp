// The top of a classroom or group: an ink card with the home page's field of marks in white and a
// soft light in the space's own colour. Its mark, kind and your role, the name and the line about it,
// then the people and the numbers. Actions on the right: Invite, Add deck and a "More" menu.
import { useRef, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import * as Menu from "@radix-ui/react-dropdown-menu";
import {
  ArrowLeft,
  GraduationCap,
  Link2,
  LogOut,
  MoreHorizontal,
  Plus,
  Settings,
  UserPlus,
  Users,
} from "lucide-react";
import { useDotField } from "@/components/page-hero/useDotField";
import { KIND_LABEL, type Space, type SpaceMember } from "@/lib/spaces";
import { useInvite } from "./invite";
import { MemberAvatar } from "./MemberRow";
import { plural } from "./SpaceCard";
import { SpaceMark, Spin, hexAlpha, toneOf, useNarrow } from "./shared";

const ROLE_LINE = {
  owner: "You own it",
  co_owner: "You're a co-owner",
  member: "You're a member",
} as const;

export function SpaceHeader({
  space,
  members,
  me,
  counts,
  canManage,
  canAddDecks,
  onAddDeck,
  onSettings,
  onLeave,
}: {
  space: Space;
  members: SpaceMember[];
  me: SpaceMember | undefined;
  counts: { decks: number | null; sets: number | null; news: number | null };
  canManage: boolean;
  canAddDecks: boolean;
  onAddDeck: () => void;
  onSettings: () => void;
  onLeave: () => void;
}) {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  useDotField(section, canvas, "#ffffff");
  const invite = useInvite(space.id, canManage);
  // On phones «Add deck» moves into the More menu so the row fits.
  const narrow = useNarrow();
  const tone = toneOf(space.color);
  const shown = members.slice(0, 5);
  const more = members.length - shown.length;
  const canLeave = !!me && me.role !== "owner";
  const KindIcon = space.kind === "classroom" ? GraduationCap : Users;

  return (
    <section
      ref={section}
      className="sp-hero"
      style={{ "--sp-glow": hexAlpha(tone.from, 0.42) } as CSSProperties}
      aria-labelledby="sp-space-name"
    >
      <canvas ref={canvas} className="sp-hero-field" aria-hidden="true" />
      <div className="sp-hero-in">
        <div className="sp-hero-bar">
          <Link to="/spaces" className="sp-hero-back" aria-label="All spaces">
            <ArrowLeft size={16} aria-hidden="true" />
            <span className="sp-hero-back-label">All spaces</span>
          </Link>
          <div className="sp-hero-actions">
            {canManage && (
              <button
                type="button"
                className="sp-btn sp-btn-white"
                disabled={invite.busy !== null || invite.loading}
                onClick={() => (invite.canShare ? invite.share(space.name) : invite.copy())}
              >
                {invite.busy === "share" || invite.busy === "copy" ? (
                  <Spin />
                ) : (
                  <UserPlus size={16} aria-hidden="true" />
                )}
                Invite
              </button>
            )}
            {canAddDecks && !narrow && (
              <button type="button" className="sp-btn sp-btn-glass" onClick={onAddDeck}>
                <Plus size={16} aria-hidden="true" />
                Add deck
              </button>
            )}
            {(canManage || canLeave) && (
              <Menu.Root modal={false}>
                <Menu.Trigger asChild>
                  <button
                    type="button"
                    className="sp-btn sp-btn-glass sp-btn-icon"
                    aria-label="More"
                  >
                    <MoreHorizontal size={18} aria-hidden="true" />
                  </button>
                </Menu.Trigger>
                <Menu.Portal>
                  <Menu.Content align="end" sideOffset={8} className="sp sp-menu">
                    {canAddDecks && narrow && (
                      <Menu.Item className="sp-menu-item" onSelect={onAddDeck}>
                        <Plus size={16} aria-hidden="true" />
                        Add deck
                      </Menu.Item>
                    )}
                    {canManage && (
                      <Menu.Item
                        className="sp-menu-item"
                        disabled={invite.loading}
                        onSelect={() => void invite.copy()}
                      >
                        <Link2 size={16} aria-hidden="true" />
                        Copy invite link
                      </Menu.Item>
                    )}
                    {canManage && (
                      <Menu.Item className="sp-menu-item" onSelect={onSettings}>
                        <Settings size={16} aria-hidden="true" />
                        Settings
                      </Menu.Item>
                    )}
                    {canLeave && (
                      <>
                        <Menu.Separator className="sp-menu-sep" />
                        <Menu.Item className="sp-menu-item sp-menu-danger" onSelect={onLeave}>
                          <LogOut size={16} aria-hidden="true" />
                          Leave this {KIND_LABEL[space.kind].toLowerCase()}
                        </Menu.Item>
                      </>
                    )}
                  </Menu.Content>
                </Menu.Portal>
              </Menu.Root>
            )}
          </div>
        </div>

        <div className="sp-hero-main">
          <SpaceMark color={space.color} emoji={space.emoji} size={84} className="sp-hero-mark" />
          <div className="sp-hero-copy">
            <p className="sp-hero-kind">
              <KindIcon size={15} aria-hidden="true" />
              {KIND_LABEL[space.kind]}
              {me && (
                <>
                  <span aria-hidden="true">·</span>
                  {ROLE_LINE[me.role]}
                </>
              )}
            </p>
            <h1 id="sp-space-name" className="sp-hero-title" dir="auto">
              {space.name}
            </h1>
            {space.description?.trim() && (
              <p className="sp-hero-desc" dir="auto">
                {space.description}
              </p>
            )}
          </div>
        </div>

        <div className="sp-hero-foot">
          <div className="sp-hero-people">
            <span className="sp-stack">
              {shown.map((m) => (
                <MemberAvatar key={m.user_id} path={m.avatar_url} name={m.username} size={34} />
              ))}
              {more > 0 && <span className="sp-stack-more">+{more}</span>}
            </span>
            <span>{plural(members.length, "member")}</span>
          </div>
          <dl className="sp-hero-stats">
            <div>
              <dt>Decks</dt>
              <dd>{counts.decks ?? "–"}</dd>
            </div>
            <div>
              <dt>Question sets</dt>
              <dd>{counts.sets ?? "–"}</dd>
            </div>
            <div>
              <dt>Announcements</dt>
              <dd>{counts.news ?? "–"}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

export function SpaceHeaderSkeleton() {
  return (
    <section className="sp-hero sp-hero-skel" aria-busy="true" aria-label="Loading">
      <div className="sp-hero-in">
        <span className="sp-bone sp-bone-dark sp-bone-chip" />
        <div className="sp-hero-main">
          <span className="sp-bone sp-bone-dark sp-bone-mark-lg" />
          <div className="sp-hero-copy">
            <span className="sp-bone sp-bone-dark sp-bone-line sp-bone-short" />
            <span className="sp-bone sp-bone-dark sp-bone-heading" />
          </div>
        </div>
      </div>
    </section>
  );
}
