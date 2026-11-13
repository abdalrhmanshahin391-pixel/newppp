import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { UzyraMark } from "@/components/brand/UzyraMark";
import { useUiLanguage } from "@/components/language/useUiLanguage";
import { useAuth } from "@/hooks/useAuth";
import { MUTE_KEY } from "@/lib/wordcraft/game";
import {
  LEVEL_IDS,
  LEVELS,
  listRound,
  validRound,
  type Level,
  type Round,
} from "@/lib/wordcraft/round";
import { wordcraftRound } from "@/lib/wordcraft/wordcraft.functions";
import { LEVEL_LINES, LEVEL_NAMES } from "./levels";
import { WordcraftGame } from "./WordcraftGame";
import "./wordcraft.css";

type Lang = "en" | "ar";
type Source = "ai" | "list" | "guest";

const SEEN_KEY = "uzyra-wordcraft-seen";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage blocked: kept for this visit only */
  }
}

/** Words from recent rounds on this device, so the next rounds ask for other ones. */
function seenWords(): string[] {
  try {
    const list = JSON.parse(read(SEEN_KEY) ?? "[]");
    return Array.isArray(list)
      ? list.filter((w): w is string => typeof w === "string" && /^[A-Z]{2,12}$/.test(w)).slice(-60)
      : [];
  } catch {
    return [];
  }
}

