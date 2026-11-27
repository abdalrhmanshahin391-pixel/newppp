import { useEffect, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { startHref } from "@/lib/auth-dialog";
import { useAuth } from "@/hooks/useAuth";

/**
 * Sends a signed-out visitor to the site's own sign-in page (the welcome page, where they pick
 * "Get started" or "I already have an account") and back to this exact address, search included,
 * once signed in. Renders nothing, so it can sit anywhere a page used to draw its own "Sign in"
 * card: the site has one sign-in, never a second screen or window. Waits while the shared auth
 * snapshot resolves, and replaces itself in history so Back does not bounce into the redirect.
 */
export function SignInRedirect() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const signedOut = !loading && !user;

  useEffect(() => {
    if (!signedOut) return;
    const { pathname, searchStr } = router.state.location;
    void router.navigate({ href: startHref(pathname + searchStr), replace: true });
  }, [router, signedOut]);

  return null;
}

/**
 * Wraps a page that needs an account (the games, Repeat, shared decks, question sets, summaries,
 * flashcards). Signed out, the visitor goes to the sign-in page (see `SignInRedirect`); there is
 * no separate sign-in screen here.
 *
 * While the shared auth snapshot is still resolving, and while the visitor is on the way to
 * sign-in, a quiet placeholder shows: flashing page content first would be a leak, and flashing a
 * panel made signed-in users think they had been logged out.
 */
export function RequireSignIn({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <SignInRedirect />
        <div className="mx-auto max-w-5xl px-4 py-24 md:px-8">
          <div className="h-6 w-40 animate-pulse rounded-full bg-black/10" />
          <div className="mt-4 h-4 w-64 animate-pulse rounded-full bg-black/5" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
