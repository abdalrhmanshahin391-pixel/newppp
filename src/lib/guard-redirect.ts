import { getAuthSnapshot } from "@/lib/auth-store";
import { openWelcome } from "@/lib/auth-dialog";

type NavigateFn = (opts: {
  to: string;
  search?: Record<string, unknown>;
  replace?: boolean;
}) => unknown;

/**
 * Redirect used by page-level access guards.
 *
 * Signed-out visitors get the welcome page, carrying the
 * page they were trying to reach so they land back on it after signing in.
 * Signed-in users who genuinely lack access just go home.
 */
export function guardRedirect(navigate: NavigateFn) {
  const { user } = getAuthSnapshot();
  if (!user && typeof window !== "undefined") {
    const next = window.location.pathname + window.location.search;
    // Opening the welcome page is the whole job; sending the visitor home as well would undo it.
    openWelcome(next);
    return;
  }
  navigate({ to: "/", replace: true });
}
