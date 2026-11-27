// Adding one of your shared decks to a classroom or group (into a folder, or unsorted). Decks that
// are already in here are marked, and there is a way out to make a new deck for this space.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Plus, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { coverOf, fetchMyDecks } from "@/lib/share-decks";
import { plural } from "./SpaceCard";
import { Mark, SpaceDialog, Spin } from "./shared";

export function DeckPicker({
  open,
  spaceId,
  folderName,
  existing,
  onClose,
  onPick,
}: {
  open: boolean;
  spaceId: string;
  folderName: string | null;
  existing: Set<string>;
  onClose: () => void;
  onPick: (deckId: string) => Promise<void>;
}) {
  const { user } = useAuth();
  const mine = useQuery({
    enabled: open && !!user,
    queryKey: ["share-mine", user?.id],
    queryFn: () => fetchMyDecks(user!.id),
  });
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setAdding(null);
    }
  }, [open]);

  const all = mine.data ?? [];
  const q = query.trim().toLowerCase();
  const list = q ? all.filter((deck) => deck.title.toLowerCase().includes(q)) : all;

  return (
    <SpaceDialog
      open={open}
      onClose={onClose}
      busy={adding !== null}
      wide
      title={folderName ? `Add a deck to ${folderName}` : "Add one of your decks"}
      description="Pick a deck you have shared. Everyone in here can study it."
      footer={
        <>
          <Link to="/share/new" search={{ space: spaceId }} className="sp-btn sp-btn-light">
            <Plus size={16} aria-hidden="true" />
            Make a new deck
          </Link>
          <button
            type="button"
            className="sp-btn sp-btn-ghost"
            onClick={onClose}
            disabled={adding !== null}
          >
            Close
          </button>
        </>
      }
    >
      {all.length > 6 && (
        <label className="sp-search sp-search-block">
          <Search size={16} aria-hidden="true" />
          <span className="sp-sr">Search your decks</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your decks"
            type="search"
          />
        </label>
      )}

      {mine.isLoading ? (
        <ul className="sp-pick-list" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="sp-pick sp-pick-skel">
              <span className="sp-bone sp-bone-mark" />
              <span className="sp-bone sp-bone-line" />
            </li>
          ))}
        </ul>
      ) : mine.isError ? (
        <p className="sp-state-text" role="alert">
          Your decks could not be loaded. Close this window and try again.
        </p>
      ) : all.length === 0 ? (
        <div className="sp-empty sp-empty-sm">
          <h3 className="sp-empty-title">No shared decks yet</h3>
          <p className="sp-empty-text">
            Share one of your flashcard decks first. It shows up here, ready to add.
          </p>
          <Link to="/share/new" search={{ space: spaceId }} className="sp-btn sp-btn-dark">
            <Plus size={16} aria-hidden="true" />
            Make a deck for this space
          </Link>
        </div>
      ) : list.length === 0 ? (
        <p className="sp-state-text">Nothing matches “{query.trim()}”.</p>
      ) : (
        <ul className="sp-pick-list">
          {list.map((deck) => {
            const cover = coverOf(deck.cover);
            const here = existing.has(deck.id);
            return (
              <li key={deck.id}>
                <button
                  type="button"
                  className="sp-pick"
                  disabled={here || adding !== null}
                  onClick={async () => {
                    setAdding(deck.id);
                    try {
                      await onPick(deck.id);
                    } finally {
                      setAdding(null);
                    }
                  }}
                >
                  <Mark from={cover.from} to={cover.to} emoji={deck.emoji || "🃏"} size={44} />
                  <span className="sp-pick-copy">
                    <span className="sp-pick-title" dir="auto">
                      {deck.title}
                    </span>
                    <span className="sp-pick-meta">
                      {plural(deck.card_count ?? 0, "card")} ·{" "}
                      {deck.audience === "public" ? "Public deck" : "Space only"}
                    </span>
                  </span>
                  <span className="sp-pick-add">
                    {here ? (
                      <>
                        <Check size={15} aria-hidden="true" />
                        In here
                      </>
                    ) : adding === deck.id ? (
                      <Spin />
                    ) : (
                      <Plus size={17} aria-label="Add" />
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </SpaceDialog>
  );
}
