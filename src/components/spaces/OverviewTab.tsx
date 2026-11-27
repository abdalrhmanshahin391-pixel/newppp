// The first thing inside a classroom or group: the pinned announcement, the decks added last and
// what has happened lately (decks added, posts, people joining), with the invite, the people and a
// short "About" beside them. Everything comes from data the page already loads.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarDays,
  Layers,
  Megaphone,
  Pin,
  Plus,
  Sparkles,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import {
  KIND_LABEL,
  type Space,
  type SpaceAnnouncement,
  type SpaceDeck,
  type SpaceMember,
} from "@/lib/spaces";
import { DeckTile } from "./DeckTile";
import { MemberAvatar, RoleChip } from "./MemberRow";
import { InvitePanel } from "./invite";
import type { SpaceTab } from "./SpaceTabs";
import type { ConfirmFn } from "./shared";
import { fullDate, shortDate, timeAgo } from "./time";

type Happening = {
  id: string;
  at: string;
  who: string | null;
  icon: LucideIcon;
  text: ReactNode;
};

function happenings(
  space: Space,
  members: SpaceMember[],
  decks: SpaceDeck[],
  news: SpaceAnnouncement[],
): Happening[] {
  const kind = KIND_LABEL[space.kind].toLowerCase();
  const list: Happening[] = [
    {
      id: "made",
      at: space.created_at,
      who: space.owner_id,
      icon: Sparkles,
      text: <>made this {kind}</>,
    },
  ];
  for (const member of members) {
    if (member.user_id === space.owner_id) continue;
    list.push({
      id: `joined-${member.user_id}`,
      at: member.joined_at,
      who: member.user_id,
      icon: UserPlus,
      text: "joined",
    });
  }
  for (const row of decks) {
    list.push({
      id: `deck-${row.id}`,
      at: row.created_at,
      who: row.added_by,
      icon: Layers,
      text: (
        <>
          added{" "}
          <Link
            to="/share/$deckId"
            params={{ deckId: row.deck.id }}
            className="sp-feed-link"
            dir="auto"
          >
            {row.deck.title}
          </Link>
        </>
      ),
    });
  }
  for (const item of news) {
    list.push({
      id: `news-${item.id}`,
      at: item.created_at,
      who: item.author_id,
      icon: Megaphone,
      text: "posted an announcement",
    });
  }
  return list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 8);
}

