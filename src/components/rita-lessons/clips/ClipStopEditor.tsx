import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, Check, Eye, Loader2, Plus, X } from "lucide-react";
import { adminListClips, type ClipLibrary } from "@/lib/film-clips.functions";
import { adminSaveStopClips } from "@/lib/rita-path-items.functions";
import { clipMatches, MAX_STOP_CLIPS, moveEntry, type FilmClip } from "@/lib/film-clips";
import { useWorkspaceDraft, useWorkspaceGuard, useWorkspaceTask } from "../admin/WorkspaceGuard";
import { FilmPlayer } from "../FilmPractice";
import { ClipText, ClipThumb } from "./ClipBits";

/**
 * The clips of one exercises stop: their order (arrows), removing one, and adding from the
 * library (search in English or Arabic). New clips are made on the clips library page.
 */
export function ClipStopEditor({
  stop,
  library,
  onSaved,
  onClose,
}: {
  stop: { id: string; title: string; clip_ids: string[] };
  /** The library when the caller has it; loaded here otherwise. */
  library?: ClipLibrary;
  onSaved: () => Promise<void> | void;
  onClose: () => void;
}) {
  const listFn = useServerFn(adminListClips);
  const saveFn = useServerFn(adminSaveStopClips);
  const loaded = useQuery({
    queryKey: ["clip-library", "en"],
    queryFn: () => listFn({ data: { language: "en" } }),
    enabled: !library,
    gcTime: 0,
  });
  const data = library ?? loaded.data;
  const [previous] = useState(stop.clip_ids);
  const [ids, setIds] = useState(stop.clip_ids);
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<FilmClip>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const finish = useWorkspaceTask(busy);
  const guard = useWorkspaceGuard();
  useWorkspaceDraft(ids);
  const byId = useMemo(() => new Map((data?.clips ?? []).map((clip) => [clip.id, clip])), [data]);
  const results = useMemo(
    () => (data?.clips ?? []).filter((clip) => clipMatches(clip, query)).slice(0, 60),
    [data, query],
  );
  const changed = previous.join() !== ids.join();

  async function save() {
    setBusy(true);
    setError("");
    try {
      await saveFn({ data: { id: stop.id, previous, clipIds: ids } });
      finish();
      guard?.saved();
      await onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  if (!data)
    return loaded.error ? (
      <p role="alert" className="text-[15px] text-[#8c1a31]">
        {loaded.error instanceof Error ? loaded.error.message : "تعذّر تحميل المكتبة."}
      </p>
    ) : (
      <p role="status" className="flex items-center gap-2 text-[15px]">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" /> جاري تحميل المكتبة…
      </p>
    );
  if (!data.ready)
    return (
      <p className="rounded-xl bg-[#fff6e5] p-3 text-[14px] text-[#6b4100]">
        مكتبة المقاطع بدها تحديث قاعدة البيانات: طبّق migration ‏20261125120000_rita_film_clips بـ
        Lovable Cloud.
      </p>
    );

  return (
    <fieldset
      dir="rtl"
      disabled={busy}
      className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 text-start"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="me-auto text-[17px] font-bold">مقاطع المحطة · {ids.length}</h3>
        <Link to="/admin/clips" className="rita-btn rita-btn-quiet rita-btn-sm">
          مكتبة المقاطع
        </Link>
      </div>

      {ids.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-[var(--pp-line)] p-4 text-center text-[14px] text-[var(--pp-muted)]">
          ما في مقاطع بالمحطة. أضف من تحت.
        </p>
      ) : (
        <ol className="grid gap-2">
          {ids.map((id, index) => {
            const clip = byId.get(id);
            return (
              <li
                key={id}
                className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--pp-line)] bg-white p-2"
              >
                <span className="w-5 text-center text-[13px] tabular-nums text-[var(--pp-muted)]">
                  {index + 1}
                </span>
                {clip ? (
                  <>
                    <ClipThumb clip={clip} className="h-11 w-[76px]" />
                    <ClipText clip={clip} />
                  </>
                ) : (
                  <span className="flex-1 text-[14px] text-[var(--pp-muted)]">مقطع انحذف</span>
                )}
                <span className="ms-auto flex shrink-0 gap-1">
                  <button
                    type="button"
                    className="rita-btn rita-btn-quiet rita-btn-sm !px-2"
                    aria-label="لفوق"
                    disabled={index === 0}
                    onClick={() => setIds(moveEntry(ids, index, -1))}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    className="rita-btn rita-btn-quiet rita-btn-sm !px-2"
                    aria-label="لتحت"
                    disabled={index === ids.length - 1}
                    onClick={() => setIds(moveEntry(ids, index, 1))}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    className="rita-btn rita-btn-quiet rita-btn-sm !px-2"
                    aria-label={`شيل ${clip?.en ?? "المقطع"}`}
                    onClick={() => setIds(ids.filter((value) => value !== id))}
                  >
                    <X size={16} />
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <label className="grid grid-cols-[minmax(0,1fr)] gap-1 text-[15px] font-semibold">
        أضف من المكتبة
        <input
          type="search"
          data-workspace-transient
          dir="auto"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحث بالإنجليزي أو العربي"
          className="min-h-11 rounded-xl border border-[var(--pp-line)] px-3 font-normal"
        />
      </label>
      <ul className="grid max-h-[340px] gap-2 overflow-y-auto">
        {results.map((clip) => {
          const chosen = ids.includes(clip.id);
          return (
            <li key={clip.id} className="flex min-w-0 items-center gap-2">
              <ClipThumb clip={clip} className="h-11 w-[76px]" />
              <ClipText clip={clip} />
              <span className="ms-auto flex shrink-0 gap-1">
                <button
                  type="button"
                  className="rita-btn rita-btn-quiet rita-btn-sm !px-2"
                  aria-label={`معاينة ${clip.en}`}
                  onClick={() => setPreview(clip)}
                >
                  <Eye size={16} />
                </button>
                <button
                  type="button"
                  className={`rita-btn rita-btn-sm !px-2 ${chosen ? "rita-btn-primary" : "rita-btn-soft"}`}
                  aria-pressed={chosen}
                  aria-label={`${chosen ? "شيل" : "أضف"} ${clip.en}`}
                  disabled={!chosen && ids.length >= MAX_STOP_CLIPS}
                  onClick={() =>
                    setIds(chosen ? ids.filter((value) => value !== clip.id) : [...ids, clip.id])
                  }
                >
                  {chosen ? <Check size={16} /> : <Plus size={16} />}
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      {!results.length && (
        <p role="status" className="text-[14px] text-[var(--pp-muted)]">
          ما لقينا. جرّب كلمة وحدة من الجملة.
        </p>
      )}

      {error && (
        <p role="alert" className="text-[14px] text-[#8c1a31]">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rita-btn rita-btn-primary"
          disabled={!changed}
          onClick={() => void save()}
        >
          {busy ? "جاري الحفظ…" : `احفظ المحطة (${ids.length})`}
        </button>
        <button type="button" className="rita-btn rita-btn-quiet" onClick={onClose}>
          إلغاء
        </button>
      </div>

      {preview && (
        <FilmPlayer
          clips={[preview]}
          pool={data.clips.map((clip) => ({ en: clip.en, ar: clip.ar }))}
          onClose={() => setPreview(undefined)}
        />
      )}
    </fieldset>
  );
}
