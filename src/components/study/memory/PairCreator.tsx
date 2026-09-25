import { useEffect, useState } from "react";
import { ClipboardPaste, Info, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog, simpleContentCls, simpleInputCls, simpleLabelCls } from "@/components/study/SimpleDialogs";
import { parsePairList, useMemoryPairs, type MemoryPair } from "@/lib/use-memory-pairs";

type Draft = { left: string; right: string; hint: string; group: string };

const EMPTY: Draft = { left: "", right: "", hint: "", group: "" };

/** One box used for both adding and editing — same fields, same order. */
function PairDialog({
  open,
  onOpenChange,
  editing,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: MemoryPair | null;
  onSave: (d: Draft) => void;
}) {
  const [d, setD] = useState<Draft>(EMPTY);

  useEffect(() => {
    if (!open) return;
    setD(
      editing
        ? {
            left: editing.left,
            right: editing.right,
            hint: editing.hint ?? "",
            group: editing.group ?? "",
          }
        : EMPTY,
    );
  }, [open, editing]);

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setD((p) => ({ ...p, [k]: e.target.value }));

  const submit = () => {
    if (!d.left.trim() || !d.right.trim()) {
      toast.info("Fill both sides to make a pair");
      return;
    }
    onSave(d);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={simpleContentCls}>
        <DialogHeader>
          <DialogTitle className="font-display text-[22px] font-black tracking-tight">
            {editing ? "Edit pair" : "Add pair"}
          </DialogTitle>
          <DialogDescription className="text-[13px] font-semibold text-[#a29a8d]">
            Left = the thing. Right = what belongs to it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className={simpleLabelCls}>Left side</label>
            <input
              autoFocus
              value={d.left}
              onChange={set("left")}
              placeholder="Paracetamol"
              className={simpleInputCls}
            />
          </div>
          <div>
            <label className={simpleLabelCls}>Right side</label>
            <input
              value={d.right}
              onChange={set("right")}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="500–1000 mg q6h"
              className={simpleInputCls}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={simpleLabelCls}>Hint (optional)</label>
              <input
                value={d.hint}
                onChange={set("hint")}
                placeholder="Shown after a wrong try"
                className={simpleInputCls}
              />
            </div>
            <div>
              <label className={simpleLabelCls}>Group (optional)</label>
              <input
                value={d.group}
                onChange={set("group")}
                placeholder="Analgesics"
                className={simpleInputCls}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <button
            type="button"
            className="h-11 rounded-xl px-5 text-[13.5px] font-bold text-[#a29a8d] hover:bg-black/[0.05]"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button type="button" className="rita-pill h-11 rounded-xl px-5 text-[13.5px] font-extrabold" onClick={submit}>
            {editing ? "Save changes" : "Add pair"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PasteDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImport: (text: string) => void;
}) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (open) setText("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={simpleContentCls}>
        <DialogHeader>
          <DialogTitle className="font-display text-[22px] font-black tracking-tight">Paste a list</DialogTitle>
          <DialogDescription className="text-[13px] font-semibold text-[#a29a8d]">
            One pair per line, the two sides split by a | sign.
          </DialogDescription>
        </DialogHeader>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={"Paracetamol | 1 g q6h\nDexamethasone | 4 mg IV"}
          className={`${simpleInputCls} resize-y font-mono text-[13px]`}
        />
        <DialogFooter className="gap-2 sm:gap-2">
          <button
            type="button"
            className="h-11 rounded-xl px-5 text-[13.5px] font-bold text-[#a29a8d] hover:bg-black/[0.05]"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rita-pill h-11 rounded-xl px-5 text-[13.5px] font-extrabold"
            onClick={() => onImport(text)}
          >
            Add them all
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Simple pair list: two buttons, one box for adding and editing. */
export function PairCreator({ subject, subtopic }: { subject: string; subtopic: string }) {
  const store = useMemoryPairs(subject, subtopic);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MemoryPair | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<MemoryPair | null>(null);

  useEffect(() => {
    setDialogOpen(false);
    setEditing(null);
  }, [subject, subtopic]);

  const save = (d: Draft) => {
    const payload = {
      left: d.left.trim(),
      right: d.right.trim(),
      hint: d.hint.trim() || undefined,
      group: d.group.trim() || undefined,
    };
    if (editing) {
      store.updatePair(editing.id, payload);
      toast.success("Pair updated");
    } else {
      store.addPair(payload.left, payload.right, payload.hint, payload.group);
      toast.success("Pair saved");
    }
    setEditing(null);
  };

  const importList = (text: string) => {
    const rows = parsePairList(text);
    if (rows.length === 0) {
      toast.info("Use one pair per line: Paracetamol | 1 g q6h");
      return;
    }
    store.addMany(rows);
    setPasteOpen(false);
    toast.success(`${rows.length} pair${rows.length === 1 ? "" : "s"} added`);
  };

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-5">
      <div className="flex items-start gap-3 rounded-xl bg-[#fbf5e9] px-4 py-3">
        <Info size={16} className="mt-0.5 shrink-0 text-[#b3aa9c]" />
        <p className="text-[12.5px] font-semibold leading-relaxed text-[#6b6459]">
          A pair is two halves of one fact. Left is the thing, right is what belongs to it — for example{" "}
          <span className="text-[#23201d]">Paracetamol</span> → <span className="text-[#23201d]">1 g q6h</span>. Build a
          handful, then press Play.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          className="rita-pill inline-flex h-11 items-center gap-2 rounded-xl px-5 text-[13.5px] font-extrabold"
        >
          <Plus size={16} /> Add pair
        </button>
        <button
          type="button"
          onClick={() => setPasteOpen(true)}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-[13px] font-bold text-[#23201d] hover:bg-black/[0.03]"
        >
          <ClipboardPaste size={16} /> Paste a list
        </button>
        <span className="ml-auto text-[12.5px] font-bold text-[#a29a8d]">
          {store.pairs.length} pair{store.pairs.length === 1 ? "" : "s"}
        </span>
      </div>

      {store.pairs.length === 0 ? (
        <p className="mt-5 rounded-xl bg-[#fbf5e9] px-4 py-5 text-center text-[13px] font-semibold text-[#8d8578]">
          No pairs yet. Press “Add pair” to make your first one.
        </p>
      ) : (
        <ul className="mt-5 flex flex-col gap-2">
          {store.pairs.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-xl border border-black/[0.06] bg-[#fbf5e9] px-3.5 py-2.5"
            >
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-extrabold text-[#7a4b16]">{p.left}</span>
              <span className="text-[#ccc4b6]">→</span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-[#1f4c6d]">{p.right}</span>
              {(p.misses ?? 0) > 0 && (
                <span
                  title={`${p.misses} miss${p.misses === 1 ? "" : "es"}`}
                  className="h-2 w-2 shrink-0 rounded-full bg-[#d1795e]"
                />
              )}
              <button
                type="button"
                onClick={() => {
                  setEditing(p);
                  setDialogOpen(true);
                }}
                className="grid h-8 w-8 place-items-center rounded-lg text-[#a29a8d] hover:bg-black/[0.06] hover:text-[#23201d]"
                aria-label="Edit pair"
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                onClick={() => setPendingDelete(p)}
                className="grid h-8 w-8 place-items-center rounded-lg text-[#a29a8d] hover:bg-black/[0.06] hover:text-[#d1795e]"
                aria-label="Delete pair"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <PairDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditing(null);
        }}
        editing={editing}
        onSave={save}
      />

      <PasteDialog open={pasteOpen} onOpenChange={setPasteOpen} onImport={importList} />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
        title="Delete pair"
        description={pendingDelete ? `Remove “${pendingDelete.left}”?` : undefined}
        onConfirm={() => {
          if (pendingDelete) store.deletePair(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
