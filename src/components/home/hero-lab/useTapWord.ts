import { useEffect, useRef, useState } from "react";
import type { OrbLevels } from "@/components/rita-live/VoiceOrb";

export type TapWord = {
  term: string;
  lang: "German" | "English";
  meaning: string;
  say: string;
};

// Meanings and pronunciation (in Arabic letters) are what Rita's tap-a-word window gives.
export const TAP_WORDS: TapWord[] = [
  { term: "Guten Morgen", lang: "German", meaning: "صباح الخير", say: "غوتن مورغن" },
  { term: "Danke", lang: "German", meaning: "شكراً", say: "دانكه" },
  { term: "Wie geht's?", lang: "German", meaning: "كيف حالك؟", say: "في غيتس" },
  { term: "Nice to meet you", lang: "English", meaning: "فرصة سعيدة", say: "نايس تو ميت يو" },
];

/** Tap-a-word state shared by the hero concepts: which word is open, the orb's speech level. */
export function useTapWord() {
  const [active, setActive] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [speaking, setSpeaking] = useState(false);
  const levels = useRef<OrbLevels>({ input: 0, output: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!speaking) {
      levels.current.output = 0;
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      levels.current.output = 0.32 + 0.22 * Math.abs(Math.sin(t * 6.1)) + 0.1 * Math.sin(t * 13);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speaking]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function pick(index: number) {
    setActive(index);
    setTouched(true);
    setSpeaking(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSpeaking(false), 1900);
  }

  function add(index: number) {
    setAdded((current) => new Set(current).add(index));
  }

  function remove(index: number) {
    setAdded((current) => {
      const next = new Set(current);
      next.delete(index);
      return next;
    });
  }

  return {
    active,
    word: active === null ? null : TAP_WORDS[active],
    added,
    isAdded: active !== null && added.has(active),
    touched,
    speaking,
    levels,
    pick,
    add,
    remove,
  };
}

export type TapState = ReturnType<typeof useTapWord>;
