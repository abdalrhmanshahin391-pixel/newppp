// Books Reader on the pricing page: not a fifth card in the row of Uzyra plans but a wide one of
// its own under them. It keeps the page's language (24px corners, 16px figure tiles, the pill,
// the grotesk) but inverts it: an ink card with the home page's faint dot field and a small shelf
// of books in white and grey, one of them in the brand blue, that lifts on hover. No voice calls.
import { ArrowRight, BookOpen, Check } from "lucide-react";
import "./books-reader-card.css";

const WHAT = [
  "Read the library and your own books",
  "Explain any line, or translate it",
  "Meaning and pronunciation of any word",
  "Flashcards from any page",
];

export function BooksReaderCard({
  name,
  price,
  per,
  requests,
  tagline,
  mine,
  cta,
  onBuy,
}: {
  name: string;
  price: string;
  per: string;
  requests: string;
  tagline: string;
  mine: boolean;
  cta: string;
  onBuy: () => void;
}) {
  return (
    <section className="br" aria-labelledby="br-name">
      <div className="br-main">
        <p className="br-kicker">
          <span className="br-pill">
            <BookOpen size={14} strokeWidth={1.75} aria-hidden="true" />
            For readers
          </span>
          {mine && <span className="br-pill br-pill-mine">Your plan</span>}
        </p>
        <h2 id="br-name" className="br-name">
          {name}
        </h2>
        <p className="br-tagline">{tagline}</p>
        <div className="br-tiles">
          <div className="br-tile">
            <b>{requests}</b>
            <span>Emith requests a month</span>
          </div>
          <div className="br-tile">
            <b>Reading</b>
            <span>no voice calls in this plan</span>
          </div>
        </div>
        <ul className="br-what">
          {WHAT.map((text) => (
            <li key={text}>
              <Check size={15} strokeWidth={1.75} aria-hidden="true" />
              {text}
            </li>
          ))}
        </ul>
      </div>
      <div className="br-side">
        <div className="br-shelf" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
        <p className="br-price">
          <span>{price}</span>
          <small>{per}</small>
        </p>
        <button type="button" className="br-buy" onClick={onBuy}>
          {cta}
          <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
