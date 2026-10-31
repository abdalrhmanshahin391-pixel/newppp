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

let navigateTo: ((href: string) => void) | null = null;

/** The root hands over the router, so opening sign-in is an in-app page change. */
export function setAuthNavigator(fn: ((href: string) => void) | null) {
  navigateTo = fn;
}

export function authHref(mode: AuthMode, next?: string) {
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
  return safeNext ? `${AUTH_PATHS[mode]}?next=${encodeURIComponent(safeNext)}` : AUTH_PATHS[mode];
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
