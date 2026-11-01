import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { AUTH_PATHS, beginAuthPage, subscribeAuthDialog, type AuthMode } from "@/lib/auth-dialog";
import { ForgotPanel, SignInPanel, SignUpPanel } from "./AuthPanels";
import { useAuthCopy } from "./auth-copy";

/**
 * Sign in, sign up and reset password: three plain white pages with only what is needed to get in.
 *
 * They are plain on purpose. The owner will design them later, so do not add any visual design here
 * (no rings, wordmark, animation or custom CSS) and do not rebuild an earlier design from the git
 * history. Wait for the owner's own design brief.
 */
export function AuthPage({ mode, next }: { mode: AuthMode; next?: string }) {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { t, ar } = useAuthCopy();
  const [shown, setShown] = useState<AuthMode>(mode);
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/learn";
  const search = next ? `?next=${encodeURIComponent(next)}` : "";
  const leaving = useRef(false);

  // The page owns the flow while it is open: the forms switch steps and finish through it.
  useEffect(() => {
    beginAuthPage(mode, next);
    setShown(mode);
  }, [mode, next]);

  useEffect(() => {
    const unsubscribe = subscribeAuthDialog((state) => {
      if (!state.open) {
        if (leaving.current) return;
        leaving.current = true;
        void navigate({ href: target, replace: true });
        return;
      }
      setShown(state.mode);
      if (window.location.pathname !== AUTH_PATHS[state.mode]) {
        void navigate({ href: AUTH_PATHS[state.mode] + search, replace: true });
      }
    });
    return () => {
      unsubscribe();
    };
  }, [navigate, search, target]);

  // Already signed in: there is nothing to do here.
  useEffect(() => {
    if (!loading && user && !leaving.current) {
      leaving.current = true;
      void navigate({ href: target, replace: true });
    }
  }, [loading, navigate, target, user]);

  const title =
    shown === "signin" ? t.signinTitle : shown === "signup" ? t.signupTitle : t.forgotTitle;

  return (
    <div dir={ar ? "rtl" : "ltr"} className="min-h-dvh bg-white p-5 text-black">
      <div className="mx-auto max-w-sm">
        <p className="mb-6">
          <Link to="/" className="underline">
            {t.home}
          </Link>
        </p>
        <h1 className="mb-4 text-2xl font-bold">{title}</h1>
        {shown === "signin" && <SignInPanel next={target} />}
        {shown === "signup" && <SignUpPanel />}
        {shown === "forgot" && <ForgotPanel />}
      </div>
    </div>
  );
}
