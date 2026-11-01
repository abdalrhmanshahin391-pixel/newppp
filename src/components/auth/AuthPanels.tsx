import { useEffect, useMemo, useState, type FormEvent, type InputHTMLAttributes } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Check, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/legacy-client";
import { lovable } from "@/integrations/lovable";
import { checkIdentityAvailability } from "@/lib/auth.functions";
import {
  loadRememberedLogin,
  saveRememberedLogin,
  clearRememberedLogin,
} from "@/lib/remember-login";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { useAuthCopy, type AuthCopy } from "@/components/auth/auth-copy";

import { closeAuth, setAuthMode } from "@/lib/auth-dialog";

/* ── shared bits ────────────────────────────────────────────────────────── */

function Err({ message }: { message: string }) {
  return (
    <p role="alert" className="ua-alert">
      {message}
    </p>
  );
}

type Problem = {
  title: string;
  hint?: string;
  suggestions?: string[];
  action?: "signin" | "reset";
};

/** A calm, explanatory message with a way forward — used when sign-up can't continue. */
function ProblemNote({
  problem,
  onPick,
  t,
}: {
  problem: Problem;
  onPick?: (value: string) => void;
  t: AuthCopy;
}) {
  return (
    <div role="alert" className="ua-alert">
      <p className="ua-alert-title">{problem.title}</p>
      {problem.hint && <p>{problem.hint}</p>}
      {!!problem.suggestions?.length && (
        <div className="ua-chips">
          {problem.suggestions.map((s) => (
            <button key={s} type="button" dir="ltr" onClick={() => onPick?.(s)} className="ua-chip">
              {s}
            </button>
          ))}
        </div>
      )}
      {problem.action && (
        <button
          type="button"
          onClick={() => setAuthMode(problem.action === "reset" ? "forgot" : "signin")}
          className="ua-link ua-alert-action"
        >
          {problem.action === "reset" ? t.resetInstead : t.signInInstead}
        </button>
      )}
    </div>
  );
}

/** A labelled text field. Email, phone, username and password read left to right in any language. */
function Field({
  label,
  ltr,
  ...input
}: { label: string; ltr?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="ua-field">
      <span className="ua-label">{label}</span>
      <input className="ua-input" dir={ltr ? "ltr" : "auto"} {...input} />
    </label>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  autoFocus,
  t,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  placeholder: string;
  autoFocus?: boolean;
  t: AuthCopy;
}) {
  const [shown, setShown] = useState(false);
  return (
    <label className="ua-field">
      <span className="ua-label">{label}</span>
      <span className="ua-pw">
        <input
          className="ua-input"
          dir="ltr"
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="ua-eye"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? t.hidePassword : t.showPassword}
        >
          {shown ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </span>
    </label>
  );
}

function Divider({ children }: { children: React.ReactNode }) {
  return (
    <p className="ua-or">
      <span>{children}</span>
    </p>
  );
}

/** "Terms, Privacy Policy and Refund Policy" as three links. */
function LegalLinks({ t }: { t: AuthCopy }) {
  return (
    <>
      <Link to="/terms" className="ua-link">
        {t.terms}
      </Link>
      {", "}
      <Link to="/privacy-policy" className="ua-link">
        {t.privacy}
      </Link>{" "}
      {t.and}{" "}
      <Link to="/refund-policy" className="ua-link">
        {t.refund}
      </Link>
    </>
  );
}

/* ── returning from Google ─────────────────────────────────────────────── */

/**
 * Google sends people back to the home page. When a sign-in page asked to go somewhere after it,
 * that wish is kept for the trip and honoured here, once the account is really signed in.
 */
export function AuthReturn() {
  const router = useRouter();
  useEffect(() => {
    const destination = sessionStorage.getItem("rita-auth-next");
    if (!destination) return;
    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      sessionStorage.removeItem("rita-auth-next");
      if (destination.startsWith("/") && !destination.startsWith("//")) {
        void router.navigate({ href: destination, replace: true });
      }
    });
  }, [router]);
  return null;
}

/* ── sign in ────────────────────────────────────────────────────────────── */

