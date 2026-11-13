import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { PickerBoard, type PickerGroup } from "@/components/common/PickerBoard";
import { useUiLanguage } from "@/components/language/useUiLanguage";
import { langKey } from "@/lib/language-scope";
import { buildPool, MIN_CARDS, type PairCard } from "@/lib/pairs/game";
import { countCards, readCards, useCardsVersion } from "@/lib/use-flashcards";
import { useStudySubjects } from "@/lib/use-study-subjects";
import { UzyraMark } from "@/components/brand/UzyraMark";
import { UzyraWordmark } from "@/components/brand/UzyraWordmark";
import { PairsGame } from "./PairsGame";
import "./pairs.css";

type Lang = "en" | "ar";
type Step = "intro" | "pick" | "play";

/** The ticked sub-subjects, kept for next time ("subject index:sub index"). */
const SELECTION_KEY = () => langKey("rita_pairs_selection");

function readSelection(): string[] {
  try {
    const list = JSON.parse(window.localStorage.getItem(SELECTION_KEY()) ?? "[]");
    return Array.isArray(list) ? list.filter((k): k is string => /^\d+:\d+$/.test(String(k))) : [];
  } catch {
    return [];
  }
}

/** Pairs: the big card, then the learner's subjects, then the game. */
export function PairsPage() {
  const lang = useUiLanguage();
  const [step, setStep] = useState<Step>("intro");
  const [game, setGame] = useState<{ pool: PairCard[]; title: string; id: number } | null>(null);
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);

  // The page starts at the top whenever the step changes.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  return (
    <div className="edith-premium min-h-screen bg-white text-[var(--pp-ink)]">
      <SiteHeader />
      <main className="pr" dir={lang === "ar" ? "rtl" : "ltr"}>
        {step === "intro" && <Hero lang={lang} onPlay={() => setStep("pick")} />}
        {step === "pick" && (
          <Picker
            lang={lang}
            onBack={() => setStep("intro")}
            onStart={(pool, title) => {
              setGame({ pool, title, id: Date.now() });
              setStep("play");
            }}
          />
        )}
        {step === "play" && game && (
          <PairsGame
            key={game.id}
            lang={lang}
            pool={game.pool}
            title={game.title}
            onExit={() => setStep("pick")}
            onAgain={() => setGame((g) => (g ? { ...g, id: Date.now() } : g))}
          />
        )}
        {step === "intro" ? (
          <p className="pr-foot">
            {t("Your cards live in ", "بطاقاتك موجودة بصفحة ")}
            <Link to="/study" className="pr-link">
              {t("Flashcards", "البطاقات")}
            </Link>
            {t(": add more there and they show up here.", "، ضيف بطاقات هناك وبتطلع هون.")}
          </p>
        ) : null}
      </main>
    </div>
  );
}

/** The big blue card: the name, one line, the Uzyra logo between two puzzle pieces, and Play. */
function Hero({ lang, onPlay }: { lang: Lang; onPlay: () => void }) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  return (
    <section className="pr-hero" aria-labelledby="pr-title">
      <h1 id="pr-title" className="pr-logo" dir="ltr">
        <PairsMark />
        <span>Pairs</span>
      </h1>
      <p className="pr-tagline">
        {t("Match the words with their meanings!", "اقرن الكلمات مع معانيها!")}
      </p>
      <div className="pr-stage" aria-hidden="true">
        <Piece className="pr-piece is-left" fill="#8fd16f" shade="#6fb54f" />
        <span className="pr-brand">
          <UzyraMark className="pr-brand-mark" />
          <UzyraWordmark size={30} withMark={false} className="pr-brand-name" />
        </span>
        <Piece className="pr-piece is-right" fill="#f8d147" shade="#e3b62a" />
      </div>
      <button type="button" className="pr-play" onClick={onPlay}>
        {t("Play", "العب")}
      </button>
    </section>
  );
}

/** Two cards leaning together: the small mark in front of the name. */
function PairsMark() {
  return (
    <svg className="pr-mark" viewBox="0 0 40 52" aria-hidden="true">
      <path d="M4 6 L20 2 L22 48 L10 50 Z" fill="#cfe4ff" />
      <path d="M14 4 L34 2 L36 46 L18 50 Z" fill="#fff" />
    </svg>
  );
}

