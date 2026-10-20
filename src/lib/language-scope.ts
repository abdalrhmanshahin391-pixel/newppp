import { useSyncExternalStore } from "react";
import { scopedKey } from "@/lib/learning-language";

/**
 * The language the study kit is currently showing. Plain functions that build storage keys
 * (`topicKey`, `memoryKey`, ...) read it synchronously; components subscribe through
 * `useActiveLanguage` so they re-render when it changes. `LearningLanguageScope` keeps it in
 * step with the learner's account.
 */

/** Fired on `window` when the active language changes, so list caches can refresh. */
export const LANGUAGE_CHANGED_EVENT = "rita-language-changed";

// Last language on this device (not a `rita_` key, so it is never mirrored to the account).
// It makes the first paint use the right space before the account has loaded.
const CACHE_KEY = "ritajet_active_language";
const LEGACY_CACHE_KEY = "ritajet_legacy_language";

function readCache(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

let active: string | null = readCache(CACHE_KEY);
let legacy: string | null = readCache(LEGACY_CACHE_KEY);
// True once the account has told us the learner's language (or there is no account), so database
// reads can wait for it instead of asking for every language's rows first.
let resolved = false;
const listeners = new Set<() => void>();

export function getActiveLanguage(): string | null {
  return active;
}

export function getLegacyLanguage(): string | null {
  return legacy;
}

export function setLanguageScope(next: { active: string | null; legacy: string | null }) {
  const wasResolved = resolved;
  resolved = true;
  if (next.active === active && next.legacy === legacy) {
    if (!wasResolved) listeners.forEach((listener) => listener());
    return;
  }
  const changed = next.active !== active;
  active = next.active;
  legacy = next.legacy;
  if (typeof window !== "undefined") {
    try {
      if (active) window.localStorage.setItem(CACHE_KEY, active);
      else window.localStorage.removeItem(CACHE_KEY);
      if (legacy) window.localStorage.setItem(LEGACY_CACHE_KEY, legacy);
      else window.localStorage.removeItem(LEGACY_CACHE_KEY);
    } catch {
      /* private mode: the account copy still applies */
    }
  }
  listeners.forEach((listener) => listener());
  if (changed && typeof window !== "undefined") {
    window.dispatchEvent(new Event(LANGUAGE_CHANGED_EVENT));
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Re-renders the component when the active language changes. */
export function useActiveLanguage(): string | null {
  return useSyncExternalStore(subscribe, getActiveLanguage, () => null);
}

/** The storage key for the active language's copy of `base` (the key itself when none is chosen). */
export function langKey(base: string): string {
  return scopedKey(base, active);
}

/**
 * Whether sample content may be added to the active language. The cardiology sample is for the
 * learner's first space only; a language they add later starts empty.
 */
export function isSampleLanguage(): boolean {
  return active === null || legacy === null || active === legacy;
}

/**
 * The language to filter or stamp on database rows: the active one, but only on a migrated
 * database (where the learner has a legacy language) and once a language has been chosen.
 */
export function dbLanguage(): string | null {
  return active && legacy ? active : null;
}

/** Re-renders when the language used for database filters changes (use it in query keys). */
export function useDbLanguage(): string | null {
  return useSyncExternalStore(subscribe, dbLanguage, () => null);
}

/** False until the account has answered; use it to hold back database reads that depend on the language. */
export function useLanguageResolved(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => resolved,
    () => false,
  );
}

// A live voice conversation belongs to one language; switching in the middle would leave Rita and the
// page disagreeing, so the switcher asks the learner to end it first.
let voiceSessionActive = false;

export function setVoiceSessionActive(value: boolean) {
  voiceSessionActive = value;
}

export function isVoiceSessionActive(): boolean {
  return voiceSessionActive;
}
