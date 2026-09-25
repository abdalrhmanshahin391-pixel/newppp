import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFlags, setFlag, type CardFlag } from "@/lib/card-flags.functions";
import { useAuth } from "@/hooks/useAuth";

/** Every red-flagged card, kept in one cache so counts never disagree. */
export function useCardFlags() {
  const { user } = useAuth();
  const load = useServerFn(listFlags);
  const toggle = useServerFn(setFlag);
  const qc = useQueryClient();

  const query = useQuery<CardFlag[]>({
    queryKey: ["card-flags", user?.id ?? "anon"],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: () => load(),
  });

  const mutation = useMutation({
    mutationFn: (v: { cardId: string; subject: string; sub: string; on: boolean; note?: string }) =>
      toggle({ data: { ...v, note: v.note ?? "" } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["card-flags"] });
      void qc.invalidateQueries({ queryKey: ["review-sync"] });
    },
  });

  const ids = new Set((query.data ?? []).map((f) => f.card_id));

  const isFlagged = useCallback((id: string) => ids.has(id), [query.data]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    flags: query.data ?? [],
    ids,
    isFlagged,
    setFlagged: mutation.mutateAsync,
    busy: mutation.isPending,
  };
}