/** Wordcraft: choose a difficulty, then play rounds of four new words. */
export function WordcraftPage({ level }: { level?: Level }) {
  const lang = useUiLanguage();
  const [muted, setMuted] = useState(false);
  useEffect(() => setMuted(read(MUTE_KEY) === "1"), []);
  const toggleMute = useCallback(() => {
    setMuted((m) => {
      write(MUTE_KEY, m ? "0" : "1");
      return !m;
    });
  }, []);
  return (
    <div className="edith-premium min-h-screen bg-white text-[var(--pp-ink)]">
      <SiteHeader />
      <main className="wc" dir={lang === "ar" ? "rtl" : "ltr"}>
        {level ? (
          <Play key={level} level={level} lang={lang} muted={muted} onMute={toggleMute} />
        ) : (
          <Picker lang={lang} />
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

function Picker({ lang }: { lang: Lang }) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const { user, loading } = useAuth();
  return (
    <div className="wc-home">
      <header className="wc-head">
        <h1 className="wc-h1">
          <Logotype />
        </h1>
        <p className="wc-lede">
          {t(
            "Every round has four new English words hidden in the letters. Slide across the letters to find them: every letter is used once, and there is one answer.",
            "كل جولة فيها أربع كلمات إنجليزية جديدة مخبّاية بين الحروف. مرّر إصبعك عالحروف لتلاقيها: كل حرف بينستخدم مرة وحدة، وإلها حل واحد بس.",
          )}
        </p>
      </header>
      <h2 className="wc-section-title">{t("Choose the difficulty", "اختار الصعوبة")}</h2>
      <ul className="wc-levels-pick">
        {LEVEL_IDS.map((id) => {
          const info = LEVELS[id];
          return (
            <li key={id}>
              <Link to="/wordcraft" search={{ d: id }} className="wc-pick">
                <span
                  className="wc-pick-grid"
                  dir="ltr"
                  aria-hidden="true"
                  style={{ gridTemplateColumns: `repeat(${info.cols}, auto)` }}
                >
                  {Array.from({ length: info.rows * info.cols }, (_, i) => (
                    <span key={i} />
                  ))}
                </span>
                <span className="wc-pick-text">
                  <span className="wc-pick-name">{LEVEL_NAMES[id][lang]}</span>
                  <span className="wc-pick-line">{LEVEL_LINES[id][lang]}</span>
                </span>
                <ArrowRight size={18} className="wc-pick-go rtl:rotate-180" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
      {!loading && !user ? (
        <p className="wc-note">
          {t(
            "Signed out, the words come from Uzyra's own list. ",
            "بدون تسجيل دخول، الكلمات من قائمة Uzyra. ",
          )}
          <Link to="/login" search={{ next: "/wordcraft" }} className="wc-inline-link">
            {t(
              "Sign in for new AI words every round.",
              "سجّل دخول لكلمات جديدة من الذكاء الاصطناعي كل جولة.",
            )}
          </Link>
        </p>
      ) : null}
    </div>
  );
}

/** Rounds at one level: the first is made when the page opens, the next one while you play. */
function Play({
  level,
  lang,
  muted,
  onMute,
}: {
  level: Level;
  lang: Lang;
  muted: boolean;
  onMute: () => void;
}) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const { user, loading } = useAuth();
  const ask = useServerFn(wordcraftRound);
  const [current, setCurrent] = useState<{ round: Round; source: Source } | null>(null);
  const prepared = useRef<Promise<{ round: Round; source: Source }> | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /** One round: from the AI for a signed-in learner, else (or when anything fails) the list. */
  const make = useCallback(async (): Promise<{ round: Round; source: Source }> => {
    const avoid = seenWords();
    if (!user) return { round: listRound(level, undefined, avoid), source: "guest" };
    try {
      const result = await ask({ data: { level, avoid: avoid.slice(-40) } });
      if (validRound(result.round) && result.round.level === level)
        return { round: result.round, source: result.round.source };
    } catch {
      /* the list below */
    }
    return { round: listRound(level, undefined, avoid), source: "list" };
  }, [ask, level, user]);

  const show = useCallback(
    (next: { round: Round; source: Source }) => {
      if (!alive.current) return;
      write(SEEN_KEY, JSON.stringify([...seenWords(), ...next.round.words].slice(-60)));
      setCurrent(next);
      // The next round is made while this one is played (a little later: one AI round at a time).
      prepared.current = new Promise((done) => setTimeout(done, 4_000)).then(make);
    },
    [make],
  );

  useEffect(() => {
    if (loading) return;
    let stop = false;
    void make().then((next) => {
      if (!stop) show(next);
    });
    return () => {
      stop = true;
    };
    // Only once auth is known; later rounds come from "New round".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const nextRound = useCallback(() => {
    const ready = prepared.current ?? make();
    prepared.current = null;
    setCurrent(null);
    // The summary sits low on the page; the new board starts at the top.
    window.scrollTo({ top: 0 });
    void ready.then(show);
  }, [make, show]);

  if (!current) return <Waiting level={level} lang={lang} />;
  const note =
    current.source === "guest"
      ? t(
          "These words are from Uzyra's own list. Sign in for new AI words every round.",
          "هالكلمات من قائمة Uzyra. سجّل دخول لكلمات جديدة من الذكاء الاصطناعي كل جولة.",
        )
      : current.source === "list"
        ? t(
            "The AI could not make words this time, so these are from Uzyra's own list.",
            "الذكاء الاصطناعي ما قدر يجهّز كلمات هالمرة، فهالكلمات من قائمة Uzyra.",
          )
        : null;
  return (
    <WordcraftGame
      key={current.round.letters + current.round.words.join()}
      round={current.round}
      lang={lang}
      muted={muted}
      onMute={onMute}
      onNext={nextRound}
      note={note}
    />
  );
}

/** While the words are being made: the guide says so, and the empty board holds its place. */
function Waiting({ level, lang }: { level: Level; lang: Lang }) {
  const info = LEVELS[level];
  return (
    <div
      className="wc-game"
      style={{ ["--wc-cols" as string]: info.cols, ["--wc-rows" as string]: info.rows }}
      aria-busy="true"
    >
      <div className="wc-bar">
        <p className="wc-bar-title">
          <span className="wc-bar-brand">Wordcraft</span>
          <span className="wc-bar-level">{LEVEL_NAMES[level][lang]}</span>
        </p>
      </div>
      <div className="wc-guide" data-tone="info">
        <span className="wc-badge" aria-hidden="true">
          <UzyraMark className="wc-badge-mark" />
        </span>
        <p className="wc-bubble" role="status">
          {lang === "ar" ? "عم بجهّزلك الكلمات…" : "Getting your words ready…"}
        </p>
      </div>
      <div className="wc-stage">
        <p className="wc-typed" aria-hidden="true">
          {" "}
        </p>
        <div className="wc-board is-waiting" dir="ltr" aria-hidden="true">
          <div className="wc-tiles">
            {Array.from({ length: info.rows }, (_, r) => (
              <div key={r} className="wc-row">
                {Array.from({ length: info.cols }, (_, c) => (
                  <span key={c} className="wc-tile is-empty" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
