import { useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/legacy-client";
import { settingsText as t, type SettingsLang } from "@/lib/settings";
import { SettingsNotice, SettingsRow } from "./SettingsControls";

function PasswordField({
  id,
  value,
  onChange,
  current,
  invalid,
  lang,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  current?: boolean;
  invalid?: boolean;
  lang: SettingsLang;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="settings-password">
      <input
        id={id}
        className="settings-input"
        type={show ? "text" : "password"}
        autoComplete={current ? "current-password" : "new-password"}
        value={value}
        aria-invalid={invalid || undefined}
        aria-describedby={
          invalid
            ? "settings-security-message"
            : id === "settings-new-password"
              ? `${id}-hint`
              : undefined
        }
        required
        minLength={current ? undefined : 6}
        onChange={(event) => onChange(event.target.value)}
        dir="ltr"
      />
      <button
        type="button"
        className="settings-icon-button"
        aria-label={
          show
            ? t(lang, "Hide password", "إخفاء كلمة المرور")
            : t(lang, "Show password", "إظهار كلمة المرور")
        }
        aria-pressed={show}
        onClick={() => setShow(!show)}
      >
        {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}
export function SecuritySettings({ lang }: { lang: SettingsLang }) {
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState<string | null>(null);
  const guard = useRef(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const hasPassword =
    user?.app_metadata?.provider === "email" || user?.app_metadata?.providers?.includes("email");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (guard.current) return;
    setMessage(null);
    setInvalid(null);
    if (password.length < 6 || password !== confirmation) {
      setMessage({
        kind: "error",
        text:
          password !== confirmation
            ? t(lang, "The new passwords don’t match.", "كلمتا المرور الجديدتان غير متطابقتين.")
            : t(lang, "Use at least 6 characters.", "استخدم 6 أحرف على الأقل."),
      });
      const field =
        password !== confirmation ? "settings-confirm-password" : "settings-new-password";
      setInvalid(field);
      document.getElementById(field)?.focus();
      return;
    }
    guard.current = true;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password,
        ...({ current_password: current } as Record<string, string>),
      });
      if (error) {
        const detail = error.message.toLowerCase();
        const field = /current|invalid.credentials/.test(detail)
          ? "settings-current-password"
          : "settings-new-password";
        setInvalid(field);
        document.getElementById(field)?.focus();
        setMessage({
          kind: "error",
          text: /current|invalid.credentials/.test(detail)
            ? t(lang, "Your current password isn’t correct.", "كلمة المرور الحالية غير صحيحة.")
            : /weak|pwned|breach/.test(detail)
              ? t(
                  lang,
                  "Choose a stronger password that hasn’t appeared in a data leak.",
                  "اختر كلمة مرور أقوى لم تظهر في تسريب بيانات.",
                )
              : /same/.test(detail)
                ? t(
                    lang,
                    "Choose a password different from your current one.",
                    "اختر كلمة مرور مختلفة عن الحالية.",
                  )
                : t(
                    lang,
                    "We couldn’t change your password. Please try again.",
                    "تعذّر تغيير كلمة المرور. جرّب مرة ثانية.",
                  ),
        });
      } else {
        setCurrent("");
        setPassword("");
        setConfirmation("");
        setMessage({
          kind: "success",
          text: t(lang, "Your password has been changed.", "تم تغيير كلمة المرور."),
        });
      }
    } catch {
      setMessage({
        kind: "error",
        text: t(
          lang,
          "We couldn’t change your password. Please try again.",
          "تعذّر تغيير كلمة المرور. جرّب مرة ثانية.",
        ),
      });
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  if (!hasPassword)
    return (
      <SettingsRow
        label={t(lang, "Sign-in method", "طريقة تسجيل الدخول")}
        hint={t(
          lang,
          "Your account uses a connected sign-in provider.",
          "حسابك يستخدم مزوّد تسجيل دخول مرتبطًا.",
        )}
      >
        <p>
          {t(
            lang,
            "You can use the password recovery page to set up or recover email sign-in.",
            "يمكنك استخدام صفحة استعادة كلمة المرور لإعداد أو استعادة الدخول بالبريد.",
          )}
        </p>
        <Link to="/forgot-password" className="settings-button settings-button-secondary">
          {t(lang, "Password recovery", "استعادة كلمة المرور")}
        </Link>
      </SettingsRow>
    );
  return (
    <form onSubmit={submit}>
      <SettingsRow
        id="settings-current-password"
        label={t(lang, "Current password", "كلمة المرور الحالية")}
      >
        <PasswordField
          id="settings-current-password"
          value={current}
          onChange={(value) => {
            setCurrent(value);
            setMessage(null);
            setInvalid(null);
          }}
          invalid={invalid === "settings-current-password"}
          current
          lang={lang}
        />
      </SettingsRow>
      <SettingsRow
        id="settings-new-password"
        label={t(lang, "New password", "كلمة المرور الجديدة")}
        hint={t(
          lang,
          "Use at least 6 characters and choose a password unique to this account.",
          "استخدم 6 أحرف على الأقل وكلمة مرور خاصة بهذا الحساب.",
        )}
      >
        <PasswordField
          id="settings-new-password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            setMessage(null);
            setInvalid(null);
          }}
          invalid={invalid === "settings-new-password"}
          lang={lang}
        />
      </SettingsRow>
      <SettingsRow
        id="settings-confirm-password"
        label={t(lang, "Confirm new password", "تأكيد كلمة المرور الجديدة")}
      >
        <PasswordField
          id="settings-confirm-password"
          value={confirmation}
          onChange={(value) => {
            setConfirmation(value);
            setMessage(null);
            setInvalid(null);
          }}
          invalid={invalid === "settings-confirm-password"}
          lang={lang}
        />
      </SettingsRow>
      {message && (
        <SettingsNotice id="settings-security-message" kind={message.kind}>
          {message.text}
        </SettingsNotice>
      )}
      <div className="settings-actions">
        <Link to="/forgot-password" className="settings-text-link">
          {t(lang, "Forgot your password?", "نسيت كلمة المرور؟")}
        </Link>
        <button type="submit" className="settings-button settings-button-primary" disabled={busy}>
          {busy && <Loader2 size={16} className="settings-spinner" aria-hidden="true" />}
          {busy
            ? t(lang, "Updating…", "جاري التحديث…")
            : t(lang, "Change password", "تغيير كلمة المرور")}
        </button>
      </div>
    </form>
  );
}
