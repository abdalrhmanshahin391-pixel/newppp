import { useMemo, useState } from "react";
import { Pencil, RotateCcw, Search, Trash2 } from "lucide-react";
import { scaleText, type FlashCardItem } from "@/lib/use-flashcards";
import { FlipCard } from "@/components/study/FlipCard";

/** One face of a gallery tile. */
function TileFace({ side, text, image }: { side: string; text: string; image?: string }) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl text-left">
      <span className="mb-2 block text-[10.5px] font-bold uppercase tracking-[0.18em] text-[#b3aa9c]">
        {side}
      </span>
      <span className={`block ${scaleText(text)}`}>{text}</span>
      {image && <img src={image} alt="" className="mt-3 h-16 w-auto rounded-xl object-cover" />}
    </div>
  );
}

export function FlashCardGallery({
  cards,
  topicLabel,
  onEdit,
  onDelete,
}: {
  cards: FlashCardItem[];
  topicLabel: string;
  onEdit: (card: FlashCardItem) => void;
  onDelete: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const [confirming, setConfirming] = useState<string | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) => `${c.front} ${c.back}`.toLowerCase().includes(q));
  }, [cards, query]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b3aa9c]">
            {cards.length} card{cards.length === 1 ? "" : "s"}
          </p>
          <h2 className="truncate text-[20px] font-black">{topicLabel}</h2>
        </div>
        <label className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2">
          <Search size={15} className="text-[#b3aa9c]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cards"
            className="w-44 bg-transparent text-[13px] font-semibold outline-none placeholder:text-[#c3bbad]"
          />
        </label>
      </div>

      {list.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-black/10 bg-[#fbf5e9] p-10 text-center text-[14px] font-semibold text-[#a29a8d]">
          {cards.length === 0 ? "No cards here yet — add your first one." : "No cards match that search."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((card) => {
            const isBack = !!flipped[card.id];
            return (
              <div
                key={card.id}
                className="flex flex-col justify-between rounded-3xl border border-black/[0.07] bg-white p-5"
              >
                <button
                  type="button"
                  onClick={() => setFlipped((f) => ({ ...f, [card.id]: !f[card.id] }))}
                  className="min-w-0 text-left"
                >
                  <FlipCard
                    flipped={isBack}
                    perspective={1000}
                    duration={420}
                    className="h-[8.5rem] w-full"
                    front={<TileFace side="Front" text={card.front} image={card.frontImage} />}
                    back={<TileFace side="Back" text={card.back} image={card.backImage} />}
                  />
                </button>


                <div className="mt-4 flex items-center gap-2">
                  <IconBtn label="Flip" onClick={() => setFlipped((f) => ({ ...f, [card.id]: !f[card.id] }))}>
                    <RotateCcw size={15} />
                  </IconBtn>
                  <IconBtn label="Edit" onClick={() => onEdit(card)}>
                    <Pencil size={15} />
                  </IconBtn>
                  {confirming === card.id ? (
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onDelete(card.id);
                          setConfirming(null);
                        }}
                        className="rounded-full bg-[#f6ddd5] px-3 py-1.5 text-[12px] font-extrabold text-[#7d3421]"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(null)}
                        className="rounded-full border border-black/10 px-3 py-1.5 text-[12px] font-bold"
                      >
                        Keep
                      </button>
                    </div>
                  ) : (
                    <div className="ml-auto">
                      <IconBtn label="Delete" onClick={() => setConfirming(card.id)}>
                        <Trash2 size={15} />
                      </IconBtn>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-full border border-black/10 bg-white text-[#7a6f5e]"
    >
      {children}
    </button>
  );
}
