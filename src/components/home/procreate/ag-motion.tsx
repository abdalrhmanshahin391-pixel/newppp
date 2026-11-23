import type { CSSProperties, ElementType } from "react";
import { useShown } from "./ag-hooks";
import { LETTERS, splitLetters } from "./feature-explorer";
import "./ag-motion.css";

/**
 * The home page's shared motion: text typed in letter by letter, text whose letters fade in one
 * after another, and the hooks that start them once they are in view. Timings come from
 * `feature-explorer.ts`. Reduced motion shows the text at once.
 */

type TypedProps = {
  text: string;
  as?: ElementType;
  id?: string;
  className?: string;
};

/** A heading typed in at 0.02s a letter, with a caret, once its top is 80% down the screen. */
export function Typed({ text, as: Tag = "h2", id, className }: TypedProps) {
  const { ref, shown } = useShown<HTMLElement>(0.8);
  const chars = [...text];
  return (
    <Tag
      ref={ref}
      id={id}
      className={className}
      data-typing={shown ? "on" : undefined}
      style={{ "--type": `${LETTERS.type}s` } as CSSProperties}
    >
      <span className="uz-ag-sr">{text}</span>
      <span aria-hidden="true">
        {chars.map((ch, i) => (
          <span
            key={i}
            className={i === chars.length - 1 ? "uz-ag-ch uz-ag-last" : "uz-ag-ch"}
            style={{ "--i": i } as CSSProperties}
          >
            {ch}
          </span>
        ))}
      </span>
    </Tag>
  );
}

/** Text whose letters fade in one after another (0.1s each, 0.005s apart) once `shown`. */
export function Letters({
  text,
  shown,
  className,
  as: Tag = "p",
}: {
  text: string;
  shown: boolean;
  className?: string;
  as?: ElementType;
}) {
  return (
    <Tag className={className} data-shown={shown ? "on" : undefined}>
      <span className="uz-ag-sr">{text}</span>
      <span aria-hidden="true">
        {splitLetters(text).map(({ letters }, w) => (
          <span key={w}>
            <span className="uz-ag-word">
              {letters.map(({ char, index }) => (
                <span
                  key={index}
                  className="uz-ag-letter"
                  style={{ transitionDelay: `${(index * LETTERS.stagger).toFixed(3)}s` }}
                >
                  {char}
                </span>
              ))}
            </span>{" "}
          </span>
        ))}
      </span>
    </Tag>
  );
}

/** `Letters` that starts itself when its own top is 85% down the screen. */
export function FadeText({ text, className }: { text: string; className?: string }) {
  const { ref, shown } = useShown<HTMLDivElement>(0.85);
  return (
    <div ref={ref}>
      <Letters text={text} shown={shown} className={className} />
    </div>
  );
}
