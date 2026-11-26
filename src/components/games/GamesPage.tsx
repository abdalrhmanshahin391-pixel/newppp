import { Link } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero/PageHero";
import { useTranslation } from "react-i18next";
import { SiteHeader } from "@/components/SiteHeader";
import { PairsCardArt, RepeatCardArt, WordcraftCardArt } from "@/components/learn/PlayCardArt";
import { useActiveLanguage } from "@/lib/language-scope";

type Lang = "en" | "ar";

/** The games, worded for the learner's learning language (German or English words). */
const gamesFor = (german: boolean) => [
  {
    key: "wordcraft",
    to: "/wordcraft",
    tone: "violet",
    Art: WordcraftCardArt,
    name: { en: "Wordcraft", ar: "Wordcraft" },
    line: {
      en: `Find the ${german ? "German" : "English"} words hidden in the letters, and learn what they mean.`,
      ar: `لاقي الكلمات ${german ? "الألمانية" : "الإنجليزية"} المخبّاية بين الحروف وتعلّم معانيها.`,
    },
  },
  {
    key: "pairs",
    to: "/study/pairs",
    tone: "blue",
    Art: PairsCardArt,
    name: { en: "Pairs", ar: "اقرن" },
    line: {
      en: "Match your flashcards' fronts and backs against the clock.",
      ar: "اقرن وجه بطاقاتك مع ظهرها قبل ما يخلص الوقت.",
    },
  },
  {
    key: "repeat",
    to: "/repeat",
    tone: "teal",
    Art: RepeatCardArt,
    name: { en: "Repeat", ar: "كرر" },
    line: {
      en: `Uzyra says a ${german ? "German" : "English"} sentence, you say it back. Every word you get right turns black.`,
      ar: `Uzyra بتحكي جملة ${german ? "بالألماني" : "بالإنجليزي"} وإنت بتكررها. كل كلمة بتلفظها صح بتصير سودا.`,
    },
  },
];

/** /games: the games as big game cards, one under the other in the middle of the page. */
export function GamesPage() {
  const { i18n } = useTranslation();
  const lang: Lang = (i18n.language ?? "").startsWith("ar") ? "ar" : "en";
  const GAMES = gamesFor(useActiveLanguage() === "de");
  return (
    <div
      className="edith-premium edith-light uz-learn min-h-screen"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <SiteHeader />
      <PageHero
        kicker={lang === "ar" ? "الألعاب" : "Games"}
        title={lang === "ar" ? "العب بالكلمات." : "Play with words."}
        lead={
          lang === "ar"
            ? "ألعاب قصيرة بتعلّمك كلمات جديدة وإنت بتلعب."
            : "Short games that teach you new words while you play."
        }
      />
      <main className="uz-games">
        <ul className="uz-games-list">
          {GAMES.map((game) => (
            <li key={game.key}>
              <Link to={game.to} data-game={game.key} data-tone={game.tone} className="uz-play">
                <h2 className="uz-play-title">{game.name[lang]}</h2>
                <span className="uz-play-line">{game.line[lang]}</span>
                <span className="uz-play-art" aria-hidden="true">
                  <game.Art />
                </span>
                <span className="uz-play-btn">{lang === "ar" ? "العب" : "Play"}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
