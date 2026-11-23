/**
 * Numbers for the home page's feature section: the row of circles that ripples under the typed
 * statement, the way it drifts with the scroll, and the timing of the letters that fade in.
 * Pure, so they are tested without a browser.
 */

export const WAVE = {
  /** How far a circle rises and falls (px). */
  amplitude: 35,
  /** Seconds for the ripple to travel one screen width. */
  period: 7,
  /** How far the whole row slides left while the section crosses the screen (px). */
  drift: 250,
} as const;

/** Vertical offset of a circle whose centre is `x` px along the row, at ripple `phase` (px). */
export function waveOffset(x: number, phase: number, width: number) {
  const span = Math.max(1, width);
  return Math.sin(((x + phase) / span) * Math.PI * 2) * WAVE.amplitude;
}

/** Ripple phase after `seconds`: one screen width per period, then round again. */
export function wavePhase(seconds: number, width: number) {
  const span = Math.max(1, width);
  return ((seconds / WAVE.period) * span) % span;
}

/**
 * Sideways drift of the row: 0 when the section's top meets the bottom of the screen, the full
 * drift (to the left) when its bottom leaves the top.
 */
export function driftOffset(top: number, height: number, viewport: number) {
  const travel = viewport + height;
  const progress = travel <= 0 ? 0 : (viewport - top) / travel;
  return -WAVE.drift * Math.min(1, Math.max(0, progress));
}

export const LETTERS = {
  /** Delay between one letter and the next as a description fades in (s). */
  stagger: 0.005,
  /** Each letter's own fade (s). */
  fade: 0.1,
  /** Typing speed of the statement, per character (s). */
  type: 0.02,
} as const;

/** Splits a text into words of characters, keeping each character's running index. */
export function splitLetters(text: string) {
  let index = 0;
  return text.split(" ").map((word) => ({
    word,
    letters: [...word].map((char) => ({ char, index: index++ })),
    // The space after a word also counts, so the timing matches the text as read.
    after: index++,
  }));
}
