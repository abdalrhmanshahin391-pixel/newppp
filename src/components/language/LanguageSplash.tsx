import { useEffect, useState, useSyncExternalStore } from "react";
import { LanguageFlag } from "@/components/language/LanguageFlag";
import { useLanguageRegistry } from "@/hooks/useLearningLanguage";
import {
  SPLASH_MS,
  SPLASH_REDUCED_MS,
  dismissLanguageSplash,
  getSplash,
  subscribeSplash,
} from "@/lib/language-splash";

const WORD = "Uzyra";

/** The word's serif is loaded first (at most 500ms), so it never appears in another face. */
function useFontReady(active: boolean): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!active) {
      setReady(false);
      return;
    }
    let live = true;
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    const loaded = fonts
      ? fonts.load('180px "Uzyra Serif"').catch(() => undefined)
      : Promise.resolve();
    void Promise.race([loaded, new Promise((resolve) => window.setTimeout(resolve, 500))]).then(
      () => live && setReady(true),
    );
    return () => {
      live = false;
    };
  }, [active]);
  return ready;
}

/**
 * White, quiet, about three seconds: "Uzyra" rises letter by letter, a blue line opens under it,
 * and the language being left rolls up while the new one (flag and its own name) rolls in. It is
 * only a picture: the change itself has already happened, tapping anywhere or pressing Escape
 * closes it, and the screen reader announcement stays with the switcher that made the change.
 */
export function LanguageSplash() {
  const splash = useSyncExternalStore(subscribeSplash, getSplash, () => null);
  const { all } = useLanguageRegistry();
  const ready = useFontReady(splash !== null);
  const id = splash?.id;

  useEffect(() => {
    if (id === undefined || !ready) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(
      () => dismissLanguageSplash(id),
      reduced ? SPLASH_REDUCED_MS : SPLASH_MS,
    );
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismissLanguageSplash(id);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [id, ready]);

  if (!splash || !ready) return null;
  const to = all.find((language) => language.code === splash.to);
  const from = splash.from ? all.find((language) => language.code === splash.from) : undefined;
  if (!to) return null;

  return (
    <div
      key={splash.id}
      className="uz-splash"
      aria-hidden="true"
      onClick={() => dismissLanguageSplash(splash.id)}
    >
      <div className="uz-splash-word" dir="ltr">
        {WORD.split("").map((letter, index) => (
          <span key={index} className="uz-splash-cell">
            <i style={{ ["--i" as string]: index }}>{letter}</i>
          </span>
        ))}
      </div>
      <span className="uz-splash-rule" />
      <div className="uz-splash-lang" data-first={from ? "false" : "true"}>
        {from && (
          <div className="uz-splash-item uz-splash-old">
            <LanguageFlag language={from} size={46} />
            <b dir="auto">{from.name_native}</b>
          </div>
        )}
        <div className="uz-splash-item uz-splash-new">
          <LanguageFlag language={to} size={46} />
          <b dir="auto">{to.name_native}</b>
        </div>
      </div>
    </div>
  );
}
