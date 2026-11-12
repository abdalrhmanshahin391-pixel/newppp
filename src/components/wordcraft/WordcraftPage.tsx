import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Lock, Trash2, Volume2 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { useUiLanguage } from "@/components/language/useUiLanguage";
import { BY_WORD } from "@/lib/wordcraft/lexicon";
import {
  ammanDay,
  dailyPick,
  EMPTY_PROGRESS,
  isOpen,
  parseProgress,
  PROGRESS_KEY,
  type Progress,
} from "@/lib/wordcraft/game";
import { DAILY_POOL, PACKS, packPuzzles, PUZZLE_BY_ID } from "@/lib/wordcraft/packs";
import { WordcraftGame } from "./WordcraftGame";
import "./wordcraft.css";

type Lang = "en" | "ar";

/** Progress kept on this device (a broken or blocked storage just starts empty). */
function useProgress(): [Progress, (next: (p: Progress) => Progress) => void] {
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  useEffect(() => {
    try {
      setProgress(parseProgress(window.localStorage.getItem(PROGRESS_KEY)));
    } catch {
      /* storage blocked: progress lives for this visit only */
    }
  }, []);
  const update = useCallback((next: (p: Progress) => Progress) => {
    setProgress((current) => {
      const value = next(current);
      try {
        window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(value));
      } catch {
        /* kept for this visit only */
      }
      return value;
    });
  }, []);
  return [progress, update];
}

/** Wordcraft: the levels (and today's puzzle), one puzzle, or the words to review. */
export function WordcraftPage({ puzzleId, view }: { puzzleId?: string; view?: "review" }) {
  const lang = useUiLanguage();
  const [progress, setProgress] = useProgress();
  const puzzle = puzzleId ? PUZZLE_BY_ID.get(puzzleId) : undefined;
  return (
    <div className="edith-premium min-h-screen bg-white text-[var(--pp-ink)]">
      <SiteHeader />
      <main className="wc" dir={lang === "ar" ? "rtl" : "ltr"}>
        {puzzle ? (
          <WordcraftGame
            key={puzzle.id}
            puzzle={puzzle}
            lang={lang}
            progress={progress}
            onProgress={setProgress}
          />
        ) : view === "review" ? (
          <Review lang={lang} progress={progress} onProgress={setProgress} />
        ) : (
          <Home lang={lang} progress={progress} missing={Boolean(puzzleId)} />
        )}
      </main>
    </div>
  );
}

/** The logotype: the name on small letter tiles, like the game's own tiles. */
function Logotype() {
  return (
    <span className="wc-logo" dir="ltr" aria-label="Wordcraft" role="img">
      {"WORDCRAFT".split("").map((letter, i) => (
        <span key={i} aria-hidden="true">
          {letter}
        </span>
      ))}
    </span>
  );
}

