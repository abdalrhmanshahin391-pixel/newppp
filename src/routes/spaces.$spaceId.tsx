import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Copy,
  FolderPlus,
  Layers,
  Link2,
  ListChecks,
  MessageCircle,
  Pin,
  Plus,
  Send,
  Settings,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { MemberAvatar, MemberRow } from "@/components/spaces/MemberRow";
import { useAuth } from "@/hooks/useAuth";
import { fetchMyDecks } from "@/lib/share-decks";
import {
  fetchSpaceQuestionSets,
  removeQuestionSetFromSpace,
  SOURCE_TYPE_META,
  coverOf,
} from "@/lib/share-questions";
import { DeckRating } from "@/components/share/DeckRating";
import {
  KIND_LABEL,
  ALREADY_IN_SPACE,
  addDeckToSpace,
  addFolder,
  deleteAnnouncement,
  deleteFolder,
  deleteSpace,
  inviteLink,
  leaveSpace,
  moveDeck,
  postAnnouncement,
  removeDeckFromSpace,
  removeMember,
  rotateInvite,
  sendMessage,
  setAnnouncementPinned,
  setMemberRole,
  spaceTone,
  updateSpace,
  useSpace,
  useSpaceAnnouncements,
  useSpaceDecks,
  useSpaceFolders,
  useSpaceInvite,
  useSpaceMembers,
  useSpaceMessages,
} from "@/lib/spaces";

