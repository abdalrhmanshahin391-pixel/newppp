import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  cancelSubscription,
  createCustomerPortalSession,
  removeSavedPaymentMethod,
  type SavedPaymentMethod,
} from "@/lib/subscription.functions";
import type { BillingChangeResult } from "@/lib/subscription-management";
import { settingsDate, settingsText as t, type SettingsLang } from "@/lib/settings";
import { subscriptionLabel } from "@/lib/settings";
import {
  SettingsConfirm,
  SettingsFailure,
  SettingsLoading,
  SettingsNotice,
  SettingsRow,
} from "./SettingsControls";
import type { SettingsData } from "./settings-data";

function feedback(result: BillingChangeResult, lang: SettingsLang) {
  if (result.ok)
    return result.cardRemoved
      ? result.renewalStopped
        ? t(
            lang,
            "Your card was removed and auto-renewal has stopped.",
            "تمت إزالة البطاقة وإيقاف التجديد التلقائي.",
          )
        : t(lang, "Your saved card was removed.", "تمت إزالة البطاقة المحفوظة.")
      : t(
          lang,
          "Auto-renewal has stopped. Your current access continues until the end of the billing period.",
          "تم إيقاف التجديد التلقائي. وصولك الحالي مستمر حتى نهاية فترة الاشتراك.",
        );
  if (result.cardRemoved)
    return t(
      lang,
      "Paddle removed the card, but the account display could not be updated. Refresh the details before trying again.",
      "أزال Paddle البطاقة، لكن تعذّر تحديث عرض الحساب. حدّث المعلومات قبل المحاولة مجددًا.",
    );
  if (result.renewalStopped)
    return result.code === "card_failed"
      ? t(
          lang,
          "Auto-renewal stopped, but Paddle could not remove the saved card. You can retry removing it.",
          "تم إيقاف التجديد، لكن تعذّرت إزالة البطاقة من Paddle. يمكنك إعادة محاولة إزالتها.",
        )
      : t(
          lang,
          "Paddle confirmed that renewal has stopped, but the account display is still pending an update. Refresh your details.",
          "أكّد Paddle إيقاف التجديد، لكن حالة الحساب لم تتحدّث بعد. حدّث المعلومات.",
        );
  if (result.code === "sync_pending")
    return t(
      lang,
      "The account details could not be updated. Please refresh before trying again.",
      "تعذّر تحديث معلومات الحساب. حدّثها قبل المحاولة مجددًا.",
    );
  return t(
    lang,
    "Paddle did not confirm the change. Please try again or open the payment portal.",
    "لم يؤكّد Paddle تنفيذ التغيير. جرّب مرة ثانية أو افتح بوابة الدفع.",
  );
}
export function BillingSettings({
  lang,
  subscription,
  cards,
}: {
  lang: SettingsLang;
  subscription: SettingsData["subscription"];
  cards: SettingsData["cards"];
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const cancelFn = useServerFn(cancelSubscription);
  const removeFn = useServerFn(removeSavedPaymentMethod);
  const portalFn = useServerFn(createCustomerPortalSession);
  const [confirm, setConfirm] = useState<"cancel" | SavedPaymentMethod | null>(null);
  const [busy, setBusy] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const guard = useRef(false);
  const portalGuard = useRef(false);
  const [message, setMessage] = useState<{
    kind: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const sub = subscription.data;
  const end = settingsDate(sub?.current_period_end, lang);
  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["my-subscription", user?.id] }),
      queryClient.invalidateQueries({ queryKey: ["my-payment-methods", user?.id] }),
      queryClient.invalidateQueries({ queryKey: ["my-plan-usage", user?.id] }),
    ]);
  }
  async function apply() {
    if (!confirm || guard.current || portalGuard.current) return;
    if (confirm === "cancel" && !sub?.paddle_subscription_id) return;
    guard.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const result =
        confirm === "cancel"
          ? await cancelFn({ data: { paddleSubscriptionId: sub!.paddle_subscription_id } })
          : await removeFn({ data: { cardId: confirm.id } });
      setMessage({
        kind: result.ok
          ? "success"
          : result.renewalStopped || result.cardRemoved
            ? "info"
            : "error",
        text: feedback(result, lang),
      });
      setConfirm(null);
      await refresh();
    } catch {
      setConfirm(null);
      setMessage({
        kind: "error",
        text: t(
          lang,
          "We couldn’t complete this request. Refresh the details before trying again.",
          "تعذّر إكمال الطلب. حدّث المعلومات قبل المحاولة مجددًا.",
        ),
      });
      await refresh();
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  async function portal() {
    if (portalGuard.current || guard.current) return;
    portalGuard.current = true;
    setPortalBusy(true);
    setMessage(null);
    try {
      const result = await portalFn();
      window.location.assign(result.url);
    } catch {
      setMessage({
        kind: "error",
        text: t(
          lang,
          "The payment portal couldn’t be opened. Please try again.",
          "تعذّر فتح بوابة الدفع. جرّب مرة ثانية.",
        ),
      });
    } finally {
      portalGuard.current = false;
      setPortalBusy(false);
    }
  }
  return (
    <>
      {message && <SettingsNotice kind={message.kind}>{message.text}</SettingsNotice>}
      {subscription.isError ? (
        <SettingsFailure lang={lang} onRetry={() => void subscription.refetch()} />
      ) : subscription.isPending ? (
        <SettingsLoading lang={lang} />
      ) : (
        <SettingsRow
          label={t(lang, "Subscription", "الاشتراك")}
          hint={
            end
              ? sub?.status === "canceled" || sub?.status === "paused"
                ? t(lang, `Billing period ends: ${end}`, `نهاية فترة الاشتراك: ${end}`)
                : sub?.cancel_at_period_end
                  ? t(lang, `Your access continues until ${end}.`, `وصولك مستمر حتى ${end}.`)
                  : t(lang, `Next renewal: ${end}`, `التجديد القادم: ${end}`)
              : undefined
          }
        >
          <span className="settings-tag">{subscriptionLabel(sub, lang)}</span>
        </SettingsRow>
      )}
      <SettingsRow
        label={t(lang, "Saved payment methods", "وسائل الدفع المحفوظة")}
        hint={t(
          lang,
          "Cards saved for future purchases. Your subscription may have a separate payment method in Paddle.",
          "بطاقات محفوظة للمشتريات القادمة. قد تكون وسيلة دفع الاشتراك منفصلة داخل Paddle.",
        )}
      >
        {cards.isError ? (
          <SettingsFailure lang={lang} onRetry={() => void cards.refetch()} />
        ) : cards.isPending ? (
          <SettingsLoading lang={lang} />
        ) : cards.data?.length ? (
          <ul className="settings-card-list">
            {cards.data.map((card) => (
              <li key={card.id}>
                <div className="settings-card-details">
                  <CreditCard size={21} aria-hidden="true" />
                  <div>
                    <p dir="ltr">
                      {card.card_brand.toUpperCase()} ···· {card.card_last4}
                    </p>
                    {card.card_exp_month && card.card_exp_year && (
                      <p className="settings-hint">
                        {t(lang, "Expires", "تنتهي في")}{" "}
                        <bdi>
                          {String(card.card_exp_month).padStart(2, "0")}/{card.card_exp_year}
                        </bdi>
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="settings-button settings-button-quiet"
                  onClick={() => setConfirm(card)}
                  disabled={busy || portalBusy || subscription.isPending || subscription.isError}
                >
                  {t(lang, "Remove", "إزالة")}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="settings-hint">
            {t(
              lang,
              "No cards saved for future purchases. You can manage subscription payment details in the portal.",
              "لا توجد بطاقات محفوظة للمشتريات القادمة. يمكنك إدارة وسيلة دفع اشتراكك من بوابة الدفع.",
            )}
          </p>
        )}
      </SettingsRow>
      <SettingsRow
        label={t(lang, "Invoices & payment details", "الفواتير وبيانات الدفع")}
        hint={t(
          lang,
          "View receipts, download invoices and update payment details in Paddle’s secure portal.",
          "اطّلع على إيصالاتك، ونزّل الفواتير، وحدّث بيانات الدفع من بوابة Paddle.",
        )}
      >
        <button
          type="button"
          className="settings-button settings-button-secondary"
          disabled={portalBusy || busy}
          onClick={() => void portal()}
        >
          {portalBusy ? (
            <Loader2 size={16} className="settings-spinner" aria-hidden="true" />
          ) : (
            <ExternalLink size={16} aria-hidden="true" />
          )}
          {portalBusy
            ? t(lang, "Opening…", "جاري الفتح…")
            : t(lang, "Open payment portal", "فتح بوابة الدفع")}
        </button>
      </SettingsRow>
      {sub && sub.status !== "canceled" && !sub.cancel_at_period_end && (
        <SettingsRow
          label={t(lang, "Automatic renewal", "التجديد التلقائي")}
          hint={t(
            lang,
            "Stopping renewal keeps your access until the current billing period ends.",
            "إيقاف التجديد يُبقي وصولك حتى نهاية فترة الاشتراك الحالية.",
          )}
        >
          <button
            type="button"
            className="settings-button settings-button-quiet settings-danger-text"
            disabled={busy || portalBusy}
            onClick={() => setConfirm("cancel")}
          >
            {t(lang, "Stop auto-renewal", "إيقاف التجديد التلقائي")}
          </button>
        </SettingsRow>
      )}
      <div className="settings-actions">
        <span className="settings-hint">
          {t(lang, "Payments are managed by Paddle.", "تتم إدارة المدفوعات عبر Paddle.")}
        </span>
        <button
          type="button"
          className="settings-text-link"
          disabled={cards.isFetching || subscription.isFetching || busy}
          onClick={() => void refresh()}
        >
          {t(lang, "Refresh details", "تحديث المعلومات")}
        </button>
      </div>
      <SettingsConfirm
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={
          confirm === "cancel"
            ? t(lang, "Stop automatic renewal?", "إيقاف التجديد التلقائي؟")
            : t(lang, "Remove this saved card?", "إزالة هذه البطاقة المحفوظة؟")
        }
        confirmLabel={
          confirm === "cancel"
            ? t(lang, "Stop renewal", "إيقاف التجديد")
            : t(lang, "Remove card", "إزالة البطاقة")
        }
        lang={lang}
        busy={busy}
        onConfirm={() => void apply()}
      >
        {confirm && confirm !== "cancel" && (
          <p dir="ltr">
            {confirm.card_brand.toUpperCase()} ···· {confirm.card_last4}
          </p>
        )}
        <p>
          {confirm === "cancel"
            ? t(
                lang,
                "Your subscription won’t renew after its current billing period.",
                "لن يتجدد اشتراكك بعد نهاية فترة الفوترة الحالية.",
              )
            : sub && sub.status !== "canceled"
              ? t(
                  lang,
                  "Removing a saved card also stops automatic renewal of your subscription.",
                  "إزالة البطاقة المحفوظة توقف أيضًا التجديد التلقائي لاشتراكك.",
                )
              : t(
                  lang,
                  "This card will no longer be saved for future purchases.",
                  "لن تبقى هذه البطاقة محفوظة للمشتريات القادمة.",
                )}
        </p>
        {end && (
          <p>{t(lang, `Your access continues until ${end}.`, `وصولك الحالي مستمر حتى ${end}.`)}</p>
        )}
      </SettingsConfirm>
    </>
  );
}
