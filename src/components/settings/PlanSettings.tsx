import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import {
  subscriptionLabel,
  settingsDate,
  settingsText as t,
  SETTINGS_METERS,
  settingsAllowance,
  type SettingsLang,
} from "@/lib/settings";

import type { SettingsData } from "./settings-data";
import { SettingsFailure, SettingsLoading, SettingsNotice, SettingsRow } from "./SettingsControls";

export function PlanSettings({
  lang,
  query,
  subscription,
}: {
  lang: SettingsLang;
  query: SettingsData["plan"];
  subscription: SettingsData["subscription"];
}) {
  const site = useSiteSettings();
  const data = query.data;
  if (!data && query.isError)
    return <SettingsFailure lang={lang} onRetry={() => void query.refetch()} />;
  if (!data) return <SettingsLoading lang={lang} />;
  if (!data.plan) return <SettingsFailure lang={lang} onRetry={() => void query.refetch()} />;
  const plan = data.plan;
  const renewal = settingsDate(subscription.data?.current_period_end, lang);
  const expires = settingsDate(data.offer_expires_at, lang);
  const offerActive = !!expires && Date.parse(data.offer_expires_at!) > Date.now();
  return (
    <>
      <div className="settings-plan-summary">
        <span className="settings-hint">{t(lang, "Your current plan", "خطتك الحالية")}</span>
        <h3>{plan.name}</h3>
        <Link to="/pricing" className="settings-button settings-button-secondary">
          {t(lang, "Explore plans & packs", "استعراض الخطط والباقات")}
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
      {subscription.isError ? (
        <SettingsFailure lang={lang} onRetry={() => void subscription.refetch()} />
      ) : subscription.isPending ? (
        <SettingsLoading lang={lang} />
      ) : (
        <>
          <SettingsRow label={t(lang, "Subscription", "حالة الاشتراك")}>
            <span className="settings-tag">{subscriptionLabel(subscription.data, lang)}</span>
          </SettingsRow>
          <SettingsRow
            label={
              subscription.data?.status === "canceled" || subscription.data?.status === "paused"
                ? t(lang, "Billing period ends", "نهاية فترة الاشتراك")
                : subscription.data?.cancel_at_period_end
                  ? t(lang, "Access until", "الوصول متاح حتى")
                  : t(lang, "Next renewal", "التجديد القادم")
            }
          >
            <p>
              {renewal ??
                (plan.price_cents === 0
                  ? t(lang, "Free plan · no renewal", "خطة مجانية · بدون تجديد")
                  : plan.billing_kind === "lifetime"
                    ? t(lang, "One-time purchase", "شراء لمرة واحدة")
                    : t(lang, "Date not available", "التاريخ غير متاح"))}
            </p>
          </SettingsRow>
        </>
      )}
      <SettingsRow label={t(lang, "Included features", "مزايا الخطة")}>
        <ul className="settings-feature-list">
          {[
            [plan.rich_cards, "Rich flashcards", "بطاقات متقدمة"],
            [plan.feature_lecture_qgen, "Lecture questions", "أسئلة المحاضرات"],
            [plan.feature_archive_qgen, "Archive questions", "أسئلة الأرشيف"],
            [plan.feature_all_in_one, "All-in-One", "الكل في واحد"],
            [plan.todo_full, "Full task management", "إدارة المهام الكاملة"],
          ]
            .filter(([enabled]) => enabled)
            .map(([, en, ar]) => (
              <li key={String(en)}>{t(lang, String(en), String(ar))}</li>
            ))}
        </ul>
        <Link to="/settings" search={{ section: "usage" }} className="settings-text-link">
          {t(lang, "See your allowances", "عرض رصيد الخدمات")}
        </Link>
      </SettingsRow>
      {data.offer_name && (
        <SettingsRow label={t(lang, "Your offer", "العرض على حسابك")}>
          <p dir="auto">{data.offer_name}</p>
          <p className="settings-hint">
            {offerActive
              ? t(lang, `Available until ${expires}`, `متاح حتى ${expires}`)
              : expires
                ? t(lang, "This offer has ended.", "انتهت مدة هذا العرض.")
                : t(lang, "Expiry date not available.", "تاريخ الانتهاء غير متاح.")}
          </p>
          {site.offers_page_enabled && (
            <Link to="/offers" className="settings-text-link">
              {t(lang, "View offers", "عرض العروض")}
            </Link>
          )}
        </SettingsRow>
      )}
      <SettingsRow
        label={t(lang, "Payment & renewal", "الدفع والتجديد")}
        hint={t(
          lang,
          "Manage payment methods and automatic renewal in Billing.",
          "إدارة وسائل الدفع والتجديد التلقائي من قسم الدفع.",
        )}
      >
        <Link to="/settings" search={{ section: "billing" }} className="settings-text-link">
          {t(lang, "Open billing", "فتح الدفع والفواتير")}
        </Link>
      </SettingsRow>
    </>
  );
}
export function UsageSettings({
  lang,
  query,
}: {
  lang: SettingsLang;
  query: SettingsData["plan"];
}) {
  const data = query.data;
  if (!data && query.isError)
    return <SettingsFailure lang={lang} onRetry={() => void query.refetch()} />;
  if (!data) return <SettingsLoading lang={lang} />;
  const format = (number: number) =>
    new Intl.NumberFormat(lang === "ar" ? "ar-JO" : "en-GB", { maximumFractionDigits: 0 }).format(
      number,
    );
  if (!data.plan || !data.usage)
    return <SettingsFailure lang={lang} onRetry={() => void query.refetch()} />;
  return (
    <>
      <p className="settings-section-note">
        {t(
          lang,
          "These are your account’s current allowances, including additional packs. They are not a billing statement.",
          "هذه حدود الخدمات الفعلية على حسابك، وتشمل رصيد الباقات الإضافية.",
        )}
      </p>
      {query.isError && (
        <SettingsNotice kind="error">
          {t(
            lang,
            "Couldn’t refresh. Your last loaded balance is shown.",
            "تعذّر التحديث. المعروض هو آخر رصيد تم تحميله.",
          )}
        </SettingsNotice>
      )}
      <div className="settings-usage-list">
        {SETTINGS_METERS.map((meter) => {
          const balance = settingsAllowance(data, meter);
          return (
            <div key={meter.key} className="settings-usage-row">
              <div className="settings-usage-heading">
                <h3>{t(lang, meter.en, meter.ar)}</h3>
                <span>
                  {balance.total === null
                    ? t(lang, "Unlimited", "غير محدود")
                    : balance.total === undefined
                      ? t(lang, "Not available", "غير متاح")
                      : t(
                          lang,
                          `${format(balance.left!)} remaining`,
                          `${format(balance.left!)} متبقي`,
                        )}
                </span>
              </div>
              {balance.total !== null && balance.total !== undefined && balance.total > 0 && (
                <div
                  className="settings-meter"
                  role="progressbar"
                  aria-label={t(lang, meter.en, meter.ar)}
                  aria-valuemin={0}
                  aria-valuemax={balance.total}
                  aria-valuenow={Math.min(balance.used, balance.total)}
                  aria-valuetext={t(
                    lang,
                    `${format(balance.used)} used of ${format(balance.total)}`,
                    `${format(balance.used)} مستخدم من ${format(balance.total)}`,
                  )}
                >
                  <span style={{ width: `${balance.percent}%` }} />
                </div>
              )}
              <p className="settings-hint">
                {t(lang, `${format(balance.used)} used`, `${format(balance.used)} مستخدم`)}
                {balance.total !== null &&
                  balance.total !== undefined &&
                  ` · ${t(lang, `${format(balance.total)} total`, `${format(balance.total)} إجمالي`)}`}
                {balance.extra > 0 &&
                  ` · ${t(lang, `${format(balance.extra)} from extra packs`, `${format(balance.extra)} من الباقات الإضافية`)}`}
              </p>
            </div>
          );
        })}
      </div>
      <div className="settings-actions">
        <button
          type="button"
          className="settings-button settings-button-secondary"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {query.isFetching
            ? t(lang, "Refreshing…", "جاري التحديث…")
            : t(lang, "Refresh balance", "تحديث الرصيد")}
        </button>
        <Link to="/pricing" className="settings-text-link">
          {t(lang, "Explore extra packs", "استعراض الباقات الإضافية")}
        </Link>
      </div>
    </>
  );
}
