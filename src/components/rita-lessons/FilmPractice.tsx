import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useUiLanguage } from "@/components/language/useUiLanguage";
import lines from "@/lib/sintel-lines.json";
import { savePathFilmLines } from "@/lib/rita-path-items.functions";
import type { PathItem } from "@/lib/rita-path-layout";
import { useWorkspaceDraft, useWorkspaceGuard, useWorkspaceTask } from "./admin/WorkspaceGuard";
import { FilmSpeaking } from "./FilmSpeaking";
import "./film-practice.css";

type Line = (typeof lines)[number];
const byId = new Map(lines.map((line) => [line.id, line]));
const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
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
  const internal = useRef<HTMLVideoElement>(null);
  const ref = video ?? internal;
  return (
    <>
      <video
        ref={ref}
        aria-label={t("Sintel dialogue clip", "مشهد من سينتل")}
        src={`/media/sintel/${line.id}.mp4`}
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
      <Credit />
    </>
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
  const [previous] = useState(item.film_lines ?? []);
  const [ids, setIds] = useState(previous);
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<Line>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const finish = useWorkspaceTask(busy);
  const guard = useWorkspaceGuard();
  useWorkspaceDraft(ids);
  const needle = normalize(query);
  const matches = lines.filter(
    (line) =>
      [line.en, line.ar].some((text) =>
        (" " + normalize(text) + " ").includes(" " + needle + " "),
      ) || !needle,
  );
  async function publish() {
    setBusy(true);
    setError("");
    try {
      await save({ data: { id: item.id, previous, lines: ids } });
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
        {t("Search Sintel dialogue", "ابحث في حوار سينتل")}
        <input
          type="search"
          dir="auto"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPreview(undefined);
          }}
          placeholder={t("Phrase or word", "جملة أو كلمة")}
        />
      </label>
      <div className="fc-results">
        {matches.map((line) => (
          <button
            key={line.id}
            aria-pressed={preview?.id === line.id}
            dir="ltr"
            onClick={() => setPreview(line)}
          >
            {ids.includes(line.id) && "✓ "}
            {line.en}
          </button>
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
          <Clip key={preview.id} line={preview} />
          <p dir="rtl">{preview.ar}</p>
          <button disabled={ids.includes(preview.id)} onClick={() => setIds([...ids, preview.id])}>
            {t("Add clip to this stop", "أضف المقطع للمحطة")}
          </button>
        </div>
      )}
      <ol>
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
        {t("Save clips", "احفظ المقاطع")} ({ids.length})
      </button>
    </fieldset>
  );
}

export function FilmPlayer({ ids, onClose }: { ids: number[]; onClose: () => void }) {
  const t = useCopy();
  const selected = ids.flatMap((id) => byId.get(id) ?? []);
  const [step, setStep] = useState(0);
  const line = selected[Math.floor(step / 4)];
  if (!line)
    return (
      <div className="film-practice">
        <h4>{t("Practice complete", "أنهيت التدريب")}</h4>
        <button className="fc-primary" onClick={onClose}>
          {t("Back to path", "ارجع للخارطة")}
        </button>
      </div>
    );
  return (
    <div className="film-practice">
      <progress
        aria-label={t("Practice progress", "تقدّم التدريب")}
        value={step}
        max={4 * selected.length}
      />
      <FilmStep key={step} line={line} phase={step % 4} next={() => setStep((s) => s + 1)} />
    </div>
  );
}

function FilmStep({ line, phase, next }: { line: Line; phase: number; next: () => void }) {
  const t = useCopy();
  const video = useRef<HTMLVideoElement>(null);
  const [options] = useState(() =>
    shuffled([line, ...shuffled(lines.filter((other) => other.ar !== line.ar)).slice(0, 2)]),
  );
  const words = line.en.split(/\s+/);
  const [bank] = useState(() => {
    const mixed = shuffled(words.map((_, i) => i));
    if (mixed.every((v, i) => v === i)) mixed.push(mixed.shift()!);
    return mixed;
  });
  const [picked, setPicked] = useState<number[]>([]);
  const [choice, setChoice] = useState<number>();
  const [checked, setChecked] = useState(false);
  const [playError, setPlayError] = useState(false);
  const correct =
    phase === 1 ? choice === line.id : picked.map((i) => words[i]).join(" ") === line.en;
  const title = [
    t("Watch and listen", "شاهد واسمع"),
    t("Choose the translation", "اختر ترجمة العبارة"),
    t("Build the phrase you hear", "رتّب كلمات العبارة اللي سمعتها"),
    t("Say the phrase", "انطق العبارة"),
  ][phase];
  async function replay(rate: number) {
    if (!video.current) return;
    video.current.currentTime = 0;
    video.current.playbackRate = rate;
    try {
      await video.current.play();
      setPlayError(false);
    } catch {
      setPlayError(true);
    }
  }
  return (
    <>
      <h4>{title}</h4>
      <div className="fc-card">
        <Clip line={line} video={video} />
        {(phase === 0 || phase === 3) && (
          <>
            <p dir="ltr" lang="en">
              <strong>
                {line.en.split(line.target)[0]}
                <mark>{line.target}</mark>
                {line.en.split(line.target)[1]}
              </strong>
            </p>
            <p dir="rtl" lang="ar">
              {line.ar}
            </p>
          </>
        )}
      </div>
      {phase === 1 && (
        <div className="fc-options" dir="rtl">
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
        <>
          <div className="fc-answer" dir="ltr" aria-label={t("Your phrase", "عبارتك")}>
            {picked.map((id, i) => (
              <button
                key={id}
                disabled={checked}
                onClick={() => setPicked(picked.filter((_, n) => n !== i))}
              >
                {words[id]}
              </button>
            ))}
          </div>
          <div className="fc-bank" dir="ltr">
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
        </>
      )}
      {phase === 3 ? (
        <>
          <div className="fc-actions">
            {[1, 0.75].map((rate) => (
              <button key={rate} onClick={() => void replay(rate)}>
                {rate === 1 ? t("Listen", "اسمع") : t("Listen slowly", "اسمع ببطء")}
              </button>
            ))}
          </div>
          {playError && (
            <p role="alert">
              {t("Use the video controls to replay.", "استخدم زر تشغيل الفيديو للإعادة.")}
            </p>
          )}
          <FilmSpeaking t={t} stopVideo={() => video.current?.pause()} onDone={next} />
        </>
      ) : (
        <>
          {checked && (
            <p role="status" className={correct ? "fc-right" : "fc-wrong"}>
              {correct ? (
                t("Correct!", "صحيح!")
              ) : (
                <>
                  {t("Correct answer", "الإجابة الصحيحة")} ·{" "}
                  <bdi>{phase === 1 ? line.ar : line.en}</bdi>
                </>
              )}
            </p>
          )}
          <button
            className="fc-primary"
            disabled={
              phase === 1 ? choice === undefined : phase === 2 && picked.length !== words.length
            }
            onClick={phase === 0 || checked ? next : () => setChecked(true)}
          >
            {phase === 0 || checked ? t("Continue", "متابعة") : t("Check", "تحقّق")}
          </button>
        </>
      )}
    </>
  );
}
