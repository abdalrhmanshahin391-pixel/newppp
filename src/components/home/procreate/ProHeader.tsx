import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
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
import { useDismiss } from "@/components/header/useDismiss";
import { avatarTone, useAvatarUrl } from "@/lib/avatars";
import { UzyraWordmark } from "@/components/brand/UzyraWordmark";
import { StartLearningLink } from "@/components/StartLearningLink";
import { LanguageMenu } from "@/components/language/LanguageMenu";

const SIMPLE_LINKS: { to: string; label: string }[] = [{ to: "/pricing", label: "Pricing" }];

// The language switcher is rendered once for wide screens and once for phones; each has its own
// state, so the hidden copy never reacts to presses inside the visible one.
type OpenMenu = "credits" | "account" | "language" | "language-phone" | null;

/** The hand-drawn accent line from the home headline, drawn once under the current page. */
function Squiggle() {
  return (
    <svg aria-hidden="true" className="rh-squiggle" viewBox="0 0 60 10" preserveAspectRatio="none">
      <path pathLength={1} d="M2 5 C 8 1, 14 9, 20 5 S 32 1, 40 5 S 52 9, 58 5" />
    </svg>
  );
}

function isHere(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

function Avatar({
  src,
  initial,
  tone,
  size,
}: {
  src: string | null | undefined;
  initial: string;
  tone: string;
  size: number;
}) {
  return (
    <span
      className="rh-avatar"
      style={{ background: tone, width: size, height: size, fontSize: size * 0.42 }}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initial}
    </span>
  );
}

/**
 * One top bar for the whole site: the dark ink bar, links on the left, the account on the
 * right. Home floats it over the page, every other page keeps it sticky. The menus are the
 * same white card with an ink border used on the home page.
 */
