import { useEffect, useRef, useState } from "react";

/** Hooks behind the home page's shared motion (see ag-motion.tsx). */

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** Runs `onEnter` once, when the element's top reaches `share` of the way down the screen. */
export function useOnceInView<T extends Element>(share: number, onEnter: () => void) {
  const ref = useRef<T>(null);
  const done = useRef(onEnter);
  done.current = onEnter;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      done.current();
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        done.current();
      },
      { rootMargin: `0px 0px -${Math.round((1 - share) * 100)}% 0px` },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [share]);
  return ref;
}

/** True once the element's top is `share` of the way down the screen (or at once, reduced). */
export function useShown<T extends Element>(share = 0.85) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(false);
  const ref = useOnceInView<T>(share, () => setShown(true));
  return { ref, shown: shown || reduced, reduced };
}
