import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  Gauge,
  LayoutGrid,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { openAuth } from "@/lib/auth-dialog";
import { useAuth } from "@/hooks/useAuth";

import { supabase } from "@/integrations/supabase/client";
import { CreditsMeter } from "@/components/CreditsMeter";
import { InstallAppButton } from "@/components/InstallAppButton";
import { avatarTone, useAvatarUrl } from "@/lib/avatars";
import { RitaBrand } from "@/components/brand/RitaBrand";
import { StartLearningLink } from "@/components/StartLearningLink";

const SIMPLE_LINKS: { to: string; label: string }[] = [
  { to: "/rita-live", label: "Talk to Rita" },
  { to: "/tutorial", label: "Tutorial" },
];

/** Transparent over artwork on the home page, solid cream everywhere else. */
export function ProHeader({ variant = "transparent" }: { variant?: "transparent" | "solid" } = {}) {
  const { t } = useTranslation();
  const { user, profile, isAdmin, isRealAdmin, isGolden, loading: authLoading } = useAuth();
  
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const solid = variant === "solid";

  const displayName = profile?.username ?? user?.email ?? "";
  const avatar = useAvatarUrl((profile as any)?.avatar_url ?? null);
  const tone = avatarTone(user?.id ?? displayName ?? "rita");
  const initial = (profile?.full_name || profile?.username || user?.email || "?")
    .charAt(0)
    .toUpperCase();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-pro-account]")) return;
      setAccountOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function handleLogout() {
    setAccountOpen(false);
    setSheet(false);
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  const menuLink =
    "rita-ink flex items-center gap-3 border-t border-black/[0.07] px-5 py-3 text-[14px] font-semibold transition-opacity hover:opacity-65";
  const headerText = solid ? "rita-ink" : "text-white";
  const headerTextSoft = solid ? "rita-ink-soft" : "text-white/80";

  return (
    <header
      className={
        solid
          ? "rita-cream rita-panel sticky top-0 z-50 border-b border-black/[0.06]"
          : "absolute inset-x-0 top-0 z-50"
      }
    >
      {/* Soft scrim so white words stay readable over the artwork below. */}
      {!solid && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[130px]"
          style={{
            background:
              "linear-gradient(180deg,rgba(0,0,0,.34) 0%,rgba(0,0,0,.14) 55%,rgba(0,0,0,0) 100%)",
          }}
        />
      )}
      <div
        className={`${
          solid ? "" : "rita-onart"
        } relative mx-auto flex h-[72px] max-w-[1120px] items-center justify-between gap-4 px-6 md:px-10`}
      >
        <Link to="/" className="shrink-0">
          <RitaBrand size={38} onArtwork={!solid} />
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          <StartLearningLink
            className={`text-[16px] font-semibold transition-opacity hover:opacity-75 ${headerText}`}
          >
            Start learning
          </StartLearningLink>



          {SIMPLE_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to as never}
              className={`text-[16px] font-semibold transition-opacity hover:opacity-75 ${headerText}`}
              style={{ fontFamily: "var(--font-grotesk)" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>


        {/* Each action stands alone so the header stays light and easy to scan. */}
        <div className="hidden items-center gap-2.5 lg:flex">
          <Link
            to="/pricing"
            className={`px-2 py-2 text-[14px] font-semibold transition-opacity hover:opacity-70 ${headerTextSoft}`}
            style={{ fontFamily: "var(--font-grotesk)" }}
          >
            Pricing
          </Link>
          {user && <CreditsMeter dark={!solid} />}

          {authLoading ? (
            <div aria-hidden="true" className="h-9 w-9 animate-pulse rounded-full bg-white/10" />
          ) : !user ? (
            <button
              type="button"
              onClick={() => openAuth("signin")}
              className={`inline-flex h-10 items-center rounded-full px-5 text-[14px] font-semibold transition-colors ${
                solid
                  ? "rita-ink border border-black/[0.08] bg-black/[0.03] hover:bg-black/[0.07]"
                  : "border border-white/15 bg-white/[0.06] text-white/90 backdrop-blur-xl hover:bg-white/[0.12] hover:text-white"
              }`}
              style={{ fontFamily: "var(--font-grotesk)" }}
            >
              Sign in
            </button>
          ) : (
            <div className="relative" data-pro-account>
              <button
                type="button"
                onClick={() => setAccountOpen((v) => !v)}
                aria-label="Account menu"
                aria-expanded={accountOpen}
                data-open={accountOpen ? "true" : "false"}
                className={`rita-ghost ps-1 pe-2 ${solid ? "rita-ghost-solid" : ""}`}
              >
                <span
                  className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-sm font-black text-white ring-2 ring-white/35"
                  style={{ background: tone }}
                >
                  {avatar ? (
                    <img src={avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initial
                  )}
                </span>
                {isRealAdmin && (
                  <span className={`rita-accent text-[11px] font-black uppercase tracking-[0.14em] ${solid ? "" : "!text-white/85"}`}>
                    Admin
                  </span>
                )}
                <ChevronDown size={14} className={solid ? "rita-ink-soft" : "text-white/70"} />
              </button>

              {accountOpen && (
                <div className="rita-panel absolute right-0 z-50 mt-3 flex max-h-[calc(100vh-8rem)] w-72 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[22px] border border-black/[0.07] shadow-[0_28px_70px_-30px_rgba(60,45,20,0.45)]">
                  <div className="shrink-0 px-4 pb-3 pt-4">
                    <div className="flex items-center gap-3 px-1 py-1">
                      <span
                        className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full text-[16px] font-black text-white"
                        style={{ background: tone }}
                      >
                        {avatar ? (
                          <img src={avatar} alt="" className="h-full w-full object-cover" />
                        ) : (
                          initial
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="rita-ink truncate text-[14.5px] font-extrabold">
                          {profile?.full_name || displayName}
                        </p>
                        <p className="rita-ink-soft mt-0.5 text-[10.5px] font-bold uppercase tracking-[0.14em]">
                          {isAdmin ? t("cms.header.roleAdmin") : isGolden ? "Golden member" : t("cms.header.roleUser")}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                    <Link to="/profile" onClick={() => setAccountOpen(false)} className={menuLink}>
                      <Settings size={16} className="text-white/50" />
                      {t("cms.header.profileSettings")}
                    </Link>
                    <Link to="/my-plan" onClick={() => setAccountOpen(false)} className={menuLink}>
                      <Gauge size={16} className="text-white/50" />
                      My plan
                    </Link>
                    <Link to="/pricing" onClick={() => setAccountOpen(false)} className={menuLink}>
                      <ReceiptText size={16} className="text-white/50" />
                      Plans & pricing
                    </Link>
                    <InstallAppButton className={menuLink} />
                    {isAdmin && (
                      <>
                        <Link to="/admin" onClick={() => setAccountOpen(false)} className={menuLink}>
                          <LayoutGrid size={16} className="text-white/50" />
                          Admin
                        </Link>
                      </>
                    )}
                  </div>

                  <div className="shrink-0 border-t border-black/[0.07]">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 px-5 py-3.5 text-[14px] font-bold text-rose-600 transition-colors hover:text-rose-700"
                    >
                      <LogOut size={16} />
                      {t("cms.header.logout")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 lg:hidden">
          <StartLearningLink
            className="rita-btn rita-btn-primary !h-9 !px-3.5 !text-[13px] font-bold shadow-xs"
          >
            Start learning
          </StartLearningLink>

          <button
            type="button"
            aria-label="Menu"
            onClick={() => setSheet((s) => !s)}
            className={`${headerText} p-1`}
          >
            {sheet ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {sheet && (
        <div className="rita-panel relative mx-4 max-h-[80vh] overflow-y-auto rounded-2xl border border-black/[0.07] p-3 shadow-[0_28px_70px_-30px_rgba(60,45,20,0.45)] lg:hidden">
          <div className="pb-2 pt-1">
            <StartLearningLink
              onOpen={() => setSheet(false)}
              className="rita-btn rita-btn-primary !w-full justify-center !py-3 !text-[15px] font-bold shadow-xs"
            >
              Start learning
            </StartLearningLink>
          </div>

          {SIMPLE_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to as never}
              onClick={() => setSheet(false)}
              className="rita-ink block border-b border-black/[0.06] px-3 py-3 text-[16px]"
              style={{ fontFamily: "var(--font-grotesk)" }}
            >
              {l.label}
            </Link>
          ))}
          <div className="mx-1 my-2 border-t border-white/10" />
          <Link
            to="/pricing"
            onClick={() => setSheet(false)}
            className="rita-ink block border-b border-black/[0.06] px-3 py-3 text-[16px]"
            style={{ fontFamily: "var(--font-grotesk)" }}
          >
            Pricing
          </Link>
          {user && (
            <div className="px-1 py-2">
              <CreditsMeter dark compact />
            </div>
          )}
          {user ? (
            <>
              <div className="mx-1 my-2 border-t border-white/10" />
              <div className="flex items-center gap-3 px-3 py-2">
                <span
                  className="grid h-9 w-9 place-items-center overflow-hidden rounded-full text-sm font-black text-white"
                  style={{ background: tone }}
                >
                  {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initial}
                </span>
                <div className="min-w-0">
                   <p className="rita-ink truncate text-[14px] font-bold">{profile?.full_name || displayName}</p>
                   <p className="rita-ink-soft text-[11px] font-semibold uppercase tracking-wider">
                    {isAdmin ? "Admin" : isGolden ? "Golden member" : "Student"}
                  </p>
                </div>
              </div>
              <Link to="/profile" onClick={() => setSheet(false)} className="rita-ink block border-t border-black/[0.06] px-3 py-3 text-[16px]" style={{ fontFamily: "var(--font-grotesk)" }}>
                Profile settings
              </Link>
              <Link to="/my-plan" onClick={() => setSheet(false)} className="rita-ink block border-t border-black/[0.06] px-3 py-3 text-[16px]" style={{ fontFamily: "var(--font-grotesk)" }}>
                My plan
              </Link>
              {isAdmin && (
                <Link to="/admin" onClick={() => setSheet(false)} className="block border-t border-black/[0.06] px-3 py-3 text-[16px] font-bold text-white" style={{ fontFamily: "var(--font-grotesk)" }}>
                  Admin panel
                </Link>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="block w-full border-t border-black/[0.06] px-3 py-3 text-left text-[16px] font-bold text-rose-600"
                style={{ fontFamily: "var(--font-grotesk)" }}
              >
                {t("cms.header.logout")}
              </button>
            </>
          ) : (
            !authLoading && (
              <button
                type="button"
                onClick={() => {
                  setSheet(false);
                  openAuth("signin");
                }}
                  className="rita-ink block w-full px-3 py-3 text-left text-[16px]"
                style={{ fontFamily: "var(--font-grotesk)" }}
              >
                Sign in
              </button>
            )
          )}
        </div>
      )}
    </header>
  );
}
