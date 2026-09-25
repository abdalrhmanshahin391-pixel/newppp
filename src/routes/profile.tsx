import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/legacy-client";
import { useAuth } from "@/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { GoldenBadge } from "@/components/GoldenBadge";
import { CommitteeBadge } from "@/components/CommitteeBadge";
import { AdminBadge, StudentBadge } from "@/components/RoleBadge";
import { toast } from "sonner";
import { avatarTone, removeAvatar, uploadAvatar, useAvatarUrl } from "@/lib/avatars";
import {
  AlertCircle,
  Camera,
  Loader2,
  Share2,
  Trash2,
  CheckCircle2,
  Eye,
  EyeOff,
  CreditCard,
  Gauge,
  KeyRound,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — RitaJet" },
      {
        name: "description",
        content:
          "Update your photo, name, bio and password, and manage the flashcard decks you share on RitaJet.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Your profile — RitaJet" },
      { property: "og:description", content: "Manage your account details and security." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, isGolden, isCommittee, isRealAdmin, loading } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoMsg, setInfoMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);



  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  // Seed from auth user immediately, then refine when profile row loads.
  useEffect(() => {
    if (user) {
      setEmail((prev) => prev || user.email || "");
      const meta = (user.user_metadata ?? {}) as Record<string, any>;
      setFullName((prev) => prev || meta.full_name || meta.name || "");
      setUsername((prev) => prev || meta.username || (user.email ? user.email.split("@")[0] : ""));
      setPhone((prev) => prev || meta.phone || "");
    }
  }, [user]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setUsername(profile.username ?? "");
      setEmail(profile.email ?? "");
      setPhone(profile.phone ?? "");
      setBio((profile as any).bio ?? "");
      setAvatarPath((profile as any).avatar_url ?? null);
      return;
    }
    // No profile row exists yet → create one so the form has something to save against.
    if (!loading && user && !profile) {
      const meta = (user.user_metadata ?? {}) as Record<string, any>;
      supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            email: user.email ?? "",
            full_name: meta.full_name || meta.name || "",
            username: meta.username || (user.email ? user.email.split("@")[0] : user.id),
            phone: meta.phone || null,
          },
          { onConflict: "id" },
        )
        .then(() => {});
    }
  }, [profile, loading, user]);

  async function saveInfo(e: FormEvent) {
    e.preventDefault();
    setInfoMsg(null);
    if (!user) return;
    setSavingInfo(true);
    try {
      // unique checks
      if (username !== profile?.username) {
        const { data } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", username)
          .neq("id", user.id)
          .maybeSingle();
        if (data) {
          setInfoMsg({ type: "err", text: "That username is already taken." });
          setSavingInfo(false);
          return;
        }
      }
      if (phone && phone !== profile?.phone) {
        const { data } = await supabase
          .from("profiles")
          .select("id")
          .eq("phone", phone)
          .neq("id", user.id)
          .maybeSingle();
        if (data) {
          setInfoMsg({ type: "err", text: "That phone number is already in use." });
          setSavingInfo(false);
          return;
        }
      }
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          username,
          bio: bio || null,
          avatar_url: avatarPath,
          phone: phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (error) {
        setInfoMsg({ type: "err", text: error.message });
      } else {
        setInfoMsg({ type: "ok", text: "Profile updated successfully." });
      }
    } finally {
      setSavingInfo(false);
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (newPw.length < 6) {
      setPwMsg({ type: "err", text: "New password must be at least 6 characters." });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ type: "err", text: "New passwords do not match." });
      return;
    }
    if (!currentPw) {
      setPwMsg({ type: "err", text: "Please type your current password first." });
      return;
    }
    if (!user?.email) return;
    setSavingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPw,
        // Lovable Cloud requires the current password for signed-in changes.
        ...( { current_password: currentPw } as any),
      } as any);
      if (error) {
        const m = (error.message || "").toLowerCase();
        setPwMsg({
          type: "err",
          text:
            m.includes("current") || m.includes("invalid credentials")
              ? "Your current password isn't right."
              : m.includes("weak") || m.includes("pwned") || m.includes("breach")
                ? "That password has appeared in a data leak — please pick a different one."
                : m.includes("same")
                  ? "Your new password must be different from the current one."
                  : error.message,
        });
      } else {
        setPwMsg({ type: "ok", text: "Password changed successfully." });
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
      }
    } catch (err: any) {
      setPwMsg({ type: "err", text: err?.message || "Could not change your password." });
    } finally {
      setSavingPw(false);
    }
  }


  async function pickAvatar(file: File) {
    if (!user) return;
    setUploading(true);
    try {
      const path = await uploadAvatar(user.id, file);
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: path, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      if (error) throw error;
      if (avatarPath) await removeAvatar(avatarPath);
      setAvatarPath(path);
      toast.success("Photo updated");
    } catch (e: any) {
      toast.error(e?.message || "Could not upload that photo");
    } finally {
      setUploading(false);
    }
  }

  async function clearAvatar() {
    if (!user || !avatarPath) return;
    const old = avatarPath;
    setAvatarPath(null);
    await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
    await removeAvatar(old);
    toast.success("Photo removed");
  }

  if (loading || !user) {
    return <div className="min-h-screen" style={{ background: "#fbf5e9" }} />;
  }

  
  const pwScore =
    newPw.length === 0
      ? null
      : newPw.length < 6
        ? { label: "Too short", tone: "text-destructive", bar: "w-1/4 bg-destructive" }
        : newPw.length < 10
          ? { label: "Okay", tone: "text-amber-600", bar: "w-2/4 bg-amber-500" }
          : /[^a-zA-Z0-9]/.test(newPw) && /\d/.test(newPw)
            ? { label: "Strong", tone: "text-emerald-600", bar: "w-full bg-emerald-500" }
            : { label: "Good", tone: "text-emerald-600", bar: "w-3/4 bg-emerald-500" };

  return (
    <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 pt-28 pb-24">
        <ProfileHero
          fullName={fullName}
          username={username}
          email={email}
          bio={bio}
          avatarPath={avatarPath}
          uploading={uploading}
          onPick={pickAvatar}
          onClear={clearAvatar}
          badge={
            isRealAdmin ? (
              <AdminBadge size="md" />
            ) : isGolden ? (
              <GoldenBadge size="md" />
            ) : isCommittee ? (
              <CommitteeBadge size="md" />
            ) : (
              <StudentBadge size="md" />
            )
          }
        />

        <Link
          to="/share"
          className="mb-8 flex items-center gap-3 rounded-3xl border border-black/[0.07] bg-white px-6 py-5 transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-28px_rgba(0,0,0,0.5)]"
        >
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e6f4d8] text-[#3d5c14]">
            <Share2 size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[17px] font-black">Shared flashcards</span>
            <span className="block text-sm text-[#6b655c]">
              Publish your subjects as a deck, or manage the ones you already shared.
            </span>
          </span>
          <span className="text-sm font-black text-[#8ec63f]">Open →</span>
        </Link>

        {/* Personal Information */}
        <SectionCard icon={<UserRound size={18} />} title="Personal Information">
          <form onSubmit={saveInfo} className="space-y-5">
            {infoMsg && <MessageBox msg={infoMsg} />}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Full Name">
                <input
                  className={inputCls}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                />
              </Field>
              <Field label="Username">
                <input
                  className={inputCls}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                />
              </Field>
            </div>
            <Field label="Email" hint="Your email is used to sign in and can't be changed here.">
              <input className={`${inputCls} opacity-60`} value={email} disabled />
            </Field>
            <Field label="Phone Number">
              <input
                className={inputCls}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XXXXXXXX"
              />
            </Field>
            <Field label="Bio" hint="Shown next to your name on decks you share.">
              <textarea
                className={`${inputCls} min-h-[90px]`}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={240}
                placeholder="3rd year medical student — pharmacology decks."
              />
            </Field>
            <button
              type="submit"
              disabled={savingInfo}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              <Save size={16} />
              {savingInfo ? "Saving…" : "Save Changes"}
            </button>
          </form>
        </SectionCard>

        <SectionCard icon={<KeyRound size={18} />} title="Change Password">
          <form onSubmit={changePassword} className="space-y-5">
            {pwMsg && <MessageBox msg={pwMsg} />}
            <Field label="Current Password">
              <PasswordInput value={currentPw} onChange={setCurrentPw} />
            </Field>
            <Field label="New Password" hint="Use at least 6 characters.">
              <PasswordInput value={newPw} onChange={setNewPw} />
              {pwScore && (
                <div className="mt-2">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full transition-all ${pwScore.bar}`} />
                  </div>
                  <span className={`mt-1 inline-block text-xs font-semibold ${pwScore.tone}`}>
                    {pwScore.label}
                  </span>
                </div>
              )}
            </Field>
            <Field label="Confirm New Password">
              <PasswordInput value={confirmPw} onChange={setConfirmPw} />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={savingPw}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-bold text-foreground transition hover:bg-muted disabled:opacity-60"
              >
                <ShieldCheck size={16} />
                {savingPw ? "Updating…" : "Change Password"}
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard icon={<CreditCard size={18} />} title="Billing & Subscription">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-md">
              <p className="text-sm font-semibold text-foreground">
                Manage your active plan, view saved payment cards, or cancel auto-renewal.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                All subscriptions, card on file, and invoices are handled securely via Paddle.
              </p>
            </div>
            <Link
              to="/my-plan"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90"
            >
              <Gauge size={16} />
              Manage Plan & Cards
            </Link>
          </div>
        </SectionCard>


        <div className="mt-10 text-center">
          <Link
            to="/"
            className="text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            ← Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}

function ProfileHero({
  fullName,
  username,
  email,
  bio,
  avatarPath,
  uploading,
  onPick,
  onClear,
  badge,
}: {
  fullName: string;
  username: string;
  email: string;
  bio: string;
  avatarPath: string | null;
  uploading: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
  badge: React.ReactNode;
}) {
  const url = useAvatarUrl(avatarPath);
  const seed = username || fullName || email || "rita";
  const initial = seed.trim().charAt(0).toUpperCase();
  return (
    <header className="mb-8 overflow-hidden rounded-[30px] border border-black/[0.07] bg-white">
      <div className="h-24" style={{ background: avatarTone(seed) }} />
      <div className="flex flex-wrap items-end gap-5 px-6 pb-6 md:px-8">
        <div className="-mt-12 relative">
          <span
            className="grid h-24 w-24 place-items-center overflow-hidden rounded-3xl text-3xl font-black text-white ring-4 ring-white"
            style={{ background: avatarTone(seed) }}
          >
            {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : initial}
          </span>
          <label className="absolute -bottom-2 -right-2 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-[#23201d] text-white shadow-lg">
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPick(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <div className="min-w-0 flex-1 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate font-display text-2xl font-black tracking-tight">
              {fullName || username || "Student"}
            </h1>
            {badge}
          </div>
          <p className="mt-0.5 truncate text-sm font-bold text-[#6b655c]">
            {username ? `@${username}` : ""}
            {username && email ? " · " : ""}
            {email}
          </p>
          {bio && <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-[#4a453d]">{bio}</p>}
        </div>
        {avatarPath && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.1] px-4 py-2 text-[13px] font-black text-[#6b655c] hover:text-red-600"
          >
            <Trash2 size={14} /> Remove photo
          </button>
        )}
      </div>
    </header>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10";

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8 rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </span>
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function PasswordInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        className={`${inputCls} pr-12`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function MessageBox({ msg }: { msg: { type: "ok" | "err"; text: string } }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
        msg.type === "ok"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-destructive/30 bg-destructive/10 text-destructive"
      }`}
    >
      {msg.type === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      <span>{msg.text}</span>
    </div>
  );
}
