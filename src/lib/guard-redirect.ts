import { getAuthSnapshot } from "@/lib/auth-store";
import { openAuth } from "@/lib/auth-dialog";

type NavigateFn = (opts: {
  to: string;
  search?: Record<string, unknown>;
  replace?: boolean;
}) => unknown;

/**
 * Redirect used by page-level access guards.
 *
 * Signed-out visitors get the sign-in window over the home page, carrying the
 * page they were trying to reach so they land back on it after signing in.
 * Signed-in users who genuinely lack access just go home.
 */
export function guardRedirect(navigate: NavigateFn) {
  const { user } = getAuthSnapshot();
  if (!user && typeof window !== "undefined") {
    const next = window.location.pathname + window.location.search;
    openAuth("signin", next);
    navigate({ to: "/", replace: true });
    return;
  }
  navigate({ to: "/", replace: true });
}
