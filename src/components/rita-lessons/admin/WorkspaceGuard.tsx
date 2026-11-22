import { createContext, useContext, useEffect, useId, useRef } from "react";

export type WorkspaceGuard = {
  dirty: boolean;
  markDirty: () => void;
  saved: () => void;
  task: (id: string, running: boolean) => void;
  leave: (action: () => void) => void;
};
export const WorkspaceGuardContext = createContext<WorkspaceGuard | null>(null);
export const useWorkspaceGuard = () => useContext(WorkspaceGuardContext);

/** Only active inside the path editor; the standalone admin keeps its existing behaviour. */
export function useWorkspaceTask(running: boolean) {
  const guard = useWorkspaceGuard();
  const task = guard?.task;
  const id = useId();
  useEffect(() => {
    task?.(id, running);
    return () => task?.(id, false);
  }, [id, running, task]);
  return () => task?.(id, false);
}

/** Captures non-text edits too, such as adding a goal or reordering a slide. */
export function useWorkspaceDraft(value: unknown) {
  const guard = useWorkspaceGuard();
  const markDirty = guard?.markDirty;
  const fingerprint = JSON.stringify(value);
  const previous = useRef(fingerprint);
  useEffect(() => {
    if (previous.current !== fingerprint) {
      previous.current = fingerprint;
      markDirty?.();
    }
  }, [fingerprint, markDirty]);
}
