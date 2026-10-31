import { useEffect, useSyncExternalStore } from "react";
import { LanguageFlag } from "@/components/language/LanguageFlag";
import { useLanguageRegistry } from "@/hooks/useLearningLanguage";
import {
  SPLASH_MS,
  SPLASH_REDUCED_MS,
  dismissLanguageSplash,
  getSplash,
  subscribeSplash,
} from "@/lib/language-splash";

/** "light": white page, ink lines. "dark": deep navy page, white lines. */
export type SplashTone = "light" | "dark";
const TONE: SplashTone = "dark";

// UZYRA drawn as single lines, all one weight, on a 56 x 100 grid. The A has no bar (a pointed
// arch), the R's leg starts apart from its bowl. Each path is drawn by its own stroke.
const LETTERS: { key: string; d: string }[] = [
  { key: "U", d: "M0 0 V72 A28 28 0 0 0 56 72 V0" },
  { key: "Z", d: "M0 0 H56 L0 100 H56" },
  { key: "Y", d: "M0 0 L28 52 L56 0 M28 52 V100" },
  { key: "R", d: "M0 100 V0 H32 A25 25 0 0 1 32 50 H0 M30 56 L56 100" },
  { key: "A", d: "M0 100 L28 0 L56 100" },
];

type SplashLanguage = { code: string; name_native: string };

/**
 * The picture itself: the word is drawn line by line while its letters drift apart, a hairline
 * opens under it, then the language being left rolls up and the new one rolls in. Shared by the
 * live splash and the preview, so what is reviewed is what ships.
 */
export function SplashStage({
  tone,
  from,
  to,
  flag,
}: {
  tone: SplashTone;
  from?: SplashLanguage;
  to: SplashLanguage;
  flag: (language: SplashLanguage) => React.ReactNode;
}) {
  return (
    <>
      <div className="uz-splash-word" dir="ltr" role="presentation">
        {LETTERS.map((letter, index) => (
          <svg
            key={letter.key}
            viewBox="-2 -2 60 104"
            className="uz-splash-letter"
            style={{ ["--i" as string]: index }}
            focusable="false"
          >
            <path d={letter.d} pathLength={1} />
          </svg>
        ))}
      </div>
      <span className="uz-splash-rule" data-tone={tone} />
      <div className="uz-splash-lang" data-first={from ? "false" : "true"}>
        {from && (
          <div className="uz-splash-item uz-splash-old">
            {flag(from)}
            <b dir="auto">{from.name_native}</b>
          </div>
        )}
        <div className="uz-splash-item uz-splash-new">
          {flag(to)}
          <b dir="auto">{to.name_native}</b>
        </div>
      </div>
    </>
  );
}

const swallow = (event: React.SyntheticEvent) => {
  event.preventDefault();
  event.stopPropagation();
};

/**
 * About three seconds: a quiet page, the word drawn in fine lines, then the new language. It is
 * only a picture: the change itself has already happened, it always plays to its end (with
 * reduced motion it is a one-second still), and the screen reader announcement stays with the
 * switcher that made the change.
 */
export function LanguageSplash() {
  const splash = useSyncExternalStore(subscribeSplash, getSplash, () => null);
  const { all } = useLanguageRegistry();
  const id = splash?.id;

  useEffect(() => {
    if (id === undefined) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(
      () => dismissLanguageSplash(id),
      reduced ? SPLASH_REDUCED_MS : SPLASH_MS,
    );
    return () => window.clearTimeout(timer);
  }, [id]);

  if (!splash) return null;
  const to = all.find((language) => language.code === splash.to);
  const from = splash.from ? all.find((language) => language.code === splash.from) : undefined;
  if (!to) return null;

  return (
    <div
      key={splash.id}
      className="uz-splash"
      data-tone={TONE}
      aria-hidden="true"
      // It plays to the end: a tap is caught here so it never reaches the page underneath
      // (a tap on the logo below used to open the home page).
      onPointerDown={swallow}
      onClick={swallow}
    >
      <SplashStage
        tone={TONE}
        from={from}
        to={to}
        flag={(language) => {
          const full = all.find((item) => item.code === language.code);
          return full ? <LanguageFlag language={full} size={34} /> : null;
        }}
      />
    </div>
  );
}
