import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronDown, LayoutGrid, LogOut, Menu, ReceiptText, Settings, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { openWelcome } from "@/lib/auth-dialog";
import { useAuth } from "@/hooks/useAuth";

import { supabase } from "@/integrations/supabase/client";
import { CreditsMeter } from "@/components/CreditsMeter";
import { InstallAppButton } from "@/components/InstallAppButton";
import { HeaderResourcesMenu } from "@/components/header/HeaderResourcesMenu";
import { useDismiss } from "@/components/header/useDismiss";
import { avatarTone, useAvatarUrl } from "@/lib/avatars";
import { UzyraWordmark } from "@/components/brand/UzyraWordmark";
import { BRAND_NAME } from "@/lib/brand";
import { StartLearningLink } from "@/components/StartLearningLink";
import { LanguageMenu } from "@/components/language/LanguageMenu";

const MAIN_LINKS = [
  { to: "/games", en: "Games", ar: "الألعاب" },
  { to: "/books", en: "Library", ar: "المكتبة" },
  { to: "/pricing", en: "Pricing", ar: "الأسعار" },
] as const;

// Keep one disclosure open, including the dedicated language trigger on smaller screens.
type OpenMenu = "resources" | "credits" | "account" | "language" | "language-phone" | null;

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
      {src ? <img src={src} alt="" className="rh-avatar-photo" /> : initial}
    </span>
  );
}

/** Shared blog styling, with learning and account controls on the main site. */
export function ProHeader({
  variant = "transparent",
}: { variant?: "transparent" | "solid"; tone?: "dark" | "light" } = {}) {
  const { t, i18n } = useTranslation();
  const { user, profile, isAdmin, isGolden, loading: authLoading } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const navigate = useNavigate();
  const [menu, setMenu] = useState<OpenMenu>(null);
  const [sheet, setSheet] = useState(false);
  const solid = variant === "solid";
  const arabic = i18n.language?.startsWith("ar") ?? false;
  const startLearning = arabic ? "ابدأ التعلّم" : "Start learning";
  const signIn = arabic ? "سجّل الدخول" : "Sign in";
  const setResourcesOpen = useCallback((open: boolean) => {
    setMenu((current) => (open ? "resources" : current === "resources" ? null : current));
  }, []);
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
        <StartLearningLink onOpen={onOpen} className="rh-link uz-header-link">
          {startLearning}
        </StartLearningLink>
      )}
      {MAIN_LINKS.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          onClick={onOpen}
          className="rh-link uz-header-link"
          aria-current={isHere(pathname, link.to) ? "page" : undefined}
        >
          {arabic ? link.ar : link.en}
        </Link>
      ))}
    </>
  );

  return (
    <header
      className={`rh-bar ${solid ? "sticky" : "rh-bar-home fixed inset-x-0"} z-50`}
      dir={arabic ? "rtl" : "ltr"}
    >
      <div className="rh-bar-inner uz-header-shell">
        <Link to="/" aria-label={`${BRAND_NAME} home`} className="rh-logo shrink-0">
          <UzyraWordmark size={16} />
        </Link>

        <nav
          aria-label={arabic ? "التنقل" : "Navigation"}
          className="rh-nav uz-header-nav hidden lg:flex"
        >
          {nav()}
          <HeaderResourcesMenu
            arabic={arabic}
            open={menu === "resources"}
            onOpenChange={setResourcesOpen}
          />
        </nav>

        <div className="rh-actions hidden lg:flex">
          {authLoading ? (
            <div aria-hidden="true" className="h-9 w-9 animate-pulse rounded-full bg-black/5" />
          ) : !user ? (
            <>
              <button
                type="button"
                onClick={() => openWelcome()}
                className="rh-link uz-header-link"
              >
                {signIn}
              </button>
              <StartLearningLink className="ub-cta">{startLearning}</StartLearningLink>
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
              <div className="rh-account-anchor" ref={accountBox}>
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
                    <Link to="/settings" search={{ section: "account" }} className="rh-item">
                      <Settings size={18} aria-hidden="true" />
                      {t("nav.settings")}
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
            <StartLearningLink className="ub-cta">{startLearning}</StartLearningLink>
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
            <div className="rh-sheet-links">
              {nav(() => setSheet(false))}
              <Link
                to="/blog"
                onClick={() => setSheet(false)}
                className="rh-link uz-header-link"
                aria-current={isHere(pathname, "/blog") ? "page" : undefined}
              >
                {arabic ? "المدونة" : "Blog"}
              </Link>
            </div>
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
                <Link to="/settings" search={{ section: "account" }} className="rh-item">
                  <Settings size={18} aria-hidden="true" />
                  {t("nav.settings")}
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
                      openWelcome();
                    }}
                    className="rh-item"
                  >
                    {signIn}
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
