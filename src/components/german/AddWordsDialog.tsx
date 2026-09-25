import { useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import {
  ARTICLES,
  fullGerman,
  itemKey,
  parseBulk,
  parseLine,
  playsIn,
  type Article,
  type ParsedLine,
} from "@/lib/de-lab";

const LABS = [
  { mode: "articles" as const, label: "der/die/das", color: "#2f6fd0" },
  { mode: "speaking" as const, label: "speak", color: "#d98d3a" },
  { mode: "build" as const, label: "build", color: "#2f9e63" },
];

/**
 * One add box for the whole German shelf. Whatever you add here is saved once
 * and every lab picks up whatever it can play — the preview shows which.
 */
export function AddWordsDialog({
  accent,
  name,
  busy,
  existingKeys = [],
  onClose,
  onSave,
}: {
  accent: string;
  name: string;
  busy: boolean;
  /** Keys of items already saved in this sub-subject, so we can flag duplicates. */
  existingKeys?: string[];
  onClose: () => void;
  onSave: (items: ParsedLine[]) => Promise<void>;
}) {
  const [tab, setTab] = useState<"one" | "list">("one");

  // guided fields
  const [german, setGerman] = useState("");
  const [english, setEnglish] = useState("");
  const [plural, setPlural] = useState("");
  const [article, setArticle] = useState<Article | null>(null);
  const [queue, setQueue] = useState<ParsedLine[]>([]);

  // bulk field
  const [text, setText] = useState("");
  const parsed = useMemo(() => parseBulk(text), [text]);

  const raw = tab === "one" ? queue : parsed;
  const already = useMemo(() => new Set(existingKeys), [existingKeys]);
  const duplicates = raw.filter((p) => already.has(itemKey(p)));
  const items = raw.filter((p) => !already.has(itemKey(p)));

  const canQueue = german.trim().length > 0;

  const addToQueue = () => {
    if (!canQueue) return;
    const base = parseLine(`${article ? `${article} ` : ""}${german.trim()}`) ?? {
      kind: "word" as const,
      german: german.trim(),
      article: null,
      plural: null,
      english: null,
    };
    setQueue((q) => [
      ...q,
      { ...base, plural: plural.trim() || base.plural, english: english.trim() || null },
    ]);
    setGerman("");
    setEnglish("");
    setPlural("");
    setArticle(null);
  };

  const placeholder =
    "die Bank, die Banken = bench\ndas Haus, die Häuser = house\nIch hätte gern einen Kaffee. = I would like a coffee.";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-[20px] font-black text-[#23201d]">Add to “{name}”</h3>
        <p className="mt-1 text-[13px] font-bold text-[#8a8175]">
          Saved once — every German lab uses whatever it can play.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-1.5 rounded-2xl bg-[#faf6ee] p-1">
          {(["one", "list"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="h-9 rounded-xl text-[13px] font-extrabold transition"
              style={tab === t ? { background: "#fff", color: "#23201d" } : { color: "#a29a8d" }}
            >
              {t === "one" ? "One at a time" : "Paste a list"}
            </button>
          ))}
        </div>

        {tab === "one" ? (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {ARTICLES.map((a) => (
                <button
                  key={a}
                  onClick={() => setArticle(article === a ? null : a)}
                  className="h-11 rounded-2xl border-2 text-[15px] font-black transition"
                  style={
                    article === a
                      ? { borderColor: accent, background: accent, color: "#fff" }
                      : { borderColor: "#e5ded2", color: "#6b645b" }
                  }
                >
                  {a}
                </button>
              ))}
            </div>
            <p className="text-[12px] font-bold text-[#a89e90]">
              Pick an article for nouns — that's what unlocks the der/die/das lab. Sentences don't need one.
            </p>
            <Field
              label="German word or sentence"
              value={german}
              onChange={setGerman}
              placeholder="Bank"
              autoFocus
            />
            <Field label="English meaning (optional)" value={english} onChange={setEnglish} placeholder="bench" />
            <Field label="Plural (optional)" value={plural} onChange={setPlural} placeholder="die Banken" />
            <button
              disabled={!canQueue}
              onClick={addToQueue}
              className="h-11 w-full rounded-2xl text-[14px] font-extrabold text-white transition disabled:opacity-40"
              style={{ background: accent }}
            >
              Add another
            </button>
            {queue.length > 0 && (
              <div className="rounded-2xl bg-[#faf6ee] p-3">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a89e90]">
                  Ready to save
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {queue.map((p, i) => (
                    <button
                      key={`${p.german}-${i}`}
                      onClick={() => setQueue((q) => q.filter((_, j) => j !== i))}
                      className="rounded-full bg-white px-2.5 py-1 text-[12px] font-extrabold text-[#5a4a2e] hover:bg-[#f1e7d6]"
                    >
                      {fullGerman(p)} ✕
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <p className="mt-3 text-[13px] text-[#6b645b]">
              One per line. Use <b>=</b> for the English meaning, and a comma for the plural. Nouns keep
              their article, sentences work as they are.
            </p>
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={placeholder}
              className="mt-3 w-full resize-none rounded-2xl border border-black/10 bg-[#fbf8f2] p-4 font-mono text-[14px] leading-relaxed text-[#23201d] outline-none focus:border-black/25"
            />
          </>
        )}

        {raw.length > 0 && (
          <div className="mt-4 max-h-56 space-y-1.5 overflow-y-auto rounded-2xl bg-[#faf6ee] p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a89e90]">
              What each lab will get
            </p>
            {raw.map((p, i) => {
              const dup = already.has(itemKey(p));
              return (
                <div
                  key={`${p.german}-${i}`}
                  className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2"
                >
                  <span
                    className={`min-w-0 flex-1 truncate text-[13.5px] font-extrabold ${
                      dup ? "text-[#b0a696] line-through" : "text-[#23201d]"
                    }`}
                  >
                    {fullGerman(p)}
                    {p.english && <span className="font-bold text-[#a89e90]"> — {p.english}</span>}
                  </span>
                  {dup ? (
                    <span className="rounded-full bg-[#f3ece0] px-2 py-0.5 text-[10.5px] font-black uppercase tracking-wider text-[#8a8175]">
                      already there
                    </span>
                  ) : (
                    LABS.map((l) => {
                      const ok = playsIn(p, l.mode);
                      return (
                        <span
                          key={l.mode}
                          className="rounded-full px-2 py-0.5 text-[10.5px] font-black uppercase tracking-wider"
                          style={
                            ok
                              ? { background: `${l.color}22`, color: l.color }
                              : { background: "#f3ece0", color: "#c0b7a8" }
                          }
                        >
                          {l.label}
                        </span>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 text-[13px] font-bold text-[#6b645b]">
          <Sparkles size={14} style={{ color: accent }} />
          {items.length} ready
          {duplicates.length > 0 && (
            <span className="text-[#a89e90]"> · {duplicates.length} already on the shelf</span>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full px-5 py-2.5 text-[14px] font-extrabold text-[#6b645b]">
            Cancel
          </button>
          <button
            disabled={!items.length || busy}
            onClick={() => void onSave(items)}
            className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[14px] font-extrabold text-white transition disabled:opacity-40"
            style={{ background: accent }}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Save {items.length || ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a89e90]">{label}</span>
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 h-11 w-full rounded-2xl border border-black/10 bg-[#fbf8f2] px-4 text-[15px] font-semibold text-[#23201d] outline-none focus:border-black/25"
      />
    </label>
  );
}
