import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/legacy-client";
import { useAuth } from "@/hooks/useAuth";

type Summary = {
  avg: number;
  count: number;
  mine: { stars: number; note: string | null } | null;
  breakdown: Record<string, number>;
};

export function useDeckRating(deckId: string, spaceId?: string | null) {
  return useQuery({
    queryKey: ["deck-rating", deckId, spaceId ?? "global"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("deck_rating_summary", {
        _deck_id: deckId,
        _space_id: spaceId ?? null,
      });
      if (error) throw error;
      return (data ?? { avg: 0, count: 0, mine: null, breakdown: {} }) as Summary;
    },
  });
}

export function DeckRating({
  deckId,
  spaceId = null,
  compact = false,
}: {
  deckId: string;
  spaceId?: string | null;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useDeckRating(deckId, spaceId);
  const [hover, setHover] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [openNote, setOpenNote] = useState(false);

  const mine = data?.mine?.stars ?? 0;

  async function rate(stars: number, withNote?: string) {
    if (!user) return toast.error("Sign in first to rate this deck.");
    setBusy(true);
    try {
      const { error } = await (supabase.rpc as any)("rate_deck", {
        _deck_id: deckId,
        _stars: stars,
        _note: withNote?.trim() || null,
        _space_id: spaceId,
      });
      if (error) throw error;
      toast.success("Thanks — your rating is private.");
      setOpenNote(false);
      setNote("");
      qc.invalidateQueries({ queryKey: ["deck-rating", deckId, spaceId ?? "global"] });
    } catch (e: any) {
      toast.error(e?.message || "Could not save your rating");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[#6b655c]"><Loader2 size={12} className="animate-spin" /></span>;
  }

  const stars = (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = (hover || mine) >= n;
        return (
          <button
            key={n}
            type="button"
            disabled={busy}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => rate(n)}
            className="p-0.5 disabled:opacity-50"
          >
            <Star
              size={compact ? 15 : 20}
              strokeWidth={2.5}
              className={on ? "fill-amber-400 text-amber-400" : "text-[#c7c0b4]"}
            />
          </button>
        );
      })}
    </div>
  );

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {stars}
        <span className="text-[12px] font-black text-[#6b655c]">
          {data?.count ? `${data.avg.toFixed(1)} · ${data.count}` : "No ratings yet"}
        </span>
      </div>
    );
  }

  return (
    <section className="mt-8 rounded-[26px] border border-black/[0.07] bg-white p-6">
      <h2 className="font-display text-lg font-black">How good is this deck?</h2>
      <p className="mt-1 text-[13px] font-semibold text-[#6b655c]">
        Your rating stays private — nobody sees who gave what, only the average.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        {stars}
        <span className="text-[13px] font-black text-[#4a453d]">
          {data?.count ? `${data.avg.toFixed(1)} out of 5 · ${data.count} rating${data.count > 1 ? "s" : ""}` : "Be the first to rate"}
        </span>
        <button
          type="button"
          onClick={() => setOpenNote((v) => !v)}
          className="ms-auto text-[13px] font-black text-[#8ec63f]"
        >
          {openNote ? "Hide note" : "Add a private note"}
        </button>
      </div>

      {openNote && (
        <div className="mt-4">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={400}
            placeholder="What could be better in this deck?"
            className="h-24 w-full rounded-2xl border border-black/[0.1] bg-[#fbf5e9] px-4 py-3 text-sm font-semibold"
          />
          <button
            type="button"
            disabled={busy || !(mine || hover)}
            onClick={() => rate(mine || hover || 5, note)}
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#23201d] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />} Send privately
          </button>
        </div>
      )}
    </section>
  );
}
