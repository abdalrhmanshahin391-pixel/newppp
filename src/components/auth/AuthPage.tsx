import "./auth.css";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { UzyraWordmark } from "@/components/brand/UzyraWordmark";
import { AUTH_PATHS, beginAuthPage, subscribeAuthDialog, type AuthMode } from "@/lib/auth-dialog";
import { ForgotPanel, SignInPanel, SignUpPanel } from "./AuthPanels";
import { RitaCube } from "@/components/rita-study/RitaCube";
import { useDotField } from "@/components/page-hero/useDotField";
import { useAuthCopy } from "./auth-copy";

export type AuthStep = AuthMode | "welcome";

/** A headline whose words rise into place one after another. */
function Rising({ text, className }: { text: string; className: string }) {
  const words = text.split(" ");
  return (
    <h1 className={className} aria-label={text}>
      {words.map((word, i) => (
        <Fragment key={i}>
          <span className="ua-word" aria-hidden="true">
            <span style={{ ["--w" as string]: i }}>{word}</span>
          </span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </h1>
  );
}

/** Uzyra's cube, in its idle life, at the size its wrapper gives it. */
function Cube({ className }: { className: string }) {
  const levels = useRef({ input: 0, output: 0 });
  return (
    <span className={className} aria-hidden="true">
      <RitaCube levelsRef={levels} mode="idle" label="" />
    </span>
  );
}

/**
 * The frame of every sign-in page, in the home page's language: the shared top bar, the home
 * hero's field of black marks behind everything, and the content centred on it. A form sits in one
 * white card that starts with the cube. `back` is where the top bar's link goes.
 */
export function AuthFrame({
  welcome = false,
  back,
  children,
}: {
  welcome?: boolean;
  back: { to: string; search?: Record<string, string | undefined> };
  children: ReactNode;
}) {
  const { t, ar } = useAuthCopy();
  const main = useRef<HTMLElement>(null);
  const field = useRef<HTMLCanvasElement>(null);
  useDotField(main, field);
  return (
    <div
      className={`edith-premium edith-light ua ${welcome ? "ua--welcome" : "ua--form"}`}
      dir={ar ? "rtl" : "ltr"}
    >
      <header className="rh-bar">
        <div className="rh-bar-inner uz-header-shell">
          <Link to="/" aria-label="Uzyra" className="rh-logo shrink-0">
            <UzyraWordmark size={16} />
          </Link>
          {welcome ? (
            <Link to="/" className="rh-link">
              {t.home}
            </Link>
          ) : (
            <Link to={back.to} search={back.search} className="rh-link ua-back">
              <ArrowLeft size={18} aria-hidden="true" className="rtl:rotate-180" />
              {t.back}
            </Link>
          )}
        </div>
      </header>
      <main ref={main} className="ua-main">
        <canvas ref={field} className="ua-marks" aria-hidden="true" />
        <section className="ua-body">
          {welcome ? (
            children
          ) : (
            <div className="ua-form">
              <Cube className="ua-cube" />
              {children}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

/**
 * The welcome page and the sign-in, sign-up and reset pages. The welcome page is the home hero's
 * top: «[cube] Welcome to Uzyra», a light headline, one black pill and one white. The forms switch
 * pages and finish through this page; sign-up asks two things per card (see SignUpPanel).
 */
export function AuthPage({ mode, next }: { mode: AuthStep; next?: string }) {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { t, ar } = useAuthCopy();
  const welcome = mode === "welcome";
  const formMode: AuthMode = welcome ? "signin" : mode;
  const [shown, setShown] = useState<AuthMode>(formMode);
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/learn";
  const search = next ? `?next=${encodeURIComponent(next)}` : "";
  const leaving = useRef(false);

  // A form page owns the flow while it is open: the forms switch pages and finish through it.
  useEffect(() => {
    if (welcome) return;
    beginAuthPage(formMode, next);
    setShown(formMode);
  }, [welcome, formMode, next]);

  useEffect(() => {
    if (welcome) return;
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
  }, [navigate, search, target, welcome]);

  // Already signed in: there is nothing to do here.
  useEffect(() => {
    if (!loading && user && !leaving.current) {
      leaving.current = true;
      void navigate({ href: target, replace: true });
    }
  }, [loading, navigate, target, user]);

  const Forward = ar ? ArrowLeft : ArrowRight;

  return (
    <AuthFrame welcome={welcome} back={{ to: "/start", search: { next } }}>
      {welcome ? (
        <div className="ua-welcome">
          <p className="ua-kicker">
            <Cube className="ua-kicker-cube" />
            {t.welcomeTo} {ar ? "يوزرا" : "Uzyra"}
          </p>
          <Rising text={t.startHeadline} className="ua-display" />
          <div className="ua-actions">
            <Link to="/register" search={{ next }} className="ua-btn ua-btn--primary ua-go">
              {t.getStarted}
              <Forward size={20} aria-hidden="true" />
            </Link>
            <Link to="/login" search={{ next }} className="ua-btn ua-btn--ghost">
              {t.haveAccount}
            </Link>
          </div>
          <p className="ua-fine">
            {t.legalLead}{" "}
            <Link to="/terms" className="ua-link">
              {t.terms}
            </Link>{" "}
            {t.and}{" "}
            <Link to="/privacy-policy" className="ua-link">
              {t.privacy}
            </Link>
            .
          </p>
        </div>
      ) : (
        <div key={shown} className="ua-panel">
          {shown === "signin" && <SignInPanel next={target} />}
          {shown === "signup" && <SignUpPanel />}
          {shown === "forgot" && <ForgotPanel />}
        </div>
      )}
    </AuthFrame>
  );
}
