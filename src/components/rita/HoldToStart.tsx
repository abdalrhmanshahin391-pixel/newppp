import { useCallback, useEffect, useRef, useState } from "react";
import { UzyraMark } from "@/components/brand/UzyraMark";
import {
  endHoldTone,
  holdDoneSound,
  holdTone,
  unlockSound,
} from "@/components/rita-study/tech-sound";

/** How long the circle takes to fill while held. */
const FILL_MS = 950;
/** Letting go early drains it back this fast (per full circle). */
const DRAIN_MS = 420;

/**
 * Starting a call with Rita: a black circle with the Uzyra mark that has to be held. While it is
 * held a white disc grows from its centre out to the edge (the mark turns black as the white passes
 * it) and a soft tone rises with it; letting go early shrinks the disc back, the tone falls, and
 * nothing happens, so a call never starts by accident. Full, it plays a small chord, calls `onStart`
 * and shrinks away (the page then shows the connecting ring). Space or Enter held down work the
 * same way. Only transforms move, so the fill stays smooth while the page is busy.
 */
export function HoldToStart({
  onStart,
  disabled = false,
  label,
}: {
  onStart: () => void;
  disabled?: boolean;
  /** The words under the circle ("اضغط مطوّلاً لتبدأ"). */
  label: string;
}) {
  const button = useRef<HTMLButtonElement | null>(null);
  const disc = useRef<HTMLSpanElement | null>(null);
  const fill = useRef(0);
  const holding = useRef(false);
  const frame = useRef(0);
  const last = useRef(0);
  const [done, setDone] = useState(false);
  const still = useRef(false);
  useEffect(() => {
    still.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const paint = (value: number) => {
    fill.current = value;
    if (disc.current) disc.current.style.transform = `scale(${value.toFixed(4)})`;
    // The circle gives a little under the finger as it fills.
    if (button.current && !still.current)
      button.current.style.transform = `scale(${(1 - value * 0.05).toFixed(4)})`;
  };

  const tick = useCallback(
    (now: number) => {
      const step = now - (last.current || now);
      last.current = now;
      const next = holding.current
        ? Math.min(1, fill.current + step / FILL_MS)
        : Math.max(0, fill.current - step / DRAIN_MS);
      paint(next);
      if (next >= 1 && holding.current) {
        holding.current = false;
        holdDoneSound();
        // The shrinking-away transition belongs to the stylesheet from here on.
        if (button.current) button.current.style.transform = "";
        setDone(true);
        onStart();
        return;
      }
      holdTone(next);
      if (next > 0 || holding.current) frame.current = requestAnimationFrame(tick);
      else last.current = 0;
    },
    [onStart],
  );

  const press = () => {
    if (disabled || done || holding.current) return;
    // A press is the one moment Safari lets sound start.
    unlockSound();
    holding.current = true;
    cancelAnimationFrame(frame.current);
    last.current = 0;
    frame.current = requestAnimationFrame(tick);
  };
  const release = () => {
    if (!holding.current) return;
    holding.current = false;
    cancelAnimationFrame(frame.current);
    last.current = 0;
    frame.current = requestAnimationFrame(tick);
  };

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      endHoldTone();
    },
    [],
  );
  // Shown again after a failed call: empty and ready.
  useEffect(() => {
    if (!disabled) return;
    holding.current = false;
    paint(0);
    endHoldTone();
  }, [disabled]);

  return (
    <div className="uz-hold">
      <button
        ref={button}
        type="button"
        className="uz-hold-btn"
        data-done={done ? "" : undefined}
        disabled={disabled}
        aria-label={`${label}: اضغط مطوّلاً لبدء المكالمة`}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          press();
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onKeyDown={(event) => {
          if ((event.key === " " || event.key === "Enter") && !event.repeat) {
            event.preventDefault();
            press();
          }
        }}
        onKeyUp={(event) => {
          if (event.key === " " || event.key === "Enter") release();
        }}
        onContextMenu={(event) => event.preventDefault()}
        onClick={(event) => event.preventDefault()}
      >
        <span ref={disc} className="uz-hold-fill" aria-hidden="true" />
        <UzyraMark className="uz-hold-mark" />
      </button>
      <p className="uz-hold-label" aria-hidden="true">
        {label}
      </p>
    </div>
  );
}
