import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  deAddItems,
  deCreateSubject,
  deCreateSubtopic,
  deItems,
  deRecordAttempts,
  deRemove,
  deRename,
  deSetFlag,
  deTree,
} from "@/lib/de-lab.functions";
import type { DeItem, DeSubject, LabMode } from "@/lib/de-lab";
import { useAuth } from "@/hooks/useAuth";

export function useDeTree(mode: LabMode) {
  const { user } = useAuth();
  const load = useServerFn(deTree);
  const qc = useQueryClient();

  const query = useQuery<DeSubject[]>({
    queryKey: ["de-tree", mode, user?.id ?? "anon"],
    enabled: !!user,
    queryFn: () => load({ data: { mode } }),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["de-tree"] });
    void qc.invalidateQueries({ queryKey: ["de-items"] });
  };

  const addSubject = useServerFn(deCreateSubject);
  const addSubtopic = useServerFn(deCreateSubtopic);
  const rename = useServerFn(deRename);
  const remove = useServerFn(deRemove);
  const addItems = useServerFn(deAddItems);

  const mCreateSubject = useMutation({
    mutationFn: (v: { name: string; color: string }) =>
      addSubject({ data: { mode: mode === "build" ? "speaking" : mode, ...v } }),
    onSuccess: invalidate,
  });
  const mCreateSubtopic = useMutation({
    mutationFn: (v: { subjectId: string; name: string }) => addSubtopic({ data: v }),
    onSuccess: invalidate,
  });
  const mRename = useMutation({
    mutationFn: (v: { table: "de_subjects" | "de_subtopics"; id: string; name: string }) => rename({ data: v }),
    onSuccess: invalidate,
  });
  const mRemove = useMutation({
    mutationFn: (v: { table: "de_subjects" | "de_subtopics" | "de_items"; id: string }) => remove({ data: v }),
    onSuccess: invalidate,
  });
  const mAddItems = useMutation({
    mutationFn: (v: { subtopicId: string; items: any[] }) => addItems({ data: v }),
    onSuccess: invalidate,
  });

  return {
    subjects: query.data ?? [],
    loading: query.isLoading,
    createSubject: mCreateSubject.mutateAsync,
    createSubtopic: mCreateSubtopic.mutateAsync,
    rename: mRename.mutateAsync,
    remove: mRemove.mutateAsync,
    addItems: mAddItems.mutateAsync,
    busy:
      mCreateSubject.isPending ||
      mCreateSubtopic.isPending ||
      mRename.isPending ||
      mRemove.isPending ||
      mAddItems.isPending,
    refresh: invalidate,
  };
}

export function useDeItems(subtopicIds: string[], flaggedOnly = false) {
  const { user } = useAuth();
  const load = useServerFn(deItems);
  return useQuery<DeItem[]>({
    queryKey: ["de-items", subtopicIds.slice().sort().join(","), flaggedOnly, user?.id ?? "anon"],
    enabled: !!user && subtopicIds.length > 0,
    queryFn: () => load({ data: { subtopicIds, flaggedOnly } }),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });
}

export function useDeFlag() {
  const set = useServerFn(deSetFlag);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { itemId: string; on: boolean; note?: string }) =>
      set({ data: { itemId: v.itemId, on: v.on, note: v.note ?? "" } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["de-tree"] });
      void qc.invalidateQueries({ queryKey: ["de-items"] });
    },
  });
}

export function useDeRecord() {
  const save = useServerFn(deRecordAttempts);
  return useMutation({
    mutationFn: (v: { mode: string; rows: { itemId: string; correct: boolean; score?: number }[] }) =>
      save({ data: { mode: v.mode, rows: v.rows.map((r) => ({ ...r, score: r.score ?? (r.correct ? 100 : 0) })) } }),
  });
}
