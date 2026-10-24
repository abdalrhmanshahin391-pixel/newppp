import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "rita_admin_guide";

/** Open the first time an admin sees it, then as they left it. Storage can fail: it just opens. */
export function useGuideOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(STORAGE_KEY) !== "closed");
    } catch {
      setOpen(true);
    }
  }, []);
  const change = useCallback((next: boolean) => {
    setOpen(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "open" : "closed");
    } catch {
      /* the choice is not remembered, nothing else is lost */
    }
  }, []);
  return [open, change];
}
