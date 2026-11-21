import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Clapperboard,
  Eye,
  Image as ImageIcon,
  Loader2,
  Play,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/legacy-client";
import { adminSaveClip, adminSuggestClip } from "@/lib/film-clips.functions";
import {
  CLIPS_BUCKET,
  MAX_CLIP_BYTES,
  checkTrim,
  clipFilePath,
  clipProblems,
  formatSeconds,
  videoExtension,
  type ClipKind,
  type ClipPoolEntry,
  type FilmClip,
  type GiphyResult,
} from "@/lib/film-clips";
import { FilmPlayer } from "../FilmPractice";
import { ClipDialog } from "./ClipDialog";
import { GiphyPicker } from "./GiphyPicker";

const field = "min-h-11 w-full rounded-xl border border-[var(--pp-line)] px-3 font-normal";
const label = "grid grid-cols-[minmax(0,1fr)] gap-1 text-[14px] font-semibold";

/** Waits for the video to show the frame at `at` seconds (gives up after 4 s). */
function seek(video: HTMLVideoElement, at: number) {
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      video.removeEventListener("seeked", done);
      resolve();
    };
    const timer = setTimeout(done, 4000);
    video.addEventListener("seeked", done);
    video.currentTime = at;
  });
}

/** The frame at `at` seconds as a JPEG (at most 960 px wide), or null when the browser refuses. */
async function capturePoster(video: HTMLVideoElement, at: number): Promise<Blob | null> {
  try {
    video.pause();
    await seek(video, at);
    const scale = Math.min(1, 960 / (video.videoWidth || 960));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round((video.videoWidth || 960) * scale);
    canvas.height = Math.round((video.videoHeight || 540) * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  } catch {
    return null;
  }
}

function gifOf(clip: FilmClip | null): GiphyResult | null {
  if (!clip?.gif_id || !clip.gif_mp4 || !clip.gif_still) return null;
  return {
    id: clip.gif_id,
    title: "",
    page: clip.gif_page ?? "",
    mp4: clip.gif_mp4,
    still: clip.gif_still,
    preview: clip.gif_mp4,
    width: 0,
    height: 0,
  };
}

/** Words of the sentence the admin can tap to make the target word. */
function sentenceWords(en: string) {
  return [
    ...new Set(
      en
        .split(/\s+/)
        .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
        .filter(Boolean),
    ),
  ];
}

/**
 * Adds or edits one clip. A video is uploaded from the admin's device and cut to one sentence
 * («من هون / لهون» while it plays, or the seconds); its cover is taken from the first frame. A GIF
 * is picked from GIPHY. Then the sentence, «اقترح» for the Arabic fields, and the credit.
 */
export function ClipEditor({
  clip,
  initialKind,
  pool,
  giphy,
  onSaved,
  onClose,
}: {
  clip: FilmClip | null;
  initialKind: ClipKind;
  pool: ClipPoolEntry[];
  giphy: boolean;
  onSaved: (clip: FilmClip) => void;
  onClose: () => void;
}) {
  const saveFn = useServerFn(adminSaveClip);
  const suggestFn = useServerFn(adminSuggestClip);
  const [kind, setKind] = useState<ClipKind>(clip?.kind ?? initialKind);
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState("");
  const [duration, setDuration] = useState<number | null>(null);
  const [start, setStart] = useState<number | null>(clip?.start_s ?? null);
  const [end, setEnd] = useState<number | null>(clip?.end_s ?? null);
  const [gif, setGif] = useState<GiphyResult | null>(gifOf(clip));
  const [en, setEn] = useState(clip?.en ?? "");
  const [ar, setAr] = useState(clip?.ar ?? "");
  const [target, setTarget] = useState(clip?.target ?? "");
  const [targetAr, setTargetAr] = useState(clip?.target_ar ?? "");
  const [contextAr, setContextAr] = useState(clip?.context_ar ?? "");
  const [source, setSource] = useState(clip?.source ?? "");
  const [credit, setCredit] = useState(clip?.credit ?? "");
  const [creditUrl, setCreditUrl] = useState(clip?.credit_url ?? "");
  const [rights, setRights] = useState(Boolean(clip));
  const [busy, setBusy] = useState<"" | "save" | "suggest">("");
  const [error, setError] = useState("");
  const [tried, setTried] = useState(false);
  const [preview, setPreview] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const trialEnd = useRef<number | null>(null);

  useEffect(() => () => void (fileUrl && URL.revokeObjectURL(fileUrl)), [fileUrl]);

  const videoSrc = fileUrl || clip?.video_url || "";
  const trim = checkTrim(start, end, duration);
  const draft: FilmClip = {
    id: clip?.id ?? "draft",
    kind,
    en: en.trim(),
    ar: ar.trim(),
    target: target.trim(),
    target_ar: targetAr.trim(),
    context_ar: contextAr.trim(),
    video_url: kind === "video" ? videoSrc || null : null,
    poster_url: kind === "video" && !file ? (clip?.poster_url ?? null) : null,
    start_s: trim.start,
    end_s: trim.end,
    gif_id: gif?.id ?? null,
    gif_mp4: gif?.mp4 ?? null,
    gif_still: gif?.still ?? null,
    gif_page: gif?.page || null,
    source: source.trim(),
    credit: credit.trim(),
    credit_url: creditUrl.trim() || null,
    legacy_id: clip?.legacy_id ?? null,
  };
  const problems = useMemo(() => {
    const list = clipProblems(draft);
    if (kind === "video") {
      if (!videoSrc) list.unshift("ارفع الفيديو.");
      if (trim.problem) list.push(trim.problem);
      if (file && !rights) list.push("أكّد إنه عندك حق تستخدم هالفيديو.");
    } else if (!gif) list.unshift("اختار GIF.");
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draft.en,
    draft.ar,
    draft.target,
    draft.target_ar,
    kind,
    videoSrc,
    trim.problem,
    file,
    rights,
    gif,
  ]);
  const words = sentenceWords(en);

  function chooseFile(next: File | undefined) {
    setError("");
    if (!next) return;
    if (!videoExtension(next.type, next.name)) {
      setError("الفيديو لازم يكون MP4 أو WebM أو MOV.");
      return;
    }
    if (next.size > MAX_CLIP_BYTES) {
      setError(`الفيديو أكبر من ${MAX_CLIP_BYTES / 1024 / 1024} MB. قصّه أو صغّره قبل الرفع.`);
      return;
    }
    setFile(next);
    setFileUrl(URL.createObjectURL(next));
    setDuration(null);
    setStart(null);
    setEnd(null);
    if (!source) setSource(next.name.replace(/\.[^.]+$/, "").slice(0, 120));
  }

  async function tryCut() {
    const el = video.current;
    if (!el) return;
    trialEnd.current = trim.end;
    el.currentTime = trim.start ?? 0;
    try {
      await el.play();
    } catch {
      setError("المتصفح ما شغّل الفيديو.");
    }
  }

  async function suggest() {
    if (en.trim().split(/\s+/).length < 2) {
      setError("اكتب الجملة الإنجليزية أولاً.");
      return;
    }
    setBusy("suggest");
    setError("");
    try {
      const value = await suggestFn({ data: { en: en.trim(), kind } });
      setAr(value.ar);
      setTarget(value.target);
      setTargetAr(value.target_ar);
      setContextAr(value.context_ar);
      toast.success("انكتب الاقتراح. راجعه وعدّل إذا بدك.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ما قدرنا نقترح هلأ.");
    } finally {
      setBusy("");
    }
  }

  async function save() {
    setTried(true);
    if (problems.length) return;
    setBusy("save");
    setError("");
    const uploaded: string[] = [];
    try {
      let videoPath: string | null = null;
      let posterPath: string | null = null;
      if (kind === "video") {
        if (file) {
          const ext = videoExtension(file.type, file.name) ?? "mp4";
          videoPath = clipFilePath(crypto.randomUUID(), ext);
          const upload = await supabase.storage
            .from(CLIPS_BUCKET)
            .upload(videoPath, file, { contentType: file.type || "video/mp4" });
          if (upload.error) throw new Error(`رفع الفيديو فشل: ${upload.error.message}`);
          uploaded.push(videoPath);
        }
        // A new cover when the video or its start changed (the first frame of the cut).
        const startChanged = (clip?.start_s ?? null) !== trim.start;
        if (video.current && (file || startChanged || !clip?.poster_url)) {
          const poster = await capturePoster(video.current, (trim.start ?? 0) + 0.05);
          if (poster) {
            posterPath = clipFilePath(crypto.randomUUID(), "jpg");
            const upload = await supabase.storage
              .from(CLIPS_BUCKET)
              .upload(posterPath, poster, { contentType: "image/jpeg" });
            if (upload.error) posterPath = null;
            else uploaded.push(posterPath);
          }
        }
      }
      const saved = await saveFn({
        data: {
          ...(clip ? { id: clip.id } : {}),
          kind,
          en: draft.en,
          ar: draft.ar,
          target: draft.target,
          target_ar: draft.target_ar,
          context_ar: draft.context_ar,
          video_path: videoPath,
          poster_path: posterPath,
          start_s: kind === "video" ? trim.start : null,
          end_s: kind === "video" ? trim.end : null,
          ...(kind === "gif" && gif
            ? { gif: { id: gif.id, mp4: gif.mp4, still: gif.still, page: gif.page } }
            : {}),
          source: draft.source || (kind === "gif" ? "GIPHY" : ""),
          credit: draft.credit,
          credit_url: draft.credit_url ?? "",
        },
      });
      toast.success(clip ? "انحفظ المقطع" : "انضاف المقطع للمكتبة");
      onSaved(saved);
    } catch (cause) {
      if (uploaded.length) await supabase.storage.from(CLIPS_BUCKET).remove(uploaded);
      setError(cause instanceof Error ? cause.message : "ما انحفظ المقطع.");
    } finally {
      setBusy("");
    }
  }

  return (
    <ClipDialog
      open
      title={clip ? "تعديل المقطع" : "مقطع جديد"}
      onClose={() => !busy && onClose()}
      footer={
        <>
          <button
            type="button"
            className="rita-btn rita-btn-primary gap-1.5"
            disabled={Boolean(busy)}
            onClick={() => void save()}
          >
            {busy === "save" && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {clip ? "احفظ" : "أضف للمكتبة"}
          </button>
          <button
            type="button"
            className="rita-btn rita-btn-soft gap-1.5"
            disabled={Boolean(busy) || problems.length > 0}
            onClick={() => setPreview(true)}
          >
            <Eye size={16} aria-hidden="true" /> شوف كطالب
          </button>
          <button
            type="button"
            className="rita-btn rita-btn-quiet ms-auto"
            disabled={Boolean(busy)}
            onClick={onClose}
          >
            إلغاء
          </button>
        </>
      }
    >
      <fieldset disabled={busy === "save"} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
        {!clip && (
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="نوع المقطع">
            {(
              [
                ["video", "فيديو من جهازك", Clapperboard],
                ["gif", "GIF من GIPHY", ImageIcon],
              ] as const
            ).map(([value, text, Icon]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={kind === value}
                onClick={() => setKind(value)}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border text-[15px] font-semibold ${kind === value ? "border-[var(--pp-ink)] bg-[var(--pp-ink)] text-white" : "border-[var(--pp-line)] bg-white"}`}
              >
                <Icon size={18} aria-hidden="true" /> {text}
              </button>
            ))}
          </div>
        )}

        {kind === "video" ? (
          <section className="grid grid-cols-[minmax(0,1fr)] gap-3" aria-label="الفيديو">
            {videoSrc ? (
              <video
                ref={video}
                key={videoSrc}
                src={videoSrc}
                poster={!file ? (clip?.poster_url ?? undefined) : undefined}
                crossOrigin="anonymous"
                controls
                playsInline
                preload="metadata"
                className="aspect-video w-full rounded-xl bg-black object-contain"
                onLoadedMetadata={(event) =>
                  setDuration(
                    Number.isFinite(event.currentTarget.duration)
                      ? event.currentTarget.duration
                      : null,
                  )
                }
                onTimeUpdate={(event) => {
                  if (
                    trialEnd.current != null &&
                    event.currentTarget.currentTime >= trialEnd.current
                  ) {
                    event.currentTarget.pause();
                    trialEnd.current = null;
                  }
                }}
              />
            ) : null}
            <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--pp-line)] px-3 text-[15px] font-semibold">
              <Upload size={18} aria-hidden="true" />
              {videoSrc ? "بدّل الفيديو" : "اختار فيديو (MP4، لحد 25 MB)"}
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                className="sr-only"
                onChange={(event) => chooseFile(event.target.files?.[0])}
              />
            </label>
            {file && (
              <p className="text-[13px] text-[var(--pp-muted)]">
                <bdi dir="ltr">{file.name}</bdi> · {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
            )}
            {videoSrc && (
              <div className="grid grid-cols-[minmax(0,1fr)] gap-2 rounded-xl bg-[#f6f7f9] p-3">
                <p className="text-[14px] font-semibold">
                  قصّ المقطع لجملة وحدة
                  {duration ? (
                    <span className="font-normal text-[var(--pp-muted)]">
                      {" "}
                      · طول الفيديو {formatSeconds(duration)}
                    </span>
                  ) : null}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="rita-btn rita-btn-soft"
                    onClick={() =>
                      setStart(Math.round((video.current?.currentTime ?? 0) * 10) / 10)
                    }
                  >
                    من هون
                  </button>
                  <button
                    type="button"
                    className="rita-btn rita-btn-soft"
                    onClick={() => setEnd(Math.round((video.current?.currentTime ?? 0) * 10) / 10)}
                  >
                    لهون
                  </button>
                  <label className={label}>
                    البداية (ثانية)
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.1}
                      dir="ltr"
                      value={start ?? ""}
                      onChange={(event) =>
                        setStart(event.target.value === "" ? null : Number(event.target.value))
                      }
                      placeholder="0"
                      className={field}
                    />
                  </label>
                  <label className={label}>
                    النهاية (ثانية)
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.1}
                      dir="ltr"
                      value={end ?? ""}
                      onChange={(event) =>
                        setEnd(event.target.value === "" ? null : Number(event.target.value))
                      }
                      placeholder={duration ? duration.toFixed(1) : "للآخر"}
                      className={field}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className="rita-btn rita-btn-quiet justify-self-start gap-1.5"
                  onClick={() => void tryCut()}
                >
                  <Play size={16} aria-hidden="true" /> جرّب القصّة
                </button>
              </div>
            )}
            {file && (
              <label className="flex items-start gap-2 text-[14px] leading-6">
                <input
                  type="checkbox"
                  checked={rights}
                  onChange={(event) => setRights(event.target.checked)}
                  className="mt-1.5 h-4 w-4"
                />
                <span>
                  عندي حق أستخدم هالفيديو (من إنتاجي، أو برخصة مفتوحة، أو بإذن صاحبه). المصدر مكتوب
                  تحت.
                </span>
              </label>
            )}
          </section>
        ) : (
          <section className="grid grid-cols-[minmax(0,1fr)] gap-3" aria-label="الـ GIF">
            {gif && (
              <video
                key={gif.id}
                src={gif.mp4}
                poster={gif.still}
                muted
                loop
                autoPlay
                playsInline
                className="aspect-video w-full rounded-xl bg-[#f1f3f5] object-contain"
              />
            )}
            {(giphy || !clip) && <GiphyPicker picked={gif} onPick={setGif} />}
            <p className="text-[13px] text-[var(--pp-muted)]">
              الـ GIF ما فيه صوت، فبيطلع للطالب «اختار الجملة» و«رتّب الكلمات» بس.
            </p>
          </section>
        )}

        <section className="grid grid-cols-[minmax(0,1fr)] gap-3" aria-label="الجملة">
          <label className={label}>
            الجملة بالإنجليزي
            <input
              dir="ltr"
              lang="en"
              value={en}
              maxLength={300}
              onChange={(event) => setEn(event.target.value)}
              placeholder="I'm searching for someone."
              className={field}
            />
          </label>
          <button
            type="button"
            className="rita-btn rita-btn-soft justify-self-start gap-1.5"
            disabled={Boolean(busy) || en.trim().split(/\s+/).length < 2}
            onClick={() => void suggest()}
          >
            {busy === "suggest" ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles size={16} aria-hidden="true" />
            )}
            اقترح الترجمة والكلمة
          </button>
          {words.length > 1 && (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
              <p className="text-[14px] font-semibold">الكلمة المستهدفة (اكبس عليها)</p>
              <div className="flex flex-wrap gap-1.5" dir="ltr">
                {words.map((word) => (
                  <button
                    key={word}
                    type="button"
                    aria-pressed={target.toLowerCase() === word.toLowerCase()}
                    onClick={() => setTarget(word)}
                    className={`min-h-9 rounded-full border px-3 text-[14px] ${target.toLowerCase() === word.toLowerCase() ? "border-[var(--pp-ink)] bg-[var(--pp-ink)] text-white" : "border-[var(--pp-line)] bg-white"}`}
                  >
                    {word}
                  </button>
                ))}
              </div>
            </div>
          )}
          <label className={label}>
            المعنى بالعربي
            <input
              dir="rtl"
              value={ar}
              maxLength={400}
              onChange={(event) => setAr(event.target.value)}
              className={field}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className={label}>
              الكلمة المستهدفة
              <input
                dir="ltr"
                value={target}
                maxLength={60}
                onChange={(event) => setTarget(event.target.value)}
                className={field}
              />
            </label>
            <label className={label}>
              معناها
              <input
                dir="rtl"
                value={targetAr}
                maxLength={80}
                onChange={(event) => setTargetAr(event.target.value)}
                className={field}
              />
            </label>
          </div>
          <label className={label}>
            سطر عن المشهد (اختياري)
            <input
              dir="rtl"
              value={contextAr}
              maxLength={200}
              onChange={(event) => setContextAr(event.target.value)}
              className={field}
            />
          </label>
        </section>

        <section className="grid grid-cols-[minmax(0,1fr)] gap-3" aria-label="المصدر">
          <p className="text-[15px] font-bold">المصدر والحقوق</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={label}>
              المصدر
              <input
                dir="auto"
                value={source}
                maxLength={120}
                onChange={(event) => setSource(event.target.value)}
                placeholder={kind === "gif" ? "GIPHY" : "اسم الفيلم أو القناة"}
                className={field}
              />
            </label>
            <label className={label}>
              سطر الحقوق (بيطلع تحت المقطع)
              <input
                dir="auto"
                value={credit}
                maxLength={200}
                onChange={(event) => setCredit(event.target.value)}
                placeholder="© صاحب العمل · الرخصة"
                className={field}
              />
            </label>
          </div>
          <label className={label}>
            رابط المصدر أو الرخصة (اختياري)
            <input
              dir="ltr"
              type="url"
              value={creditUrl}
              maxLength={500}
              onChange={(event) => setCreditUrl(event.target.value)}
              placeholder="https://"
              className={field}
            />
          </label>
        </section>

        {tried && problems.length > 0 && (
          <ul
            role="alert"
            className="list-disc rounded-xl bg-[#fbe9ed] p-3 ps-7 text-[14px] text-[#8c1a31]"
          >
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-[#fbe9ed] p-3 text-[14px] text-[#8c1a31]">
            {error}
          </p>
        )}
      </fieldset>

      {preview && <FilmPlayer clips={[draft]} pool={pool} onClose={() => setPreview(false)} />}
    </ClipDialog>
  );
}