export function ProHeader({
  variant = "transparent",
}: { variant?: "transparent" | "solid"; tone?: "dark" | "light" } = {}) {
  const { t } = useTranslation();
  const { user, profile, isAdmin, isGolden, loading: authLoading } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const navigate = useNavigate();
  const [menu, setMenu] = useState<OpenMenu>(null);
  const [sheet, setSheet] = useState(false);
  const solid = variant === "solid";
  const accountBox = useRef<HTMLDivElement>(null);
  const accountId = useId();

  const displayName = profile?.username ?? user?.email ?? "";
  const avatar = useAvatarUrl(
    (profile as { avatar_url?: string | null } | null)?.avatar_url ?? null,
  );
  const tone = avatarTone(user?.id ?? displayName ?? "rita");
  const initial = (profile?.full_name || profile?.username || user?.email || "?")
    .charAt(0)
    .toUpperCase();
  const name = profile?.full_name || displayName;
  const role = isAdmin
    ? t("cms.header.roleAdmin")
    : isGolden
      ? "Golden member"
      : t("cms.header.roleUser");

  const closeAccount = useCallback(() => setMenu((m) => (m === "account" ? null : m)), []);
  useDismiss(menu === "account", closeAccount, accountBox);

  // A new page always starts with every menu shut.
  useEffect(() => {
    setMenu(null);
    setSheet(false);
  }, [pathname]);

  async function handleLogout() {
    setMenu(null);
    setSheet(false);
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  const nav = (onOpen?: () => void) => (
    <>
      {user && (
        <StartLearningLink onOpen={onOpen} className="rh-link">
          <LinkLabel here={isHere(pathname, "/learn")}>Start learning</LinkLabel>
        </StartLearningLink>
      )}
      {SIMPLE_LINKS.map((l) => (
        <Link
          key={l.to}
          to={l.to as never}
          onClick={onOpen}
          className="rh-link"
          aria-current={isHere(pathname, l.to) ? "page" : undefined}
        >
          <LinkLabel here={isHere(pathname, l.to)}>{l.label}</LinkLabel>
        </Link>
      ))}
    </>
  );

  return (
    <header className={`rh-bar ${solid ? "sticky" : "fixed inset-x-0"} top-0 z-50`}>
      <div className="rh-bar-inner">
        <Link to="/" aria-label="Uzyra home" className="rh-logo shrink-0">
          <UzyraWordmark size={20} />
        </Link>

        <nav aria-label="Main" className="rh-nav hidden lg:flex">
          {nav()}
        </nav>

        <div className="rh-actions hidden lg:flex">
          {authLoading ? (
            <div aria-hidden="true" className="h-9 w-9 animate-pulse rounded-full bg-white/10" />
          ) : !user ? (
            <>
              <button type="button" onClick={() => openAuth("signin")} className="rh-link">
                Sign in
              </button>
              <StartLearningLink className="rh-btn">Start learning</StartLearningLink>
            </>
          ) : (
            <>
              <CreditsMeter
                open={menu === "credits"}
                onOpenChange={(open) => setMenu(open ? "credits" : null)}
              />
              <LanguageMenu
                open={menu === "language"}
                onOpenChange={(open) => setMenu(open ? "language" : null)}
              />
              <div className="relative" ref={accountBox}>
                <button
                  type="button"
                  data-rh-trigger
                  onClick={() => setMenu((m) => (m === "account" ? null : "account"))}
                  aria-label="Account menu"
                  aria-expanded={menu === "account"}
                  aria-controls={accountId}
                  data-open={menu === "account" ? "true" : "false"}
                  className="rh-avatar-btn"
                >
                  <Avatar src={avatar} initial={initial} tone={tone} size={36} />
                  <ChevronDown size={16} aria-hidden="true" className="rh-chevron" />
                </button>

                {menu === "account" && (
                  <div id={accountId} className="rh-card rh-account" aria-label="Account">
                    <div className="rh-who">
                      <Avatar src={avatar} initial={initial} tone={tone} size={44} />
                      <div className="min-w-0">
                        <p className="rh-who-name">{name}</p>
                        <span className="rh-badge">{role}</span>
                      </div>
                    </div>
                    <div className="rh-rule" />
                    <Link to="/profile" className="rh-item">
                      <Settings size={18} aria-hidden="true" />
                      {t("cms.header.profileSettings")}
                    </Link>
                    <Link to="/my-plan" className="rh-item">
                      <Gauge size={18} aria-hidden="true" />
                      My plan
                    </Link>
                    <Link to="/pricing" className="rh-item">
                      <ReceiptText size={18} aria-hidden="true" />
                      Plans & pricing
                    </Link>
                    <InstallAppButton className="rh-item" iconClassName="rh-item-icon" />
                    {isAdmin && (
                      <>
                        <div className="rh-rule" />
                        <Link to="/admin" className="rh-item">
                          <LayoutGrid size={18} aria-hidden="true" />
                          Admin
                        </Link>
                      </>
                    )}
                    <div className="rh-rule" />
                    <button type="button" onClick={handleLogout} className="rh-item rh-item-danger">
                      <LogOut size={18} aria-hidden="true" />
                      {t("cms.header.logout")}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="rh-actions flex lg:hidden">
          {!user && !authLoading && (
            <StartLearningLink className="rh-btn">Start learning</StartLearningLink>
          )}
          {user && !authLoading && (
            <LanguageMenu
              open={menu === "language-phone"}
              onOpenChange={(open) => {
                setMenu(open ? "language-phone" : null);
                if (open) setSheet(false);
              }}
            />
          )}
          <button
            type="button"
            aria-label={sheet ? "Close menu" : "Open menu"}
            aria-expanded={sheet}
            onClick={() => {
              setMenu(null);
              setSheet((s) => !s);
            }}
            className="rh-burger"
          >
            {sheet ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {sheet && (
        <div className="rh-sheet-wrap lg:hidden">
          <div className="rh-card rh-sheet" aria-label="Menu">
            <div className="rh-sheet-links">{nav(() => setSheet(false))}</div>
            {user ? (
              <>
                <div className="rh-rule" />
                <div className="rh-who">
                  <Avatar src={avatar} initial={initial} tone={tone} size={40} />
                  <div className="min-w-0">
                    <p className="rh-who-name">{name}</p>
                    <span className="rh-badge">{role}</span>
                  </div>
                </div>
                <CreditsMeter inline />
                <Link to="/profile" className="rh-item">
                  <Settings size={18} aria-hidden="true" />
                  {t("cms.header.profileSettings")}
                </Link>
                <Link to="/my-plan" className="rh-item">
                  <Gauge size={18} aria-hidden="true" />
                  My plan
                </Link>
                <InstallAppButton className="rh-item" iconClassName="rh-item-icon" />
                {isAdmin && (
                  <Link to="/admin" className="rh-item">
                    <LayoutGrid size={18} aria-hidden="true" />
                    Admin
                  </Link>
                )}
                <div className="rh-rule" />
                <button type="button" onClick={handleLogout} className="rh-item rh-item-danger">
                  <LogOut size={18} aria-hidden="true" />
                  {t("cms.header.logout")}
                </button>
              </>
            ) : (
              !authLoading && (
                <>
                  <div className="rh-rule" />
                  <button
                    type="button"
                    onClick={() => {
                      setSheet(false);
                      openAuth("signin");
                    }}
                    className="rh-item"
                  >
                    Sign in
                  </button>
                </>
              )
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function LinkLabel({ here, children }: { here: boolean; children: ReactNode }) {
  return (
    <>
      {children}
      {here && <Squiggle />}
    </>
  );
}
