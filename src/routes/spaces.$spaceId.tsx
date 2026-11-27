import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LayoutGrid,
  Layers,
  ListChecks,
  Lock,
  Megaphone,
  MessageCircle,
  Settings,
  Users,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SignInRedirect } from "@/components/study/RequireSignIn";
import { ChatTab } from "@/components/spaces/ChatTab";
import { DeckPicker } from "@/components/spaces/DeckPicker";
import { DecksTab } from "@/components/spaces/DecksTab";
import { MembersTab } from "@/components/spaces/MembersTab";
import { NewsTab } from "@/components/spaces/NewsTab";
import { OverviewTab } from "@/components/spaces/OverviewTab";
import { QuestionSetsTab } from "@/components/spaces/QuestionSetsTab";
import { SettingsTab } from "@/components/spaces/SettingsTab";
import { SpaceHeader, SpaceHeaderSkeleton } from "@/components/spaces/SpaceHeader";
import { SPACE_TABS, SpaceTabs, type SpaceTab, type TabItem } from "@/components/spaces/SpaceTabs";
import { errorText, useConfirm } from "@/components/spaces/shared";
import "@/components/spaces/spaces.css";
import { useAuth } from "@/hooks/useAuth";
import { fetchSpaceQuestionSets } from "@/lib/share-questions";
import {
  ALREADY_IN_SPACE,
  addDeckToSpace,
  deleteSpace,
  leaveSpace,
  useSpace,
  useSpaceAnnouncements,
  useSpaceDecks,
  useSpaceMembers,
} from "@/lib/spaces";

