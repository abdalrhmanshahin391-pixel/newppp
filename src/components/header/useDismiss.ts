import { useEffect, type RefObject } from "react";

/**
 * Closes a header menu on a press outside it or on Escape, and hands focus back to the
 * button that opened it (the element marked `data-rh-trigger` inside the root).
 */
export function useDismiss(
  open: boolean,
  onClose: () => void,
  root: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent | TouchEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onClose();
      root.current?.querySelector<HTMLElement>("[data-rh-trigger]")?.focus();
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("touchstart", away, { passive: true });
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("touchstart", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open, onClose, root]);
}
