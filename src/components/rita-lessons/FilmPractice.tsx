import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Clapperboard,
  Volume2,
  Turtle,
  X,
  Pause,
  Play,
  Plus,
  RotateCcw,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useUiLanguage } from "@/components/language/useUiLanguage";
import lines from "@/lib/sintel-lines.json";
import { savePathFilmLines } from "@/lib/rita-path-items.functions";
import { listClips } from "@/lib/film-clips.functions";
import { SINTEL_POOL, sintelClips } from "@/lib/film-clips-sintel";
import { mediaLineIds, type PathItem } from "@/lib/rita-path-layout";
import {
  choiceOptions,
  clipCredit,
  mixedOrder,
  orderPuzzle,
  sessionSteps,
  targetIndex,
  type ClipExercise,
  type ClipPoolEntry,
  type FilmClip,
} from "@/lib/film-clips";
import { useWorkspaceDraft, useWorkspaceGuard, useWorkspaceTask } from "./admin/WorkspaceGuard";
import { FilmSpeaking } from "./FilmSpeaking";
import "./film-practice.css";
import "./film-session.css";

type Media = "film" | "gif";
type Line = (typeof lines)[number];
const byId = new Map(lines.map((line) => [line.id, line]));
const dailyIds = [5, 8, 13, 14, 15, 20, 23];
const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ـ/g, "")
    .replace(/[’‘']/g, "")
    .replace(/[^\p{L}\p{N}']+/gu, " ")
    .trim();
function useCopy() {
  const ar = useUiLanguage() === "ar";
  return (en: string, arabic: string) => (ar ? arabic : en);
}
function Credit() {
  return (
    <small dir="ltr">
      Sintel · © Blender Foundation ·{" "}
      <a href="https://durian.blender.org/sharing/" target="_blank" rel="noreferrer">
        CC BY 3.0
      </a>
    </small>
  );
}
function Clip({ line, video }: { line: Line; video?: React.RefObject<HTMLVideoElement | null> }) {
  const t = useCopy();
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const internal = useRef<HTMLVideoElement>(null);
  const ref = video ?? internal;
  return (
    <>
      <video
        ref={ref}
        aria-label={t("Sintel dialogue clip", "مشهد من سينتل")}
        src={`/media/sintel/${line.id}.mp4`}
        poster={`/media/sintel/${line.id}.jpg`}
        onPlay={() => {
          setPlaying(true);
          setEnded(false);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setEnded(true)}
        preload="metadata"
        playsInline
        controls
        onError={() => setError(true)}
      />
      {error && (
        <button
          onClick={() => {
            setError(false);
            ref.current?.load();
          }}
        >
          {t("Clip unavailable · Retry", "تعذّر تحميل المقطع · أعد المحاولة")}
        </button>
      )}
      <div className="fc-controls">
        <button
          type="button"
          className="fc-play"
          disabled={error}
          onClick={async () => {
            const player = ref.current;
            if (!player) return;
            if (!player.paused) {
              player.pause();
              return;
            }
            if (player.ended) player.currentTime = 0;
            try {
              await player.play();
            } catch {
              setError(true);
            }
          }}
        >
          {playing ? <Pause size={16} /> : ended ? <RotateCcw size={16} /> : <Play size={16} />}
          {playing
            ? t("Pause", "إيقاف مؤقت")
            : ended
              ? t("Replay clip", "إعادة المقطع")
              : t("Play clip", "شغّل المقطع")}
        </button>
        <Credit />
      </div>
    </>
  );
}

function useGifMotion() {
  return useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}
function GifPreview({ line }: { line: Line }) {
  const t = useCopy();
  const [moving, setMoving] = useGifMotion();
  return (
    <>
      <img
        className="fc-gif"
        src={`/media/sintel/${line.id}.${moving ? "gif" : "jpg"}`}
        alt={line.en}
      />
      <div className="fc-controls">
        <button type="button" className="fc-play" onClick={() => setMoving(!moving)}>
          {moving ? <Pause size={16} /> : <Play size={16} />}
          {moving ? t("Pause GIF", "أوقف الصورة") : t("Play GIF", "حرّك الصورة")}
        </button>
        <Credit />
      </div>
    </>
  );
}

function MediaFormat({ value, onChange }: { value: Media; onChange: (value: Media) => void }) {
  const t = useCopy();
  return (
    <label>
      {t("Format", "العرض")}{" "}
      <select
        data-workspace-transient
        value={value}
        onChange={(e) => onChange(e.target.value === "gif" ? "gif" : "film")}
      >
        <option value="film">{t("Video", "فيديو")}</option>
        <option value="gif">GIF</option>
      </select>
    </label>
  );
}

export function FilmEditor({
  item,
  onChanged,
  onClose,
}: {
  item: PathItem;
  onChanged: () => Promise<void>;
  onClose: () => void;
}) {
  const t = useCopy();
  const save = useServerFn(savePathFilmLines);
  const [media, setMedia] = useState<Media>("film");
  const [original] = useState(item);
  const [previous] = useState(() => mediaLineIds(original));
  const [ids, setIds] = useState(previous);
  const [query, setQuery] = useState("");
  const [daily, setDaily] = useState(true);
  const [preview, setPreview] = useState<Line>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const finish = useWorkspaceTask(busy);
  const guard = useWorkspaceGuard();
  useWorkspaceDraft(ids);
  const needle = normalize(query);
  const matches = needle
    ? lines.filter((line) =>
        needle.split(" ").every((word) =>
          normalize(line.en + " " + line.ar)
            .split(" ")
            .some((token) => token.startsWith(word)),
        ),
      )
    : daily
      ? dailyIds.map((id) => byId.get(id)!)
      : lines;
  function toggle(id: number) {
    setIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }
  async function publish() {
    setBusy(true);
    setError("");
    try {
      await save({
        data: {
          id: item.id,
          previous: original.film_lines ?? [],
          previousGifs: original.gif_lines ?? [],
          lines: ids,
        },
      });
      finish();
      guard?.saved();
      await onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Could not save", "تعذّر الحفظ"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <fieldset className="film-practice" disabled={busy}>
      <label>
        {t("Find a phrase or translation", "ابحث عن جملة أو ترجمتها")}
        <input
          type="search"
          data-workspace-transient
          dir="auto"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPreview(undefined);
          }}
          placeholder={t("Phrase or word", "جملة أو كلمة")}
        />
      </label>
      {!needle && (
        <div className="fc-filters" aria-label={t("Phrase collection", "مجموعة الجمل")}>
          <button type="button" aria-pressed={daily} onClick={() => setDaily(true)}>
            {t("Everyday phrases", "جمل يومية")}
          </button>
          <button type="button" aria-pressed={!daily} onClick={() => setDaily(false)}>
            {t("All clips", "كل المقاطع")} · {lines.length}
          </button>
        </div>
      )}
      <div className="fc-results">
        {matches.map((line) => (
          <div className="fc-result" key={line.id}>
            <button
              type="button"
              className="fc-preview"
              aria-pressed={preview?.id === line.id}
              onClick={() => setPreview(line)}
            >
              <img
                loading="lazy"
                src={`/media/sintel/${line.id}.jpg`}
                width="72"
                height="40"
                alt=""
              />
              <span>
                <strong dir="ltr">{line.en}</strong>
                <span dir="rtl">{line.ar}</span>
              </span>
            </button>
            <button
              className="fc-select"
              type="button"
              aria-pressed={ids.includes(line.id)}
              aria-label={t("Select phrase", "اختيار الجملة") + " · " + line.en}
              onClick={() => toggle(line.id)}
            >
              {ids.includes(line.id) ? <Check size={18} /> : <Plus size={18} />}
            </button>
          </div>
        ))}
      </div>
      {!matches.length && (
        <p role="status">
          {t(
            "No match. Try one word from the phrase.",
            "ما لقينا تطابق. جرّب كلمة واحدة من الجملة.",
          )}
        </p>
      )}
      {preview && (
        <div className="fc-card">
          <MediaFormat value={media} onChange={setMedia} />
          {media === "gif" ? (
            <GifPreview key={preview.id} line={preview} />
          ) : (
            <Clip key={preview.id} line={preview} />
          )}
          <p dir="rtl">{preview.ar}</p>
          <button disabled={ids.includes(preview.id)} onClick={() => setIds([...ids, preview.id])}>
            {t("Add clip to this stop", "أضف المقطع للمحطة")}
          </button>
        </div>
      )}
      {ids.length > 0 && (
        <h4>
          {t("Selected phrases", "جمل التدريب")} · {ids.length}
        </h4>
      )}
      <ol className="fc-selected">
        {ids.map((id) => (
          <li key={id}>
            <bdi>{byId.get(id)?.en}</bdi>{" "}
            <button
              aria-label={t("Remove", "احذف") + " " + byId.get(id)?.en}
              onClick={() => setIds(ids.filter((x) => x !== id))}
            >
              ×
            </button>
          </li>
        ))}
      </ol>
      {error && <p role="alert">{error}</p>}
      <button
        className="fc-primary"
        disabled={previous.join() === ids.join()}
        onClick={() => void publish()}
      >
        {busy ? t("Saving…", "جارٍ الحفظ…") : t("Save practice", "احفظ التدريب")} ({ids.length})
      </button>
    </fieldset>
  );
}

/**
 * What the learner opens on a clips stop: its library clips, or (for a stop saved before the
 * clips library) its Sintel lines.
 */
export function FilmStopPlayer({ item, onClose }: { item: PathItem; onClose: () => void }) {
  const t = useCopy();
  const listFn = useServerFn(listClips);
  const ids = item.clip_ids;
  const query = useQuery({
    queryKey: ["stop-clips", item.id, ids?.join(",")],
    queryFn: () => listFn({ data: { ids: ids ?? [] } }),
    enabled: Boolean(ids?.length),
    gcTime: 0,
  });
  if (!ids)
    return (
      <FilmPlayer clips={sintelClips(mediaLineIds(item))} pool={SINTEL_POOL} onClose={onClose} />
    );
  if (ids.length && query.isPending)
    return <p role="status">{t("Loading clips…", "جارٍ تحميل المقاطع…")}</p>;
  if (query.error)
    return (
      <p role="alert">
        {t("Could not load the clips.", "تعذّر تحميل المقاطع.")}{" "}
        <button type="button" className="underline" onClick={() => void query.refetch()}>
          {t("Retry", "أعد المحاولة")}
        </button>
      </p>
    );
  const clips = query.data?.clips ?? [];
  if (!clips.length)
    return (
      <p role="status">{t("This stop has no clips yet.", "لا توجد مقاطع في هذه المحطة بعد.")}</p>
    );
  return <FilmPlayer clips={clips} pool={query.data?.pool} onClose={onClose} />;
}

/** The link and label that credit a clip (its source page, or GIPHY's page for a GIF). */
function ClipCredit({ clip }: { clip: FilmClip }) {
  const href = clip.credit_url || clip.gif_page;
  const label = clipCredit(clip);
  if (!label) return null;
  return (
    <small dir="ltr" className="fs-credit">
      {href ? (
        <a href={href} target="_blank" rel="noreferrer">
          {label}
        </a>
      ) : (
        label
      )}
      {clip.kind === "gif" && <span className="fs-giphy">Powered by GIPHY</span>}
    </small>
  );
}

/**
 * A session over the clips of a stop: each clip shown once, then each clip's exercises (a video:
 * meaning, word order, speaking; a silent GIF: the fitting sentence, word order). `pool` holds
 * other clips' sentences for the wrong choices.
 */
export function FilmPlayer({
  clips,
  pool = [],
  onClose,
}: {
  clips: FilmClip[];
  pool?: ClipPoolEntry[];
  onClose: () => void;
}) {
  const t = useCopy();
  const lang = useUiLanguage();
  const steps = useMemo(() => sessionSteps(clips), [clips]);
  const choices = useMemo(
    () => [...clips.map((clip) => ({ en: clip.en, ar: clip.ar })), ...pool],
    [clips, pool],
  );
  const [step, setStep] = useState(0);
  // The Sintel lines also ship as GIFs: the learner can watch the same phrase as a GIF.
  const [media, setMedia] = useState<Media>("film");
  const gifReady = clips.some((clip) => sintelGif(clip));
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  const current = steps[step];
  const clip = current ? clips[current.clip] : undefined;
  const credits = [...new Map(clips.map((item) => [clipCredit(item), item])).values()];
  return (
    <dialog
      ref={dialog}
      className="film-session"
      dir={lang === "ar" ? "rtl" : "ltr"}
      aria-label={
        media === "gif" ? t("GIF practice", "تدريب GIF") : t("Film practice", "تدريب المقاطع")
      }
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="fs-layout">
        <header className="fs-top" dir="ltr">
          <span aria-hidden="true">
            <Clapperboard size={23} />
          </span>
          {gifReady && <MediaFormat value={media} onChange={setMedia} />}
          <progress
            aria-label={t("Practice progress", "تقدّم التدريب")}
            value={step}
            max={steps.length || 1}
          />
          <button type="button" aria-label={t("Close practice", "إغلاق التدريب")} onClick={onClose}>
            <X />
          </button>
        </header>
        {current && clip ? (
          <FilmStep
            key={step}
            clip={clip}
            media={media}
            phase={current.type === "intro" ? "intro" : current.exercise}
            index={current.clip}
            count={clips.length}
            choices={choices}
            previous={() => setStep(step - 1)}
            next={() => setStep(step + 1)}
          />
        ) : (
          <>
            <div className="fs-stage">
              <div className="fs-finished">
                <Check size={40} />
                <h2>{t("Practice complete", "أنهيت التدريب")}</h2>
                {credits.map((item) => (
                  <ClipCredit key={item.id} clip={item} />
                ))}
              </div>
            </div>
            <footer className="fs-foot">
              <button className="fs-primary" onClick={onClose}>
                {t("Back to path", "ارجع للخارطة")}
              </button>
            </footer>
          </>
        )}
      </div>
    </dialog>
  );
}

function Highlight({ text, word }: { text: string; word: string }) {
  const i = targetIndex(text, word);
  return i < 0 ? (
    text
  ) : (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + word.length)}</mark>
      {text.slice(i + word.length)}
    </>
  );
}

/** A Sintel clip's ready-made GIF (without extension), or null for other clips. */
function sintelGif(clip: FilmClip) {
  return clip.kind === "video" && clip.legacy_id != null && clip.source === "Sintel"
    ? `/media/sintel/${clip.legacy_id}`
    : null;
}

type Phase = "intro" | ClipExercise;
const PHASE_CLASS: Record<Phase, number> = {
  intro: 0,
  meaning: 1,
  sentence: 1,
  order: 2,
  speak: 3,
};

function FilmStep({
  clip,
  media: format,
  phase,
  index,
  count,
  choices,
  previous,
  next,
}: {
  clip: FilmClip;
  media: Media;
  phase: Phase;
  index: number;
  count: number;
  choices: ClipPoolEntry[];
  previous: () => void;
  next: () => void;
}) {
  const t = useCopy();
  const gif = clip.kind === "gif";
  // A video clip shown as its GIF: the picture moves, the sound comes from the hidden video.
  const gifView = format === "gif" ? sintelGif(clip) : null;
  const [moving, setMoving] = useGifMotion();
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const [options] = useState(() =>
    phase === "meaning"
      ? choiceOptions(
          clip.ar,
          choices.map((entry) => entry.ar),
        )
      : phase === "sentence"
        ? choiceOptions(
            clip.en,
            choices.map((entry) => entry.en),
          )
        : [],
  );
  const { prefix, words } = orderPuzzle(clip.en, clip.target);
  const [bank] = useState(() => mixedOrder(words.length));
  const [picked, setPicked] = useState<number[]>([]);
  const [choice, setChoice] = useState<string>();
  const [checked, setChecked] = useState(false);
  const right = phase === "meaning" ? clip.ar : clip.en;
  const correct =
    phase === "order"
      ? picked.map((i) => words[i]).join(" ") === words.join(" ")
      : choice === right;
  const title = {
    intro: gif ? t("Watch", "شاهد") : t("Watch and listen", "شاهد واسمع"),
    meaning: gifView
      ? t("Choose the translation of this phrase.", "اختَر ترجمة العبارة.")
      : t("Choose the translation you hear.", "اختر ترجمة العبارة التي تسمعها في الفيديو."),
    sentence: t("Which sentence fits the clip?", "اختر الجملة التي تناسب المقطع."),
    order: gif
      ? t("Build the sentence.", "رتّب كلمات الجملة.")
      : gifView
        ? t("Listen and arrange the words.", "استمع للعبارة ورتّب كلماتها.")
        : t("Build the phrase you hear.", "رتّب كلمات العبارة التي تسمعها في الفيديو."),
    speak: t("Say the phrase.", "انطق العبارة."),
  }[phase];
  const start = clip.start_s ?? 0;

  async function play(rate = 1) {
    const el = video.current;
    if (!el) return;
    try {
      if (error) el.load();
      setError(false);
      el.currentTime = start;
      el.playbackRate = rate;
      await el.play();
    } catch {
      setError(true);
    }
  }
  const media = gif ? (
    <video
      ref={video}
      src={clip.gif_mp4 ?? undefined}
      poster={clip.gif_still ?? undefined}
      aria-label={t("GIF", "صورة متحركة")}
      muted
      loop
      autoPlay
      playsInline
      onError={() => setError(true)}
    />
  ) : (
    <video
      ref={video}
      src={clip.video_url ?? undefined}
      poster={clip.poster_url ?? undefined}
      preload={gifView ? "none" : "metadata"}
      playsInline
      onLoadedMetadata={(event) => {
        if (start && event.currentTarget.currentTime < start)
          event.currentTarget.currentTime = start;
      }}
      onTimeUpdate={(event) => {
        if (clip.end_s != null && event.currentTarget.currentTime >= clip.end_s)
          event.currentTarget.pause();
      }}
      onPlaying={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={() => setPlaying(false)}
      onError={() => setError(true)}
    />
  );
  const translation = (
    <>
      <p dir="ltr" lang="en">
        <Highlight text={clip.en} word={clip.target} />
      </p>
      <p dir="rtl" lang="ar">
        <Highlight text={clip.ar} word={clip.target_ar} />
      </p>
    </>
  );
  return (
    <>
      <div className={"fs-stage fs-phase-" + PHASE_CLASS[phase]}>
        <div className="fs-column">
          <h2 className={phase === "intro" ? "sr-only" : undefined}>{title}</h2>
          <article className="fs-card">
            {phase !== "speak" ? (
              <div className="fs-scene">
                {gifView ? (
                  <>
                    <img className="fs-gif" src={`${gifView}.${moving ? "gif" : "jpg"}`} alt="" />
                    <div hidden>{media}</div>
                  </>
                ) : (
                  media
                )}
                {gifView ? (
                  <button
                    type="button"
                    className="fs-play"
                    aria-label={
                      moving ? t("Pause GIF", "أوقف الصورة") : t("Play GIF", "حرّك الصورة")
                    }
                    onClick={() => setMoving(!moving)}
                  >
                    <span>{moving ? <Pause size={17} /> : <Play size={17} />}</span>
                  </button>
                ) : (
                  !gif && (
                    <button
                      type="button"
                      className="fs-play"
                      aria-label={
                        playing ? t("Pause", "إيقاف مؤقت") : t("Play clip", "شغّل المقطع")
                      }
                      onClick={() => (playing ? video.current?.pause() : void play())}
                    >
                      <span>{playing ? <Pause size={17} /> : <Play size={17} />}</span>
                    </button>
                  )
                )}
              </div>
            ) : (
              <div hidden>{media}</div>
            )}
            {gifView && phase !== "speak" && (
              <button
                className="fs-gif-listen"
                onClick={() => (playing ? video.current?.pause() : void play())}
              >
                <Volume2 size={18} />
                {playing
                  ? t("Pause dialogue", "أوقف الصوت")
                  : t("Listen to the phrase", "اسمع العبارة")}
              </button>
            )}
            {gifView && phase === "meaning" && (
              <p className="fs-caption" dir="ltr">
                {clip.en}
              </p>
            )}
            {gifView && phase === "order" && (
              <p className="fs-caption" dir="rtl">
                {clip.ar}
              </p>
            )}
            {error && (
              <button
                className="fs-retry"
                onClick={() => (gif ? (setError(false), video.current?.load()) : void play())}
              >
                {t("Could not play · Retry", "تعذّر التشغيل · أعد المحاولة")}
              </button>
            )}
            {phase === "intro" && (
              <>
                {clip.context_ar && (
                  <div className="fs-caption" dir="rtl">
                    {clip.context_ar}
                  </div>
                )}
                <div className="fs-lines">{translation}</div>
                <ClipCredit clip={clip} />
              </>
            )}
            {phase === "order" && gif && (
              <p className="fs-hint" dir="rtl" lang="ar">
                {clip.ar}
              </p>
            )}
            {phase === "order" && (
              <div className="fs-answer" dir="ltr" aria-label={t("Your phrase", "عبارتك")}>
                {prefix && <strong>{prefix}</strong>}
                {words.map((word, i) => {
                  const id = picked[i];
                  return id === undefined ? (
                    <span
                      aria-hidden="true"
                      className="fs-slot"
                      key={i}
                      style={{ width: `${Math.min(10, Math.max(3, word.length))}ch` }}
                    />
                  ) : (
                    <button
                      key={i}
                      disabled={checked}
                      data-grade={checked ? (words[id] === word ? "right" : "wrong") : undefined}
                      onClick={() => setPicked(picked.filter((_, n) => n !== i))}
                    >
                      {words[id]}
                    </button>
                  );
                })}
              </div>
            )}
            {phase === "speak" && (
              <div className="fs-lines">
                {translation}
                <div className="fs-listen" dir="ltr">
                  {[1, 0.75].map((rate) => (
                    <button
                      key={rate}
                      aria-label={
                        rate === 1 ? t("Listen", "اسمع") : t("Listen slowly", "اسمع ببطء")
                      }
                      onClick={() => void play(rate)}
                    >
                      {rate === 1 ? <Volume2 /> : <Turtle />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </article>
          {(phase === "meaning" || phase === "sentence") && (
            <div className="fs-options" dir={phase === "meaning" ? "rtl" : "ltr"}>
              {options.map((option) => (
                <button
                  key={option}
                  disabled={checked}
                  aria-pressed={choice === option}
                  onClick={() => setChoice(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
          {phase === "order" && (
            <div className="fs-bank" dir="ltr">
              {bank.map((id) => (
                <button
                  key={id}
                  disabled={checked || picked.includes(id)}
                  onClick={() => setPicked([...picked, id])}
                >
                  {words[id]}
                </button>
              ))}
            </div>
          )}
          {phase === "speak" && (
            <FilmSpeaking t={t} stopVideo={() => video.current?.pause()} onDone={next} />
          )}
        </div>
      </div>
      {phase !== "speak" && (
        <footer
          className="fs-foot"
          data-grade={checked ? (correct ? "right" : "wrong") : undefined}
        >
          {phase === "intro" && (
            <div className="fs-dots" aria-label={t("Clip", "المقطع") + ` ${index + 1}/${count}`}>
              {Array.from({ length: count }, (_, i) => (
                <i key={i} data-current={i === index} />
              ))}
            </div>
          )}
          {checked && (
            <div className="fs-feedback" role="status">
              <strong>{correct ? t("Correct!", "صحيح!") : t("Incorrect", "غير صحيح")}</strong>
              {!correct && (
                <p>
                  {t("Correct answer", "الإجابة الصحيحة")} · <bdi>{right}</bdi>
                </p>
              )}
            </div>
          )}
          <div className="fs-buttons">
            <button
              className="fs-primary"
              disabled={
                phase === "meaning" || phase === "sentence"
                  ? choice === undefined
                  : phase === "order" && picked.length !== words.length
              }
              onClick={phase === "intro" || checked ? next : () => setChecked(true)}
            >
              {phase === "intro" || checked ? t("Continue", "متابعة") : t("Check", "تحقّق")}
            </button>
            {phase === "intro" && index > 0 && (
              <button
                className="fs-prev"
                aria-label={t("Previous clip", "المقطع السابق")}
                onClick={previous}
              >
                <ArrowLeft />
              </button>
            )}
          </div>
        </footer>
      )}
    </>
  );
}
