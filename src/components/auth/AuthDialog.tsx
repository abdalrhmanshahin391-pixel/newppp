import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { Eye, EyeOff, MailCheck, X, ArrowLeft } from "lucide-react";
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
import { RitaFace } from "@/components/brand/RitaBrand";
import { GoogleButton } from "@/components/auth/GoogleButton";

import {
  closeAuth,
  getAuthDialogState,
  setAuthMode,
  subscribeAuthDialog,
  type AuthDialogState,
  type AuthMode,
} from "@/lib/auth-dialog";

/* ── shared bits ────────────────────────────────────────────────────────── */

const field =
  "w-full rounded-2xl border-2 border-black/[0.07] bg-[#fbf7ef] px-4 py-3.5 text-[15px] font-medium text-foreground placeholder:font-normal placeholder:text-muted-foreground outline-none transition-all focus:border-[var(--rita-green)] focus:bg-white focus:ring-4 focus:ring-[var(--rita-green-soft)]";

const primaryBtn =
  "inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--rita-green)] px-8 py-4 text-[16px] font-black text-[color:var(--rita-green-ink)] shadow-[0_16px_30px_-16px_rgba(122,160,44,0.9)] transition-all hover:-translate-y-0.5 hover:bg-[var(--rita-green-deep)] active:translate-y-0 disabled:translate-y-0 disabled:opacity-60";

