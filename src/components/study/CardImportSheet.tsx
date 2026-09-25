import { useCallback, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  FileText,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Trash2,
  Type,
  Upload,
  X,
} from "lucide-react";
import { generateCards, type DraftCard } from "@/lib/card-import.functions";

type Source = "pdf" | "text" | "image";
type Step = "source" | "shape" | "review";

const SOURCES: { key: Source; title: string; blurb: string; icon: React.ReactNode; tone: string }[] = [
  {
    key: "pdf",
    title: "A PDF",
    blurb: "Lecture slides, a chapter, a handout.",
    icon: <FileText size={20} />,
    tone: "#fdeed6",
  },
  {
    key: "text",
    title: "Pasted text",
    blurb: "Your notes, a transcript, anything written.",
    icon: <Type size={20} />,
    tone: "#e2eff9",
  },
  {
    key: "image",
    title: "Photos",
    blurb: "Snap a slide or a page of handwriting.",
    icon: <ImageIcon size={20} />,
    tone: "#eee8f8",
  },
];

const STYLES: { key: "qa" | "term" | "cloze"; title: string; blurb: string }[] = [
  { key: "qa", title: "Question → answer", blurb: "Exam-style recall." },
  { key: "term", title: "Term → definition", blurb: "Vocabulary and concepts." },
  { key: "cloze", title: "Fill the gap", blurb: "One missing phrase per card." },
];

const COUNTS = [10, 20, 40] as const;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });
}

/**
 * "Make cards from material" — pick a source, shape the deck, then edit the
 * drafts before a single card lands in the subject.
 */
