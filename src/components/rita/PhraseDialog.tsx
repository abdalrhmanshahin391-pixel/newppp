import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Gauge, Loader2, Snail, Square, Target, Volume2, X, Zap } from "lucide-react";
import { explainPhrase } from "@/lib/rita-phrase.functions";
import { ttsHeaders } from "@/lib/tts-auth";
import {
  getPhraseAudio,
  cachedExplanation,
  playPhraseUrl,
  rememberExplanation,
  stopPhraseAudio,
} from "@/lib/phrase-cache";
import {
  cleanPhrase,
  explainFailureText,
  guessPhraseLang,
  type PhraseExplanation,
  type PronounceStyle,
} from "@/lib/rita-phrase";
import type { LearningItem } from "@/lib/rita-learning";

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
  context = "",
  compact = false,
  onClose,
  onPlayingChange,
  onWord,
}: {
  phrase: string;
  context?: string;
  /** A non-modal study card with one pronunciation action. */
  compact?: boolean;
  onClose: () => void;
  onPlayingChange?: (playing: boolean) => void;
  /** Called once per phrase with the word and its meaning, so it lands in the learner's Words list. */
  onWord?: (item: LearningItem) => void;
}) {
  const explainFn = useServerFn(explainPhrase);
  const text = cleanPhrase(phrase);
  const [explanation, setExplanation] = useState<PhraseExplanation | null>(() =>
    cachedExplanation(text, context),
  );
  const [loading, setLoading] = useState(!cachedExplanation(text, context));
  const [failed, setFailed] = useState(false);
  const [failReason, setFailReason] = useState("");
  const [saved, setSaved] = useState(false);
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
    const known = cachedExplanation(text, context);
    setFailed(false);
    setFailReason("");
    setExplanation(known);
    if (known) {
      setExplanation(known);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    explainFn({ data: { text, context: context || undefined } })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          rememberExplanation(text, result.explanation, context);
          setExplanation(result.explanation);
        } else {
          setFailReason(result.reason);
          setFailed(true);
        }
      })
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [explainFn, text, context, attempt]);

  const lang =
    explanation?.lang === "en"
      ? "en"
      : explanation?.lang === "de"
        ? "de"
        : !compact && !explanation && failed
          ? (guessPhraseLang(text) as "de" | "en" | null)
          : null;

  // Every phrase the learner taps goes into their Words list, ready to become a flashcard.
  const savedFor = useRef("");
  useEffect(() => {
    if (!explanation || !lang || !onWord || savedFor.current === text) return;
    savedFor.current = text;
    onWord({
      term: text,
      meaning: explanation.translation_ar,
      language: lang,
      kind: text.split(/\s+/).length > 2 ? "sentence" : "word",
      article: null,
      plural: null,
    });
    setSaved(true);
  }, [explanation, lang, onWord, text]);

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
          signal: AbortSignal.timeout(15_000),
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
      const played = await playPhraseUrl(url);
      if (mine !== token.current) return;
      setPlaying(null);
      if (!played) setAudioError(true);
      onPlayingChange?.(false);
    },
    [lang, onPlayingChange, text],
  );

  if (compact)
    return (
      <section
        className="st-meaning"
        role="dialog"
        aria-label="معنى ونطق"
        dir="rtl"
        aria-busy={loading}
      >
        <header className="st-meaning-head">
          <h2>
            <Volume2 size={16} aria-hidden="true" /> معنى ونطق
          </h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="إغلاق معنى ونطق">
            <X size={18} />
          </button>
        </header>
        <p className="st-meaning-term" dir="auto">
          {text}
        </p>
        <div className="st-meaning-result" role="status" aria-live="polite">
          {loading ? (
            <p className="st-meaning-muted">
              <Loader2 size={16} className="animate-spin" /> عم نجيب المعنى حسب الجملة…
            </p>
          ) : failed ? (
            <p className="st-meaning-muted">
              تعذّر تحميل المعنى.{" "}
              <button
                type="button"
                className="st-meaning-retry"
                onClick={() => setAttempt((count) => count + 1)}
              >
                جرّب مرة ثانية
              </button>
            </p>
          ) : explanation ? (
            <>
              <p className="st-meaning-translation">{explanation.translation_ar}</p>
              <p className="st-meaning-muted">المعنى بهالجملة</p>
            </>
          ) : null}
        </div>
        <button
          className="st-meaning-play"
          type="button"
          disabled={loading || !lang || Boolean(busy)}
          onClick={() => {
            if (playing) {
              token.current += 1;
              stopPhraseAudio();
              setPlaying(null);
              onPlayingChange?.(false);
            } else void play("fast");
          }}
        >
          {busy ? (
            <Loader2 size={17} className="animate-spin" />
          ) : playing ? (
            <Square size={16} />
          ) : (
            <Volume2 size={18} />
          )}
          {busy ? "عم نجهّز النطق…" : playing ? "إيقاف النطق" : "اسمع النطق"}
        </button>
        {audioError && (
          <p className="st-meaning-muted" role="alert">
            تعذّر تشغيل الصوت. اضغط «اسمع النطق» للمحاولة مجددًا.
          </p>
        )}
      </section>
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
              <p className="text-sm font-bold text-[var(--pp-accent-text)]">
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
            <p className="text-[16px] text-[var(--pp-accent-text)]">
              {explainFailureText(failReason)}{" "}
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
              {saved && (
                <p className="text-[14px] font-semibold text-[var(--pp-ink)]">
                  أُضيفت إلى كلماتك، وتقدر تحوّلها لبطاقة.
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
                      ? "bg-[var(--pp-accent)] text-[var(--pp-on-accent)]"
                      : "bg-white hover:bg-[var(--pp-accent-soft)]"
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
              <p dir="rtl" className="mt-2 text-sm font-semibold text-[var(--pp-accent-text)]">
                تعذّر تشغيل الصوت الآن. حاول مرة ثانية.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