function Err({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
    >
      {message}
    </div>
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
}: {
  problem: Problem;
  onPick?: (value: string) => void;
}) {
  return (
    <div
      role="alert"
      className="mb-4 rounded-2xl border border-destructive/25 bg-destructive/[0.07] px-4 py-3.5"
    >
      <p className="text-[14px] font-black text-destructive">{problem.title}</p>
      {problem.hint && (
        <p className="mt-1 text-[13px] font-medium leading-relaxed text-[#6b655c]">{problem.hint}</p>
      )}
      {!!problem.suggestions?.length && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {problem.suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPick?.(s)}
              className="rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-[13px] font-black text-foreground transition hover:-translate-y-0.5"
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
          className="mt-2.5 text-[13px] font-black text-[var(--rita-green-deep)] underline underline-offset-2"
        >
          {problem.action === "reset" ? "Reset your password" : "Sign in instead"}
        </button>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-[12px] font-black uppercase tracking-[0.08em] text-[#6b655c]">
      {children}
    </span>
  );
}

/* ── the window ─────────────────────────────────────────────────────────── */

export function AuthDialogHost() {
  const [state, setState] = useState<AuthDialogState>(() => getAuthDialogState());
  const router = useRouter();

  useEffect(() => {
    const unsub = subscribeAuthDialog(setState);
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!state.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAuth();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [state.open]);

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

  if (!state.open) return null;
  return <AuthWindow mode={state.mode} next={state.next} />;
}

function AuthWindow({ mode, next }: { mode: AuthMode; next?: string }) {
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-black/45 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (!cardRef.current?.contains(e.target as Node)) closeAuth();
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="Sign in to RitaJet"
        className="rita-dialog-pop relative w-full max-w-[27rem] rounded-[30px] border border-black/[0.06] bg-[#fdfaf3] p-6 shadow-[0_60px_120px_-45px_rgba(35,32,29,0.8)] sm:p-9"
      >
        <button
          type="button"
          onClick={closeAuth}
          aria-label="Close"
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-[#6b655c] transition-colors hover:bg-black/[0.05] hover:text-foreground"
        >
          <X size={18} />
        </button>

        <div className="mb-6 flex flex-col items-center text-center">
          <RitaFace size={68} />
          <h2 className="mt-3 font-display text-[24px] font-black leading-tight tracking-tight text-foreground">
            {mode === "signup"
              ? "Create your RitaJet account"
              : mode === "forgot"
                ? "Reset your password"
                : "Welcome back"}
          </h2>
          <p className="mt-1.5 max-w-[19rem] text-[14px] leading-relaxed text-[#6b655c]">
            {mode === "signup"
              ? "Your flashcards, summaries and to-dos, saved to one account."
              : mode === "forgot"
                ? "We'll email you a link to choose a new password."
                : "Pick up your cards, decks and study streak where you left them."}
          </p>
        </div>

        {mode === "signin" && <SignInPanel next={next} />}
        {mode === "signup" && <SignUpPanel />}
        {mode === "forgot" && <ForgotPanel />}
      </div>
    </div>
  );
}

/* ── sign in ────────────────────────────────────────────────────────────── */

function SignInPanel({ next }: { next?: string }) {
  const router = useRouter();
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
      setError("Please fill in your email and password.");
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
            ? "RitaJet cannot reach its account service right now. Your password was not rejected; please try again after the database connection is restored."
            : msg.includes("confirm") || msg.includes("verif")
            ? "Your email isn't verified yet. Open the verification link we sent you, then sign in again — check your spam folder too."
            : "That email and password don't match.",
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

      closeAuth();
      if (next) {
        void router.navigate({ href: next });
      }
      void router.invalidate();
    } catch {
      setError("Something went wrong. Please try again.");
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
      setError(err instanceof Error ? err.message : "Google sign-in could not start. Please try again.");
      setLoading(false);
    }
  }

  if (blocked) {
    return (
      <div className="text-center">
        <h3 className="text-lg font-black text-foreground">
          {blocked.kind === "suspend"
            ? "Your account is temporarily stopped"
            : "Your account has been blocked"}
        </h3>
        {blocked.message && (
          <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{blocked.message}</p>
        )}
        {blocked.kind === "suspend" && blocked.until && (
          <p className="mt-3 text-sm font-bold text-muted-foreground">
            Access returns on {new Date(blocked.until).toLocaleString()}
          </p>
        )}
        <button type="button" onClick={() => setBlocked(null)} className={primaryBtn + " mt-6"}>
          Close
        </button>
      </div>
    );
  }

  return (
    <div>
      {error && <Err message={error} />}

      <GoogleButton label="Continue with Google" onClick={handleGoogle} disabled={loading} />
      <div className="my-5 flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.08em] text-[#8a847a]">
        <span className="h-px flex-1 bg-black/[0.08]" /> or <span className="h-px flex-1 bg-black/[0.08]" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

          <label className="block">
            <Label>email</Label>
            <input
              type="email"
              autoComplete="email"
              autoFocus
              className={field}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label className="block">
            <Label>password</Label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                className={field + " pr-12"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex cursor-pointer select-none items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => {
                  setRemember(e.target.checked);
                  if (!e.target.checked) clearRememberedLogin();
                }}
                className="h-4 w-4 rounded border-2 border-border accent-[var(--rita-green)]"
              />
              keep me signed in
            </label>
            <button
              type="button"
              onClick={() => setAuthMode("forgot")}
              className="text-sm font-medium text-muted-foreground underline hover:text-foreground"
            >
              forgot your password?
            </button>
          </div>

          <button type="submit" disabled={loading} className={primaryBtn}>

            {loading ? "Signing in…" : "Sign in"}
          </button>
      </form>



      <p className="mt-6 border-t border-black/[0.07] pt-4 text-center text-sm font-medium text-muted-foreground">
        New to Rita?{" "}
        <button
          type="button"
          onClick={() => setAuthMode("signup")}
          className="font-black text-[color:var(--rita-green-deep)] underline"
        >
          Create account
        </button>
      </p>
    </div>
  );
}

/* ── sign up ────────────────────────────────────────────────────────────── */

const signupSchema = z
  .object({
    full_name: z.string().trim().min(2, "Please enter your full name.").max(100),
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters.")
      .max(30, "Username must be less than 30 characters.")
      .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores."),
    email: z.string().trim().email("Please enter a valid email address.").max(255),
    phone: z
      .string()
      .trim()
      .min(6, "Please enter your phone number (at least 6 digits).")
      .max(20, "Phone number cannot exceed 20 characters.")
      .regex(/^[0-9+\-\s()]{6,20}$/, "Please enter a valid phone number."),
    password: z.string().min(6, "Password must be at least 6 characters.").max(72),
  })
  .strip();

function SignUpPanel() {
  const checkIdentity = useServerFn(checkIdentityAvailability);
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
    const clean = base.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20) || "student";
    const n = new Date().getFullYear() % 100;
    return [`${clean}${n}`, `${clean}_${Math.floor(10 + Math.random() * 89)}`, `real${clean}`];
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setProblem(null);
    if (!accepted) {
      setProblem({
        title: "One last step",
        hint: "Tick the box to accept the Terms and Privacy Policy, then create your account.",
      });
      return;
    }
    const parsed = signupSchema.safeParse(form);
    if (!parsed.success) {
      setProblem({
        title: "Let's fix one thing",
        hint: parsed.error.issues[0]?.message ?? "Please check your information.",
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
          title: "That username is already in use",
          hint: "Usernames are unique on RitaJet. Here are a few that are free right now:",
          suggestions: usernameIdeas(data.username),
        });
        setLoading(false);
        return;
      }
      if (taken?.phone) {
        setProblem({
          title: "This phone number already has an account",
          hint: "You can sign in with that account, or leave the phone field empty and add a different number later.",
          action: "signin",
        });
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
          setProblem({
            title: "You already have an account with this email",
            hint: "Sign in to pick up where you left off, or reset your password if you don't remember it.",
            action: "signin",
          });
        } else if (msg.includes("password")) {
          setProblem({
            title: "Choose a stronger password",
            hint: "Use at least 8 characters and mix in a number or symbol — common passwords are not accepted.",
          });
        } else if (msg.includes("email")) {
          setProblem({
            title: "That email address didn't work",
            hint: "Double-check the spelling, or try another address you can open right now.",
          });
        } else {
          setProblem({ title: "We couldn't create the account", hint: signUpError.message });
        }
        setLoading(false);
        return;
      }
      setSentTo(data.email);
      setLoading(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setProblem(
        /duplicate|unique/i.test(msg)
          ? {
              title: "That username or phone is already in use",
              hint: "Try a different username, or sign in to the account that already has it.",
              action: "signin",
            }
          : { title: "Something went wrong", hint: msg },
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
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--rita-green)] text-[color:var(--rita-green-ink)]">
          <MailCheck size={26} />
        </span>
        <p className="text-sm font-bold text-foreground">
          We sent a verification link to <span className="underline">{sentTo}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Your account stays inactive until you open that link. Check your spam folder if it is not in your inbox.
        </p>
        <button type="button" onClick={resendVerification} disabled={loading} className="rita-btn rita-btn-secondary mx-auto">
          {loading ? "Sending…" : "Send the verification email again"}
        </button>
        <button type="button" onClick={() => setSentTo(null)} className="text-sm font-bold text-muted-foreground underline">
          Use a different email
        </button>
        <button type="button" onClick={() => setAuthMode("signin")} className={primaryBtn}>
          Back to sign in
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
      setError(err instanceof Error ? err.message : "Google sign-up could not start. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div>
      {error && <Err message={error} />}
      {problem && (
        <ProblemNote
          problem={problem}
          onPick={(v) => {
            update("username", v);
            setProblem(null);
          }}
        />
      )}

      <GoogleButton label="Sign up with Google" onClick={() => void googleSignUp()} disabled={loading} />
      <p className="mt-2 text-center text-xs font-medium text-muted-foreground">
        By continuing with Google you agree to RitaJet's{" "}
        <Link to="/terms" className="underline">Terms</Link>,{" "}
        <Link to="/privacy-policy" className="underline">Privacy Policy</Link> and{" "}
        <Link to="/refund-policy" className="underline">Refund Policy</Link>.
      </p>
      <div className="my-5 flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.08em] text-[#8a847a]">
        <span className="h-px flex-1 bg-black/[0.08]" /> or <span className="h-px flex-1 bg-black/[0.08]" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">

          <label className="block">
            <Label>full name</Label>
            <input
              type="text"
              autoComplete="name"
              autoFocus
              className={field}
              value={form.full_name}
              onChange={(e) => update("full_name", e.target.value)}
              placeholder="Your full name"
            />
          </label>
          <label className="block">
            <Label>username</Label>
            <input
              type="text"
              autoComplete="username"
              className={field}
              value={form.username}
              onChange={(e) => update("username", e.target.value)}
              placeholder="Choose a username"
            />
          </label>
          <label className="block">
            <Label>email</Label>
            <input
              type="email"
              autoComplete="email"
              className={field}
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label className="block">
            <Label>phone number</Label>
            <input
              type="tel"
              autoComplete="tel"
              className={field}
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="07XXXXXXXX"
            />
          </label>
          <label className="block">
            <Label>password</Label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                className={field + " pr-12"}
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder="At least 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <label className="flex cursor-pointer select-none items-start gap-2 rounded-2xl bg-[#f6f1e5] p-3 text-xs font-bold text-foreground">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 border-border accent-[var(--rita-green)]"
            />
            <span>
              I agree to RitaJet's <Link to="/terms" className="underline">Terms</Link>,{" "}
              <Link to="/privacy-policy" className="underline">Privacy Policy</Link> and{" "}
              <Link to="/refund-policy" className="underline">Refund Policy</Link>.
            </span>
          </label>

          <button type="submit" disabled={loading || !accepted} className={primaryBtn}>
            {loading ? "Creating your account…" : "Create account"}
          </button>
      </form>



      <p className="mt-6 border-t border-black/[0.07] pt-4 text-center text-sm font-medium text-muted-foreground">
        Already have an account?{" "}
        <button
          type="button"
          onClick={() => setAuthMode("signin")}
          className="font-black text-[color:var(--rita-green-deep)] underline"
        >
          Sign in
        </button>
      </p>
    </div>
  );
}