export function SignInPanel({ next }: { next?: string }) {
  const router = useRouter();
  const { t } = useAuthCopy();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState<{
    kind: "block" | "suspend";
    message: string | null;
    until: string | null;
  } | null>(null);

  useEffect(() => {
    const saved = loadRememberedLogin();
    if (saved?.email) setEmail(saved.email);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError(t.fillBoth);
      return;
    }
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError) {
        const msg = (signInError.message ?? "").toLowerCase();
        setError(
          msg.includes("fetch") || msg.includes("network")
            ? t.offline
            : msg.includes("confirm") || msg.includes("verif")
              ? t.unverified
              : t.mismatch,
        );
        setLoading(false);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (uid) {
        const { data: prof } = await (supabase.from as any)("profiles")
          .select("locked_at, lock_kind, lock_until, lock_message")
          .eq("id", uid)
          .maybeSingle();
        const stillLocked =
          prof?.locked_at &&
          (prof.lock_kind !== "suspend" ||
            !prof.lock_until ||
            new Date(prof.lock_until).getTime() > Date.now());
        if (stillLocked) {
          await supabase.auth.signOut();
          setBlocked({
            kind: prof.lock_kind === "suspend" ? "suspend" : "block",
            message: prof.lock_message ?? null,
            until: prof.lock_until ?? null,
          });
          setLoading(false);
          return;
        }
      }

      if (remember) saveRememberedLogin({ email: email.trim().toLowerCase() });
      else clearRememberedLogin();

      // The page hears this and goes on to `next`.
      closeAuth();
      void router.invalidate();
    } catch {
      setError(t.wrong);
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    try {
      if (next?.startsWith("/") && !next.startsWith("//")) {
        sessionStorage.setItem("rita-auth-next", next);
      }
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: { prompt: "select_account" },
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      closeAuth();
      await router.invalidate();
      const destination = sessionStorage.getItem("rita-auth-next");
      sessionStorage.removeItem("rita-auth-next");
      if (destination?.startsWith("/") && !destination.startsWith("//")) {
        void router.navigate({ href: destination });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.googleSigninFailed);
      setLoading(false);
    }
  }

  if (blocked) {
    return (
      <div className="ua-stack">
        <p className="ua-alert-title">{blocked.kind === "suspend" ? t.stopped : t.blocked}</p>
        {blocked.message && <p className="whitespace-pre-wrap">{blocked.message}</p>}
        {blocked.kind === "suspend" && blocked.until && (
          <p className="ua-muted">
            {t.accessReturns} {new Date(blocked.until).toLocaleString()}
          </p>
        )}
        <button type="button" onClick={() => setBlocked(null)} className="ua-btn ua-btn--primary">
          {t.close}
        </button>
      </div>
    );
  }

  return (
    <div>
      {error && <Err message={error} />}

      <form onSubmit={handleSubmit} className="ua-stack">
        <Field
          label={t.email}
          ltr
          type="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <PasswordField
          label={t.password}
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          placeholder="••••••••"
          t={t}
        />

        <div className="ua-row">
          <label className="ua-check-row">
            <input
              type="checkbox"
              className="ua-check"
              checked={remember}
              onChange={(e) => {
                setRemember(e.target.checked);
                if (!e.target.checked) clearRememberedLogin();
              }}
            />
            {t.keepSignedIn}
          </label>
          <button type="button" onClick={() => setAuthMode("forgot")} className="ua-link">
            {t.forgotLink}
          </button>
        </div>

        <button type="submit" disabled={loading} className="ua-btn ua-btn--primary">
          {loading ? t.signingIn : t.signIn}
        </button>
      </form>

      <Divider>{t.or}</Divider>
      <GoogleButton label={t.continueGoogle} onClick={handleGoogle} disabled={loading} />

      <p className="ua-switch">
        {t.newHere}{" "}
        <button type="button" onClick={() => setAuthMode("signup")} className="ua-link">
          {t.createAccountLink}
        </button>
      </p>
    </div>
  );
}

/* ── sign up: three short steps, two things at a time ───────────────────── */

function makeSignupSchema(t: AuthCopy) {
  return z
    .object({
      full_name: z.string().trim().min(2, t.vName).max(100),
      username: z
        .string()
        .trim()
        .min(3, t.vUserMin)
        .max(30, t.vUserMax)
        .regex(/^[a-zA-Z0-9_]+$/, t.vUserChars),
      email: z.string().trim().email(t.vEmail).max(255),
      phone: z
        .string()
        .trim()
        .min(6, t.vPhoneMin)
        .max(20, t.vPhoneMax)
        .regex(/^[0-9+\-\s()]{6,20}$/, t.vPhone),
      password: z.string().min(6, t.vPassword).max(72),
    })
    .strip();
}

type SignupForm = {
  full_name: string;
  username: string;
  email: string;
  phone: string;
  password: string;
};

const STEP_FIELDS: (keyof SignupForm)[][] = [
  ["full_name", "username"],
  ["email", "phone"],
  ["password"],
];

/** Friendly alternatives when the chosen username is gone. */
function usernameIdeas(base: string) {
  const clean =
    base
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 20) || "student";
  const n = new Date().getFullYear() % 100;
  return [`${clean}${n}`, `${clean}_${Math.floor(10 + Math.random() * 89)}`, `real${clean}`];
}