function Home({ lang, progress, missing }: { lang: Lang; progress: Progress; missing: boolean }) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  // Today's puzzle is chosen after the page is in the browser (the server's clock zone differs).
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(dailyPick(ammanDay(new Date()), DAILY_POOL)), []);
  const daily = today ? PUZZLE_BY_ID.get(today) : undefined;
  const solvedCount = Object.keys(progress.solved).filter((id) => PUZZLE_BY_ID.has(id)).length;
  return (
    <div className="wc-home">
      <header className="wc-head">
        <h1 className="wc-h1">
          <Logotype />
        </h1>
        <p className="wc-lede">
          {t(
            "Slide across the letters to find hidden English words. Every letter is used once, and every puzzle has one answer.",
            "مرّر إصبعك على الحروف ولاقي كلمات إنجليزية مخبّاية. كل حرف بينستخدم مرة وحدة، وكل لغز إله حل واحد بس.",
          )}
        </p>
        {missing && (
          <p className="wc-note" role="status">
            {t(
              "That puzzle does not exist any more. Pick another one.",
              "هاللغز مش موجود. اختار لغز تاني.",
            )}
          </p>
        )}
      </header>

      <section className="wc-today" aria-labelledby="wc-today-title">
        <div className="wc-today-text">
          <p className="wc-today-eyebrow">{t("Today's puzzle", "لغز اليوم")}</p>
          <h2 id="wc-today-title" className="wc-today-title">
            {t("Five words, 24 letters", "خمس كلمات، 24 حرف")}
          </h2>
          <p className="wc-today-line">
            {t(
              "The same puzzle for everyone today. A new one tomorrow.",
              "نفس اللغز للكل اليوم، ولغز جديد بكرا.",
            )}
          </p>
          {daily ? (
            <Link to="/wordcraft" search={{ p: daily.id }} className="rita-btn wc-today-btn">
              {progress.solved[daily.id] ? (
                <>
                  <Check size={17} aria-hidden="true" />
                  {t("Solved · play again", "محلول · العبه مرة ثانية")}
                </>
              ) : (
                <>
                  {t("Play today's puzzle", "العب لغز اليوم")}
                  <ArrowRight size={17} className="rtl:rotate-180" aria-hidden="true" />
                </>
              )}
            </Link>
          ) : (
            <span className="rita-btn wc-today-btn" aria-hidden="true">
              {t("Play today's puzzle", "العب لغز اليوم")}
            </span>
          )}
        </div>
        <div className="wc-mini" dir="ltr" aria-hidden="true">
          {(daily?.letters ?? "WORDCRAFTUZYRAPLAYLEARNS").split("").map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      </section>

      <div className="wc-packs-head">
        <h2 className="wc-section-title">{t("Levels", "المستويات")}</h2>
        <p className="wc-count">
          {t(
            `${solvedCount} of ${PUZZLE_BY_ID.size} solved`,
            `حليت ${solvedCount} من ${PUZZLE_BY_ID.size}`,
          )}
        </p>
        <Link to="/wordcraft" search={{ view: "review" }} className="wc-review-link">
          {t(
            `Words to review (${progress.review.length})`,
            `كلماتي للمراجعة (${progress.review.length})`,
          )}
        </Link>
      </div>

      {PACKS.map((pack) => {
        const list = packPuzzles(pack.id);
        const ids = list.map((p) => p.id);
        const done = ids.filter((id) => progress.solved[id]).length;
        return (
          <section key={pack.id} className="wc-pack" aria-labelledby={`wc-pack-${pack.id}`}>
            <div className="wc-pack-head">
              <h3 id={`wc-pack-${pack.id}`} className="wc-pack-title">
                {pack.name[lang]}
              </h3>
              <p className="wc-pack-line">{pack.line[lang]}</p>
              <p className="wc-pack-count">
                {done}/{list.length}
              </p>
            </div>
            <ol className="wc-levels">
              {list.map((p, i) => {
                const solved = Boolean(progress.solved[p.id]);
                const open = isOpen(p.id, ids, progress);
                const label = `${pack.name[lang]} ${i + 1}`;
                return (
                  <li key={p.id}>
                    {open ? (
                      <Link
                        to="/wordcraft"
                        search={{ p: p.id }}
                        className="wc-level"
                        data-state={solved ? "solved" : "open"}
                        aria-label={solved ? t(`${label}, solved`, `${label}، محلول`) : label}
                      >
                        {solved ? <Check size={18} aria-hidden="true" /> : i + 1}
                      </Link>
                    ) : (
                      <span
                        className="wc-level"
                        data-state="locked"
                        aria-label={t(
                          `${label}, locked: solve the one before`,
                          `${label}، مقفول: حل اللي قبله`,
                        )}
                        role="img"
                      >
                        <Lock size={15} aria-hidden="true" />
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function Review({
  lang,
  progress,
  onProgress,
}: {
  lang: Lang;
  progress: Progress;
  onProgress: (next: (p: Progress) => Progress) => void;
}) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const words = useMemo(() => progress.review.filter((w) => BY_WORD.has(w)), [progress.review]);
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
  return (
    <div className="wc-home">
      <div className="wc-back-row">
        <Link to="/wordcraft" className="wc-back">
          <ArrowRight size={16} className="ltr:rotate-180" aria-hidden="true" />
          {t("All puzzles", "كل الألغاز")}
        </Link>
      </div>
      <h1 className="wc-section-title rh-app-title">{t("Words to review", "كلماتي للمراجعة")}</h1>
      <p className="wc-lede">
        {t(
          "The words you said you did not know yet, kept on this device.",
          "الكلمات اللي قلت إنك لسا ما بتعرفها، محفوظة على هالجهاز.",
        )}
      </p>
      {words.length === 0 ? (
        <p className="wc-empty">
          {t(
            "Nothing here yet. At the end of a puzzle, answer «Not yet» for a word you want to review.",
            "لسا ما في كلمات. بآخر كل لغز، جاوب «لسا» على الكلمة اللي بدك تراجعها.",
          )}
        </p>
      ) : (
        <ul className="wc-words">
          {words.map((word) => {
            const e = BY_WORD.get(word)!;
            return (
              <li key={word} className="wc-word">
                <div className="wc-word-head">
                  <span className="wc-word-en" dir="ltr" lang="en">
                    {word.toLowerCase()}
                  </span>
                  <span className="wc-word-ar" lang="ar" dir="rtl">
                    {e.ar}
                  </span>
                  {canSpeak && (
                    <button
                      type="button"
                      className="wc-icon-btn is-small"
                      aria-label={t(`Say ${word.toLowerCase()}`, `اسمع ${word.toLowerCase()}`)}
                      onClick={() => {
                        window.speechSynthesis.cancel();
                        const u = new SpeechSynthesisUtterance(word.toLowerCase());
                        u.lang = "en-US";
                        u.rate = 0.9;
                        window.speechSynthesis.speak(u);
                      }}
                    >
                      <Volume2 size={16} aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    className="wc-icon-btn is-small"
                    aria-label={t(
                      `I know ${word.toLowerCase()} now: remove it`,
                      `صرت بعرف ${word.toLowerCase()}: شيلها`,
                    )}
                    onClick={() =>
                      onProgress((p) => ({ ...p, review: p.review.filter((w) => w !== word) }))
                    }
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
                <p className="wc-word-ex" dir="ltr" lang="en">
                  {e.example}
                </p>
                <p className="wc-word-ex-ar" dir="rtl" lang="ar">
                  {e.exampleAr}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