/* ── forgot password ────────────────────────────────────────────────────── */

function ForgotPanel() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Please enter your email address.");
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
        message.includes("fetch") || message.includes("network")
          ? "RitaJet cannot reach its account service right now. No reset email was sent; please try again after the database connection is restored."
          : err.message,
      );
      return;
    }
    setSent(true);
  }

  return (
    <div>
      {sent ? (
        <div className="space-y-4 text-center">
          <MailCheck className="mx-auto text-[color:var(--rita-green-deep)]" size={28} />
          <p className="text-sm text-muted-foreground">
            If an account exists for <span className="font-bold">{email}</span>, a reset link is on
            its way.
          </p>
          <button type="button" onClick={() => setAuthMode("signin")} className={primaryBtn}>
            Back to sign in
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Err message={error} />}
          <p className="text-center text-sm text-muted-foreground">
            Enter the email you signed up with and we'll send you a link to set a new password.
          </p>
          <label className="block">
            <Label>email</Label>
            <input
              type="email"
              autoComplete="email"
              autoFocus
              className={field}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <button type="submit" disabled={loading} className={primaryBtn}>
            {loading ? "Sending…" : "Send reset link"}
          </button>
          <button
            type="button"
            onClick={() => setAuthMode("signin")}
            className="mx-auto flex items-center gap-1.5 text-sm font-medium text-muted-foreground underline hover:text-foreground"
          >
            <ArrowLeft size={14} /> back to sign in
          </button>
        </form>
      )}
    </div>
  );
}
