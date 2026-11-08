import { useEffect, useRef, useState } from "react";
import { Link, useBlocker, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  CreditCard,
  Gauge,
  Search,
  Share2,
  Shield,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { useLang } from "@/components/LanguageProvider";
import { useAuth } from "@/hooks/useAuth";
import {
  matchingSettings,
  SETTINGS_INFO,
  SETTINGS_SECTIONS,
  settingsText as t,
  type SettingsSection,
} from "@/lib/settings";
import { useSettingsData } from "./settings-data";
import { ProfileSettings } from "./ProfileSettings";
import { SecuritySettings } from "./SecuritySettings";
import { PlanSettings, UsageSettings } from "./PlanSettings";
import { BillingSettings } from "./BillingSettings";
import { SettingsConfirm, SettingsLoading } from "./SettingsControls";
import "./settings.css";

const ICONS = {
  account: UserRound,
  security: Shield,
  plan: Sparkles,
  usage: Gauge,
  billing: CreditCard,
};
export function SettingsPage({ section }: { section: SettingsSection }) {
  const { lang } = useLang();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [dirty, setDirty] = useState(false);
  const [accountVisited, setAccountVisited] = useState(section === "account");
  const title = useRef<HTMLHeadingElement>(null);
  const previousSection = useRef(section);
  const data = useSettingsData(user?.id, section);
  const matches = matchingSettings(query);
  const info = SETTINGS_INFO[section];
  const blocker = useBlocker({
    shouldBlockFn: ({ next }) => !!user && dirty && next.pathname !== "/settings",
    enableBeforeUnload: !!user && dirty,
    withResolver: true,
  });
  useEffect(() => {
    if (!loading && !user)
      void navigate({
        to: "/login",
        search: { next: `/settings?section=${section}` },
        replace: true,
      });
  }, [loading, user, section, navigate]);
  useEffect(() => {
    if (section === "account") setAccountVisited(true);
    if (previousSection.current !== section) {
      title.current?.focus({ preventScroll: true });
      previousSection.current = section;
    }
  }, [section]);
  function go(next: SettingsSection) {
    setQuery("");
    void navigate({ to: "/settings", search: { section: next } });
  }
  return (
    <div className="settings-page">
      <SiteHeader />
      <div className="settings-wrap" dir={lang === "ar" ? "rtl" : "ltr"}>
        <div className="settings-page-top">
          <h1>{t(lang, "Settings", "الإعدادات")}</h1>
          <Link to="/" className="settings-back">
            <ArrowLeft size={16} aria-hidden="true" />
            {t(lang, "Back to site", "العودة للموقع")}
          </Link>
        </div>
        {loading || !user ? (
          <SettingsLoading lang={lang} />
        ) : (
          <div className="settings-layout" dir="ltr">
            <aside className="settings-sidebar" dir={lang === "ar" ? "rtl" : "ltr"}>
              <form
                className="settings-search"
                role="search"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (query.trim() && matches[0]) go(matches[0]);
                }}
              >
                <label htmlFor="settings-search" className="sr-only">
                  {t(lang, "Search settings", "البحث في الإعدادات")}
                </label>
                <Search size={17} aria-hidden="true" />
                <input
                  id="settings-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setQuery("");
                  }}
                  placeholder={t(lang, "Search settings", "ابحث في الإعدادات")}
                  autoComplete="off"
                />
                {query && (
                  <button
                    type="button"
                    className="settings-search-clear"
                    onClick={() => setQuery("")}
                    aria-label={t(lang, "Clear search", "مسح البحث")}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                )}
              </form>
              <label className="settings-mobile-picker">
                <span className="sr-only">{t(lang, "Settings section", "قسم الإعدادات")}</span>
                <select
                  value={section}
                  onChange={(event) => go(event.target.value as SettingsSection)}
                >
                  {SETTINGS_SECTIONS.map((key) => (
                    <option key={key} value={key}>
                      {SETTINGS_INFO[key][lang]}
                    </option>
                  ))}
                </select>
              </label>
              <nav
                className="settings-section-links"
                data-searching={query.trim() ? "true" : undefined}
                aria-label={t(lang, "Settings sections", "أقسام الإعدادات")}
              >
                {matches.map((key) => {
                  const Icon = ICONS[key];
                  return (
                    <Link
                      key={key}
                      to="/settings"
                      search={{ section: key }}
                      aria-current={section === key ? "page" : undefined}
                      className="settings-nav-link"
                      data-group-start={key === "plan" && !query.trim() ? "true" : undefined}
                      onClick={() => setQuery("")}
                    >
                      <Icon size={18} aria-hidden="true" />
                      <span>{SETTINGS_INFO[key][lang]}</span>
                    </Link>
                  );
                })}
                {!matches.length && (
                  <p className="settings-search-empty" role="status">
                    {t(lang, "No matching settings.", "لا توجد إعدادات مطابقة.")}
                  </p>
                )}
              </nav>
              <Link to="/share" search={{ type: "flashcards" }} className="settings-shared-link">
                <Share2 size={17} aria-hidden="true" />
                <span>{t(lang, "Shared flashcards", "البطاقات المشتركة")}</span>
              </Link>
            </aside>
            <main className="settings-content" dir={lang === "ar" ? "rtl" : "ltr"}>
              <header className="settings-content-head">
                <h2 ref={title} tabIndex={-1}>
                  {info[lang]}
                </h2>
                <p>{t(lang, ...info.description)}</p>
              </header>
              {(accountVisited || section === "account") && (
                <div hidden={section !== "account"}>
                  <ProfileSettings key={user.id} lang={lang} onDirtyChange={setDirty} />
                </div>
              )}
              {section === "security" && <SecuritySettings lang={lang} />}
              {section === "plan" && (
                <PlanSettings lang={lang} query={data.plan} subscription={data.subscription} />
              )}
              {section === "usage" && <UsageSettings lang={lang} query={data.plan} />}
              {section === "billing" && (
                <BillingSettings lang={lang} subscription={data.subscription} cards={data.cards} />
              )}
            </main>
          </div>
        )}
        <SettingsConfirm
          open={blocker.status === "blocked"}
          onClose={() => blocker.reset?.()}
          title={t(lang, "Leave without saving?", "المغادرة بدون حفظ؟")}
          confirmLabel={t(lang, "Discard changes & leave", "تجاهل التغييرات والمغادرة")}
          lang={lang}
          onConfirm={() => blocker.proceed?.()}
        >
          <p>
            {t(
              lang,
              "Your profile has unsaved changes. Stay here to save them, or discard them and continue.",
              "عندك تغييرات غير محفوظة على ملفك الشخصي. ارجع لحفظها، أو تجاهلها وأكمل.",
            )}
          </p>
        </SettingsConfirm>
      </div>
    </div>
  );
}
