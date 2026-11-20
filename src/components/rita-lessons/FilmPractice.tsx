import { useEffect, useRef, useState } from "react";
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
import { useUiLanguage } from "@/components/language/useUiLanguage";
import lines from "@/lib/sintel-lines.json";
import { savePathFilmLines } from "@/lib/rita-path-items.functions";
import type { PathItem } from "@/lib/rita-path-layout";
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
function shuffled<T>(values: T[]) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
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

export function FilmEditor({
  item,
  media,
  onChanged,
  onClose,
}: {
  item: PathItem;
  media: Media;
  onChanged: () => Promise<void>;
  onClose: () => void;
}) {
  const t = useCopy();
  const save = useServerFn(savePathFilmLines);
  const [previous] = useState((media === "gif" ? item.gif_lines : item.film_lines) ?? []);
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
      await save({ data: { id: item.id, previous, lines: ids, media } });
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
        {media === "gif"
          ? t("Find a GIF by its phrase", "ابحث عن GIF بالجملة أو ترجمتها")
          : t("Search Sintel dialogue", "ابحث في حوار سينتل")}
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

export function FilmPlayer({
  ids,
  media = "film",
  onClose,
}: {
  ids: number[];
  media?: Media;
  onClose: () => void;
}) {
  const t = useCopy();
  const lang = useUiLanguage();
  const selected = ids.flatMap((id) => byId.get(id) ?? []);
  const [step, setStep] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  // First introduce the selected phrases, then practise each one in three ways.
  const count = selected.length;
  const preview = step < count;
  const index = preview ? step : Math.floor((step - count) / 3);
  const phase = preview ? 0 : 1 + ((step - count) % 3);
  const line = selected[index];
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
          <a
            href="https://durian.blender.org/sharing/"
            target="_blank"
            rel="noreferrer"
            aria-label="Sintel · © Blender Foundation · CC BY 3.0"
            title="Sintel · © Blender Foundation · CC BY 3.0"
          >
            <Clapperboard size={23} />
          </a>
          <progress
            aria-label={t("Practice progress", "تقدّم التدريب")}
            value={step}
            max={count * 4 || 1}
          />
          <button type="button" aria-label={t("Close practice", "إغلاق التدريب")} onClick={onClose}>
            <X />
          </button>
        </header>
        {line ? (
          <FilmStep
            key={step}
            line={line}
            media={media}
            phase={phase}
            index={index}
            count={count}
            previous={() => setStep(step - 1)}
            next={() => setStep(step + 1)}
          />
        ) : (
          <>
            <div className="fs-stage">
              <div className="fs-finished">
                <Check size={40} />
                <h2>{t("Practice complete", "أنهيت التدريب")}</h2>
                <Credit />
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
  const i = text.indexOf(word);
  return i < 0 ? (
    text
  ) : (
    <>
      {text.slice(0, i)}
      <mark>{word}</mark>
      {text.slice(i + word.length)}
    </>
  );
}

function FilmStep({
  line,
  media: kind,
  phase,
  index,
  count,
  previous,
  next,
}: {
  line: Line;
  media: Media;
  phase: number;
  index: number;
  count: number;
  previous: () => void;
  next: () => void;
}) {
  const t = useCopy();
  const video = useRef<HTMLVideoElement>(null);
  const [moving, setMoving] = useGifMotion();
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const [options] = useState(() =>
    shuffled([line, ...shuffled(lines.filter((l) => l.ar !== line.ar)).slice(0, 2)]),
  );
  const phrase = line.en.split(/\s+/);
  const prefixLength = Math.max(
    0,
    Math.min(
      phrase.length - 4,
      phrase.findIndex((word) => word.includes(line.target)),
    ),
  );
  const prefix = phrase.slice(0, prefixLength).join(" ");
  const words = phrase.slice(prefixLength);
  const [bank] = useState(() => {
    const mixed = shuffled(words.map((_, i) => i));
    if (mixed.every((v, i) => v === i)) mixed.push(mixed.shift()!);
    return mixed;
  });
  const [picked, setPicked] = useState<number[]>([]);
  const [choice, setChoice] = useState<number>();
  const [checked, setChecked] = useState(false);
  const correct =
    phase === 1 ? choice === line.id : picked.map((i) => words[i]).join(" ") === words.join(" ");
  const title = [
    t("Watch and listen", "شاهد واسمع"),
    kind === "gif"
      ? t("Choose the translation of this phrase.", "اختَر ترجمة العبارة.")
      : t("Choose the translation you hear.", "اختر ترجمة العبارة التي تسمعها في الفيديو."),
    kind === "gif"
      ? t("Listen and arrange the words.", "استمع للعبارة ورتّب كلماتها.")
      : t("Build the phrase you hear.", "رتّب كلمات العبارة التي تسمعها في الفيديو."),
    t("Say the phrase.", "انطق العبارة."),
  ][phase];
  async function play(rate = 1) {
    const el = video.current;
    if (!el) return;
    try {
      if (error) el.load();
      setError(false);
      el.currentTime = 0;
      el.playbackRate = rate;
      await el.play();
    } catch {
      setError(true);
    }
  }
  const media = (
    <video
      ref={video}
      src={`/media/sintel/${line.id}.mp4`}
      poster={`/media/sintel/${line.id}.jpg`}
      preload={kind === "gif" ? "none" : "metadata"}
      playsInline
      onPlaying={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={() => setPlaying(false)}
      onError={() => setError(true)}
    />
  );
  const translation = (
    <>
      <p dir="ltr" lang="en">
        <Highlight text={line.en} word={line.target} />
      </p>
      <p dir="rtl" lang="ar">
        <Highlight text={line.ar} word={line.targetAr} />
      </p>
    </>
  );
  return (
    <>
      <div className={"fs-stage fs-phase-" + phase}>
        <div className="fs-column">
          <h2 className={phase === 0 ? "sr-only" : undefined}>{title}</h2>
          <article className="fs-card">
            {phase !== 3 ? (
              <div className="fs-scene">
                {kind === "gif" ? (
                  <>
                    <img
                      className="fs-gif"
                      src={`/media/sintel/${line.id}.${moving ? "gif" : "jpg"}`}
                      alt=""
                    />
                    <div hidden>{media}</div>
                  </>
                ) : (
                  media
                )}
                <button
                  type="button"
                  className="fs-play"
                  aria-label={
                    kind === "gif"
                      ? moving
                        ? t("Pause GIF", "أوقف الصورة")
                        : t("Play GIF", "حرّك الصورة")
                      : playing
                        ? t("Pause", "إيقاف مؤقت")
                        : t("Play clip", "شغّل المقطع")
                  }
                  onClick={() =>
                    kind === "gif"
                      ? setMoving(!moving)
                      : playing
                        ? video.current?.pause()
                        : void play()
                  }
                >
                  <span>
                    {(kind === "gif" ? moving : playing) ? <Pause size={17} /> : <Play size={17} />}
                  </span>
                </button>
              </div>
            ) : (
              <div hidden>{media}</div>
            )}
            {kind === "gif" && phase !== 3 && (
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
            {kind === "gif" && phase === 2 && (
              <p className="fs-caption" dir="rtl">
                {line.ar}
              </p>
            )}
            {error && (
              <button className="fs-retry" onClick={() => void play()}>
                {t("Could not play · Retry", "تعذّر التشغيل · أعد المحاولة")}
              </button>
            )}
            {phase === 0 && (
              <>
                <div className="fs-caption" dir="rtl">
                  {line.contextAr}
                </div>
                <div className="fs-lines">{translation}</div>
              </>
            )}
            {phase === 1 && kind === "gif" && (
              <p className="fs-caption" dir="ltr">
                {line.en}
              </p>
            )}
            {phase === 2 && (
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
            {phase === 3 && (
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
          {phase === 1 && (
            <div className="fs-options" dir="rtl">
              {options.map((o) => (
                <button
                  key={o.id}
                  disabled={checked}
                  aria-pressed={choice === o.id}
                  onClick={() => setChoice(o.id)}
                >
                  {o.ar}
                </button>
              ))}
            </div>
          )}
          {phase === 2 && (
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
          {phase === 3 && (
            <FilmSpeaking t={t} stopVideo={() => video.current?.pause()} onDone={next} />
          )}
        </div>
      </div>
      {phase !== 3 && (
        <footer
          className="fs-foot"
          data-grade={checked ? (correct ? "right" : "wrong") : undefined}
        >
          {phase === 0 && (
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
                  {t("Correct answer", "الإجابة الصحيحة")} ·{" "}
                  <bdi>{phase === 1 ? line.ar : line.en}</bdi>
                </p>
              )}
            </div>
          )}
          <div className="fs-buttons">
            <button
              className="fs-primary"
              disabled={
                phase === 1 ? choice === undefined : phase === 2 && picked.length !== words.length
              }
              onClick={phase === 0 || checked ? next : () => setChecked(true)}
            >
              {phase === 0 || checked ? t("Continue", "متابعة") : t("Check", "تحقّق")}
            </button>
            {phase === 0 && index > 0 && (
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
