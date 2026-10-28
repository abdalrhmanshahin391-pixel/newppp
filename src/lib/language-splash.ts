// The full-screen moment shown when a learner changes the language they are learning. This is only
// the small shared state behind it (who is changing from what to what); the picture is
// `LanguageSplash`. Pure, so it is unit tested with node.

export type SplashState = { id: number; from: string | null; to: string };

/** How long it stays, in milliseconds; with reduced motion it is a short still card. */
export const SPLASH_MS = 3400;
export const SPLASH_REDUCED_MS = 1200;

let state: SplashState | null = null;
let counter = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export function subscribeSplash(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getSplash = (): SplashState | null => state;

/** A real change (not the same language twice); a second change while one shows replaces it. */
export function showLanguageSplash(from: string | null, to: string): void {
  if (!to || from === to) return;
  counter += 1;
  state = { id: counter, from, to };
  emit();
}

/** Closes the splash it was opened for; a late timer from an earlier one does nothing. */
export function dismissLanguageSplash(id: number): void {
  if (!state || state.id !== id) return;
  state = null;
  emit();
}

/** For tests. */
export function resetSplash(): void {
  state = null;
  counter = 0;
  emit();
}
