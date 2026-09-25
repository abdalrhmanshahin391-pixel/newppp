import { useEffect, useRef, useState } from "react";
import { ImagePlus, RotateCcw, Save, X } from "lucide-react";
import { toast } from "sonner";
import { CARD_LIMIT, scaleText, type FlashCardItem } from "@/lib/use-flashcards";

type Draft = { front: string; back: string; frontImage?: string; backImage?: string };

const EMPTY: Draft = { front: "", back: "" };

export function FlashCardCreator({
  topicLabel,
  editing,
  onSave,
  onUpdate,
  onCancelEdit,
}: {
  topicLabel: string;
  editing?: FlashCardItem | null;
  onSave: (front: string, back: string, frontImage?: string, backImage?: string) => void;
  onUpdate?: (id: string, patch: Partial<Omit<FlashCardItem, "id">>) => void;
  onCancelEdit?: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [flipped, setFlipped] = useState(false);
  const frontRef = useRef<HTMLTextAreaElement>(null);
  const backRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft({
        front: editing.front,
        back: editing.back,
        frontImage: editing.frontImage,
        backImage: editing.backImage,
      });
      setFlipped(false);
    }
  }, [editing]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      (flipped ? backRef : frontRef).current?.focus();
    }, flipped ? 320 : 0);
    return () => window.clearTimeout(t);
  }, [flipped]);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const pickImage = (side: "front" | "back") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      set(side === "front" ? { frontImage: String(reader.result) } : { backImage: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const save = () => {
    const front = draft.front.trim();
    const back = draft.back.trim();
    if (!front || !back) {
      toast.info("Fill in both sides first");
      return;
    }
    if (editing && onUpdate) {
      onUpdate(editing.id, { front, back, frontImage: draft.frontImage, backImage: draft.backImage });
      toast.success("Card updated");
      onCancelEdit?.();
    } else {
      onSave(front, back, draft.frontImage, draft.backImage);
      toast.success("Card saved");
    }
    setDraft(EMPTY);
    setFlipped(false);
    window.setTimeout(() => frontRef.current?.focus(), 60);
  };

  const side = (which: "front" | "back") => {
    const value = which === "front" ? draft.front : draft.back;
    const image = which === "front" ? draft.frontImage : draft.backImage;
    const ref = which === "front" ? frontRef : backRef;
    return (
      <div className="flex h-full flex-col gap-3 rounded-[26px] border border-black/[0.07] bg-white p-6">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b3aa9c]">
            {which === "front" ? "Front — question" : "Back — answer"}
          </span>
          <span className="text-[11px] font-semibold text-[#b3aa9c]">
            {value.length} / {CARD_LIMIT}
          </span>
        </div>

        <textarea
          ref={ref}
          value={value}
          maxLength={CARD_LIMIT}
          onChange={(e) =>
            set(which === "front" ? { front: e.target.value } : { back: e.target.value })
          }
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.shiftKey) return;
            e.preventDefault();
            if (which === "front") setFlipped(true);
            else save();
          }}
          placeholder={which === "front" ? "Type the question, then press Enter" : "Type the answer, then press Enter to save"}
          className={`min-h-[9rem] flex-1 resize-none rounded-2xl bg-[#fbf5e9] px-4 py-3 outline-none placeholder:text-[15px] placeholder:font-semibold placeholder:text-[#c3bbad] ${scaleText(value)}`}
        />

        {image && (
          <div className="relative w-fit">
            <img src={image} alt="" className="h-20 w-auto rounded-xl object-cover" />
            <button
              type="button"
              onClick={() => set(which === "front" ? { frontImage: undefined } : { backImage: undefined })}
              className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full border border-black/10 bg-white"
              aria-label="Remove image"
            >
              <X size={13} />
            </button>
          </div>
        )}

        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-full border border-black/10 bg-white px-3.5 py-2 text-[12.5px] font-bold text-[#7a4b16]">
          <ImagePlus size={15} />
          {image ? "Replace image" : "Add image"}
          <input type="file" accept="image/*" className="hidden" onChange={pickImage(which)} />
        </label>
      </div>
    );
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b3aa9c]">
            {editing ? "Editing card" : "Fast creator"}
          </p>
          <h2 className="truncate text-[20px] font-black">{topicLabel}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-[13px] font-bold"
          >
            <RotateCcw size={15} /> Flip
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setDraft(EMPTY);
                setFlipped(false);
                onCancelEdit?.();
              }}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-[13px] font-bold"
            >
              Cancel
            </button>
          )}
          <button type="button" onClick={save} className="rita-pill flex items-center gap-2 rounded-full px-5 py-2 text-[13px] font-extrabold">
            <Save size={15} /> {editing ? "Save changes" : "Save card"}
          </button>
        </div>
      </div>

      <div style={{ perspective: "1200px" }}>
        <div
          className="relative min-h-[19rem] transition-transform duration-500"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
            {side("front")}
          </div>
          <div
            className="absolute inset-0"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            {side("back")}
          </div>
        </div>
      </div>

      <p className="text-[12.5px] font-semibold text-[#a29a8d]">
        Enter flips to the back, Enter again saves and clears for the next card. Shift + Enter adds a new line.
      </p>
    </div>
  );
}
