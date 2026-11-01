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

/** Where each step lives: signing in is a page of its own, not a window. */
export const AUTH_PATHS: Record<AuthMode, string> = {
  signin: "/login",
  signup: "/register",
  forgot: "/forgot-password",
};

/** The page before the forms: "Get started" or "I already have an account". */
export const AUTH_START_PATH = "/start";

let navigateTo: ((href: string) => void) | null = null;

/** The root hands over the router, so opening sign-in is an in-app page change. */
export function setAuthNavigator(fn: ((href: string) => void) | null) {
  navigateTo = fn;
}

export function authHref(mode: AuthMode, next?: string) {
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
  return safeNext ? `${AUTH_PATHS[mode]}?next=${encodeURIComponent(safeNext)}` : AUTH_PATHS[mode];
}

export function startHref(next?: string) {
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
  return safeNext ? `${AUTH_START_PATH}?next=${encodeURIComponent(safeNext)}` : AUTH_START_PATH;
}

/**
 * Anyone who needs an account lands on the welcome page first and picks from there. Used by every
 * generic "sign in" button; a button that already says which one uses `openAuth` and goes straight
 * to that form.
 */
export function openWelcome(next?: string) {
  const href = startHref(next);
  if (navigateTo) navigateTo(href);
  else if (typeof window !== "undefined") window.location.assign(href);
}

/** Go to the sign-in (or sign-up, or reset) page, coming back to `next` afterwards. */
export function openAuth(mode: AuthMode = "signin", next?: string) {
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
  state = { open: true, mode, next: safeNext };
  emit();
  const href = authHref(mode, safeNext);
  if (navigateTo) navigateTo(href);
  else if (typeof window !== "undefined") window.location.assign(href);
}

/** A sign-in page opened: it owns the flow until the account is signed in. */
export function beginAuthPage(mode: AuthMode, next?: string) {
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
