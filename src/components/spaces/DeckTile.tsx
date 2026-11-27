// One shared deck inside a classroom or group: its cover as a small mark, the title, the number of
// cards and who added it, its rating, and a black «Study» pill. Owners get the tools under it.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { DeckRating } from "@/components/share/DeckRating";
import { coverOf } from "@/lib/share-decks";
import type { SpaceDeck } from "@/lib/spaces";
import { plural } from "./SpaceCard";
import { Mark } from "./shared";

export function DeckTile({
  row,
  spaceId,
  addedBy,
  rating = true,
  tools,
}: {
  row: SpaceDeck;
  spaceId: string;
  addedBy?: string | null;
  rating?: boolean;
  tools?: ReactNode;
}) {
  const cover = coverOf(row.deck.cover);
  return (
    <article className="sp-deck">
      <div className="sp-deck-top">
        <Mark from={cover.from} to={cover.to} emoji={row.deck.emoji || "🃏"} size={46} />
        <div className="sp-deck-copy">
          <h4 className="sp-deck-title" dir="auto">
            <Link to="/share/$deckId" params={{ deckId: row.deck.id }}>
              {row.deck.title}
            </Link>
          </h4>
          <p className="sp-deck-meta">
            {plural(row.deck.card_count ?? 0, "card")}
            {addedBy && (
              <>
                <span aria-hidden="true"> · </span>
                <span dir="auto">by @{addedBy}</span>
              </>
            )}
          </p>
        </div>
      </div>
      {rating && (
        <div className="sp-deck-rating">
          <DeckRating deckId={row.deck.id} spaceId={spaceId} compact />
        </div>
      )}
      <div className="sp-deck-foot">
        <Link
          to="/share/$deckId"
          params={{ deckId: row.deck.id }}
          className="sp-btn sp-btn-dark sp-btn-sm"
          aria-label={`Study ${row.deck.title}`}
        >
          Study
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
        {tools}
      </div>
    </article>
  );
}
