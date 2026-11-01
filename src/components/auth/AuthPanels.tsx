import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useRouter } from "@tanstack/react-router";
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

/* Plain on purpose: no design until the owner asks for one (see AuthPage). */
const field = "w-full border border-black bg-white p-2";

const primaryBtn = "w-full border border-black bg-white p-2 disabled:opacity-60";

function Err({ message }: { message: string }) {
  return (
    <p role="alert" className="mb-4 text-red-700">
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
    <div role="alert" className="mb-4 border border-red-700 p-3 text-red-700">
      <p className="font-bold">{problem.title}</p>
      {problem.hint && <p>{problem.hint}</p>}
      {!!problem.suggestions?.length && (
        <div className="mt-2 flex flex-wrap gap-2">
          {problem.suggestions.map((s) => (
            <button
              key={s}
              type="button"
              dir="ltr"
              onClick={() => onPick?.(s)}
              className="border border-black bg-white px-2 py-1 text-black"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      {problem.action && (
        <button
          type="button"
          onClick={() => setAuthMode(problem.action === "reset" ? "forgot" : "signin")}
          className="mt-2 underline"
        >
          {problem.action === "reset" ? t.resetInstead : t.signInInstead}
        </button>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block">{children}</span>;
}

function Divider({ children }: { children: React.ReactNode }) {
  return <p className="my-4 text-center">{children}</p>;
}

function ShowPassword({
  shown,
  onToggle,
  t,
}: {
  shown: boolean;
  onToggle: () => void;
  t: AuthCopy;
}) {
  return (
    <button type="button" onClick={onToggle} className="mt-1 underline">
      {shown ? t.hidePassword : t.showPassword}
    </button>
  );
}

/** "Terms, Privacy Policy and Refund Policy" as three links. */
function LegalLinks({ t }: { t: AuthCopy }) {
  return (
    <>
      <Link to="/terms" className="underline">
        {t.terms}
      </Link>
      {", "}
      <Link to="/privacy-policy" className="underline">
        {t.privacy}
      </Link>{" "}
      {t.and}{" "}
      <Link to="/refund-policy" className="underline">
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
  const [showPw, setShowPw] = useState(false);
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

      // The page hears this, plays its little "welcome in" moment and then goes to `next`.
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
      <div className="text-center">
        <h3 className="font-bold">{blocked.kind === "suspend" ? t.stopped : t.blocked}</h3>
        {blocked.message && <p className="mt-3 whitespace-pre-wrap">{blocked.message}</p>}
        {blocked.kind === "suspend" && blocked.until && (
          <p className="mt-3">
            {t.accessReturns} {new Date(blocked.until).toLocaleString()}
          </p>
        )}
        <button type="button" onClick={() => setBlocked(null)} className={primaryBtn + " mt-6"}>
          {t.close}
        </button>
      </div>
    );
  }

  return (
    <div>
      {error && <Err message={error} />}

      <GoogleButton label={t.continueGoogle} onClick={handleGoogle} disabled={loading} />
      <Divider>{t.or}</Divider>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <Label>{t.email}</Label>
          <input
            type="email"
            dir="ltr"
            autoComplete="email"
            autoFocus
            className={field}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>

        <label className="block">
          <Label>{t.password}</Label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              dir="ltr"
              autoComplete="current-password"
              className={field}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            <ShowPassword shown={showPw} onToggle={() => setShowPw((v) => !v)} t={t} />
          </div>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => {
                setRemember(e.target.checked);
                if (!e.target.checked) clearRememberedLogin();
              }}
            />
            {t.keepSignedIn}
          </label>
          <button type="button" onClick={() => setAuthMode("forgot")} className="underline">
            {t.forgotLink}
          </button>
        </div>

        <button type="submit" disabled={loading} className={primaryBtn}>
          {loading ? t.signingIn : t.signIn}
        </button>
      </form>

      <p className="mt-6 text-center">
        {t.newHere}{" "}
        <button type="button" onClick={() => setAuthMode("signup")} className="underline">
          {t.createAccountLink}
        </button>
      </p>
    </div>
  );
}

/* ── sign up ────────────────────────────────────────────────────────────── */

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

export function SignUpPanel() {
  const checkIdentity = useServerFn(checkIdentityAvailability);
  const { t } = useAuthCopy();
  const signupSchema = useMemo(() => makeSignupSchema(t), [t]);
  const [form, setForm] = useState({
    full_name: "",
    username: "",
    email: "",
    phone: "",
    password: "",
  });
  const [accepted, setAccepted] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setProblem(null);
    if (!accepted) {
      setProblem({ title: t.oneLastStep, hint: t.tickBox });
      return;
    }
    const parsed = signupSchema.safeParse(form);
    if (!parsed.success) {
      setProblem({
        title: t.fixOne,
        hint: parsed.error.issues[0]?.message ?? t.checkInfo,
      });
      return;
    }
    const data = parsed.data;
    const phone = data.phone ? data.phone : null;

    setLoading(true);
    try {
      const taken = await checkIdentity({ data: { username: data.username, phone: phone ?? "" } });
      if (taken?.username) {
        setProblem({
          title: t.usernameTaken,
          hint: t.usernameTakenHint,
          suggestions: usernameIdeas(data.username),
        });
        setLoading(false);
        return;
      }
      if (taken?.phone) {
        setProblem({ title: t.phoneTaken, hint: t.phoneTakenHint, action: "signin" });
        setLoading(false);
        return;
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: data.full_name,
            username: data.username,
            phone: phone ?? "",
          },
        },
      });
      if (signUpError) {
        const msg = signUpError.message.toLowerCase();
        if (msg.includes("registered") || msg.includes("exists")) {
          setProblem({ title: t.emailTaken, hint: t.emailTakenHint, action: "signin" });
        } else if (msg.includes("password")) {
          setProblem({ title: t.strongerPassword, hint: t.strongerPasswordHint });
        } else if (msg.includes("email")) {
          setProblem({ title: t.badEmail, hint: t.badEmailHint });
        } else {
          setProblem({ title: t.cantCreate, hint: signUpError.message });
        }
        setLoading(false);
        return;
      }
      setSentTo(data.email);
      setLoading(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.somethingWrong;
      setProblem(
        /duplicate|unique/i.test(msg)
          ? { title: t.dupTitle, hint: t.dupHint, action: "signin" }
          : { title: t.somethingWrong, hint: msg },
      );
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
      <div className="space-y-4 text-center">
        {error && <Err message={error} />}
        <p>
          {t.sentTo} <span className="underline">{sentTo}</span>
        </p>
        <p>{t.sentLine}</p>
        <button
          type="button"
          onClick={resendVerification}
          disabled={loading}
          className={primaryBtn}
        >
          {loading ? t.sending : t.sendAgain}
        </button>
        <button type="button" onClick={() => setSentTo(null)} className="underline">
          {t.otherEmail}
        </button>
        <button type="button" onClick={() => setAuthMode("signin")} className={primaryBtn}>
          {t.backToSignin}
        </button>
      </div>
    );
  }

  const googleSignUp = async () => {
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
  };

  return (
    <div>
      {error && <Err message={error} />}
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

      <GoogleButton label={t.signupGoogle} onClick={() => void googleSignUp()} disabled={loading} />
      <p className="mt-2 text-center text-sm">
        {t.googleAgree} <LegalLinks t={t} />
      </p>
      <Divider>{t.or}</Divider>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <label className="block">
          <Label>{t.fullName}</Label>
          <input
            type="text"
            dir="auto"
            autoComplete="name"
            autoFocus
            className={field}
            value={form.full_name}
            onChange={(e) => update("full_name", e.target.value)}
            placeholder={t.placeholderName}
          />
        </label>
        <label className="block">
          <Label>{t.username}</Label>
          <input
            type="text"
            dir="ltr"
            autoComplete="username"
            autoCapitalize="none"
            className={field}
            value={form.username}
            onChange={(e) => update("username", e.target.value)}
            placeholder={t.placeholderUsername}
          />
        </label>
        <label className="block">
          <Label>{t.email}</Label>
          <input
            type="email"
            dir="ltr"
            autoComplete="email"
            className={field}
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <label className="block">
          <Label>{t.phone}</Label>
          <input
            type="tel"
            dir="ltr"
            autoComplete="tel"
            className={field}
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="07XXXXXXXX"
          />
        </label>
        <label className="block">
          <Label>{t.password}</Label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              dir="ltr"
              autoComplete="new-password"
              className={field}
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              placeholder={t.placeholderPassword}
            />
            <ShowPassword shown={showPw} onToggle={() => setShowPw((v) => !v)} t={t} />
          </div>
        </label>

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-1"
          />
          <span>
            {t.agree} <LegalLinks t={t} />
          </span>
        </label>

        <button type="submit" disabled={loading || !accepted} className={primaryBtn}>
          {loading ? t.creating : t.createAccount}
        </button>
      </form>

      <p className="mt-6 text-center">
        {t.haveAccountQ}{" "}
        <button type="button" onClick={() => setAuthMode("signin")} className="underline">
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

  return (
    <div>
      {sent ? (
        <div className="space-y-4 text-center">
          <p>
            {t.resetSentA}{" "}
            <span className="font-bold" dir="ltr">
              {email}
            </span>
            , {t.resetSentB}
          </p>
          <button type="button" onClick={() => setAuthMode("signin")} className={primaryBtn}>
            {t.backToSignin}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Err message={error} />}
          <p>{t.resetLine}</p>
          <label className="block">
            <Label>{t.email}</Label>
            <input
              type="email"
              dir="ltr"
              autoComplete="email"
              autoFocus
              className={field}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <button type="submit" disabled={loading} className={primaryBtn}>
            {loading ? t.sending : t.sendReset}
          </button>
          <button type="button" onClick={() => setAuthMode("signin")} className="underline">
            {t.backToSignin}
          </button>
        </form>
      )}
    </div>
  );
}