/** A jigsaw piece (tab on top and right, holes on the left and bottom) with a soft highlight. */
function Piece({ className, fill, shade }: { className: string; fill: string; shade: string }) {
  const d =
    "M14 22 H36 C34 10 46 6 50 6 C54 6 66 10 64 22 H86 V44 C98 42 102 54 102 58 C102 62 98 74 86 72 V94 H64 C66 82 54 78 50 78 C46 78 34 82 36 94 H14 V72 C26 74 30 62 30 58 C30 54 26 42 14 44 Z";
  return (
    <svg className={className} viewBox="0 0 112 104">
      <path d={d} fill={shade} transform="translate(0 5)" />
      <path d={d} fill={fill} />
      <path
        d="M20 28 H34"
        stroke="#fff"
        strokeOpacity=".55"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Step two: which of the learner's flashcard sub-subjects to play with. */
function Picker({
  lang,
  onBack,
  onStart,
}: {
  lang: Lang;
  onBack: () => void;
  onStart: (pool: PairCard[], title: string) => void;
}) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const board = useStudySubjects();
  const version = useCardsVersion();
  const [selected, setSelected] = useState<string[]>([]);
  const [restored, setRestored] = useState(false);

  // The last choice comes back (only the sub-subjects that still exist).
  useEffect(() => {
    if (restored || !board.subjects.length) return;
    const keep = readSelection().filter((k) => {
      const [si, sj] = k.split(":").map(Number);
      return Boolean(board.subjects[si]?.subs[sj]);
    });
    setSelected(keep);
    setRestored(true);
  }, [board.subjects, restored]);

  const save = useCallback((next: string[]) => {
    setSelected(next);
    try {
      window.localStorage.setItem(SELECTION_KEY(), JSON.stringify(next));
    } catch {
      /* kept for this visit only */
    }
  }, []);

  const groups: PickerGroup[] = useMemo(() => {
    void version;
    return board.subjects.map((s, si) => {
      const items = s.subs.map((x, sj) => ({
        id: `${si}:${sj}`,
        name: x.name,
        count: countCards(s.name, x.name),
      }));
      return {
        id: String(si),
        name: s.name,
        color: "#2b6df0",
        count: items.reduce((n, i) => n + (i.count ?? 0), 0),
        items,
      };
    });
  }, [board.subjects, version]);

  const picked = useMemo(
    () =>
      selected
        .map((k) => {
          const [si, sj] = k.split(":").map(Number);
          const subject = board.subjects[si];
          const sub = subject?.subs[sj];
          return subject && sub ? { subject: subject.name, sub: sub.name } : null;
        })
        .filter((p): p is { subject: string; sub: string } => p !== null),
    [selected, board.subjects],
  );

  const { pool, skipped } = useMemo(() => {
    void version;
    return buildPool(picked.flatMap((p) => readCards(p.subject, p.sub)));
  }, [picked, version]);

  const enough = pool.length >= MIN_CARDS;
  const title =
    picked.length === 1
      ? `${picked[0].subject} · ${picked[0].sub}`
      : t(`${picked.length} sub-subjects`, `${picked.length} مواد فرعية`);

  const toggle = (id: string) =>
    save(selected.includes(id) ? selected.filter((k) => k !== id) : [...selected, id]);

  return (
    <section className="pr-pick" aria-labelledby="pr-pick-title">
      <div className="pr-pick-head">
        <button type="button" className="pr-back" onClick={onBack} aria-label={t("Back", "رجوع")}>
          <ArrowRight size={20} className="ltr:rotate-180" aria-hidden="true" />
        </button>
        <div>
          <h1 id="pr-pick-title" className="pr-pick-title">
            {t("Choose what to play", "اختار شو بدك تلعب")}
          </h1>
          <p className="pr-pick-line">
            {t(
              "Tick the sub-subjects from your flashcards. Each card's front is matched with its back.",
              "علّم المواد الفرعية من بطاقاتك. وجه كل بطاقة بينقرن مع ظهرها.",
            )}
          </p>
        </div>
      </div>

      {board.subjects.length === 0 ? (
        <div className="pr-empty">
          <p>{t("You have no flashcards yet.", "لسا ما عندك بطاقات.")}</p>
          <Link to="/study" className="rita-btn rita-btn-primary">
            {t("Make flashcards", "اعمل بطاقات")}
          </Link>
        </div>
      ) : (
        <PickerBoard
          framed={false}
          accent="#2b6df0"
          groups={groups}
          selected={selected}
          onToggle={toggle}
          unitNoun="cards"
          searchPlaceholder={t(
            "Search subjects and sub-subjects…",
            "دوّر بالمواد والمواد الفرعية…",
          )}
          emptyHint={t("No subjects yet.", "لسا ما في مواد.")}
          onSelectAll={(g) =>
            save([
              ...selected.filter((k) => !k.startsWith(`${g.id}:`)),
              ...g.items.map((i) => i.id),
            ])
          }
          onClearGroup={(g) => save(selected.filter((k) => !k.startsWith(`${g.id}:`)))}
        />
      )}

      <div className="pr-pick-bar" role="region" aria-label={t("Your choice", "اختيارك")}>
        <p className="pr-pick-count" aria-live="polite">
          {picked.length === 0
            ? t("Nothing ticked yet.", "لسا ما علّمت إشي.")
            : enough
              ? t(`${pool.length} cards ready to play.`, `${pool.length} بطاقة جاهزة للعب.`)
              : t(
                  `${pool.length} of ${MIN_CARDS} cards: tick more.`,
                  `${pool.length} من ${MIN_CARDS} بطاقات: علّم كمان.`,
                )}
          {skipped > 0 ? (
            <span className="pr-pick-skip">
              {t(
                ` ${skipped} picture-only cards are left out.`,
                ` ${skipped} بطاقة فيها صورة بس، انشالت من اللعبة.`,
              )}
            </span>
          ) : null}
        </p>
        <button
          type="button"
          className="pr-start"
          disabled={!enough}
          onClick={() => onStart(pool, title)}
        >
          {t("Start", "ابدأ")}
        </button>
      </div>
    </section>
  );
}
