// Where the floating circle sits, as a share of the guide pane (0 to 1 on each side). Pure.

export type OrbPosition = { x: number; y: number };

/** Bottom corner on Rita's side (Rita is on the left). */
export const DEFAULT_ORB: OrbPosition = { x: 0.04, y: 0.9 };

/** Keeps the circle fully inside the pane, below the pane's top strip. */
export function clampOrb(
  position: OrbPosition,
  pane: { width: number; height: number; size: number },
): OrbPosition {
  const finite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);
  const free = Math.max(pane.height - pane.size, 1);
  const top = Math.min(0.5, 12 / free);
  return {
    x: Math.min(1, Math.max(0, finite(position.x, DEFAULT_ORB.x))),
    y: Math.min(1, Math.max(top, finite(position.y, DEFAULT_ORB.y))),
  };
}

export function snapToEdge(position: OrbPosition): OrbPosition {
  return { x: position.x < 0.5 ? 0 : 1, y: position.y };
}