export function SignUpPanel() {
  const checkIdentity = useServerFn(checkIdentityAvailability);
  const { t, ar } = useAuthCopy();
  const schema = useMemo(() => makeSignupSchema(t), [t]);
  const [form, setForm] = useState<SignupForm>({
    full_name: "",
    username: "",
    email: "",
    phone: "",
    password: "",
  });
  const [step, setStep] = useState(0);
  const [forward, setForward] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof SignupForm>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function goTo(to: number) {
    setForward(to > step);
    setProblem(null);
    setError(null);
    setStep(to);
  }

  /** The availability check is a courtesy: if it cannot run, sign-up itself still catches clashes. */
  async function taken(phone: string) {
    try {
      return await checkIdentity({ data: { username: form.username.trim(), phone } });
    } catch {
      return null;
    }
  }

  async function handleNext(e: FormEvent) {
    e.preventDefault();
    setProblem(null);
    setError(null);

    const fields = STEP_FIELDS[step];
    const mask = Object.fromEntries(fields.map((f) => [f, true])) as Partial<
      Record<keyof SignupForm, true>
    >;
    const parsed = schema.pick(mask).safeParse(form);
    if (!parsed.success) {
      setProblem({ title: t.fixOne, hint: parsed.error.issues[0]?.message ?? t.checkInfo });
      return;
    }

    if (step === 0) {
      setLoading(true);
      const result = await taken("");
      setLoading(false);
      if (result?.username) {
        setProblem({
          title: t.usernameTaken,
          hint: t.usernameTakenHint,
          suggestions: usernameIdeas(form.username),
        });
        return;
      }
      goTo(1);
      return;
    }

    if (step === 1) {
      setLoading(true);
      const result = await taken(form.phone.trim());
      setLoading(false);
      if (result?.phone) {
        setProblem({ title: t.phoneTaken, hint: t.phoneTakenHint, action: "signin" });
        return;
      }
      goTo(2);
      return;
    }

    if (!accepted) {
      setProblem({ title: t.oneLastStep, hint: t.tickBox });
      return;
    }
    const all = schema.safeParse(form);
    if (!all.success) {
      setProblem({ title: t.fixOne, hint: all.error.issues[0]?.message ?? t.checkInfo });
      return;
    }
    const data = all.data;

    setLoading(true);
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { full_name: data.full_name, username: data.username, phone: data.phone },
        },
      });
      setLoading(false);
      if (signUpError) {
        const msg = signUpError.message.toLowerCase();
        if (msg.includes("registered") || msg.includes("exists")) {
          goTo(1);
          setProblem({ title: t.emailTaken, hint: t.emailTakenHint, action: "signin" });
        } else if (msg.includes("password")) {
          setProblem({ title: t.strongerPassword, hint: t.strongerPasswordHint });
        } else if (msg.includes("email")) {
          goTo(1);
          setProblem({ title: t.badEmail, hint: t.badEmailHint });
        } else {
          setProblem({ title: t.cantCreate, hint: signUpError.message });
        }
        return;
      }
      setSentTo(data.email);
    } catch (err) {
      setLoading(false);
      const msg = err instanceof Error ? err.message : t.somethingWrong;
      if (/duplicate|unique/i.test(msg)) {
        goTo(0);
        setProblem({ title: t.dupTitle, hint: t.dupHint, action: "signin" });
      } else {
        setProblem({ title: t.somethingWrong, hint: msg });
      }
    }
  }

  async function googleSignUp() {
    setError(null);
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: { prompt: "select_account" },
      });
      if (result.error) throw result.error;
      if (!result.redirected) closeAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.googleSignupFailed);
      setLoading(false);
    }
  }

  if (sentTo) {
    const verificationEmail = sentTo;
    async function resendVerification() {
      setError(null);
      setLoading(true);
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: verificationEmail,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      setLoading(false);
      if (resendError) setError(resendError.message);
    }
    return (
      <div className="ua-stack ua-sent">
        {error && <Err message={error} />}
        <span className="ua-tick" aria-hidden="true">
          <Check size={28} strokeWidth={2.5} />
        </span>
        <p className="ua-sent-title">{t.sentTitle}</p>
        <p>
          {t.sentTo}{" "}
          <strong dir="ltr" className="ua-break">
            {sentTo}
          </strong>
        </p>
        <p className="ua-muted">{t.sentLine}</p>
        <button
          type="button"
          onClick={() => setAuthMode("signin")}
          className="ua-btn ua-btn--primary"
        >
          {t.backToSignin}
        </button>
        <button
          type="button"
          onClick={resendVerification}
          disabled={loading}
          className="ua-btn ua-btn--ghost"
        >
          {loading ? t.sending : t.sendAgain}
        </button>
        <button
          type="button"
          onClick={() => {
            setSentTo(null);
            goTo(1);
          }}
          className="ua-link"
        >
          {t.otherEmail}
        </button>
      </div>
    );
  }

  const stepTitle = [t.step1, t.step2, t.step3][step];
  const last = step === STEP_FIELDS.length - 1;

  return (
    <div>
      <div className="ua-steps">
        <div className="ua-progress" aria-hidden="true">
          {STEP_FIELDS.map((_, i) => (
            <span key={i} className={i <= step ? "is-on" : undefined} />
          ))}
        </div>
        <p className="ua-step-label">
          {t.stepWord} {step + 1} {t.ofWord} {STEP_FIELDS.length}
          <span aria-hidden="true"> · </span>
          <strong>{stepTitle}</strong>
        </p>
      </div>

      {error && <Err message={error} />}

      <form
        key={step}
        onSubmit={handleNext}
        className={`ua-stack ua-step ${forward ? "is-forward" : "is-back"}`}
        aria-label={stepTitle}
      >
        {problem && (
          <ProblemNote
            t={t}
            problem={problem}
            onPick={(v) => {
              update("username", v);
              setProblem(null);
            }}
          />
        )}

        {step === 0 && (
          <>
            <Field
              label={t.fullName}
              type="text"
              autoComplete="name"
              autoFocus
              value={form.full_name}
              onChange={(e) => update("full_name", e.target.value)}
              placeholder={t.placeholderName}
            />
            <Field
              label={t.username}
              ltr
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={form.username}
              onChange={(e) => update("username", e.target.value)}
              placeholder={t.placeholderUsername}
            />
          </>
        )}

        {step === 1 && (
          <>
            <Field
              label={t.email}
              ltr
              type="email"
              autoComplete="email"
              autoFocus
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="you@example.com"
            />
            <Field
              label={t.phone}
              ltr
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="07XXXXXXXX"
            />
          </>
        )}

        {step === 2 && (
          <>
            <PasswordField
              label={t.password}
              value={form.password}
              onChange={(v) => update("password", v)}
              autoComplete="new-password"
              placeholder={t.placeholderPassword}
              autoFocus
              t={t}
            />
            <label className="ua-check-row ua-check-row--top">
              <input
                type="checkbox"
                className="ua-check"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              <span>
                {t.agree} <LegalLinks t={t} />
              </span>
            </label>
          </>
        )}

        <div className="ua-step-actions">
          {step > 0 && (
            <button
              type="button"
              onClick={() => goTo(step - 1)}
              className="ua-btn ua-btn--ghost ua-btn--back"
              aria-label={t.back}
            >
              <ArrowLeft size={20} aria-hidden="true" className={ar ? "rotate-180" : undefined} />
            </button>
          )}
          <button type="submit" disabled={loading} className="ua-btn ua-btn--primary">
            {loading ? (last ? t.creating : t.checking) : last ? t.createAccount : t.next}
          </button>
        </div>
      </form>

      {step === 0 && (
        <>
          <Divider>{t.or}</Divider>
          <GoogleButton
            label={t.signupGoogle}
            onClick={() => void googleSignUp()}
            disabled={loading}
          />
          <p className="ua-fine">
            {t.googleAgree} <LegalLinks t={t} />
          </p>
        </>
      )}

      <p className="ua-switch">
        {t.haveAccountQ}{" "}
        <button type="button" onClick={() => setAuthMode("signin")} className="ua-link">
          {t.signIn}
        </button>
      </p>
    </div>
  );
}

/* ── forgot password ────────────────────────────────────────────────────── */

export function ForgotPanel() {
  const { t } = useAuthCopy();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError(t.enterEmail);
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (err) {
      const message = (err.message ?? "").toLowerCase();
      setError(
        message.includes("fetch") || message.includes("network") ? t.resetOffline : err.message,
      );
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="ua-stack ua-sent">
        <span className="ua-tick" aria-hidden="true">
          <Check size={28} strokeWidth={2.5} />
        </span>
        <p>
          {t.resetSentA}{" "}
          <strong dir="ltr" className="ua-break">
            {email}
          </strong>
          , {t.resetSentB}
        </p>
        <button
          type="button"
          onClick={() => setAuthMode("signin")}
          className="ua-btn ua-btn--primary"
        >
          {t.backToSignin}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="ua-stack">
      {error && <Err message={error} />}
      <Field
        label={t.email}
        ltr
        type="email"
        autoComplete="email"
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
      />
      <button type="submit" disabled={loading} className="ua-btn ua-btn--primary">
        {loading ? t.sending : t.sendReset}
      </button>
      <button type="button" onClick={() => setAuthMode("signin")} className="ua-link ua-center">
        {t.backToSignin}
      </button>
    </form>
  );
}