export function OverviewTab({
  space,
  members,
  me,
  decks,
  news,
  loading,
  canManage,
  canAdd,
  onOpen,
  onAddDeck,
  confirm,
}: {
  space: Space;
  members: SpaceMember[];
  me: SpaceMember | undefined;
  decks: SpaceDeck[];
  news: SpaceAnnouncement[];
  loading: boolean;
  canManage: boolean;
  canAdd: boolean;
  onOpen: (tab: SpaceTab) => void;
  onAddDeck: () => void;
  confirm: ConfirmFn;
}) {
  const person = (id: string | null) => (id ? members.find((m) => m.user_id === id) : undefined);
  const pinned = news.find((item) => item.pinned);
  const latest = decks.slice(0, 4);
  const feed = happenings(space, members, decks, news);
  const owners = members.filter((m) => m.role !== "member");
  const people = [...owners, ...members.filter((m) => m.role === "member")].slice(0, 6);

  return (
    <div className="sp-ov">
      <div className="sp-ov-main">
        {pinned && (
          <article className="sp-box sp-pinned">
            <div className="sp-box-head">
              <p className="sp-pinned-label">
                <Pin size={14} aria-hidden="true" />
                Pinned
              </p>
              <button
                type="button"
                className="sp-btn sp-btn-ghost sp-btn-sm"
                onClick={() => onOpen("news")}
              >
                All announcements
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>
            <p className="sp-pinned-body" dir="auto">
              {pinned.body}
            </p>
            <p className="sp-pinned-meta">
              <span dir="auto">@{person(pinned.author_id)?.username ?? "former member"}</span>
              <span aria-hidden="true"> · </span>
              <time dateTime={pinned.created_at} title={fullDate(pinned.created_at)}>
                {timeAgo(pinned.created_at)}
              </time>
            </p>
          </article>
        )}

        <section className="sp-box" aria-labelledby="sp-ov-latest">
          <div className="sp-box-head">
            <h2 id="sp-ov-latest" className="sp-box-title">
              Latest decks
            </h2>
            {decks.length > 0 && (
              <button
                type="button"
                className="sp-btn sp-btn-ghost sp-btn-sm"
                onClick={() => onOpen("decks")}
              >
                All decks
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            )}
          </div>
          {loading ? (
            <div className="sp-decks sp-decks-two" aria-busy="true">
              {[0, 1].map((i) => (
                <div key={i} className="sp-deck sp-deck-skel">
                  <span className="sp-bone sp-bone-mark" />
                  <span className="sp-bone sp-bone-line" />
                </div>
              ))}
            </div>
          ) : latest.length === 0 ? (
            <div className="sp-empty sp-empty-sm">
              <p className="sp-empty-text">
                {canAdd
                  ? "No decks yet. Add one of yours and everyone in here can study it."
                  : "No decks yet. They show up here as soon as they are added."}
              </p>
              {canAdd && (
                <button type="button" className="sp-btn sp-btn-dark" onClick={onAddDeck}>
                  <Plus size={16} aria-hidden="true" />
                  Add a deck
                </button>
              )}
            </div>
          ) : (
            <div className="sp-decks sp-decks-two">
              {latest.map((row) => (
                <DeckTile
                  key={row.id}
                  row={row}
                  spaceId={space.id}
                  addedBy={person(row.added_by)?.username ?? null}
                  rating={false}
                />
              ))}
            </div>
          )}
        </section>

        <section className="sp-box" aria-labelledby="sp-ov-feed">
          <div className="sp-box-head">
            <h2 id="sp-ov-feed" className="sp-box-title">
              Recent activity
            </h2>
          </div>
          <ol className="sp-feed">
            {feed.map((item) => {
              const who = person(item.who);
              const Icon = item.icon;
              return (
                <li key={item.id} className="sp-feed-item">
                  <span className="sp-feed-who">
                    <MemberAvatar
                      path={who?.avatar_url ?? null}
                      name={who?.username ?? "?"}
                      size={34}
                    />
                    <span className="sp-feed-icon" aria-hidden="true">
                      <Icon size={12} />
                    </span>
                  </span>
                  <p className="sp-feed-text">
                    <strong dir="auto">@{who?.username ?? "former member"}</strong> {item.text}
                  </p>
                  <time className="sp-feed-time" dateTime={item.at} title={fullDate(item.at)}>
                    {timeAgo(item.at)}
                  </time>
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      <aside className="sp-ov-side" aria-label="About this space">
        {canManage && (
          <section className="sp-box" aria-labelledby="sp-ov-invite">
            <div className="sp-box-head">
              <h2 id="sp-ov-invite" className="sp-box-title">
                Invite people
              </h2>
            </div>
            <InvitePanel spaceId={space.id} spaceName={space.name} confirm={confirm} />
          </section>
        )}

        <section className="sp-box" aria-labelledby="sp-ov-people">
          <div className="sp-box-head">
            <h2 id="sp-ov-people" className="sp-box-title">
              People
            </h2>
            <button
              type="button"
              className="sp-btn sp-btn-ghost sp-btn-sm"
              onClick={() => onOpen("members")}
            >
              See all {members.length}
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
          <ul className="sp-mini-people">
            {people.map((member) => (
              <li key={member.user_id}>
                <MemberAvatar path={member.avatar_url} name={member.username} size={32} />
                <span className="sp-mini-name" dir="auto">
                  @{member.username}
                  {member.user_id === me?.user_id && <span className="sp-mini-you"> (you)</span>}
                </span>
                {member.role !== "member" && <RoleChip role={member.role} />}
              </li>
            ))}
          </ul>
        </section>

        <section className="sp-box" aria-labelledby="sp-ov-about">
          <div className="sp-box-head">
            <h2 id="sp-ov-about" className="sp-box-title">
              About
            </h2>
          </div>
          <dl className="sp-about">
            <div>
              <dt>Kind</dt>
              <dd>{KIND_LABEL[space.kind]}</dd>
            </div>
            <div>
              <dt>Started</dt>
              <dd>
                <CalendarDays size={14} aria-hidden="true" />
                <time dateTime={space.created_at}>{shortDate(space.created_at)}</time>
              </dd>
            </div>
            <div>
              <dt>Chat</dt>
              <dd>{space.chat_enabled ? "On" : "Off"}</dd>
            </div>
            <div>
              <dt>Who adds decks</dt>
              <dd>{space.who_can_add_decks === "members" ? "Everyone" : "Owners"}</dd>
            </div>
            <div>
              <dt>Who posts news</dt>
              <dd>{space.who_can_post === "members" ? "Everyone" : "Owners"}</dd>
            </div>
          </dl>
        </section>
      </aside>
    </div>
  );
}