export const Route = createFileRoute("/spaces/$spaceId")({
  // `?tab=decks` opens a section directly (and survives a refresh); the overview has no tab.
  validateSearch: (search: Record<string, unknown>): { tab?: SpaceTab } => {
    const tab = search.tab;
    return typeof tab === "string" && tab !== "overview" && (SPACE_TABS as string[]).includes(tab)
      ? { tab: tab as SpaceTab }
      : {};
  },
  head: () => ({
    meta: [
      { title: "Space — shared decks & members | Uzyra" },
      {
        name: "description",
        content:
          "Your classroom or study group: shared flashcard decks in folders, the member list, announcements and optional chat.",
      },
      { property: "og:title", content: "A Uzyra study space" },
      {
        property: "og:description",
        content: "Shared decks, members, announcements and chat in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SpacePage,
});

function SpacePage() {
  const { spaceId } = Route.useParams();
  const { tab: asked } = Route.useSearch();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();

  const space = useSpace(spaceId);
  const members = useSpaceMembers(spaceId);
  const decks = useSpaceDecks(spaceId);
  const news = useSpaceAnnouncements(spaceId);
  const sets = useQuery({
    queryKey: ["space-question-sets", spaceId],
    queryFn: () => fetchSpaceQuestionSets(spaceId),
  });
  const [picker, setPicker] = useState<{
    folderId: string | null;
    folderName: string | null;
  } | null>(null);

  const s = space.data;
  const memberList = useMemo(() => members.data ?? [], [members.data]);
  const me = memberList.find((m) => m.user_id === user?.id);
  const canManage = me?.role === "owner" || me?.role === "co_owner";
  const isOwner = me?.role === "owner";
  const canAddDecks = !!me && (s?.who_can_add_decks === "members" || canManage);
  const canPost = !!me && (s?.who_can_post === "members" || canManage);
  const inHere = useMemo(() => new Set((decks.data ?? []).map((row) => row.deck.id)), [decks.data]);

  useEffect(() => {
    if (s?.name) document.title = `${s.name} | Uzyra`;
  }, [s?.name]);

  // `refetchType: "all"` so a list that is mounted but momentarily inactive (another section is
  // open) still reloads instead of showing the copy it had before the change.
  const refresh = async (...keys: string[]) => {
    await Promise.all(
      keys.map((key) => qc.invalidateQueries({ queryKey: [key, spaceId], refetchType: "all" })),
    );
  };

  const tabs: TabItem[] = s
    ? [
        { id: "overview", label: "Overview", icon: LayoutGrid },
        { id: "decks", label: "Decks", icon: Layers, count: decks.data?.length ?? null },
        {
          id: "questions",
          label: "Question sets",
          icon: ListChecks,
          count: sets.data?.length ?? null,
        },
        { id: "members", label: "Members", icon: Users, count: memberList.length },
        { id: "news", label: "Announcements", icon: Megaphone, count: news.data?.length ?? null },
        ...(s.chat_enabled ? [{ id: "chat" as const, label: "Chat", icon: MessageCircle }] : []),
        ...(canManage ? [{ id: "settings" as const, label: "Settings", icon: Settings }] : []),
      ]
    : [];
  const tab: SpaceTab = asked && tabs.some((item) => item.id === asked) ? asked : "overview";

  function open(next: SpaceTab) {
    void navigate({
      to: "/spaces/$spaceId",
      params: { spaceId },
      search: next === "overview" ? {} : { tab: next },
      replace: true,
      resetScroll: false,
    });
  }

  async function leave() {
    if (!s || !user) return;
    const ok = await confirm({
      title: `Leave ${s.name}?`,
      text: "You stop seeing its decks, question sets and news. You can come back with an invite.",
      confirm: "Leave",
      danger: true,
    });
    if (!ok) return;
    try {
      await leaveSpace(spaceId, user.id);
      await qc.invalidateQueries({ queryKey: ["my-spaces"] });
      toast.success(`You left ${s.name}`);
      void navigate({ to: "/spaces" });
    } catch (error) {
      toast.error(errorText(error, "Could not leave. Please try again."));
    }
  }

  async function remove() {
    if (!s) return;
    const ok = await confirm({
      title: `Delete ${s.name}?`,
      text: "It is removed for everyone, with its folders, announcements and chat. This cannot be undone. Shared decks stay with the people who made them.",
      confirm: "Delete for everyone",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteSpace(spaceId);
      await qc.invalidateQueries({ queryKey: ["my-spaces"] });
      toast.success(`${s.name} was deleted`);
      void navigate({ to: "/spaces" });
    } catch (error) {
      toast.error(errorText(error, "Could not delete it. Please try again."));
    }
  }

  if (space.isLoading) {
    return (
      <div className="sp sp-page">
        <SiteHeader />
        <SignInRedirect />
        <main className="sp-wrap">
          <SpaceHeaderSkeleton />
        </main>
      </div>
    );
  }

  if (space.isError || !s) {
    return (
      <div className="sp sp-page">
        <SiteHeader />
        <SignInRedirect />
        <main className="sp-wrap">
          <div className="sp-missing">
            <span className="sp-empty-icon" aria-hidden="true">
              <Lock size={22} />
            </span>
            <h1 className="sp-h3">
              {space.isError ? "This space could not be loaded" : "You can't see this space"}
            </h1>
            <p className="sp-muted">
              {space.isError
                ? "Check your connection and try again."
                : "It may have been deleted, or you are not in it. Ask its owner for an invite link."}
            </p>
            <div className="sp-empty-actions">
              {space.isError && (
                <button
                  type="button"
                  className="sp-btn sp-btn-dark"
                  onClick={() => void space.refetch()}
                >
                  Try again
                </button>
              )}
              <Link
                to="/spaces"
                className={`sp-btn ${space.isError ? "sp-btn-light" : "sp-btn-dark"}`}
              >
                All spaces
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="sp sp-page">
      <SiteHeader />
      <SignInRedirect />
      <main className="sp-wrap">
        <SpaceHeader
          space={s}
          members={memberList}
          me={me}
          counts={{
            decks: decks.data?.length ?? null,
            sets: sets.data?.length ?? null,
            news: news.data?.length ?? null,
          }}
          canManage={canManage}
          canAddDecks={canAddDecks}
          onAddDeck={() => setPicker({ folderId: null, folderName: null })}
          onSettings={() => open("settings")}
          onLeave={() => void leave()}
        />

        <SpaceTabs tabs={tabs} current={tab} onChange={open} />

        <div id="sp-panel" className="sp-panel" role="tabpanel" aria-labelledby={`sp-tab-${tab}`}>
          {tab === "overview" && (
            <OverviewTab
              space={s}
              members={memberList}
              me={me}
              decks={decks.data ?? []}
              news={news.data ?? []}
              loading={decks.isLoading}
              canManage={canManage}
              canAdd={canAddDecks}
              onOpen={open}
              onAddDeck={() => setPicker({ folderId: null, folderName: null })}
              confirm={confirm}
            />
          )}
          {tab === "decks" && (
            <DecksTab
              spaceId={spaceId}
              members={memberList}
              canAdd={canAddDecks}
              canManage={canManage}
              onChanged={() => refresh("space-decks", "space-folders")}
              onAdd={(folderId, folderName) => setPicker({ folderId, folderName })}
              confirm={confirm}
            />
          )}
          {tab === "questions" && (
            <QuestionSetsTab
              spaceId={spaceId}
              canAdd={canAddDecks}
              canManage={canManage}
              onChanged={() => refresh("space-question-sets")}
              confirm={confirm}
            />
          )}
          {tab === "members" && (
            <MembersTab
              spaceId={spaceId}
              members={memberList}
              loading={members.isLoading}
              failed={members.isError}
              canManage={canManage}
              meId={user?.id ?? ""}
              onChanged={() => refresh("space-members")}
              confirm={confirm}
            />
          )}
          {tab === "news" && (
            <NewsTab
              spaceId={spaceId}
              members={memberList}
              me={me}
              canPost={canPost}
              canManage={canManage}
              onChanged={() => refresh("space-announcements")}
              confirm={confirm}
            />
          )}
          {tab === "chat" && s.chat_enabled && (
            <ChatTab
              spaceId={spaceId}
              members={memberList}
              meId={user?.id ?? ""}
              onSent={() => refresh("space-messages")}
            />
          )}
          {tab === "settings" && canManage && (
            <SettingsTab
              space={s}
              isOwner={isOwner}
              onChanged={async () => {
                await Promise.all([
                  refresh("space"),
                  qc.invalidateQueries({ queryKey: ["my-spaces"] }),
                ]);
              }}
              onLeave={() => void leave()}
              onDelete={() => void remove()}
              confirm={confirm}
            />
          )}
        </div>
      </main>

      <DeckPicker
        open={picker !== null}
        spaceId={spaceId}
        folderName={picker?.folderName ?? null}
        existing={inHere}
        onClose={() => setPicker(null)}
        onPick={async (deckId) => {
          try {
            await addDeckToSpace(spaceId, deckId, picker?.folderId ?? null);
            // Wait for the list to come back before closing, so the deck is on screen when the
            // window goes.
            await refresh("space-decks", "space-folders");
            toast.success("Deck added");
            setPicker(null);
          } catch (error) {
            toast.error(
              error instanceof Error && error.message === ALREADY_IN_SPACE
                ? "That deck is already here."
                : errorText(error, "Could not add that deck."),
            );
          }
        }}
      />
      {dialog}
    </div>
  );
}
