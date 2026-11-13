import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { SiteHeader } from "@/components/SiteHeader";
import { PairsCardArt, WordcraftCardArt } from "@/components/learn/PlayCardArt";

type Lang = "en" | "ar";

const GAMES = [
  {
    key: "wordcraft",
    to: "/wordcraft",
    tone: "violet",
    Art: WordcraftCardArt,
    name: { en: "Wordcraft", ar: "Wordcraft" },
    line: {
      en: "Find the English words hidden in the letters, and learn what they mean.",
      ar: "لاقي الكلمات الإنجليزية المخبّاية بين الحروف وتعلّم معانيها.",
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
] as const;

/** /games: the two games as big game cards, one under the other in the middle of the page. */
export function GamesPage() {
  const { i18n } = useTranslation();
  const lang: Lang = (i18n.language ?? "").startsWith("ar") ? "ar" : "en";
  return (
    <div
      className="edith-premium edith-light uz-learn min-h-screen"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <SiteHeader />
      <main className="uz-games">
        <h1 className="uz-games-title">{lang === "ar" ? "الألعاب" : "Games"}</h1>
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
