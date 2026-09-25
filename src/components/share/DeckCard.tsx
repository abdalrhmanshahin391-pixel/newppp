import { Link } from "@tanstack/react-router";
import { Bookmark, Layers, Star } from "lucide-react";
import { coverOf, type DeckAuthor, type SharedDeck } from "@/lib/share-decks";
import { useAvatarUrl, avatarTone } from "@/lib/avatars";

export function AuthorChip({ author, size = 28 }: { author: DeckAuthor | null; size?: number }) {
  const url = useAvatarUrl(author?.avatar_url);
  const name = author?.username ?? "student";
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        className="grid shrink-0 place-items-center overflow-hidden rounded-full text-[11px] font-black text-white ring-2 ring-white"
        style={{ height: size, width: size, background: avatarTone(name) }}
      >
        {url ? (
          <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          name.charAt(0).toUpperCase()
        )}
      </span>
      <span className="truncate text-[13px] font-bold text-[#4a453d]">@{name}</span>
    </span>
  );
}

export function DeckCard({ deck, author }: { deck: SharedDeck; author: DeckAuthor | null }) {
  const c = coverOf(deck.cover);
  const ratingCount = (deck as any).rating_count ?? 0;
  const ratingAvg = (deck as any).rating_avg ?? 0;

  return (
    <Link
      data-tour="share-deck-card"
      to="/share/$deckId"
      params={{ deckId: deck.id }}
      className="group flex flex-col overflow-hidden rounded-[26px] border border-black/[0.07] bg-white shadow-[0_10px_30px_-24px_rgba(0,0,0,0.45)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_50px_-28px_rgba(0,0,0,0.5)]"
    >
      <div
        className="relative grid h-28 place-items-center"
        style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
      >
        <span className="text-4xl">{deck.emoji || "🃏"}</span>
        {/* Flashcard distinction badge */}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-purple-200 bg-white/95 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-purple-800 shadow-sm">
          🃏 Flashcards
        </span>
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-black text-[#23201d]">
          <Layers size={12} /> {deck.card_count}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-[18px] font-black leading-snug tracking-tight text-[#23201d]">
          {deck.title}
        </h3>
        {deck.description && (
          <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-[#6b655c]">
            {deck.description}
          </p>
        )}
        {deck.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {deck.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-full bg-black/[0.05] px-2.5 py-1 text-[11px] font-bold text-[#4a453d]"
              >
                #{t}
              </span>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <AuthorChip author={author} />
          <div className="flex items-center gap-2">
            {ratingCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[12px] font-black text-amber-700">
                <Star size={12} className="fill-amber-500 text-amber-500" />
                {Number(ratingAvg).toFixed(1)}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[12px] font-black text-[#6b655c]">
              <Bookmark size={13} /> {deck.save_count}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
