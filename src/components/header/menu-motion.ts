/**
 * The numbers and small calculations behind the header menus: one shared panel under the bar that
 * opens with a soft fade and scale, moves and resizes to fit the menu you are on, slides the old
 * menu's content out and the new one's in, and a grey highlight that glides from item to item.
 *
 * Pure, so the placement and the keyboard rules can be tested. The panel itself is in MenuGroup.
 */

/** Timings (ms) and curves. All the curves ease out hard: quick to react, long to settle. */
export const MOTION = {
  /** The panel appearing and going. */
  fade: 200,
  /** The panel moving along the bar and changing size when you switch menus. */
  move: 400,
  /** The old content leaving and the new arriving. */
  slide: 350,
  /** The highlight gliding between items, and appearing. */
  glide: 150,
  glideFade: 100,
  /** It stays a moment after the pointer leaves an item, so crossing a gap does not flash it. */
  leave: 80,
  leaveFade: 150,
  /** How far content travels when you switch menus (px). */
  distance: 80,
  /** Scale of the panel while it is closed. */
  closedScale: 0.96,
  easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
  /** A little give at the end, like a light spring. */
  easeSpring: "cubic-bezier(0.3, 1.12, 0.45, 1)",
} as const;

export type Rect = { left: number; top: number; width: number; height: number };

/** Where a pane sits against the active one: it slides away the way its trigger lies. */
export function paneSlot(index: number, activeIndex: number): "active" | "before" | "after" {
  if (index === activeIndex) return "active";
  return index < activeIndex ? "before" : "after";
}

export function slideOffset(slot: "active" | "before" | "after", distance = MOTION.distance) {
  return slot === "active" ? 0 : slot === "before" ? -distance : distance;
}

/**
 * Left edge of the panel, in pixels from the left of the group, so that it hangs from the active
 * trigger: its start edge under the trigger's start edge, or its end edge under the trigger's end
 * edge. Then kept inside the screen with a margin. Works on physical rectangles, so right-to-left
 * pages need no special case apart from which edge "start" means.
 */
export function panelLeft({
  align,
  rtl,
  trigger,
  group,
  panelWidth,
  viewportWidth,
  margin = 8,
}: {
  align: "start" | "end";
  rtl: boolean;
  trigger: Rect;
  group: Rect;
  panelWidth: number;
  viewportWidth: number;
  margin?: number;
}) {
  // "start" is the left edge in left-to-right pages and the right edge in right-to-left ones.
  const useLeftEdge = (align === "start") !== rtl;
  const absolute = useLeftEdge ? trigger.left : trigger.left + trigger.width - panelWidth;
  const clamped = Math.min(
    Math.max(absolute, margin),
    Math.max(margin, viewportWidth - margin - panelWidth),
  );
  return clamped - group.left;
}

/** Which side the panel grows from, for its transform origin (the side it hangs from). */
export function originSide(align: "start" | "end", rtl: boolean): "left" | "right" {
  return (align === "start") !== rtl ? "left" : "right";
}

/**
 * The highlight's box around an item, relative to the surface that holds it. `scale` is the
 * surface's current scale (it is a little under 1 while the panel opens), so the box stays right
 * in the surface's own, unscaled pixels.
 */
export function highlightBox(item: Rect, surface: Rect, scale = 1): Rect {
  const k = scale > 0 ? scale : 1;
  return {
    left: (item.left - surface.left) / k,
    top: (item.top - surface.top) / k,
    width: item.width / k,
    height: item.height / k,
  };
}

export type ItemKey = "ArrowDown" | "ArrowUp" | "Home" | "End";

/** The item to move to for an arrow key, wrapping at both ends. -1 means none is current. */
export function nextItem(current: number, count: number, key: ItemKey): number {
  if (count <= 0) return -1;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowDown") return current < 0 ? 0 : (current + 1) % count;
  return current <= 0 ? count - 1 : current - 1;
}

/**
 * The menu to switch to for a left or right arrow key, in the order the triggers lie on screen
 * (so it follows the page's direction without a special case). `ids` are left to right.
 */
export function neighbourMenu(
  ids: readonly string[],
  active: string,
  key: "ArrowLeft" | "ArrowRight",
): string | null {
  const at = ids.indexOf(active);
  if (at < 0 || ids.length < 2) return null;
  const step = key === "ArrowRight" ? 1 : -1;
  return ids[(at + step + ids.length) % ids.length];
}

/** Menus are ordered by where their triggers are: left to right. */
export function orderByPosition<T extends { id: string; left: number }>(menus: readonly T[]) {
  return menus
    .slice()
    .sort((a, b) => a.left - b.left)
    .map((menu) => menu.id);
}
