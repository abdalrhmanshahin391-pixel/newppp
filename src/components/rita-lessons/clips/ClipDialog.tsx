import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

/** The admin's sheet (phone) or centred window (tablet and up), as the book dialogs use. */
export function ClipDialog({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="rita-ex-overlay edith-premium" />
        <Dialog.Content
          className="rita-ex-window edith-premium"
          dir="rtl"
          aria-describedby={undefined}
        >
          <div className="flex items-center gap-2 border-b border-[var(--pp-line)] px-5 py-3">
            <Dialog.Title className="me-auto text-[18px] font-bold">{title}</Dialog.Title>
            <Dialog.Close className="rita-btn rita-btn-quiet rita-btn-sm !px-2" aria-label="إغلاق">
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <div className="flex flex-wrap gap-2 border-t border-[var(--pp-line)] px-5 py-3">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
