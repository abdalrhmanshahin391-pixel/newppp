// Books Reader on the pricing page: not a fifth card in the row of Uzyra plans but a wide one of
// its own, drawn like a book: warm paper, a dark spine with the plan's name, a stack of covers
// that fans out on hover, and one big figure (the Groq requests a month). No voice calls.
import { ArrowRight, BookOpen, Check } from "lucide-react";
import "./books-reader-card.css";

const WHAT = [
  "Read the library and your own books with Uzyra beside them",
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
      <div className="br-spine" aria-hidden="true">
        <span>BOOKS READER</span>
      </div>
      <div className="br-body">
        <div className="br-main">
          <p className="br-kicker">
            <BookOpen size={15} aria-hidden="true" /> For readers
            {mine && <span className="br-mine">Your plan</span>}
          </p>
          <h2 id="br-name" className="br-name">
            {name}
          </h2>
          <p className="br-tagline">{tagline}</p>
          <div className="br-figure">
            <span className="br-number">{requests}</span>
            <span className="br-unit">Groq AI requests a month</span>
          </div>
          <ul className="br-what">
            {WHAT.map((text) => (
              <li key={text}>
                <Check size={15} strokeWidth={2} aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <div className="br-side">
          <div className="br-stack" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <p className="br-price">
            <span>{price}</span>
            <small>{per}</small>
          </p>
          <button type="button" className="br-buy" onClick={onBuy}>
            {cta}
            <ArrowRight size={17} aria-hidden="true" />
          </button>
          <p className="br-note">No voice calls in this plan.</p>
        </div>
      </div>
    </section>
  );
}
