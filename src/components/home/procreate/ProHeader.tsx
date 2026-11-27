import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronDown, LayoutGrid, LogOut, Menu, ReceiptText, Settings, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { openWelcome } from "@/lib/auth-dialog";
import { useAuth } from "@/hooks/useAuth";

import { supabase } from "@/integrations/supabase/client";
import { CreditsMeter } from "@/components/CreditsMeter";
import { HeaderResourcesMenu } from "@/components/header/HeaderResourcesMenu";
import { MenuGroup, MenuPanel, useMenuTrigger } from "@/components/header/MenuGroup";
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
  // The photo fades in once loaded; one that fails to load shows the initial instead.
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  useEffect(() => setState("loading"), [src]);
  const photo = src && state !== "failed";
  return (
    <span
      className="rh-avatar"
      data-photo={photo ? state : undefined}
      style={{ background: tone, width: size, height: size, fontSize: size * 0.42 }}
    >
      {photo ? (
        <img
          src={src}
          alt=""
          className="rh-avatar-photo"
          decoding="async"
          draggable={false}
          ref={(el) => {
            // Already in the cache (or loaded before hydration): no load event will come.
            if (el?.complete && el.naturalWidth > 0) setState("ready");
          }}
          onLoad={() => setState("ready")}
          onError={() => setState("failed")}
        />
      ) : (
        initial
      )}
    </span>
  );
}

/** The avatar button and its menu: who you are, settings, plans, install, admin, log out. */
function AccountMenu({
  open,
  onOpenChange,
  arabic,
  avatar,
  initial,
  tone,
  name,
  role,
  isAdmin,
  onLogout,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  arabic: boolean;
  avatar: string | null | undefined;
  initial: string;
  tone: string;
  name: string;
  role: string;
  isAdmin: boolean;
  onLogout: () => void;
}) {
  const { t } = useTranslation();
  const accountId = useId();
  const trigger = useMenuTrigger({ id: "account", open, onOpenChange });
  return (
    <div className="rh-account-anchor">
      <button
        ref={trigger.ref}
        type="button"
        data-rh-trigger
        onClick={trigger.onClick}
        onPointerEnter={trigger.onPointerEnter}
        onKeyDown={trigger.onKeyDown}
        aria-label={arabic ? "قائمة الحساب" : "Account menu"}
        aria-expanded={open}
        aria-controls={open ? accountId : undefined}
        data-open={open ? "true" : "false"}
        className="rh-avatar-btn"
      >
        <Avatar src={avatar} initial={initial} tone={tone} size={36} />
        <ChevronDown size={15} className="rh-chevron" aria-hidden="true" />
      </button>
      <MenuPanel
        id="account"
        open={open}
        panelId={accountId}
        width={288}
        label="Account"
        fallbackClassName="rh-card rh-account"
      >
        <div className="uz-mp-body rh-account-body">
          <div className="rh-who">
            <Avatar src={avatar} initial={initial} tone={tone} size={44} />
            <div className="min-w-0">
              <p className="rh-who-name">{name}</p>
              <span className="rh-badge">{role}</span>
            </div>
          </div>
          <div className="rh-rule" />
          <Link to="/settings" search={{ section: "account" }} data-mp-item className="rh-item">
            <Settings size={18} aria-hidden="true" />
            {t("nav.settings")}
          </Link>
          <Link to="/pricing" data-mp-item className="rh-item">
            <ReceiptText size={18} aria-hidden="true" />
            {arabic ? "الباقات والأسعار" : "Plans & pricing"}
          </Link>
          {isAdmin && (
            <>
              <div className="rh-rule" />
              <Link to="/admin" data-mp-item className="rh-item">
                <LayoutGrid size={18} aria-hidden="true" />
                {arabic ? "الإدارة" : "Admin"}
              </Link>
            </>
          )}
          <div className="rh-rule" />
          <button type="button" data-mp-item onClick={onLogout} className="rh-item rh-item-danger">
            <LogOut size={18} aria-hidden="true" />
            {t("cms.header.logout")}
          </button>
        </div>
      </MenuPanel>
    </div>
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
  const sheetDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!sheet) return;
    const dialog = sheetDialog.current;
    dialog?.showModal();
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setSheet(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      desktop.removeEventListener("change", closeOnDesktop);
      dialog?.close();
    };
  }, [sheet]);
  const solid = variant === "solid";
  const arabic = i18n.language?.startsWith("ar") ?? false;
  const startLearning = arabic ? "ابدأ التعلّم" : "Start learning";
  const signIn = arabic ? "سجّل الدخول" : "Sign in";
  const setResourcesOpen = useCallback((open: boolean) => {
    setMenu((current) => (open ? "resources" : current === "resources" ? null : current));
  }, []);

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
      className={`rh-bar ${solid ? "sticky" : "rh-bar-home sticky"} z-50`}
      dir={arabic ? "rtl" : "ltr"}
    >
      <div className="rh-bar-inner uz-header-shell">
        <Link to="/" aria-label={`${BRAND_NAME} home`} className="rh-logo shrink-0">
          <UzyraWordmark size={16} />
        </Link>

        <MenuGroup
          as="nav"
          label={arabic ? "التنقل" : "Navigation"}
          className="rh-nav uz-header-nav hidden lg:flex"
          active={menu === "resources" ? "resources" : null}
          align="start"
          hoverOpen
        >
          {nav()}
          <HeaderResourcesMenu
            arabic={arabic}
            open={menu === "resources"}
            onOpenChange={setResourcesOpen}
          />
        </MenuGroup>

        <MenuGroup
          className="rh-actions hidden lg:flex"
          active={menu === "credits" || menu === "language" || menu === "account" ? menu : null}
          align="end"
        >
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
              <AccountMenu
                open={menu === "account"}
                onOpenChange={(open) => setMenu(open ? "account" : null)}
                arabic={arabic}
                avatar={avatar}
                initial={initial}
                tone={tone}
                name={name}
                role={role}
                isAdmin={isAdmin}
                onLogout={handleLogout}
              />
            </>
          )}
        </MenuGroup>

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
            aria-label={arabic ? "فتح القائمة" : "Open menu"}
            aria-expanded={sheet}
            onClick={() => {
              setMenu(null);
              setSheet((s) => !s);
            }}
            className="rh-burger"
          >
            {user ? (
              <Avatar src={avatar} initial={initial} tone={tone} size={34} />
            ) : (
              <Menu size={22} />
            )}
          </button>
        </div>
      </div>

      {sheet && (
        <dialog
          ref={sheetDialog}
          className="rh-sheet-wrap lg:hidden"
          aria-label={arabic ? "القائمة" : "Menu"}
          onCancel={() => setSheet(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) setSheet(false);
          }}
        >
          <div className="rh-card rh-sheet" aria-label="Menu">
            <button
              type="button"
              className="rh-sheet-close"
              aria-label={arabic ? "إغلاق" : "Close menu"}
              onClick={() => setSheet(false)}
            >
              <X size={18} />
            </button>
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
                {isAdmin && (
                  <Link to="/admin" className="rh-item">
                    <LayoutGrid size={18} aria-hidden="true" />
                    {arabic ? "الإدارة" : "Admin"}
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
            <div className="rh-rule" />
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
          </div>
        </dialog>
      )}
    </header>
  );
}
