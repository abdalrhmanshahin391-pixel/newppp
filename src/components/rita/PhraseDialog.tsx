import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Gauge, Loader2, Snail, Target, X, Zap } from "lucide-react";
import { explainPhrase } from "@/lib/rita-phrase.functions";
import { ttsHeaders } from "@/lib/tts-auth";
import {
  getPhraseAudio,
  cachedExplanation,
  playPhraseUrl,
  rememberExplanation,
  stopPhraseAudio,
} from "@/lib/phrase-cache";
import { cleanPhrase, type PhraseExplanation, type PronounceStyle } from "@/lib/rita-phrase";

const STYLE_LABEL: Record<PronounceStyle, { label: string; hint: string }> = {
  fast: { label: "Fast", hint: "Natural speed" },
  slow: { label: "Slow", hint: "Clear and slow" },
  precise: { label: "Precise", hint: "Word by word" },
};

function StyleIcon({ style }: { style: PronounceStyle }) {
  if (style === "fast") return <Zap size={16} />;
  if (style === "slow") return <Snail size={16} />;
  return <Target size={16} />;
}

/**
 * The "tap a word" window: the phrase, its Arabic meaning, how it sounds, and
 * three ways to hear it. Everything is fetched once per device (see phrase-cache).
 * `onPlayingChange` lets the page mute the microphone while a clip plays.
 */
export function PhraseDialog({
  phrase,
  onClose,
  onPlayingChange,
}: {
  phrase: string;
  onClose: () => void;
  onPlayingChange?: (playing: boolean) => void;
}) {
  const explainFn = useServerFn(explainPhrase);
  const text = cleanPhrase(phrase);
  const [explanation, setExplanation] = useState<PhraseExplanation | null>(() =>
    cachedExplanation(text),
  );
  const [loading, setLoading] = useState(!cachedExplanation(text));
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<PronounceStyle | null>(null);
  const [playing, setPlaying] = useState<PronounceStyle | null>(null);
  const [audioError, setAudioError] = useState(false);
  const token = useRef(0);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Closing the window stops the voice and gives the microphone back.
  useEffect(
    () => () => {
      token.current += 1;
      stopPhraseAudio();
      onPlayingChange?.(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const known = cachedExplanation(text);
    if (known) {
      setExplanation(known);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    explainFn({ data: { text } })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          rememberExplanation(text, result.explanation);
          setExplanation(result.explanation);
        } else {
          setFailed(true);
        }
      })
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [explainFn, text, attempt]);

  const lang = explanation?.lang === "en" ? "en" : explanation?.lang === "de" ? "de" : null;

  const play = useCallback(
    async (style: PronounceStyle) => {
      if (!lang) return;
      const mine = ++token.current;
      setAudioError(false);
      setBusy(style);
      setPlaying(null);
      stopPhraseAudio();
      const url = await getPhraseAudio(text, lang, style, async () => {
        const headers = await ttsHeaders();
        if (!headers) return null;
        const response = await fetch("/api/german/tts", {
          method: "POST",
          headers,
          body: JSON.stringify({ text, lang, style }),
        });
        return response.ok ? response.blob() : null;
      });
      if (mine !== token.current) return; // a newer tap or closing won
      setBusy(null);
      if (!url) {
        setAudioError(true);
        return;
      }
      setPlaying(style);
      onPlayingChange?.(true);
      await playPhraseUrl(url);
      if (mine !== token.current) return;
      setPlaying(null);
      onPlayingChange?.(false);
    },
    [lang, onPlayingChange, text],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-[#121117]/40 sm:items-center sm:justify-center"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={text}
        className="edith-premium w-full rounded-t-3xl bg-white p-6 text-[var(--pp-ink)] shadow-2xl sm:max-w-md sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {lang && (
              <p className="text-sm font-bold text-[var(--pp-pink-text)]">
                {lang === "de" ? "Deutsch" : "English"}
              </p>
            )}
            <h2 dir="ltr" className="break-words text-[30px] font-bold leading-9">
              {text}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--pp-muted)] hover:bg-[var(--pp-grey)]"
          >
            <X size={20} />
          </button>
        </div>

        <div dir="rtl" lang="ar" className="mt-4 min-h-[88px]">
          {loading && (
            <p className="flex items-center gap-2 text-[16px] text-[var(--pp-muted)]">
              <Loader2 className="animate-spin" size={16} /> جاري التحميل…
            </p>
          )}
          {!loading && failed && (
            <p className="text-[16px] text-[var(--pp-pink-text)]">
              تعذّر تحميل الترجمة.{" "}
              <button
                type="button"
                className="font-bold underline"
                onClick={() => setAttempt((count) => count + 1)}
              >
                حاول مجددًا
              </button>
            </p>
          )}
          {!loading && explanation && (
            <div className="space-y-2">
              <p className="text-[22px] font-bold leading-8">{explanation.translation_ar}</p>
              {explanation.pronunciation_ar && (
                <p className="text-[16px] text-[var(--pp-muted)]">
                  النطق:{" "}
                  <span className="font-semibold text-[var(--pp-ink)]">
                    {explanation.pronunciation_ar}
                  </span>
                </p>
              )}
              {explanation.tip_ar && (
                <p className="text-[14px] leading-6 text-[var(--pp-muted)]">{explanation.tip_ar}</p>
              )}
            </div>
          )}
        </div>

        {lang && (
          <div className="mt-5">
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(STYLE_LABEL) as PronounceStyle[]).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => void play(style)}
                  aria-label={`${STYLE_LABEL[style].label}: ${STYLE_LABEL[style].hint}`}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 border-[var(--pp-ink)] px-2 py-2.5 text-sm font-bold ${
                    playing === style
                      ? "bg-[var(--pp-pink)]"
                      : "bg-white hover:bg-[var(--pp-pink-soft)]"
                  }`}
                >
                  {busy === style ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : playing === style ? (
                    <Gauge size={16} />
                  ) : (
                    <StyleIcon style={style} />
                  )}
                  {STYLE_LABEL[style].label}
                  <span className="text-[11px] font-semibold text-[var(--pp-muted)]">
                    {STYLE_LABEL[style].hint}
                  </span>
                </button>
              ))}
            </div>
            {audioError && (
              <p dir="rtl" className="mt-2 text-sm font-semibold text-[var(--pp-pink-text)]">
                تعذّر تشغيل الصوت الآن. حاول مرة ثانية.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
