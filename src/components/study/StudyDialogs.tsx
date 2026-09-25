import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SampleSubject } from "@/lib/study-sample-data";

const inputCls =
  "w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-[14px] font-semibold text-[#23201d] outline-none focus:border-[#f0a95c] focus:ring-2 focus:ring-[#f0a95c]/25";

const labelCls = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-[#b3aa9c]";

const cancelCls =
  "h-11 rounded-xl px-5 text-[13.5px] font-bold text-[#a29a8d] transition-colors hover:bg-black/[0.05]";

const primaryCls = "rita-pill h-11 rounded-xl px-5 text-[13.5px] font-extrabold";

const dangerCls =
  "h-11 rounded-xl bg-[#d1795e] px-5 text-[13.5px] font-extrabold text-white transition-opacity hover:opacity-90";

const contentCls =
  "rounded-3xl border border-black/[0.07] bg-[#fbf5e9] text-[#23201d] sm:max-w-md";

export function AddSubjectDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (name: string) => void;
}) {
  const [name, setName] = useState("");
  useEffect(() => {
    if (open) setName("");
  }, [open]);

  const submit = () => {
    const v = name.trim();
    if (!v) return;
    onAdd(v);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={contentCls}>
        <DialogHeader>
          <DialogTitle className="font-display text-[22px] font-black tracking-tight">
            Add Subject
          </DialogTitle>
          <DialogDescription className="text-[13px] font-semibold text-[#a29a8d]">
            Create a new subject for your study board.
          </DialogDescription>
        </DialogHeader>
        <div>
          <label className={labelCls} htmlFor="subject-name">
            Subject name
          </label>
          <input
            id="subject-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="e.g. Cardiology"
            className={inputCls}
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <button type="button" className={cancelCls} onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button type="button" className={primaryCls} onClick={submit}>
            Add Subject
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AddSubSubjectDialog({
  open,
  onOpenChange,
  subjects,
  defaultParent,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subjects: SampleSubject[];
  defaultParent: number;
  onAdd: (si: number, name: string) => void;
}) {
  const [parent, setParent] = useState(defaultParent);
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) {
      setParent(defaultParent);
      setName("");
    }
  }, [open, defaultParent]);

  const submit = () => {
    const v = name.trim();
    if (!v || !subjects[parent]) return;
    onAdd(parent, v);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={contentCls}>
        <DialogHeader>
          <DialogTitle className="font-display text-[22px] font-black tracking-tight">
            Add Sub-Subject
          </DialogTitle>
          <DialogDescription className="text-[13px] font-semibold text-[#a29a8d]">
            Nest a topic under one of your subjects.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className={labelCls} htmlFor="parent-subject">
              Parent subject
            </label>
            <select
              id="parent-subject"
              value={parent}
              onChange={(e) => setParent(Number(e.target.value))}
              className={inputCls}
            >
              {subjects.map((s, i) => (
                <option key={`${s.name}-${i}`} value={i}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="sub-name">
              Sub-subject name
            </label>
            <input
              id="sub-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="e.g. Heart failure"
              className={inputCls}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <button type="button" className={cancelCls} onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button type="button" className={primaryCls} onClick={submit}>
            Add Sub-Subject
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditItemDialog({
  open,
  onOpenChange,
  isSub,
  initialName,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isSub: boolean;
  initialName: string;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  const submit = () => {
    const v = name.trim();
    if (!v) return;
    onSave(v);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={contentCls}>
        <DialogHeader>
          <DialogTitle className="font-display text-[22px] font-black tracking-tight">
            {isSub ? "Edit Sub-Subject" : "Edit Subject"}
          </DialogTitle>
          <DialogDescription className="text-[13px] font-semibold text-[#a29a8d]">
            Give it a clearer name.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className={labelCls} htmlFor="edit-name">
              Name
            </label>
            <input
              id="edit-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className={inputCls}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <button type="button" className={cancelCls} onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button type="button" className={primaryCls} onClick={submit}>
            Save Changes
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RemoveDialog({
  open,
  onOpenChange,
  isSub,
  name,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isSub: boolean;
  name: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={contentCls}>
        <DialogHeader>
          <DialogTitle className="font-display text-[22px] font-black tracking-tight">
            {isSub ? "Remove Sub-Subject" : "Remove Subject"}
          </DialogTitle>
          <DialogDescription className="text-[13.5px] font-semibold text-[#5c554b]">
            Are you sure you want to remove &ldquo;{name}&rdquo;?
            {!isSub && " All of its sub-subjects will be removed too."}
          </DialogDescription>
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
            Delete
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
