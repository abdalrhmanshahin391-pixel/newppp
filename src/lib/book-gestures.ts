// Turning a book's pages by touch (the page-pane plan, phase 3a): a swipe across the page or a
// tap on its outer edges. Only the decisions live here (no DOM), so they can be tested.
//
// Selection always wins: the caller starts nothing while text is selected or after a long press
// (that is how a selection begins on iPhone and iPad), and a mouse never swipes.

export const SWIPE = {
  /** The least sideways travel that turns, in px. */
  min: 60,
  /** Sideways must be more than this many times the up/down travel. */
  ratio: 2,
  /** A swipe slower than this … */
  slowMs: 600,
  /** … still turns when it moves at least this fast (px per ms). */
  speed: 0.4,
  /** While dragging, the sheet follows this part of the finger's travel … */
  follow: 0.4,
  /** … up to this far (px); 12 px where there is no page beyond. */
  followMax: 48,
  edgeMax: 12,
} as const;

/** A touch held still this long is a long press (a selection starting), not a swipe or tap. */
export const LONG_PRESS_MS = 300;
/** Travel under this (px) is still a tap. */
export const TAP_SLOP = 10;
/** Each outer edge of the page that turns on a tap, as a part of its width. */
export const TAP_ZONE = 0.12;
/** A tap in a page taller than the pane scrolls by this part of the pane before it turns. */
export const TAP_SCROLL = 0.85;

/** +1 the next page, -1 the previous, 0 nothing. */
export type Turn = -1 | 0 | 1;

/** The page a finished sideways swipe turns to. Swiping left is "next" in a left-to-right book. */
export function swipeTurn(dx: number, dy: number, ms: number, rtl: boolean): Turn {
  const across = Math.abs(dx);
  if (across < SWIPE.min || across <= SWIPE.ratio * Math.abs(dy)) return 0;
  if (ms > SWIPE.slowMs && across / Math.max(1, ms) < SWIPE.speed) return 0;
  const next: Turn = dx < 0 ? 1 : -1;
  return rtl ? (-next as Turn) : next;
}

/** The turn a swipe that has travelled dx would make (its direction only). */
export function swipeDirection(dx: number, rtl: boolean): Turn {
  if (!dx) return 0;
  const next: Turn = dx < 0 ? 1 : -1;
  return rtl ? (-next as Turn) : next;
}

/**
 * How far the sheet follows the finger while dragging (px, signed). Mostly up/down travel moves
 * nothing; with no page beyond in that direction it gives way only a little.
 */
export function dragOffset(dx: number, dy: number, pageBeyond: boolean): number {
  if (Math.abs(dx) <= Math.abs(dy)) return 0;
  const most = pageBeyond ? SWIPE.followMax : SWIPE.edgeMax;
  return Math.sign(dx) * Math.min(most, Math.abs(dx) * SWIPE.follow);
}

/**
 * The turn for a tap at x (px from the page's left edge, page `width` px wide): the outer 12%
 * on each side. In a left-to-right book the right edge is "next"; in a right-to-left one the left.
 */
export function tapTurn(x: number, width: number, rtl: boolean): Turn {
  if (!(width > 0)) return 0;
  const part = x / width;
  const side: Turn = part <= TAP_ZONE ? -1 : part >= 1 - TAP_ZONE ? 1 : 0;
  return rtl ? (-side as Turn) : side;
}

/**
 * Whether a zoomed page (wider than its pane) is already at the edge a swipe pulls towards, so
 * the swipe turns instead of moving the page. `scrollLeft` as the browser gives it: from 0 up in
 * a left-to-right box, from 0 down to negative in a right-to-left one.
 */
export function atSwipeEdge(
  dx: number,
  scroll: { left: number; width: number; client: number; rtl: boolean },
): boolean {
  const max = scroll.width - scroll.client;
  if (max <= 1) return true;
  const fromLeft = scroll.rtl ? max + scroll.left : scroll.left;
  // Swiping left shows what is on the right: allowed only at the right end, and the reverse.
  return dx < 0 ? fromLeft >= max - 1 : fromLeft <= 1;
}

/**
 * A tap on the page's "next" or "previous" edge in a page taller than its pane first scrolls it
 * (85% of the pane), and turns only from the bottom (or, going back, from the top). Returns the
 * new scroll top, or null to turn the page.
 */
export function tapScrollTo(
  turn: Turn,
  scroll: { top: number; height: number; client: number },
): number | null {
  const max = scroll.height - scroll.client;
  if (max <= 2 || !turn) return null;
  if (turn > 0)
    return scroll.top >= max - 2 ? null : Math.min(max, scroll.top + scroll.client * TAP_SCROLL);
  return scroll.top <= 2 ? null : Math.max(0, scroll.top - scroll.client * TAP_SCROLL);
}