export const Route = createFileRoute("/spaces/$spaceId")({
  head: () => ({
    meta: [
      { title: "Space — shared decks & members | RitaJet" },
      {
        name: "description",
        content:
          "Your classroom or study group: shared flashcard decks in folders, the member list, announcements and optional chat.",
      },
      { property: "og:title", content: "A RitaJet study space" },
      { property: "og:description", content: "Shared decks, members, announcements and chat in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SpacePage,
});

type Tab = "decks" | "questions" | "members" | "news" | "chat" | "settings";

function SpacePage() {
  const { spaceId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("decks");

  const space = useSpace(spaceId);
  const members = useSpaceMembers(spaceId);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const me = (members.data ?? []).find((m) => m.user_id === user?.id);
  const canManage = me?.role === "owner" || me?.role === "co_owner";
  const isOwner = me?.role === "owner";
  const s = space.data;

  const canAddDecks = !!me && (s?.who_can_add_decks === "members" || canManage);
  const canPost = !!me && (s?.who_can_post === "members" || canManage);

  // `refetchType: "all"` so a list that is mounted but momentarily inactive
  // (tab switch, background window) still reloads instead of showing the copy
  // it had before the change.
  const refresh = (key: string) =>
    qc.invalidateQueries({ queryKey: [key, spaceId], refetchType: "all" });

  if (space.isLoading) {
    return (
      <div className="min-h-screen" style={{ background: "#fbf5e9" }}>
        <SiteHeader />
        <p className="mx-auto max-w-7xl px-4 py-20 text-[#6b655c]">Loading…</p>
      </div>
    );
  }

  if (!s) {
    return (
      <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-4 py-24 text-center">
          <h1 className="font-display text-3xl font-black">You can't see this space</h1>
          <p className="mt-2 text-[#6b655c]">Ask its owner for an invite link.</p>
          <Link to="/spaces" className="mt-6 inline-flex rounded-full bg-[#23201d] px-6 py-3 text-sm font-black text-white">
            My spaces
          </Link>
        </main>
      </div>
    );
  }

  const tabs: [Tab, string, React.ReactNode][] = [
    ["decks", "🃏 Flashcard Decks", <Layers key="d" size={14} />],
    ["questions", "❓ Question Sets", <ListChecks key="q" size={14} />],
    ["members", `Members (${members.data?.length ?? 0})`, <Users key="m" size={14} />],
    ["news", "Announcements", <Bell key="n" size={14} />],
    ...(s.chat_enabled ? ([["chat", "Chat", <MessageCircle key="c" size={14} />]] as [Tab, string, React.ReactNode][]) : []),
    ...(canManage ? ([["settings", "Settings", <Settings key="s" size={14} />]] as [Tab, string, React.ReactNode][]) : []),
  ];

  return (
    <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
        <div className="overflow-hidden rounded-[28px] border border-black/[0.07] bg-white">
          <div className="flex items-center gap-4 px-6 py-6" style={{ background: spaceTone(s.color) }}>
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/70 text-3xl">
              {s.emoji || "🎓"}
            </span>
            <div className="min-w-0">
              <span className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-black uppercase tracking-[0.15em] text-[#4a453d]">
                {KIND_LABEL[s.kind]}
              </span>
              <h1 className="mt-2 truncate font-display text-3xl font-black">{s.name}</h1>
            </div>
            <div className="ml-auto flex -space-x-2">
              {(members.data ?? []).slice(0, 5).map((m) => (
                <MemberAvatar key={m.user_id} path={m.avatar_url} name={m.username} size={34} />
              ))}
            </div>
          </div>
          {s.description && <p className="px-6 py-4 text-[15px] text-[#4a453d]">{s.description}</p>}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {tabs.map(([id, label, icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-black transition ${
                tab === id ? "bg-[#23201d] text-white" : "bg-white text-[#6b655c] hover:bg-black/[0.05]"
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "decks" && (
            <DecksTab
              spaceId={spaceId}
              canAdd={canAddDecks}
              canManage={canManage}
              onChanged={() =>
                Promise.all([refresh("space-decks"), refresh("space-folders")]).then(() => {})
              }
            />
          )}
          {tab === "questions" && (
            <SpaceQuestionsTab
              spaceId={spaceId}
              canAdd={canAddDecks}
              canManage={canManage}
              onChanged={() => refresh("space-question-sets")}
            />
          )}
          {tab === "members" && (
            <MembersTab
              spaceId={spaceId}
              emoji={s.emoji || "🎓"}
              tone={spaceTone(s.color)}
              canManage={canManage}
              meId={user?.id ?? ""}
              onChanged={() => refresh("space-members")}
            />
          )}
          {tab === "news" && (
            <NewsTab
              spaceId={spaceId}
              canPost={canPost}
              canManage={canManage}
              onChanged={() => refresh("space-announcements")}
            />
          )}
          {tab === "chat" && s.chat_enabled && (
            <ChatTab spaceId={spaceId} onSent={() => refresh("space-messages")} />
          )}
          {tab === "settings" && canManage && (
            <SettingsTab
              spaceId={spaceId}
              space={s}
              isOwner={!!isOwner}
              meId={user?.id ?? ""}
              onChanged={() => {
                qc.invalidateQueries({ queryKey: ["space", spaceId] });
                qc.invalidateQueries({ queryKey: ["my-spaces"] });
              }}
              onGone={() => navigate({ to: "/spaces" })}
            />
          )}
        </div>
      </main>
    </div>
  );
}

/* -------------------------------------------------------------- questions */

/** Question sets shared inside this classroom or study group. */
function SpaceQuestionsTab({
  spaceId,
  canAdd,
  canManage,
  onChanged,
}: {
  spaceId: string;
  canAdd: boolean;
  canManage: boolean;
  onChanged: () => void;
}) {
  const query = useQuery({
    queryKey: ["space-question-sets", spaceId],
    queryFn: () => fetchSpaceQuestionSets(spaceId),
  });

  const sets = query.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-black text-[#23201d]">Question sets</h2>
          <p className="text-sm text-[#6b655c]">
            Questions shared by members for practice and exam preparation.
          </p>
        </div>
        {canAdd && (
          <Link
            to="/share/questions/new"
            search={{ space: spaceId, source: "lecture" }}
            className="inline-flex items-center gap-2 rounded-full bg-[#8ec63f] px-5 py-2.5 text-[14px] font-black text-white shadow-sm transition hover:brightness-105"
          >
            <Plus size={15} /> Share questions here
          </Link>
        )}
      </div>

      {query.isLoading ? (
        <p className="mt-6 text-[#6b655c]">Loading question sets…</p>
      ) : sets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/15 bg-white/60 p-10 text-center">
          <span className="text-3xl">❓</span>
          <p className="mt-3 font-display text-lg font-black text-[#23201d]">No question sets yet</p>
          <p className="mt-1 text-sm text-[#6b655c]">
            Share questions from Question Bank, Exam Archive, or Lecture Lab with everyone here.
          </p>
          {canAdd && (
            <Link
              to="/share/questions/new"
              search={{ space: spaceId, source: "lecture" }}
              className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#23201d] px-5 py-2.5 text-xs font-black text-white"
            >
              <Plus size={14} /> Add questions
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((q) => {
            const c = coverOf(q.cover);
            const sourceMeta = SOURCE_TYPE_META[q.source_type || "lecture"];
            return (
              <div
                key={q.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-sm transition hover:-translate-y-0.5"
              >
                <div
                  className="relative flex h-24 items-center justify-center p-3"
                  style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
                >
                  <span className="text-3xl drop-shadow-sm">{q.emoji || "❓"}</span>
                  <span
                    className="absolute left-2.5 top-2.5 rounded-full border border-sky-200 bg-white/95 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-sky-800 shadow-sm"
                  >
                    ❓ {sourceMeta.label}
                  </span>
                  <span className="absolute right-2.5 top-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[10.5px] font-black text-[#23201d]">
                    {q.question_count} Qs
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <Link
                    to="/share/questions/$setId"
                    params={{ setId: q.id }}
                    className="font-display text-[16px] font-black text-[#23201d] hover:underline"
                  >
                    {q.title}
                  </Link>
                  {q.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-[#6b655c]">
                      {q.description}
                    </p>
                  )}

                  <div className="mt-4 flex items-center justify-between border-t border-black/[0.05] pt-3">
                    <div className="flex items-center gap-2">
                      <Link
                        to="/share/questions/$setId"
                        params={{ setId: q.id }}
                        className="inline-flex items-center gap-1 text-xs font-black text-[#8ec63f] hover:underline"
                      >
                        Study questions →
                      </Link>
                      {(q.rating_count ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-black text-amber-700">
                          <Star size={11} className="fill-amber-500 text-amber-500" />
                          {Number(q.rating_avg).toFixed(1)}
                        </span>
                      )}
                    </div>

                    {canManage && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm(`Remove "${q.title}" from this space?`)) return;
                          try {
                            await removeQuestionSetFromSpace(spaceId, q.id);
                            toast.success("Question set removed from space");
                            onChanged();
                          } catch (e: any) {
                            toast.error(e?.message || "Could not remove question set");
                          }
                        }}
                        className="grid h-7 w-7 place-items-center rounded-lg text-[#a29a8d] hover:bg-red-50 hover:text-red-600"
                        title="Remove from space"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ decks */

function DecksTab({
  spaceId,
  canAdd,
  canManage,
  onChanged,
}: {
  spaceId: string;
  canAdd: boolean;
  canManage: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const folders = useSpaceFolders(spaceId);
  const decks = useSpaceDecks(spaceId);
  const myId = useAuth().user?.id ?? null;
  const [picking, setPicking] = useState<string | null | false>(false);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof decks.data>();
    for (const d of decks.data ?? []) {
      const key = d.folder_id ?? "none";
      map.set(key, [...(map.get(key) ?? []), d] as any);
    }
    return map;
  }, [decks.data]);

  const buckets = [
    ...(folders.data ?? []).map((f) => ({ id: f.id, name: f.name })),
    { id: "none", name: "Unsorted" },
  ];

  return (
    <div className="space-y-6">
      {canManage && (
        <button
          onClick={async () => {
            const name = prompt("Folder name");
            if (!name?.trim()) return;
            await addFolder(spaceId, name.trim(), folders.data?.length ?? 0);
            onChanged();
          }}
          className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[15px] font-black shadow-[0_14px_28px_-22px_rgba(35,32,29,0.9)] transition-transform hover:-translate-y-0.5 hover:bg-black/[0.03]"
        >
          <FolderPlus size={18} /> New folder
        </button>
      )}

      {buckets.map((b) => {
        const items = grouped.get(b.id) ?? [];
        if (b.id === "none" && items.length === 0 && buckets.length > 1) return null;
        return (
          <section key={b.id} className="rounded-[28px] border border-black/[0.06] bg-white p-6">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-display text-xl font-black">{b.name}</h3>
              <span className="rounded-full bg-[#fbf5e9] px-3 py-1 text-[13px] font-black text-[#6b655c]">
                {items.length} {items.length === 1 ? "deck" : "decks"}
              </span>
              <div className="ml-auto flex items-center gap-2">
                {canAdd && (
                  <button
                    onClick={() => setPicking(b.id === "none" ? null : b.id)}
                    className="inline-flex items-center gap-2 rounded-full bg-[#8ec63f] px-6 py-3.5 text-[15px] font-black text-white shadow-[0_16px_30px_-18px_rgba(122,160,44,0.9)] transition-transform hover:-translate-y-0.5"
                  >
                    <Plus size={18} /> Add deck
                  </button>
                )}
                {canManage && b.id !== "none" && (
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete folder "${b.name}"? Decks move to Unsorted.`)) return;
                      await deleteFolder(b.id);
                      onChanged();
                    }}
                    className="grid h-11 w-11 place-items-center rounded-2xl text-[#6b655c] hover:bg-red-50 hover:text-red-600"
                    aria-label="Delete folder"
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
            </div>

            {items.length === 0 ? (
              canAdd ? (
                <button
                  onClick={() => setPicking(b.id === "none" ? null : b.id)}
                  className="mt-5 flex w-full flex-col items-center gap-2 rounded-[24px] border-2 border-dashed border-black/[0.12] bg-[#fbf5e9] px-6 py-10 text-center transition-colors hover:border-[#8ec63f] hover:bg-[#f7fbef]"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-[#8ec63f] text-white">
                    <Plus size={22} />
                  </span>
                  <span className="font-display text-[18px] font-black">Add your first deck here</span>
                  <span className="text-[14px] text-[#6b655c]">
                    Pick one of your shared decks — everyone here can study it.
                  </span>
                </button>
              ) : (
                <p className="mt-4 text-[15px] text-[#6b655c]">No decks here yet.</p>
              )
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

                {items.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-black/[0.06] p-4">
                    <Link
                      to="/share/$deckId"
                      params={{ deckId: row.deck.id }}
                      className="flex items-start gap-2 font-display text-[16px] font-black hover:underline"
                    >
                      <span className="text-xl">{row.deck.emoji || "🃏"}</span>
                      <span className="min-w-0 flex-1">{row.deck.title}</span>
                    </Link>
                    <p className="mt-2 text-[13px] text-[#6b655c]">{row.deck.card_count} cards</p>
                    <div className="mt-2">
                      <DeckRating deckId={row.deck.id} spaceId={spaceId} compact />
                    </div>
                    {(canManage || row.added_by === myId) && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {canManage && (
                        <select
                          value={row.folder_id ?? ""}
                          onChange={async (e) => {
                            await moveDeck(row.id, e.target.value || null);
                            onChanged();
                          }}
                          className="rounded-lg border border-black/[0.1] px-2 py-1 text-[12px] font-bold"
                        >
                          <option value="">Unsorted</option>
                          {(folders.data ?? []).map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                        )}
                        <button
                          onClick={async () => {
                            try {
                              await removeDeckFromSpace(row.id);
                              await onChanged();
                            } catch (e: any) {
                              toast.error(e?.message || "Could not remove this deck.");
                            }
                          }}
                          className="text-[12px] font-black text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {picking !== false && (
        <DeckPicker
          spaceId={spaceId}
          onClose={() => setPicking(false)}
          onPick={async (deckId) => {
            try {
              await addDeckToSpace(spaceId, deckId, picking as string | null);
              toast.success("Deck added");
              // Wait for the list to come back before closing, so the card is
              // on screen the moment the picker disappears.
              await onChanged();
            } catch (e: any) {
              toast.error(
                e?.message === ALREADY_IN_SPACE
                  ? "That deck is already here"
                  : e?.message || "Could not add that deck.",
              );
            }
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

function DeckPicker({
  spaceId,
  onClose,
  onPick,
}: {
  spaceId: string;
  onClose: () => void;
  onPick: (deckId: string) => void;
}) {
  const { user } = useAuth();
  const mine = useQuery({
    enabled: !!user,
    queryKey: ["share-mine", user?.id],
    queryFn: () => fetchMyDecks(user!.id),
  });

  const [q, setQ] = useState("");
  const all = mine.data ?? [];
  const list = q.trim()
    ? all.filter((d) => d.title.toLowerCase().includes(q.trim().toLowerCase()))
    : all;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#23201d]/50 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-[0_40px_90px_-45px_rgba(35,32,29,0.7)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-4 bg-gradient-to-br from-[#f3f7e6] to-[#fdf3e2] px-7 py-6">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-2xl">🃏</span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[26px] font-black leading-tight">Add one of your decks</h2>
            <p className="mt-1 text-[14px] text-[#6b655c]">
              Pick a deck below — only the people in here can see it.
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/80 text-[#6b655c] hover:bg-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        {all.length > 6 && (
          <div className="border-b border-black/[0.06] px-7 py-4">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search your decks…"
              className="h-12 w-full rounded-2xl border-2 border-black/[0.07] bg-[#fbf7ef] px-4 text-[15px] font-medium outline-none focus:border-[#8ec63f] focus:bg-white"
            />
          </div>
        )}

        <div className="flex-1 overflow-auto px-7 py-6">
          {mine.isLoading ? (
            <p className="text-[15px] text-[#6b655c]">Loading your decks…</p>
          ) : all.length === 0 ? (
            <div className="rounded-[24px] border-2 border-dashed border-black/[0.12] bg-[#fbf5e9] px-6 py-10 text-center">
              <p className="font-display text-[20px] font-black">No shared decks yet</p>
              <p className="mx-auto mt-2 max-w-[38ch] text-[14px] text-[#6b655c]">
                Share one of your flashcard decks first, then it will show up here ready to add.
              </p>
              <Link
                to="/share/new"
                search={{ space: spaceId }}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#d94f3d] px-7 py-3.5 text-[16px] font-black text-white shadow-[0_16px_30px_-16px_rgba(217,79,61,0.9)] hover:-translate-y-0.5 transition-transform"
              >
                <Plus size={18} /> Make a deck for this space
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {list.map((d) => (
                <button
                  key={d.id}
                  onClick={() => onPick(d.id)}
                  className="group flex items-center gap-4 rounded-[24px] border-2 border-black/[0.07] bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-[#8ec63f] hover:bg-[#f7fbef]"
                >
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#fbf5e9] text-3xl">
                    {d.emoji || "🃏"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[17px] font-black">{d.title}</span>
                    <span className="mt-1 flex items-center gap-2 text-[13px] font-bold text-[#6b655c]">
                      {d.card_count} cards
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                          d.audience === "public"
                            ? "bg-[#fdf0d8] text-[#8a6a1f]"
                            : "bg-[#eef7e4] text-[#4e7a1f]"
                        }`}
                      >
                        {d.audience === "public" ? "Public deck" : "Space only"}
                      </span>
                    </span>
                  </span>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f0f0ec] text-[#3a352e] transition-colors group-hover:bg-[#8ec63f] group-hover:text-white">
                    <Plus size={18} />
                  </span>
                </button>
              ))}
              {list.length === 0 && (
                <p className="text-[15px] text-[#6b655c]">Nothing matches "{q}".</p>
              )}
            </div>
          )}
        </div>

        {all.length > 0 && (
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] bg-[#fbf5e9] px-7 py-4">
            <Link
              to="/share/new"
              search={{ space: spaceId }}
              className="inline-flex items-center gap-2 rounded-full bg-[#d94f3d] px-6 py-3 text-[15px] font-black text-white shadow-[0_14px_26px_-14px_rgba(217,79,61,0.9)] hover:-translate-y-0.5 transition-transform"
            >
              <Plus size={18} /> Make a new deck for this space
            </Link>
            <button
              onClick={onClose}
              className="rounded-full bg-white px-6 py-3 text-[15px] font-black hover:bg-black/[0.04]"
            >
              Cancel
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- members */

function MembersTab({
  spaceId,
  emoji,
  tone,
  canManage,
  meId,
  onChanged,
}: {
  spaceId: string;
  emoji: string;
  tone: string;
  canManage: boolean;
  meId: string;
  onChanged: () => void;
}) {
  const members = useSpaceMembers(spaceId);
  return (
    <div className="space-y-2">
      {(members.data ?? []).map((m) => (
        <MemberRow
          key={m.user_id}
          member={m}
          spaceEmoji={emoji}
          spaceTone={tone}
          canManage={canManage}
          isMe={m.user_id === meId}
          onRole={async (role) => {
            await setMemberRole(spaceId, m.user_id, role);
            onChanged();
          }}
          onRemove={async () => {
            if (!confirm(`Remove @${m.username}?`)) return;
            await removeMember(spaceId, m.user_id);
            onChanged();
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------- news */

function NewsTab({
  spaceId,
  canPost,
  canManage,
  onChanged,
}: {
  spaceId: string;
  canPost: boolean;
  canManage: boolean;
  onChanged: () => void;
}) {
  const news = useSpaceAnnouncements(spaceId);
  const members = useSpaceMembers(spaceId);
  const [body, setBody] = useState("");
  const nameOf = (id: string) =>
    (members.data ?? []).find((m) => m.user_id === id)?.username ?? "member";

  return (
    <div className="space-y-4">
      {canPost && (
        <div className="rounded-[24px] border border-black/[0.06] bg-white p-5">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Tell everyone what you added or changed…"
            className="min-h-[80px] w-full rounded-xl border border-black/[0.1] px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-[#8ec63f]"
          />
          <button
            onClick={async () => {
              if (!body.trim()) return;
              await postAnnouncement(spaceId, body);
              setBody("");
              onChanged();
            }}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#8ec63f] px-5 py-2.5 text-[13px] font-black text-white"
          >
            <Bell size={14} /> Post announcement
          </button>
        </div>
      )}

      {(news.data ?? []).length === 0 && (
        <p className="text-[15px] text-[#6b655c]">No announcements yet.</p>
      )}
      {(news.data ?? []).map((a) => (
        <article key={a.id} className="rounded-2xl border border-black/[0.06] bg-white px-5 py-4">
          <div className="flex items-center gap-2 text-[12px] font-black text-[#6b655c]">
            @{nameOf(a.author_id)} · {new Date(a.created_at).toLocaleString()}
            {a.pinned && <span className="rounded-full bg-[#e6f4d8] px-2 py-0.5 text-[#3d5c14]">Pinned</span>}
            {canManage && (
              <span className="ml-auto flex items-center gap-1">
                <button
                  onClick={async () => {
                    await setAnnouncementPinned(a.id, !a.pinned);
                    onChanged();
                  }}
                  className="grid h-8 w-8 place-items-center rounded-lg hover:bg-black/[0.06]"
                  aria-label="Pin"
                >
                  <Pin size={14} />
                </button>
                <button
                  onClick={async () => {
                    await deleteAnnouncement(a.id);
                    onChanged();
                  }}
                  className="grid h-8 w-8 place-items-center rounded-lg text-red-600 hover:bg-red-50"
                  aria-label="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </span>
            )}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{a.body}</p>
        </article>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------- chat */

function ChatTab({ spaceId, onSent }: { spaceId: string; onSent: () => void }) {
  const messages = useSpaceMessages(spaceId, true);
  const members = useSpaceMembers(spaceId);
  const [text, setText] = useState("");
  const nameOf = (id: string) =>
    (members.data ?? []).find((m) => m.user_id === id)?.username ?? "member";

  return (
    <div className="rounded-[24px] border border-black/[0.06] bg-white p-5">
      <div className="max-h-[52vh] space-y-3 overflow-auto pr-1">
        {(messages.data ?? []).length === 0 && (
          <p className="text-[15px] text-[#6b655c]">Say hello 👋</p>
        )}
        {(messages.data ?? []).map((m) => (
          <div key={m.id} className="rounded-2xl bg-black/[0.03] px-4 py-3">
            <p className="text-[12px] font-black text-[#6b655c]">
              @{nameOf(m.author_id)} · {new Date(m.created_at).toLocaleTimeString()}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[15px]">{m.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === "Enter" && text.trim()) {
              await sendMessage(spaceId, text);
              setText("");
              onSent();
            }
          }}
          placeholder="Write a message…"
          className="flex-1 rounded-full border border-black/[0.1] px-4 py-2.5 text-sm font-semibold outline-none focus:border-[#8ec63f]"
        />
        <button
          onClick={async () => {
            if (!text.trim()) return;
            await sendMessage(spaceId, text);
            setText("");
            onSent();
          }}
          className="grid h-11 w-11 place-items-center rounded-full bg-[#8ec63f] text-white"
          aria-label="Send"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- settings */

function SettingsTab({
  spaceId,
  space,
  isOwner,
  meId,
  onChanged,
  onGone,
}: {
  spaceId: string;
  space: any;
  isOwner: boolean;
  meId: string;
  onChanged: () => void;
  onGone: () => void;
}) {
  const invite = useSpaceInvite(spaceId, true);
  const qc = useQueryClient();
  const [code, setCode] = useState<string | null>(null);
  const link = inviteLink(code ?? invite.data?.code ?? "");

  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-black/[0.06] bg-white p-5">
        <h3 className="font-display text-lg font-black">Invite link</h3>
        {invite.data || code ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-xl bg-black/[0.05] px-3 py-2 text-[13px] font-black">{link}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(link);
                toast.success("Link copied");
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#23201d] px-4 py-2 text-[12px] font-black text-white"
            >
              <Copy size={14} /> Copy
            </button>
            <button
              onClick={async () => {
                const c = await rotate(spaceId, invite.data?.id);
                setCode(c);
                qc.invalidateQueries({ queryKey: ["space-invite", spaceId] });
              }}
              className="rounded-full bg-black/[0.05] px-4 py-2 text-[12px] font-black"
            >
              Make a new link
            </button>
          </div>
        ) : (
          <button
            onClick={async () => {
              const c = await rotate(spaceId);
              setCode(c);
              qc.invalidateQueries({ queryKey: ["space-invite", spaceId] });
            }}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#8ec63f] px-5 py-2.5 text-[13px] font-black text-white"
          >
            <Link2 size={15} /> Create invite link
          </button>
        )}
      </section>

      <section className="space-y-3 rounded-[24px] border border-black/[0.06] bg-white p-5">
        <h3 className="font-display text-lg font-black">How this space works</h3>
        <Toggle
          label="Chat"
          note="Off by default. Turn it on only if you want people talking here."
          value={space.chat_enabled}
          onChange={async (v) => {
            await updateSpace(spaceId, { chat_enabled: v } as any);
            onChanged();
          }}
        />
        <Choice
          label="Who can add decks"
          value={space.who_can_add_decks}
          onChange={async (v) => {
            await updateSpace(spaceId, { who_can_add_decks: v } as any);
            onChanged();
          }}
        />
        <Choice
          label="Who can post announcements"
          value={space.who_can_post}
          onChange={async (v) => {
            await updateSpace(spaceId, { who_can_post: v } as any);
            onChanged();
          }}
        />
      </section>

      <section className="rounded-[24px] border border-black/[0.06] bg-white p-5">
        <h3 className="font-display text-lg font-black">Danger zone</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {!isOwner && (
            <button
              onClick={async () => {
                await leaveSpace(spaceId, meId);
                onGone();
              }}
              className="rounded-full bg-black/[0.05] px-5 py-2.5 text-[13px] font-black"
            >
              Leave this space
            </button>
          )}
          {isOwner && (
            <button
              onClick={async () => {
                if (!confirm("Delete this space for everyone?")) return;
                await deleteSpace(spaceId);
                toast.success("Space deleted");
                onGone();
              }}
              className="rounded-full bg-red-50 px-5 py-2.5 text-[13px] font-black text-red-600"
            >
              Delete space
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

async function rotate(spaceId: string, oldId?: string) {
  const c = await rotateInvite(spaceId, oldId);
  toast.success("Invite link ready");
  return c;
}

function Toggle({
  label,
  note,
  value,
  onChange,
}: {
  label: string;
  note: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-black/[0.03] px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-black">{label}</p>
        <p className="text-[13px] text-[#6b655c]">{note}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`h-8 w-14 rounded-full p-1 transition ${value ? "bg-[#8ec63f]" : "bg-black/20"}`}
        aria-label={label}
      >
        <span
          className={`block h-6 w-6 rounded-full bg-white transition ${value ? "translate-x-6" : ""}`}
        />
      </button>
    </div>
  );
}

function Choice({
  label,
  value,
  onChange,
}: {
  label: string;
  value: "owners" | "members";
  onChange: (v: "owners" | "members") => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-black/[0.03] px-4 py-3">
      <p className="min-w-0 flex-1 text-[15px] font-black">{label}</p>
      <div className="inline-flex rounded-full bg-white p-1">
        {(["owners", "members"] as const).map((v) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`rounded-full px-4 py-1.5 text-[12px] font-black ${
              value === v ? "bg-[#23201d] text-white" : "text-[#6b655c]"
            }`}
          >
            {v === "owners" ? "Owners only" : "Everyone"}
          </button>
        ))}
      </div>
    </div>
  );
}
