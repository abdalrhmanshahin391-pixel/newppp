export type AuthMode = "signin" | "signup" | "forgot";

export type AuthDialogState = {
  open: boolean;
  mode: AuthMode;
  next?: string;
};

let state: AuthDialogState = { open: false, mode: "signin" };
const listeners = new Set<(s: AuthDialogState) => void>();

function emit() {
  for (const l of listeners) l(state);
}

export function subscribeAuthDialog(fn: (s: AuthDialogState) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getAuthDialogState() {
  return state;
}

/** Open the sign-in window over the current page. */
export function openAuth(mode: AuthMode = "signin", next?: string) {
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
  state = { open: true, mode, next: safeNext };
  emit();
}

export function closeAuth() {
  if (!state.open) return;
  state = { ...state, open: false };
  emit();
}

export function setAuthMode(mode: AuthMode) {
  state = { ...state, mode };
  emit();
}
