import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Search } from "lucide-react";
import { adminGiphySearch } from "@/lib/film-clips.functions";
import type { GiphyResult } from "@/lib/film-clips";

/**
 * Searches GIPHY from our server (the key never reaches the browser) and picks one GIF. The GIF
 * is shown from GIPHY's own hosts, with GIPHY's attribution.
 */
export function GiphyPicker({
  picked,
  onPick,
}: {
  picked: GiphyResult | null;
  onPick: (gif: GiphyResult) => void;
}) {
  const searchFn = useServerFn(adminGiphySearch);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GiphyResult[]>([]);
  const [total, setTotal] = useState(0);
  const [searched, setSearched] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState(true);

  async function search(offset: number) {
    const q = offset ? searched : query.trim();
    if (!q) return;
    setBusy(true);
    setError("");
    try {
      const reply = await searchFn({ data: { q, offset } });
      setConfigured(reply.configured);
      setTotal(reply.total);
      setSearched(q);
      setResults((current) => (offset ? [...current, ...reply.results] : reply.results));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "البحث ما زبط.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void search(0);
        }}
      >
        <input
          type="search"
          dir="ltr"
          lang="en"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="hello, thank you, I'm tired…"
          aria-label="ابحث عن GIF بالإنجليزي"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--pp-line)] px-3"
        />
        <button
          type="submit"
          className="rita-btn rita-btn-primary gap-1.5"
          disabled={busy || !query.trim()}
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <Search size={16} aria-hidden="true" />
          )}
          ابحث
        </button>
      </form>
      <p className="text-[12px] font-bold tracking-wide text-[var(--pp-muted)]" dir="ltr">
        Powered by GIPHY
      </p>

      {!configured && (
        <div className="rounded-xl bg-[#fff6e5] p-3 text-[14px] leading-6 text-[#6b4100]">
          <p className="font-semibold">البحث بـ GIPHY بدّه مفتاح.</p>
          <p>
            اعمل مفتاح API من developers.giphy.com، وحطّه بأسرار الموقع باسم{" "}
            <code dir="ltr">GIPHY_API_KEY</code>. رفع الفيديو شغّال بدونه.
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-[14px] text-[#8c1a31]">
          {error}
        </p>
      )}

      {results.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {results.map((gif) => {
            const chosen = picked?.id === gif.id;
            return (
              <li key={gif.id} className="min-w-0">
                <button
                  type="button"
                  aria-pressed={chosen}
                  aria-label={gif.title || "GIF"}
                  onClick={() => onPick(gif)}
                  className={`relative block aspect-video w-full overflow-hidden rounded-xl bg-[#f1f3f5] outline-offset-2 ${chosen ? "outline outline-[3px] outline-[var(--pp-ink)]" : ""}`}
                >
                  {chosen ? (
                    <video
                      src={gif.preview}
                      poster={gif.still}
                      muted
                      loop
                      autoPlay
                      playsInline
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <img
                      src={gif.still}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  )}
                  {chosen && (
                    <span className="absolute end-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-[var(--pp-ink)] text-white">
                      <Check size={16} aria-hidden="true" />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {searched && !busy && results.length === 0 && configured && !error && (
        <p role="status" className="text-[14px] text-[var(--pp-muted)]">
          ما لقينا GIF. جرّب كلمة ثانية بالإنجليزي.
        </p>
      )}
      {results.length > 0 && results.length < total && (
        <button
          type="button"
          className="rita-btn rita-btn-soft justify-self-start"
          disabled={busy}
          onClick={() => void search(results.length)}
        >
          المزيد
        </button>
      )}
    </div>
  );
}
