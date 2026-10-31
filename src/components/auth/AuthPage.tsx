import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { LETTERS } from "@/components/language/LanguageSplash";
import { AUTH_PATHS, beginAuthPage, subscribeAuthDialog, type AuthMode } from "@/lib/auth-dialog";
import { AuthRings } from "./AuthRings";
import { ForgotPanel, SignInPanel, SignUpPanel } from "./AuthPanels";

const TEXT: Record<"en" | "ar", Record<AuthMode, { title: string; line: string }>> = {
  en: {
    signin: {
      title: "Welcome back",
      line: "Pick up your cards, lessons and talks with Rita where you left them.",
    },
    signup: {
      title: "Create your account",
      line: "One account for Rita, your flashcards, summaries and plans.",
    },
    forgot: {
      title: "Reset your password",
      line: "We will email you a link to choose a new one.",
    },
  },
  ar: {
    signin: {
      title: "أهلاً من جديد",
      line: "كمّل بطاقاتك ودروسك وحديثك مع ريتا من حيث توقفت.",
    },
    signup: {
      title: "أنشئ حسابك",
      line: "حساب واحد لريتا وبطاقاتك وملخصاتك وخططك.",
    },
    forgot: {
      title: "إعادة تعيين كلمة السر",
      line: "رح نبعتلك رابط على إيميلك لتختار كلمة سر جديدة.",
    },
  },
};

/** UZYRA in the same drawn lines as the language splash, drawn letter by letter. */
function DrawnWordmark() {
  return (
    <span className="uz-auth-word" dir="ltr" role="img" aria-label="Uzyra">
      {LETTERS.map((letter, index) => (
        <svg
          key={letter.key}
          viewBox="-2 -2 60 104"
          aria-hidden="true"
          focusable="false"
          style={{ ["--i" as string]: index }}
        >
          <path d={letter.d} pathLength={1} />
        </svg>
      ))}
    </span>
  );
}

/**
 * Signing in, signing up and resetting a password, as one page: the rings and the drawn
 * wordmark on one side, the form on the other (stacked on phones). The forms are the same ones
 * the old window used; this page only gives them a place. The step lives in the address.
 */
export function AuthPage({ mode, next }: { mode: AuthMode; next?: string }) {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { i18n } = useTranslation();
  const ar = (i18n.language ?? "").startsWith("ar");
  const [shown, setShown] = useState<AuthMode>(mode);
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/learn";
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
      const search = next ? `?next=${encodeURIComponent(next)}` : "";
      if (window.location.pathname !== AUTH_PATHS[state.mode]) {
        void navigate({ href: AUTH_PATHS[state.mode] + search, replace: true });
      }
    });
    return () => {
      unsubscribe();
    };
  }, [navigate, next, target]);

  // Already signed in: there is nothing to do here.
  useEffect(() => {
    if (!loading && user && !leaving.current) {
      leaving.current = true;
      void navigate({ href: target, replace: true });
    }
  }, [loading, navigate, target, user]);

  const text = TEXT[ar ? "ar" : "en"][shown];
  const switchTo = (to: AuthMode) => {
    const search = next ? `?next=${encodeURIComponent(next)}` : "";
    void navigate({ href: AUTH_PATHS[to] + search, replace: true });
  };

  return (
    <div className="edith-premium edith-light uz-auth" dir={ar ? "rtl" : "ltr"}>
      <div className="uz-auth-glow" aria-hidden="true" />
      <header className="uz-auth-top">
        <Link to="/" className="uz-auth-back">
          <ArrowLeft size={18} aria-hidden="true" className="rtl:rotate-180" />
          {ar ? "الرئيسية" : "Home"}
        </Link>
      </header>

      <main className="uz-auth-main">
        <section className="uz-auth-stage" aria-label="Uzyra">
          <AuthRings />
          <div className="uz-auth-mark">
            <span className="uz-auth-welcome">{ar ? "أهلاً بك في" : "Welcome to"}</span>
            <DrawnWordmark />
          </div>
          <p className="uz-auth-pitch">
            {ar
              ? "تحدث مع ريتا بصوتك، وتعلّم بموادك أنت، وتابع تقدّمك كل يوم."
              : "Talk with Rita out loud, study from your own material, and see yourself improve every day."}
          </p>
        </section>

        <section className="uz-auth-card" aria-labelledby="uz-auth-title">
          {shown !== "forgot" ? (
            <div className="uz-auth-switch" role="group" aria-label="Account">
              {(["signup", "signin"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={shown === m}
                  onClick={() => switchTo(m)}
                >
                  {m === "signup"
                    ? ar
                      ? "ابدأ"
                      : "Get started"
                    : ar
                      ? "عندي حساب"
                      : "I have an account"}
                </button>
              ))}
            </div>
          ) : null}
          <div key={shown} className="uz-auth-step">
            <h1 id="uz-auth-title" className="uz-auth-title">
              {text.title}
            </h1>
            <p className="uz-auth-line">{text.line}</p>
            <div className="uz-auth-form">
              {shown === "signin" && <SignInPanel next={target} />}
              {shown === "signup" && <SignUpPanel />}
              {shown === "forgot" && <ForgotPanel />}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
