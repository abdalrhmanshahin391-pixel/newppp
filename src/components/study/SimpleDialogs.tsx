import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const simpleInputCls =
  "w-full rounded-lg border-2 border-[#121117] bg-white px-3.5 py-2.5 text-[15px] font-medium text-[#121117] outline-none placeholder:text-[#6a697c] focus:border-[#121117] focus:ring-4 focus:ring-[#ff7aac]/40";

export const simpleLabelCls = "mb-1.5 block text-[14px] font-semibold text-[#121117]";

const cancelCls =
  "h-11 rounded-lg px-5 text-[15px] font-semibold text-[#121117] transition-colors hover:bg-[#f4f4f8]";

const primaryCls =
  "h-11 rounded-lg border-2 border-[#121117] bg-[#ff7aac] px-5 text-[15px] font-semibold text-[#121117] transition-colors hover:bg-[#fe9fc3]";

const dangerCls =
  "h-11 rounded-lg border-2 border-[#121117] bg-[#b3213f] px-5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90";

export const simpleContentCls =
  "rounded-[20px] border-2 border-[#121117] bg-white text-[#121117] sm:max-w-md";

/** One-field name box — replaces window.prompt(). */
export function PromptDialog({
  open,
  onOpenChange,
  title,
  description,
  label = "Name",
  placeholder,
  initialValue = "",
  confirmLabel = "Save",
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  onSubmit: (value: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  const submit = async () => {
    const v = value.trim();
    if (!v || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(v);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={simpleContentCls}>
        <DialogHeader>
          <DialogTitle className="font-display text-[24px] font-bold tracking-[-0.02em]">
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription className="text-[15px] font-medium text-[#6a697c]">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <div>
          <label className={simpleLabelCls}>{label}</label>
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={submitting}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
            placeholder={placeholder}
            className={simpleInputCls}
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <button
            type="button"
            disabled={submitting}
            className={cancelCls}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            className={`${primaryCls} disabled:opacity-50`}
            onClick={() => void submit()}
          >
            {submitting ? "Saving…" : confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Small confirm box — replaces window.confirm(). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={simpleContentCls}>
        <DialogHeader>
          <DialogTitle className="font-display text-[24px] font-bold tracking-[-0.02em]">
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription className="text-[15px] font-medium text-[#4b4a5c]">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <button type="button" className={cancelCls} onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={dangerCls}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