export function CardImportSheet({
  open,
  topicLabel,
  onClose,
  onAdd,
}: {
  open: boolean;
  topicLabel: string;
  onClose: () => void;
  onAdd: (cards: DraftCard[]) => void;
}) {
  const run = useServerFn(generateCards);
  const pdfInput = useRef<HTMLInputElement>(null);
  const imgInput = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("source");
  const [source, setSource] = useState<Source>("pdf");
  const [pdf, setPdf] = useState<File | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [startPage, setStartPage] = useState("");
  const [endPage, setEndPage] = useState("");
  const [count, setCount] = useState<number>(20);
  const [style, setStyle] = useState<"qa" | "term" | "cloze">("qa");
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<DraftCard[]>([]);

  const reset = useCallback(() => {
    setStep("source");
    setPdf(null);
    setImages([]);
    setText("");
    setStartPage("");
    setEndPage("");
    setDrafts([]);
  }, []);

  const close = () => {
    reset();
    onClose();
  };

  const ready = useMemo(() => {
    if (source === "pdf") return !!pdf;
    if (source === "image") return images.length > 0;
    return text.trim().length >= 40;
  }, [source, pdf, images, text]);

  const generate = async () => {
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        source,
        count,
        style,
        topic: topicLabel,
      };
      if (source === "pdf" && pdf) {
        if (pdf.size > 18_000_000) throw new Error("That PDF is too big — try a page range export.");
        payload.pdfBase64 = await fileToBase64(pdf);
        if (startPage) payload.startPage = Number(startPage);
        if (endPage) payload.endPage = Number(endPage);
      } else if (source === "image") {
        payload.images = await Promise.all(
          images.map(async (f) => ({ mime: f.type || "image/jpeg", data: await fileToBase64(f) })),
        );
      } else {
        payload.text = text;
      }
      const result = await run({ data: payload as never });
      setDrafts(result.cards);
      setStep("review");
      toast.success(result.note);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That did not work — try again.");
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const keep = drafts.filter((c) => c.front.trim() && c.back.trim());
    if (keep.length === 0) {
      toast.info("Nothing left to add.");
      return;
    }
    onAdd(keep);
    toast.success(`${keep.length} card${keep.length === 1 ? "" : "s"} added to ${topicLabel}`);
    close();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#fbf5e9]">
      <header className="flex items-center justify-between gap-3 border-b border-black/[0.06] px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          {step !== "source" && (
            <button
              type="button"
              onClick={() => setStep(step === "review" ? "shape" : "source")}
              className="grid h-9 w-9 place-items-center rounded-full border border-black/10 bg-white text-[#6d6355]"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#a79c8c]">
              make cards from material
            </p>
            <p className="truncate text-[15px] font-black text-[#23201d]">{topicLabel}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          className="grid h-9 w-9 place-items-center rounded-full border border-black/10 bg-white text-[#6d6355]"
        >
          <X size={17} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
        <div className="mx-auto w-full max-w-3xl">
          {/* ---------------------------- step 1 ---------------------------- */}
          {step === "source" && (
            <>
              <h2 className="font-display text-[1.9rem] font-black leading-tight text-[#23201d]">
                What are we turning into cards?
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {SOURCES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSource(s.key)}
                    className="rounded-[22px] border bg-white p-4 text-left transition-transform active:scale-[0.98]"
                    style={{
                      borderColor: source === s.key ? "var(--rita-green)" : "rgba(0,0,0,0.07)",
                      boxShadow: source === s.key ? "0 0 0 2px var(--rita-green)" : "none",
                    }}
                  >
                    <span
                      className="grid h-10 w-10 place-items-center rounded-xl text-[#3a352e]"
                      style={{ background: s.tone }}
                    >
                      {s.icon}
                    </span>
                    <p className="mt-3 text-[15px] font-black text-[#23201d]">{s.title}</p>
                    <p className="mt-0.5 text-[12.5px] font-semibold text-[#8c8375]">{s.blurb}</p>
                  </button>
                ))}
              </div>

              <div className="mt-6 rounded-[24px] border border-black/[0.06] bg-white p-5">
                {source === "pdf" && (
                  <>
                    <input
                      ref={pdfInput}
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
                    />
                    <button
                      type="button"
                      onClick={() => pdfInput.current?.click()}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-black/[0.12] py-10 text-[14px] font-extrabold text-[#6d6355]"
                    >
                      <Upload size={17} />
                      {pdf ? pdf.name : "Choose a PDF"}
                    </button>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <span className="text-[12.5px] font-bold text-[#8c8375]">Pages</span>
                      <input
                        value={startPage}
                        onChange={(e) => setStartPage(e.target.value.replace(/\D/g, ""))}
                        placeholder="from"
                        inputMode="numeric"
                        className="h-10 w-24 rounded-xl border border-black/10 px-3 text-[14px] font-bold outline-none"
                      />
                      <span className="text-[#b3aa9c]">—</span>
                      <input
                        value={endPage}
                        onChange={(e) => setEndPage(e.target.value.replace(/\D/g, ""))}
                        placeholder="to"
                        inputMode="numeric"
                        className="h-10 w-24 rounded-xl border border-black/10 px-3 text-[14px] font-bold outline-none"
                      />
                      <span className="text-[12px] font-semibold text-[#b3aa9c]">
                        leave empty for the whole file
                      </span>
                    </div>
                  </>
                )}

                {source === "image" && (
                  <>
                    <input
                      ref={imgInput}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => setImages(Array.from(e.target.files ?? []).slice(0, 8))}
                    />
                    <button
                      type="button"
                      onClick={() => imgInput.current?.click()}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-black/[0.12] py-10 text-[14px] font-extrabold text-[#6d6355]"
                    >
                      <Upload size={17} />
                      {images.length ? `${images.length} photo(s) chosen` : "Choose up to 8 photos"}
                    </button>
                    {images.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {images.map((f) => (
                          <span
                            key={f.name}
                            className="max-w-[14rem] truncate rounded-full bg-[#f4eddf] px-3 py-1.5 text-[12px] font-bold text-[#6d6355]"
                          >
                            {f.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {source === "text" && (
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={10}
                    placeholder="Paste your notes here…"
                    className="w-full resize-y rounded-2xl border border-black/10 p-4 text-[14.5px] font-medium leading-relaxed outline-none"
                  />
                )}
              </div>

              <button
                type="button"
                disabled={!ready}
                onClick={() => setStep("shape")}
                className="mt-6 h-12 w-full rounded-full bg-[var(--rita-green)] text-[15.5px] font-semibold text-[color:var(--rita-green-ink)] disabled:opacity-40"
              >
                Next — shape the deck
              </button>
            </>
          )}

          {/* ---------------------------- step 2 ---------------------------- */}
          {step === "shape" && (
            <>
              <h2 className="font-display text-[1.9rem] font-black leading-tight text-[#23201d]">
                How should the cards read?
              </h2>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {STYLES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setStyle(s.key)}
                    className="rounded-[22px] border bg-white p-4 text-left"
                    style={{
                      borderColor: style === s.key ? "var(--rita-green)" : "rgba(0,0,0,0.07)",
                      boxShadow: style === s.key ? "0 0 0 2px var(--rita-green)" : "none",
                    }}
                  >
                    <p className="text-[15px] font-black text-[#23201d]">{s.title}</p>
                    <p className="mt-0.5 text-[12.5px] font-semibold text-[#8c8375]">{s.blurb}</p>
                  </button>
                ))}
              </div>

              <p className="mt-7 text-[11px] font-black uppercase tracking-[0.18em] text-[#a79c8c]">
                how many
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {COUNTS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCount(c)}
                    className="h-11 rounded-full border px-6 text-[14px] font-extrabold"
                    style={
                      count === c
                        ? {
                            background: "var(--rita-green)",
                            borderColor: "var(--rita-green)",
                            color: "var(--rita-green-ink)",
                          }
                        : { background: "#fff", borderColor: "rgba(0,0,0,0.1)", color: "#6d6355" }
                    }
                  >
                    up to {c}
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => void generate()}
                className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--rita-green)] text-[15.5px] font-semibold text-[color:var(--rita-green-ink)] disabled:opacity-60"
              >
                {busy ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
                {busy ? "Reading your material…" : "Draft the cards"}
              </button>
              <p className="mt-3 text-center text-[12.5px] font-semibold text-[#a79c8c]">
                Nothing is saved until you approve the drafts.
              </p>
            </>
          )}

          {/* ---------------------------- step 3 ---------------------------- */}
          {step === "review" && (
            <>
              <h2 className="font-display text-[1.9rem] font-black leading-tight text-[#23201d]">
                {drafts.length} draft{drafts.length === 1 ? "" : "s"} — keep what is good
              </h2>
              <p className="mt-1 text-[14px] font-semibold text-[#8c8375]">
                Edit any wording straight in place, bin the rest.
              </p>

              <div className="mt-5 grid gap-3">
                {drafts.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-[22px] border border-black/[0.06] bg-white p-4 sm:grid sm:grid-cols-[1fr_1fr_auto] sm:gap-3"
                  >
                    <textarea
                      value={c.front}
                      rows={2}
                      onChange={(e) =>
                        setDrafts((d) =>
                          d.map((x, j) => (j === i ? { ...x, front: e.target.value } : x)),
                        )
                      }
                      className="w-full resize-y rounded-xl bg-[#faf6ee] p-3 text-[14px] font-extrabold text-[#23201d] outline-none"
                    />
                    <textarea
                      value={c.back}
                      rows={2}
                      onChange={(e) =>
                        setDrafts((d) =>
                          d.map((x, j) => (j === i ? { ...x, back: e.target.value } : x)),
                        )
                      }
                      className="mt-2 w-full resize-y rounded-xl bg-[#f4f7f2] p-3 text-[14px] font-semibold text-[#3a352e] outline-none sm:mt-0"
                    />
                    <button
                      type="button"
                      onClick={() => setDrafts((d) => d.filter((_, j) => j !== i))}
                      className="mt-2 grid h-10 w-10 place-items-center rounded-xl border border-black/10 text-[#a15b47] sm:mt-0 sm:self-center"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={save}
                className="sticky bottom-0 mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--rita-green)] text-[15.5px] font-semibold text-[color:var(--rita-green-ink)]"
              >
                <Check size={17} />
                Add {drafts.length} card{drafts.length === 1 ? "" : "s"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
