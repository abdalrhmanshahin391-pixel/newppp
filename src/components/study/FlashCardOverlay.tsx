import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ImagePlus,
  Pencil,
  RotateCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Lock } from "lucide-react";
import { usePlan } from "@/hooks/usePlan";
import { useAuth } from "@/hooks/useAuth";
import { recordFlashcards } from "@/lib/plans.functions";
import {
  CARD_LIMIT,
  HIGHLIGHT_COLORS,
  TEXT_COLORS,
  scaleText,
  styleToCss,
  useCreatorMode,
  type CardStyle,
  type FlashCardItem,
} from "@/lib/use-flashcards";

type Draft = {
  front: string;
  back: string;
  frontImage?: string;
  backImage?: string;
  frontStyle?: CardStyle;
  backStyle?: CardStyle;
};
const EMPTY: Draft = { front: "", back: "" };

export type FlashCardOverlayProps = {
  open: boolean;
  mode: "create" | "gallery";
  topicLabel: string;
  cards: FlashCardItem[];
  onAdd: (
    front: string,
    back: string,
    frontImage?: string,
    backImage?: string,
    frontStyle?: CardStyle,
    backStyle?: CardStyle,
  ) => void;
  onUpdate: (id: string, patch: Partial<Omit<FlashCardItem, "id">>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

/** Full-screen white flashcard workspace: fast create loop + card gallery. */
export function FlashCardOverlay({
  open,
  mode,
  topicLabel,
  cards,
  onAdd,
  onUpdate,
  onDelete,
  onClose,
}: FlashCardOverlayProps) {
  const [view, setView] = useState<"create" | "gallery">(mode);
  const [creator, setCreator] = useCreatorMode();
  const plan = usePlan();
  const { user } = useAuth();
  const countCard = useServerFn(recordFlashcards);
  const effectiveCreator = plan.richCards ? creator : "simple";
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [flipped, setFlipped] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [added, setAdded] = useState(0);
  const [query, setQuery] = useState("");
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});
  const frontRef = useRef<HTMLTextAreaElement>(null);
  const backRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setView(mode);
    setDraft(EMPTY);
    setFlipped(false);
    setEditingId(null);
    setAdded(0);
    setQuery("");
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || view !== "create") return;
    const t = window.setTimeout(
      () => (flipped ? backRef : frontRef).current?.focus(),
      flipped ? 320 : 40,
    );
    return () => window.clearTimeout(t);
  }, [flipped, open, view]);

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

  const save = useCallback(async () => {
    const front = draft.front.trim();
    const back = draft.back.trim();
    if (!front || !back) {
      toast.info("Fill in both sides first");
      return;
    }
    if (editingId) {
      onUpdate(editingId, {
        front,
        back,
        frontImage: draft.frontImage,
        backImage: draft.backImage,
        frontStyle: draft.frontStyle,
        backStyle: draft.backStyle,
      });
      toast.success("Card updated");
      setEditingId(null);
    } else {
      if (user) {
        try {
          await countCard({ data: { count: 1 } });
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Card limit reached on your plan");
          return;
        }
      }
      onAdd(front, back, draft.frontImage, draft.backImage, draft.frontStyle, draft.backStyle);
      setAdded((n) => n + 1);
      toast.success("Card saved — next one is ready");
    }
    setDraft(EMPTY);
    setFlipped(false);
    window.setTimeout(() => frontRef.current?.focus(), 60);
  }, [draft, editingId, onAdd, onUpdate, user, countCard]);

  const startEdit = (card: FlashCardItem) => {
    setEditingId(card.id);
    setDraft({
      front: card.front,
      back: card.back,
      frontImage: card.frontImage,
      backImage: card.backImage,
      frontStyle: card.frontStyle,
      backStyle: card.backStyle,
    });
    setFlipped(false);
    setView("create");
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(
      (c) => c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q),
    );
  }, [cards, query]);

  if (!open) return null;

  const setStyle = (which: "front" | "back", patch: Partial<CardStyle>) =>
    setDraft((d) => {
      const current = (which === "front" ? d.frontStyle : d.backStyle) ?? {};
      const next = { ...current, ...patch };
      return which === "front" ? { ...d, frontStyle: next } : { ...d, backStyle: next };
    });

  const side = (which: "front" | "back") => {
    const value = which === "front" ? draft.front : draft.back;
    const image = which === "front" ? draft.frontImage : draft.backImage;
    const ref = which === "front" ? frontRef : backRef;
    const st = (which === "front" ? draft.frontStyle : draft.backStyle) ?? {};
    const rich = effectiveCreator === "rich";
    return (
      <div className="grid h-full grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-3 overflow-hidden rounded-[30px] border border-black/[0.07] bg-white p-5 shadow-[0_24px_60px_-40px_rgba(35,32,29,0.5)] md:p-6">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#c0b7a8]">
            {which === "front" ? "Front — question" : "Back — answer"}
          </span>
          <span className="text-[11px] font-bold text-[#c0b7a8]">
            {value.length} / {CARD_LIMIT}
          </span>
        </div>

        {rich ? (
          <RichBar style={st} onChange={(patch) => setStyle(which, patch)} />
        ) : (
          <span />
        )}

        <div className="flex min-h-0 flex-col gap-3">
          {image && (
            <div className="flex max-h-[42%] shrink-0 flex-col items-center gap-2">
              <div className="grid min-h-0 w-full flex-1 place-items-center overflow-hidden rounded-2xl bg-[#fbf5e9]">
                <img src={image} alt="" className="max-h-full max-w-full object-contain" />
              </div>
              <button
                type="button"
                onClick={() =>
                  set(which === "front" ? { frontImage: undefined } : { backImage: undefined })
                }
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-[12px] font-bold text-[#7d3421]"
              >
                <X size={12} /> Remove image
              </button>
            </div>
          )}

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
              else void save();
            }}
            placeholder={
              which === "front"
                ? "Type the question, then press Enter"
                : "Type the answer, then press Enter to save"
            }
            className={`min-h-0 flex-1 resize-none overflow-y-auto rounded-2xl bg-white px-3 py-2 outline-none placeholder:text-[16px] placeholder:font-semibold placeholder:text-[#cfc7b9] ${
              rich ? "" : `text-center ${scaleText(value)}`
            }`}
            style={
              rich ? { textAlign: st.align ?? "center", ...styleToCss(st) } : undefined
            }
          />
        </div>

        <div className="flex items-center justify-center">
          <label className="flex cursor-pointer items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-[13px] font-bold text-[#5c554b] hover:bg-[#fbf5e9]">
            <ImagePlus size={15} />
            {image ? "Replace image" : "Add image"}
            <input type="file" accept="image/*" className="hidden" onChange={pickImage(which)} />
          </label>
        </div>
      </div>
    );
  };


  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#23201d]/55 p-4 backdrop-blur-sm md:p-8">
      <div className="w-full max-w-5xl rounded-[34px] bg-white p-5 md:p-8">
        {/* header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#c0b7a8]">
              {view === "create" ? (editingId ? "Editing card" : "Fast creator") : "Card gallery"}
            </p>
            <h2 className="truncate text-[22px] font-black">{topicLabel}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {view === "create" && (
              <div className="flex rounded-full bg-[#fbf5e9] p-1">
                {(["simple", "rich"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      if (m === "rich" && !plan.richCards) {
                        toast.info("The rich card designer is part of the paid plans.");
                        return;
                      }
                      setCreator(m);
                    }}
                    className={`rounded-full px-5 py-2 text-[13px] font-black transition-all ${
                      creator === m
                        ? "bg-white text-[#23201d] shadow-[0_6px_16px_-10px_rgba(35,32,29,0.6)]"
                        : "text-[#a29a8d]"
                    }`}
                  >
                    {m === "rich" && !plan.richCards ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Lock size={12} /> Rich
                      </span>
                    ) : m === "simple" ? (
                      "Simple"
                    ) : (
                      "Rich"
                    )}
                  </button>
                ))}
              </div>
            )}
            <div className="flex rounded-full border border-black/10 p-1">
              {(["create", "gallery"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`rounded-full px-4 py-1.5 text-[13px] font-extrabold ${
                    view === v ? "bg-[#23201d] text-white" : "text-[#7a736a]"
                  }`}
                >
                  {v === "create" ? "Create" : `Cards (${cards.length})`}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-[13px] font-extrabold hover:bg-[#fbf5e9]"
            >
              <X size={15} /> Done
            </button>
          </div>
        </div>

        {view === "create" ? (
          <>
            <div className="mt-5" style={{ perspective: "1400px" }}>
              <div
                className="relative h-[26rem] transition-transform duration-500 md:h-[30rem]"
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

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[12.5px] font-semibold text-[#a29a8d]">
                Enter flips · Enter again saves and opens a fresh card · Shift + Enter for a new line
                · Esc closes
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFlipped((f) => !f)}
                  className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-[13.5px] font-extrabold hover:bg-[#fbf5e9]"
                >
                  <RotateCw size={15} /> Flip
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setDraft(EMPTY);
                      setFlipped(false);
                    }}
                    className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-[13.5px] font-extrabold"
                  >
                    Cancel edit
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void save()}
                  className="rita-pill flex items-center gap-2 rounded-full px-6 py-2.5 text-[13.5px] font-black"
                >
                  <Check size={16} /> {editingId ? "Save changes" : "Save card"}
                </button>
              </div>
            </div>

            <div className="mt-5 border-t border-black/[0.06] pt-4">
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#c0b7a8]">
                {added} added this session · {cards.length} cards in this topic
              </p>
              {cards.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {cards
                    .slice()
                    .reverse()
                    .slice(0, 14)
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => startEdit(c)}
                        title="Click to edit"
                        className="h-16 w-40 shrink-0 overflow-hidden rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-left text-[12px] font-bold leading-snug text-[#5c554b] hover:bg-[#fbf5e9]"
                      >
                        {c.front}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="mt-5">
            <div className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5">
              <Search size={16} className="text-[#c0b7a8]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your cards"
                className="w-full bg-transparent text-[14px] font-semibold outline-none placeholder:text-[#c0b7a8]"
              />
            </div>

            {filtered.length === 0 ? (
              <p className="py-16 text-center text-[14px] font-bold text-[#a29a8d]">
                No cards here yet — switch to Create and add your first one.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((c) => {
                  const isFlipped = !!flippedCards[c.id];
                  return (
                    <div
                      key={c.id}
                      className="flex min-h-[9.5rem] flex-col justify-between rounded-2xl border border-black/[0.07] bg-white p-4"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setFlippedCards((s) => ({ ...s, [c.id]: !isFlipped }))
                        }
                        className="flex-1 text-left"
                      >
                        <span className="block text-[10.5px] font-black uppercase tracking-[0.2em] text-[#c0b7a8]">
                          {isFlipped ? "Back" : "Front"}
                        </span>
                        {(isFlipped ? c.backImage : c.frontImage) && (
                          <img
                            src={isFlipped ? c.backImage : c.frontImage}
                            alt=""
                            className="mt-2 max-h-40 w-full rounded-xl object-contain"
                          />
                        )}
                        <span
                          className="mt-1.5 block text-[14.5px] font-bold leading-snug text-[#23201d]"
                          style={styleToCss(isFlipped ? c.backStyle : c.frontStyle)}
                        >
                          {isFlipped ? c.back : c.front}
                        </span>
                      </button>
                      <div className="mt-3 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setFlippedCards((s) => ({ ...s, [c.id]: !isFlipped }))}
                          className="grid h-8 w-8 place-items-center rounded-lg text-[#a29a8d] hover:bg-black/[0.05]"
                          aria-label="Flip card"
                        >
                          <RotateCw size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(c)}
                          className="grid h-8 w-8 place-items-center rounded-lg text-[#a29a8d] hover:bg-black/[0.05]"
                          aria-label="Edit card"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onDelete(c.id);
                            toast.success("Card deleted");
                          }}
                          className="grid h-8 w-8 place-items-center rounded-lg text-[#a29a8d] hover:bg-black/[0.05]"
                          aria-label="Delete card"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RichBar({
  style,
  onChange,
}: {
  style: CardStyle;
  onChange: (patch: Partial<CardStyle>) => void;
}) {
  const btn = (active: boolean) =>
    `grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[13px] font-black transition-colors ${
      active ? "bg-[#23201d] text-white" : "bg-[#fbf5e9] text-[#5c554b] hover:bg-[#f2e9d8]"
    }`;
  return (
    <div className="flex shrink-0 flex-nowrap items-center gap-1.5 overflow-x-auto rounded-2xl border border-black/[0.06] bg-[#fffdf8] p-1.5 [scrollbar-width:thin]">

      <button type="button" className={btn(!!style.bold)} onClick={() => onChange({ bold: !style.bold })} aria-label="Bold">
        B
      </button>
      <button
        type="button"
        className={`${btn(!!style.italic)} italic`}
        onClick={() => onChange({ italic: !style.italic })}
        aria-label="Italic"
      >
        I
      </button>
      <button
        type="button"
        className={`${btn(!!style.underline)} underline`}
        onClick={() => onChange({ underline: !style.underline })}
        aria-label="Underline"
      >
        U
      </button>

      <span className="mx-1 h-6 w-px shrink-0 bg-black/10" />

      {(["s", "m", "l", "xl"] as const).map((sz) => (
        <button
          key={sz}
          type="button"
          className={btn((style.size ?? "m") === sz)}
          onClick={() => onChange({ size: sz })}
          aria-label={`Text size ${sz}`}
        >
          {sz.toUpperCase()}
        </button>
      ))}

      <span className="mx-1 h-6 w-px shrink-0 bg-black/10" />

      {(["left", "center", "right"] as const).map((a) => (
        <button
          key={a}
          type="button"
          className={btn((style.align ?? "center") === a)}
          onClick={() => onChange({ align: a })}
          aria-label={`Align ${a}`}
        >
          {a === "left" ? "\u2190" : a === "center" ? "\u2194" : "\u2192"}
        </button>
      ))}

      <span className="mx-1 h-6 w-px shrink-0 bg-black/10" />

      {TEXT_COLORS.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onChange({ color: c.value })}
          aria-label={`Text colour ${c.key}`}
          className={`h-7 w-7 shrink-0 rounded-full border-2 ${
            (style.color ?? "#23201d") === c.value ? "border-[#23201d]" : "border-transparent"
          }`}
          style={{ background: c.value }}
        />
      ))}

      <span className="mx-1 h-6 w-px shrink-0 bg-black/10" />

      {HIGHLIGHT_COLORS.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onChange({ highlight: c.value })}
          aria-label={`Highlight ${c.key}`}
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${
            (style.highlight ?? "") === c.value ? "border-[#23201d]" : "border-black/10"
          }`}
          style={{ background: c.value || "#ffffff" }}
        >
          {c.value ? "" : <X size={12} className="text-[#a29a8d]" />}
        </button>
      ))}
    </div>
  );
}
