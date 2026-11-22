import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Clapperboard,
  Eye,
  Image as ImageIcon,
  ListPlus,
  Loader2,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { adminDeleteClip, adminListClips, type ClipLibrary } from "@/lib/film-clips.functions";
import { clipCredit, clipMatches, type ClipKind, type FilmClip } from "@/lib/film-clips";
import { FilmPlayer } from "../FilmPractice";
import { AddToPathDialog } from "./AddToPathDialog";
import { ClipDialog } from "./ClipDialog";
import { ClipEditor } from "./ClipEditor";
import { ClipStopEditor } from "./ClipStopEditor";
import { ClipText, ClipThumb } from "./ClipBits";

type Filter = "all" | "video" | "gif" | "unused";
const FILTERS: [Filter, string][] = [
  ["all", "الكل"],
  ["video", "فيديو"],
  ["gif", "GIF"],
  ["unused", "مش بالمسار"],
];

/**
 * The admin's clips library: every clip as a card (cover, sentence, meaning, target word, the
 * stops that use it), search in English or Arabic, add a video or a GIF, tick clips and put them
 * on the path as one stop, and edit the clips stops already there.
 */
export function ClipsLibrary() {
  const listFn = useServerFn(adminListClips);
  const deleteFn = useServerFn(adminDeleteClip);
  const [language, setLanguage] = useState("en");
  const library = useQuery({
    queryKey: ["clip-library", language],
    queryFn: () => listFn({ data: { language } }),
  });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<{ clip: FilmClip | null; kind: ClipKind } | null>(null);
  const [preview, setPreview] = useState<FilmClip[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [stop, setStop] = useState<ClipLibrary["stops"][number] | null>(null);
  const [deleting, setDeleting] = useState("");
  const data = library.data;
  const refresh = async () => {
    await library.refetch();
  };

  const shown = useMemo(
    () =>
      (data?.clips ?? []).filter(
        (clip) =>
          clipMatches(clip, query) &&
          (filter === "all" ||
            (filter === "unused" ? !data?.usage[clip.id]?.length : clip.kind === filter)),
      ),
    [data, filter, query],
  );
  const pool = useMemo(
    () => (data?.clips ?? []).map((clip) => ({ en: clip.en, ar: clip.ar })),
    [data],
  );
  const byId = useMemo(() => new Map((data?.clips ?? []).map((clip) => [clip.id, clip])), [data]);

  async function remove(clip: FilmClip) {
    const uses = data?.usage[clip.id]?.length ?? 0;
    if (
      !window.confirm(
        uses
          ? `حذف المقطع؟ بينشال من ${uses === 1 ? "محطة وحدة" : `${uses} محطات`} بالمسار.`
          : "حذف المقطع من المكتبة؟",
      )
    )
      return;
    setDeleting(clip.id);
    try {
      await deleteFn({ data: { id: clip.id } });
      setSelected((ids) => ids.filter((id) => id !== clip.id));
      toast.success("انحذف المقطع");
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "ما انحذف.");
    } finally {
      setDeleting("");
    }
  }

  const toggle = (id: string) =>
    setSelected((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="me-auto min-w-0">
          <h1 className="rh-app-title text-[30px] font-bold leading-tight">مكتبة المقاطع</h1>
          <p className="mt-1 text-[15px] text-[var(--pp-muted)]">
            كل مقطع جملة وحدة. التمارين بتنعمل لحالها من الجملة والمعنى والكلمة.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rita-btn rita-btn-primary gap-2"
            disabled={!data?.ready}
            onClick={() => setEditing({ clip: null, kind: "video" })}
          >
            <Clapperboard size={18} aria-hidden="true" /> فيديو جديد
          </button>
          <button
            type="button"
            className="rita-btn rita-btn-soft gap-2"
            disabled={!data?.ready}
            onClick={() => setEditing({ clip: null, kind: "gif" })}
          >
            <ImageIcon size={18} aria-hidden="true" /> GIF جديد
          </button>
        </div>
      </div>

      {library.isPending ? (
        <p role="status" className="flex items-center gap-2 text-[15px]">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" /> جاري التحميل…
        </p>
      ) : library.error ? (
        <div role="alert" className="rounded-xl bg-[#fbe9ed] p-3 text-[15px] text-[#8c1a31]">
          {library.error instanceof Error ? library.error.message : "ما قدرنا نحمّل المكتبة."}{" "}
          <button type="button" className="underline" onClick={() => void refresh()}>
            جرّب مرة ثانية
          </button>
        </div>
      ) : !data?.ready ? (
        <div className="rounded-2xl bg-[#fff6e5] p-4 text-[15px] leading-7 text-[#6b4100]">
          <p className="font-semibold">المكتبة بدها تحديث قاعدة البيانات أولاً.</p>
          <p>
            طبّق ملف <code dir="ltr">20261125120000_rita_film_clips.sql</code> بـ Lovable Cloud.
            بعدها مقاطع سينتل الـ20 بتطلع هون، ومحطات المقاطع الموجودة بتضل شغّالة.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3">
            <input
              type="search"
              dir="auto"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث بالإنجليزي أو العربي"
              aria-label="ابحث بالمقاطع"
              className="min-h-12 w-full rounded-xl border border-[var(--pp-line)] px-4 text-[16px]"
            />
            <div className="flex flex-wrap gap-2" role="group" aria-label="نوع المقاطع">
              {FILTERS.map(([value, text]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={`min-h-10 rounded-full border px-4 text-[14px] font-semibold ${filter === value ? "border-[var(--pp-ink)] bg-[var(--pp-ink)] text-white" : "border-[var(--pp-line)] bg-white"}`}
                >
                  {text}
                </button>
              ))}
              <span className="ms-auto self-center text-[14px] text-[var(--pp-muted)]">
                {shown.length} من {data.clips.length}
              </span>
            </div>
          </div>

          {shown.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-[var(--pp-line)] p-8 text-center">
              <p className="text-[17px] font-semibold">
                {data.clips.length ? "ما لقينا مقاطع." : "لسا ما في مقاطع."}
              </p>
              <p className="mt-1 text-[14px] text-[var(--pp-muted)]">
                {data.clips.length
                  ? "جرّب كلمة وحدة من الجملة، أو غيّر النوع."
                  : "أضف فيديو من جهازك أو GIF من GIPHY."}
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((clip) => {
                const uses = data.usage[clip.id] ?? [];
                const ticked = selected.includes(clip.id);
                return (
                  <li
                    key={clip.id}
                    className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-white ${ticked ? "border-[var(--pp-ink)] ring-2 ring-[var(--pp-ink)]" : "border-[var(--pp-line)]"}`}
                  >
                    <div className="relative">
                      <button
                        type="button"
                        className="group block w-full"
                        aria-label={`معاينة ${clip.en}`}
                        onClick={() => setPreview([clip])}
                      >
                        <ClipThumb clip={clip} className="aspect-video w-full !rounded-none" />
                        <span className="absolute inset-0 grid place-items-center">
                          <span className="grid h-11 w-11 place-items-center rounded-full bg-black/55 text-white">
                            <Play size={18} aria-hidden="true" />
                          </span>
                        </span>
                      </button>
                      <label className="absolute end-2 top-2 flex h-10 cursor-pointer items-center gap-2 rounded-full bg-white/95 px-3 text-[14px] font-semibold shadow">
                        <input
                          type="checkbox"
                          checked={ticked}
                          onChange={() => toggle(clip.id)}
                          className="h-4 w-4"
                        />
                        اختار
                      </label>
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <ClipText clip={clip} />
                      {clip.target && (
                        <p className="text-[13px] text-[var(--pp-muted)]">
                          الكلمة: <bdi dir="ltr">{clip.target}</bdi> · {clip.target_ar}
                        </p>
                      )}
                      <p className="flex flex-wrap gap-1.5 text-[13px]">
                        {uses.length ? (
                          uses.map((use) => (
                            <span
                              key={use.id}
                              className="rounded-full bg-[#e8f1fb] px-2.5 py-0.5 text-[#0b4f8a]"
                            >
                              {use.title}
                            </span>
                          ))
                        ) : (
                          <span className="text-[var(--pp-muted)]">مش بالمسار</span>
                        )}
                      </p>
                      <p className="truncate text-[12px] text-[var(--pp-muted)]" dir="auto">
                        {clipCredit(clip)}
                      </p>
                      <div className="mt-auto flex gap-1 pt-1">
                        <button
                          type="button"
                          className="rita-btn rita-btn-quiet rita-btn-sm gap-1"
                          onClick={() => setEditing({ clip, kind: clip.kind })}
                        >
                          <Pencil size={15} aria-hidden="true" /> تعديل
                        </button>
                        <button
                          type="button"
                          className="rita-btn rita-btn-quiet rita-btn-sm gap-1"
                          onClick={() => setPreview([clip])}
                        >
                          <Eye size={15} aria-hidden="true" /> معاينة
                        </button>
                        <button
                          type="button"
                          className="rita-btn rita-btn-quiet rita-btn-sm ms-auto gap-1 text-[#8c1a31]"
                          disabled={deleting === clip.id}
                          onClick={() => void remove(clip)}
                        >
                          {deleting === clip.id ? (
                            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                          ) : (
                            <Trash2 size={15} aria-hidden="true" />
                          )}
                          حذف
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <section className="space-y-3" aria-labelledby="clip-stops-title">
            <h2 id="clip-stops-title" className="text-[20px] font-bold">
              محطات المقاطع بالمسار
            </h2>
            {data.stops.length === 0 ? (
              <p className="text-[15px] text-[var(--pp-muted)]">
                لسا ما في. اختار مقاطع من فوق واكبس «أضف للمسار».
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {data.stops.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setStop(item)}
                      className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-[var(--pp-line)] bg-white px-3 text-start"
                    >
                      <span className="flex -space-x-3 rtl:space-x-reverse" aria-hidden="true">
                        {item.clip_ids.slice(0, 3).map((id) => {
                          const clip = byId.get(id);
                          return clip ? (
                            <ClipThumb
                              key={id}
                              clip={clip}
                              className="h-9 w-14 border-2 border-white"
                            />
                          ) : null;
                        })}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">
                          {item.title}
                        </span>
                        <span className="text-[13px] text-[var(--pp-muted)]">
                          {item.clip_ids.length} مقاطع · {item.language.toUpperCase()}
                        </span>
                      </span>
                      <Pencil size={16} className="text-[var(--pp-muted)]" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {selected.length > 0 && (
            <div className="fixed inset-x-4 bottom-[max(16px,env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-[60rem] flex-wrap items-center gap-2 rounded-2xl bg-[var(--pp-ink)] p-3 text-white shadow-lg">
              <span className="me-auto px-1 text-[15px] font-semibold">
                {selected.length} مختارة
              </span>
              <button
                type="button"
                className="rita-btn rita-btn-sm bg-white/15 text-white"
                onClick={() => setPreview(selected.flatMap((id) => byId.get(id) ?? []))}
              >
                <Eye size={15} aria-hidden="true" /> جرّبها
              </button>
              <button
                type="button"
                className="rita-btn rita-btn-sm gap-1.5 bg-white text-[var(--pp-ink)]"
                onClick={() => setAdding(true)}
              >
                <ListPlus size={16} aria-hidden="true" /> أضف للمسار
              </button>
              <button
                type="button"
                className="rita-btn rita-btn-sm bg-transparent text-white underline"
                onClick={() => setSelected([])}
              >
                إلغاء
              </button>
            </div>
          )}
        </>
      )}

      {editing && data && (
        <ClipEditor
          clip={editing.clip}
          initialKind={editing.kind}
          pool={pool}
          giphy={data.giphy}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {preview && preview.length > 0 && (
        <FilmPlayer clips={preview} pool={pool} onClose={() => setPreview(null)} />
      )}
      {adding && data && (
        <AddToPathDialog
          library={data}
          language={language}
          clipIds={selected}
          onLanguage={setLanguage}
          onDone={async () => {
            setSelected([]);
            await refresh();
          }}
          onClose={() => setAdding(false)}
        />
      )}
      {stop && data && (
        <ClipDialog open title={stop.title} onClose={() => setStop(null)}>
          <ClipStopEditor
            stop={stop}
            library={data}
            onSaved={refresh}
            onClose={() => setStop(null)}
          />
        </ClipDialog>
      )}
    </div>
  );
}
