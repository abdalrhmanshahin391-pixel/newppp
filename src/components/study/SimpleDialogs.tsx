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
  "w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-[14px] font-semibold text-[#23201d] outline-none focus:border-[#f0a95c] focus:ring-2 focus:ring-[#f0a95c]/25";

export const simpleLabelCls =
  "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-[#b3aa9c]";

const cancelCls =
  "h-11 rounded-xl px-5 text-[13.5px] font-bold text-[#a29a8d] transition-colors hover:bg-black/[0.05]";

const primaryCls =
  "h-11 rounded-xl bg-[#23201d] px-5 text-[13.5px] font-extrabold text-white transition-opacity hover:opacity-90";

const dangerCls =
  "h-11 rounded-xl bg-[#d1795e] px-5 text-[13.5px] font-extrabold text-white transition-opacity hover:opacity-90";

export const simpleContentCls =
  "rounded-3xl border border-black/[0.07] bg-[#fbf5e9] text-[#23201d] sm:max-w-md";

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
          <DialogTitle className="font-display text-[22px] font-black tracking-tight">
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription className="text-[13px] font-semibold text-[#a29a8d]">
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
          <button type="button" disabled={submitting} className={cancelCls} onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button type="button" disabled={submitting} className={`${primaryCls} disabled:opacity-50`} onClick={() => void submit()}>
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
          <DialogTitle className="font-display text-[22px] font-black tracking-tight">
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription className="text-[13.5px] font-semibold text-[#5c554b]">
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
