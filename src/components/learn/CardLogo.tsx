import type { ReactNode } from "react";
import type { Look } from "./card-looks";

type Lang = "en" | "ar";

const words = (text: string) => text.split(/\s+/).filter(Boolean);

function Spark() {
  return (
    <svg viewBox="-10 -10 20 20" className="gc-deco" aria-hidden="true" focusable="false">
      <path d="M0 -10C1 -3 3 -1 10 0C3 1 1 3 0 10C-1 3 -3 1 -10 0C-3 -1 -1 -3 0 -10Z" />
    </svg>
  );
}

/**
 * A card's name, drawn as its logo. Latin names in tiles get one tile per letter; Arabic letters
 * must stay joined, so Arabic gets one tile per word.
 */
export function Logo({ look, lang }: { look: Look; lang: Lang }) {
  const text = look.logo[lang];
  let body: ReactNode = <span className="gc-ink">{text}</span>;
  switch (look.style) {
    case "tiles":
      body = words(text).map((word, w) => (
        <span key={w} className="gc-word">
          {lang === "ar" ? (
            <span className="gc-tile">{word}</span>
          ) : (
            Array.from(word).map((char, c) => (
              <span key={c} className="gc-tile">
                {char}
              </span>
            ))
          )}
        </span>
      ));
      break;
    case "linked": {
      const [first, ...rest] = words(text);
      body = (
        <>
          <span className="gc-ink">{first}</span>
          <span className="gc-link" aria-hidden="true">
            <i />
            <i />
          </span>
          <span className="gc-ink">{rest.join(" ")}</span>
        </>
      );
      break;
    }
    case "star":
      body = (
        <>
          <span className="gc-ink">{text}</span>
          <svg viewBox="0 0 24 24" className="gc-deco gc-star" aria-hidden="true" focusable="false">
            <path d="M12 1.8l3.1 6.4 7 .9-5.1 4.9 1.3 7-6.3-3.4-6.3 3.4 1.3-7L1.9 9.1l7-.9Z" />
          </svg>
        </>
      );
      break;
    case "spark":
      body = (
        <>
          <Spark />
          <span className="gc-ink">{text}</span>
          <Spark />
        </>
      );
      break;
    case "wave":
      body = (
        <>
          <span className="gc-ink">{text}</span>
          <span className="gc-bars" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </>
      );
      break;
    case "check":
      body = (
        <>
          <svg viewBox="0 0 24 24" className="gc-deco gc-tick" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="11" />
            <path d="M7 12.5l3.2 3.2L17.2 8.6" />
          </svg>
          <span className="gc-ink">{text}</span>
        </>
      );
      break;
    case "flag":
      body = (
        <>
          <span className="gc-ink">{text}</span>
          <span className="gc-flag" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </>
      );
      break;
  }
  return (
    <span className="gc-logo" data-style={look.style} aria-hidden="true">
      {body}
    </span>
  );
}
