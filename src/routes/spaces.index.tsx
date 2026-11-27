import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { PageHero } from "@/components/page-hero/PageHero";
import { RitaCube } from "@/components/rita-study/RitaCube";
import { SignInRedirect } from "@/components/study/RequireSignIn";
import { CreateSpaceDialog } from "@/components/spaces/CreateSpaceDialog";
import { JoinBar } from "@/components/spaces/JoinBar";
import { MakeCards } from "@/components/spaces/MakeCards";
import { SpaceCard, SpaceCardSkeleton } from "@/components/spaces/SpaceCard";
import "@/components/spaces/spaces.css";
import { useMySpaces, type SpaceKind } from "@/lib/spaces";

export const Route = createFileRoute("/spaces/")({
  head: () => ({
    meta: [
      { title: "Classrooms & study groups | Uzyra" },
      {
        name: "description",
        content:
          "Join classrooms and study groups, share flashcard decks with your classmates and keep everything organised in folders.",
      },
      { property: "og:title", content: "Classrooms & study groups on Uzyra" },
      {
        property: "og:description",
        content: "Study together: shared decks, members, announcements and optional chat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SpacesPage,
});

type Filter = "all" | SpaceKind;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "classroom", label: "Classrooms" },
  { id: "group", label: "Study groups" },
];

const STEPS = [
  {
    title: "Make it",
    text: "Give it a name, an emoji and a colour. A classroom for a whole course, a group for a few friends.",
  },
  {
    title: "Share the link",
    text: "Send the code or the invite link. People join with one tap and land straight inside.",
  },
  {
    title: "Study together",
    text: "Add decks and question sets into folders, post news, and turn the chat on if you want to talk.",
  },
];

function SpacesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const spaces = useMySpaces();
  const [making, setMaking] = useState<SpaceKind | null>(null);
  // The window keeps its kind while it closes.
  const [lastKind, setLastKind] = useState<SpaceKind>("classroom");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const all = spaces.data ?? [];
  const counts: Record<Filter, number> = {
    all: all.length,
    classroom: all.filter((s) => s.kind === "classroom").length,
    group: all.filter((s) => s.kind === "group").length,
  };
  const q = query.trim().toLowerCase();
  const shown = all.filter(
    (s) =>
      (filter === "all" || s.kind === filter) &&
      (!q || s.name.toLowerCase().includes(q) || (s.description ?? "").toLowerCase().includes(q)),
  );

  const make = (kind: SpaceKind) => {
    setLastKind(kind);
    setMaking(kind);
  };

  return (
    <div className="sp sp-page">
      <SiteHeader />
      <SignInRedirect />
      <PageHero
        kicker="Classrooms & groups"
        title="Study together, in one room."
        lead="A classroom is a whole course. A group is a few classmates. Each keeps its own decks, members and news."
      >
        <JoinBar />
      </PageHero>

      <main className="sp-wrap">
        <MakeCards onMake={make} />

        <section className="sp-section" aria-labelledby="sp-mine">
          <div className="sp-mine-head">
            <div className="sp-mine-title">
              <h2 id="sp-mine" className="sp-h2">
                Your spaces
              </h2>
              {all.length > 0 && <span className="sp-n">{all.length}</span>}
            </div>
            {all.length > 0 && (
              <div className="sp-mine-tools">
                <div className="sp-seg" role="group" aria-label="Show">
                  {FILTERS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={filter === item.id}
                      onClick={() => setFilter(item.id)}
                    >
                      {item.label}
                      <span className="sp-seg-n">{counts[item.id]}</span>
                    </button>
                  ))}
                </div>
                {all.length > 6 && (
                  <label className="sp-search">
                    <Search size={16} aria-hidden="true" />
                    <span className="sp-sr">Search your spaces</span>
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search"
                    />
                  </label>
                )}
              </div>
            )}
          </div>

          {spaces.isLoading ? (
            <div className="sp-grid" aria-busy="true" aria-label="Loading your spaces">
              {[0, 1, 2].map((i) => (
                <SpaceCardSkeleton key={i} />
              ))}
            </div>
          ) : spaces.isError ? (
            <div className="sp-empty sp-section-gap">
              <h3 className="sp-empty-title">Your spaces could not be loaded</h3>
              <p className="sp-empty-text">Check your connection, then try again.</p>
              <button
                type="button"
                className="sp-btn sp-btn-dark"
                onClick={() => void spaces.refetch()}
              >
                Try again
              </button>
            </div>
          ) : all.length === 0 ? (
            <FirstSpace onMake={make} />
          ) : shown.length === 0 ? (
            <div className="sp-empty sp-empty-sm sp-section-gap">
              <p className="sp-empty-text">
                {q
                  ? `Nothing matches “${query.trim()}”.`
                  : filter === "classroom"
                    ? "You are not in any classroom yet."
                    : "You are not in any study group yet."}
              </p>
              {!q && filter !== "all" && (
                <button type="button" className="sp-btn sp-btn-dark" onClick={() => make(filter)}>
                  <Plus size={16} aria-hidden="true" />
                  {filter === "classroom" ? "New classroom" : "New study group"}
                </button>
              )}
            </div>
          ) : (
            <div className="sp-grid">
              {shown.map((space) => (
                <SpaceCard key={space.id} space={space} />
              ))}
            </div>
          )}
        </section>

        <section className="sp-section" aria-labelledby="sp-how">
          <h2 id="sp-how" className="sp-h2">
            How it works
          </h2>
          <ol className="sp-steps">
            {STEPS.map((step, i) => (
              <li key={step.title} className="sp-step">
                <span className="sp-step-n">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="sp-step-title">{step.title}</h3>
                <p className="sp-step-text">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <CreateSpaceDialog
        open={making !== null}
        kind={making ?? lastKind}
        onClose={() => setMaking(null)}
        onCreated={async (id) => {
          setMaking(null);
          await qc.invalidateQueries({ queryKey: ["my-spaces"] });
          void navigate({ to: "/spaces/$spaceId", params: { spaceId: id } });
        }}
      />
    </div>
  );
}

/** Nothing yet: Uzyra's cube, a line, and the two ways to start. */
function FirstSpace({ onMake }: { onMake: (kind: SpaceKind) => void }) {
  const levels = useRef({ input: 0, output: 0 });
  return (
    <div className="sp-empty sp-section-gap">
      <span className="sp-empty-cube" aria-hidden="true">
        <RitaCube levelsRef={levels} mode="idle" label="" />
      </span>
      <h3 className="sp-empty-title">No classrooms or groups yet</h3>
      <p className="sp-empty-text">
        Make one for your course or your friends, or paste the code you were sent into the box at
        the top.
      </p>
      <div className="sp-empty-actions">
        <button type="button" className="sp-btn sp-btn-dark" onClick={() => onMake("classroom")}>
          <Plus size={16} aria-hidden="true" />
          New classroom
        </button>
        <button type="button" className="sp-btn sp-btn-light" onClick={() => onMake("group")}>
          <Plus size={16} aria-hidden="true" />
          New study group
        </button>
      </div>
    </div>
  );
}
