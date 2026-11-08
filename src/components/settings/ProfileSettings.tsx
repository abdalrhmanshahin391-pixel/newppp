import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { useAuth, refreshAuthProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/legacy-client";
import { removeAvatar, uploadAvatar, useAvatarUrl } from "@/lib/avatars";
import { settingsText as t, type SettingsLang } from "@/lib/settings";
import { SettingsNotice, SettingsRow } from "./SettingsControls";

type Draft = { name: string; username: string; phone: string; bio: string };
export function ProfileSettings({
  lang,
  onDirtyChange,
}: {
  lang: SettingsLang;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { user, profile, isRealAdmin, isGolden, isCommittee } = useAuth();
  const meta = user?.user_metadata ?? {};
  const [draft, setDraft] = useState<Draft>(() => ({
    name: profile?.full_name || meta.full_name || meta.name || "",
    username: profile?.username || meta.username || user?.email?.split("@")[0] || "",
    phone: profile?.phone || meta.phone || "",
    bio: (profile as { bio?: string } | null)?.bio || "",
  }));
  const [baseline, setBaseline] = useState(draft);
  const [profileReady, setProfileReady] = useState(!!profile);
  const [avatar, setAvatar] = useState(
    (profile as { avatar_url?: string } | null)?.avatar_url ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [fieldError, setFieldError] = useState<"username" | "phone" | null>(null);
  const guard = useRef(false);
  const photoGuard = useRef(false);
  const picker = useRef<HTMLInputElement>(null);
  const url = useAvatarUrl(avatar);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  function update(key: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setMessage(null);
    setFieldError(null);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!user || guard.current || photoGuard.current) return;
    guard.current = true;
    setSaving(true);
    setMessage(null);
    setFieldError(null);
    const next = {
      ...draft,
      name: draft.name.trim(),
      username: draft.username.trim(),
      phone: draft.phone.trim(),
      bio: draft.bio.trim(),
    };
    try {
      for (const key of ["username", "phone"] as const) {
        if (!next[key] || next[key] === (key === "username" ? profile?.username : profile?.phone))
          continue;
        const { data, error } = await supabase
          .from("profiles")
          .select("id")
          .eq(key, next[key])
          .neq("id", user.id)
          .maybeSingle();
        if (error) throw new Error("save");
        if (data) {
          setFieldError(key);
          throw new Error(key);
        }
      }
      const { error } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          email: user.email ?? "",
          full_name: next.name,
          username: next.username,
          phone: next.phone || null,
          bio: next.bio || null,
          avatar_url: avatar,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
      if (error) {
        if (error.code === "23505") {
          const key = /phone/i.test(error.message) ? "phone" : "username";
          setFieldError(key);
          throw new Error(key);
        }
        throw new Error("save");
      }
      setDraft(next);
      setBaseline(next);
      setProfileReady(true);
      setMessage({
        kind: "success",
        text: t(lang, "Your profile has been saved.", "تم حفظ معلوماتك الشخصية."),
      });
      await refreshAuthProfile();
    } catch (error) {
      const code = error instanceof Error ? error.message : "save";
      setMessage({
        kind: "error",
        text:
          code === "username"
            ? t(
                lang,
                "That username is already taken. Choose another.",
                "اسم المستخدم مستخدم بالفعل. اختر اسمًا آخر.",
              )
            : code === "phone"
              ? t(lang, "That phone number is already in use.", "رقم الهاتف مستخدم بالفعل.")
              : t(
                  lang,
                  "Your changes weren’t saved. Please try again.",
                  "تعذّر حفظ التغييرات. جرّب مرة ثانية.",
                ),
      });
      if (code === "username" || code === "phone")
        document.getElementById(`settings-${code}`)?.focus();
    } finally {
      guard.current = false;
      setSaving(false);
    }
  }
  async function changePhoto(file: File | null) {
    if (!user || !profileReady || photoGuard.current || guard.current) return;
    if (file && (!/image\/(jpeg|png|webp)/.test(file.type) || file.size > 5 * 1024 * 1024)) {
      setMessage({
        kind: "error",
        text: t(
          lang,
          "Choose a JPG, PNG or WebP image under 5 MB.",
          "اختر صورة JPG أو PNG أو WebP بحجم أقل من 5 MB.",
        ),
      });
      return;
    }
    photoGuard.current = true;
    setPhotoBusy(true);
    setMessage(null);
    try {
      const next = file ? await uploadAvatar(user.id, file) : null;
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: next, updated_at: new Date().toISOString() })
        .eq("id", user.id)
        .select("id")
        .single();
      if (error) throw error;
      const old = avatar;
      setAvatar(next);
      await refreshAuthProfile();
      if (old) await removeAvatar(old);
      setMessage({
        kind: "success",
        text: file
          ? t(lang, "Photo updated.", "تم تحديث الصورة.")
          : t(lang, "Photo removed from your profile.", "تمت إزالة صورة الملف الشخصي."),
      });
    } catch {
      setMessage({
        kind: "error",
        text: t(
          lang,
          "We couldn’t update your photo. Please try again.",
          "تعذّر تحديث الصورة. جرّب مرة ثانية.",
        ),
      });
    } finally {
      photoGuard.current = false;
      setPhotoBusy(false);
      if (picker.current) picker.current.value = "";
    }
  }
  return (
    <>
      <SettingsRow
        label={t(lang, "Profile photo", "الصورة الشخصية")}
        hint={t(lang, "JPG, PNG or WebP. Up to 5 MB.", "JPG أو PNG أو WebP، حتى 5 MB.")}
      >
        <div className="settings-photo-row">
          <span className="settings-avatar">
            {url ? (
              <img src={url} alt={t(lang, "Your profile photo", "صورتك الشخصية")} />
            ) : (
              (draft.name || draft.username || "U").slice(0, 1).toUpperCase()
            )}
          </span>
          <input
            ref={picker}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            aria-label={t(lang, "Choose profile photo", "اختيار صورة شخصية")}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void changePhoto(file);
            }}
          />
          <button
            type="button"
            className="settings-button settings-button-secondary"
            onClick={() => picker.current?.click()}
            disabled={photoBusy || saving || !profileReady}
          >
            {photoBusy ? (
              <Loader2 size={16} className="settings-spinner" aria-hidden="true" />
            ) : (
              <Camera size={16} aria-hidden="true" />
            )}
            {t(lang, "Change", "تغيير")}
          </button>
          {avatar && (
            <button
              type="button"
              className="settings-icon-button"
              disabled={photoBusy || saving}
              onClick={() => void changePhoto(null)}
              aria-label={t(lang, "Remove profile photo", "إزالة الصورة الشخصية")}
            >
              <Trash2 size={18} aria-hidden="true" />
            </button>
          )}
        </div>
        {!profileReady && (
          <p className="settings-hint">
            {t(
              lang,
              "Save your profile details before adding a photo.",
              "احفظ معلوماتك أولًا، ثم أضف صورتك.",
            )}
          </p>
        )}
      </SettingsRow>
      <form onSubmit={save}>
        <SettingsRow id="settings-name" label={t(lang, "Full name", "الاسم الكامل")}>
          <input
            id="settings-name"
            className="settings-input"
            autoComplete="name"
            dir="auto"
            readOnly={saving || photoBusy}
            value={draft.name}
            maxLength={150}
            onChange={(event) => update("name", event.target.value)}
          />
        </SettingsRow>
        <SettingsRow id="settings-username" label={t(lang, "Username", "اسم المستخدم")}>
          <input
            id="settings-username"
            className="settings-input"
            autoComplete="username"
            readOnly={saving || photoBusy}
            value={draft.username}
            required
            maxLength={80}
            dir="auto"
            aria-invalid={fieldError === "username"}
            aria-describedby={fieldError === "username" ? "settings-username-error" : undefined}
            onChange={(event) => update("username", event.target.value)}
          />
          {fieldError === "username" && message && (
            <p id="settings-username-error" className="settings-inline-error" role="alert">
              {message.text}
            </p>
          )}
        </SettingsRow>
        <SettingsRow
          id="settings-email"
          label={t(lang, "Email address", "البريد الإلكتروني")}
          hint={t(
            lang,
            "Used to sign in. This address is read-only here.",
            "يُستخدم لتسجيل الدخول، ويظهر هنا للقراءة.",
          )}
        >
          <input
            id="settings-email"
            className="settings-input settings-readonly"
            type="email"
            autoComplete="email"
            readOnly
            value={user?.email ?? profile?.email ?? ""}
            dir="ltr"
            aria-describedby="settings-email-hint"
          />
        </SettingsRow>
        <SettingsRow id="settings-phone" label={t(lang, "Phone number", "رقم الهاتف")}>
          <input
            id="settings-phone"
            type="tel"
            autoComplete="tel"
            readOnly={saving || photoBusy}
            className="settings-input"
            value={draft.phone}
            maxLength={30}
            dir="ltr"
            aria-invalid={fieldError === "phone"}
            aria-describedby={fieldError === "phone" ? "settings-phone-error" : undefined}
            onChange={(event) => update("phone", event.target.value)}
          />
          {fieldError === "phone" && message && (
            <p id="settings-phone-error" className="settings-inline-error" role="alert">
              {message.text}
            </p>
          )}
        </SettingsRow>
        <SettingsRow
          id="settings-bio"
          label={t(lang, "About you", "نبذة عنك")}
          hint={t(
            lang,
            "Shown beside your name on decks you share. Up to 240 characters.",
            "تظهر بجانب اسمك على البطاقات التي تشاركها. حتى 240 حرفًا.",
          )}
        >
          <textarea
            id="settings-bio"
            className="settings-input settings-textarea"
            maxLength={240}
            dir="auto"
            readOnly={saving || photoBusy}
            value={draft.bio}
            aria-describedby="settings-bio-hint"
            onChange={(event) => update("bio", event.target.value)}
          />
        </SettingsRow>
        <SettingsRow label={t(lang, "Account role", "صفة الحساب")}>
          <span className="settings-tag">
            {isRealAdmin
              ? t(lang, "Administrator", "مسؤول")
              : isGolden
                ? t(lang, "Golden member", "عضو ذهبي")
                : isCommittee
                  ? t(lang, "Committee member", "عضو لجنة")
                  : t(lang, "Student", "طالب")}
          </span>
        </SettingsRow>
        {message && !fieldError && (
          <SettingsNotice kind={message.kind}>{message.text}</SettingsNotice>
        )}
        <div className="settings-actions">
          <span className="settings-hint">
            {dirty ? t(lang, "You have unsaved changes.", "عندك تغييرات غير محفوظة.") : ""}
          </span>
          <button
            type="submit"
            className="settings-button settings-button-primary"
            disabled={saving || photoBusy || (!dirty && profileReady)}
          >
            {saving && <Loader2 size={16} className="settings-spinner" aria-hidden="true" />}
            {saving ? t(lang, "Saving…", "جاري الحفظ…") : t(lang, "Save changes", "حفظ التغييرات")}
          </button>
        </div>
      </form>
    </>
  );
}
