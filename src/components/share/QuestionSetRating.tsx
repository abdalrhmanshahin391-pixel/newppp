import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { fetchQuestionSetRating, rateQuestionSet, type QuestionSetRatingSummary } from "@/lib/share-questions";

export function useQuestionSetRating(setId: string, spaceId?: string | null) {
  return useQuery({
    queryKey: ["qset-rating", setId, spaceId ?? "global"],
    queryFn: () => fetchQuestionSetRating(setId, spaceId),
  });
}

export function QuestionSetRating({
  setId,
  spaceId = null,
  compact = false,
}: {
  setId: string;
  spaceId?: string | null;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuestionSetRating(setId, spaceId);
  const [hover, setHover] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [openNote, setOpenNote] = useState(false);

  const mine = data?.mine?.stars ?? 0;

  async function handleRate(stars: number, withNote?: string) {
    if (!user) return toast.error("Sign in first to rate this question set.");
    setBusy(true);
    try {
      await rateQuestionSet(setId, stars, withNote, spaceId);
      toast.success("Thanks — your rating was recorded.");
      setOpenNote(false);
      setNote("");
      qc.invalidateQueries({ queryKey: ["qset-rating", setId, spaceId ?? "global"] });
      qc.invalidateQueries({ queryKey: ["qset-feed"] });
    } catch (e: any) {
      toast.error(e?.message || "Could not save rating");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[#6b655c]">
        <Loader2 size={12} className="animate-spin" />
      </span>
    );
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
            onClick={() => handleRate(n)}
            className="p-0.5 disabled:opacity-50"
          >
            <Star
              size={compact ? 14 : 18}
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
      <div className="inline-flex items-center gap-1.5 text-[12px] font-black text-[#23201d]">
        <Star size={13} strokeWidth={2.5} className="fill-amber-400 text-amber-400" />
        <span>{data?.avg ? data.avg.toFixed(1) : "New"}</span>
        {data?.count ? (
          <span className="font-semibold text-[#8a8376]">({data.count})</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-black uppercase tracking-wider text-[#8a8376]">
            Question Quality Rating
          </span>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="font-display text-2xl font-black text-[#23201d]">
              {data?.avg ? data.avg.toFixed(1) : "—"}
            </span>
            <span className="text-xs font-bold text-[#8a8376]">
              {data?.count ? `from ${data.count} student${data.count > 1 ? "s" : ""}` : "No ratings yet"}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[11px] font-bold text-[#8a8376] mb-1">
            {mine ? "Your rating:" : "Rate this set:"}
          </span>
          {stars}
        </div>
      </div>

      {mine > 0 && !openNote && (
        <button
          type="button"
          onClick={() => setOpenNote(true)}
          className="mt-3 text-[11.5px] font-bold text-[#8a8376] hover:text-[#23201d] hover:underline"
        >
          {data?.mine?.note ? "Edit review note" : "Add private note"}
        </button>
      )}

      {openNote && (
        <div className="mt-3 space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add an optional feedback note (private to you)…"
            rows={2}
            className="w-full rounded-xl border border-black/[0.1] p-2.5 text-xs font-semibold outline-none"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleRate(mine, note)}
              disabled={busy}
              className="rounded-full bg-[#23201d] px-3.5 py-1 text-xs font-black text-white"
            >
              Save note
            </button>
            <button
              type="button"
              onClick={() => setOpenNote(false)}
              className="text-xs font-bold text-[#8a8376]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
