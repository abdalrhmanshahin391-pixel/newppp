export const PRESENCE_INTERVAL_MS = 30 * 60_000;
export const PRESENCE_ACTIVE_MS = 2 * 60_000;
export const ANNOUNCEMENT_STALE_MS = 60 * 60_000;

/** Hydration and visibility alone are not user activity. */
export function createActivityGate() {
  let lastActivity: number | null = null;
  let lastWrite: number | null = null;
  return {
    interact(now: number) { lastActivity = now; },
    reset() { lastActivity = null; lastWrite = null; },
    take(now: number, visible: boolean) {
      if (!visible || lastActivity === null || now - lastActivity > PRESENCE_ACTIVE_MS) return false;
      if (lastWrite !== null && now - lastWrite < PRESENCE_INTERVAL_MS) return false;
      lastWrite = now;
      return true;
    },
  };
}