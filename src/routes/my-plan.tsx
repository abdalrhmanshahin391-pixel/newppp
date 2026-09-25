import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CreditCard,
  ExternalLink,
  Flame,
  Gauge,
  Loader2,
  Sparkles,
  Timer,
  Trash2,
  XCircle,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { usePlan } from "@/hooks/usePlan";
import { useAuth } from "@/hooks/useAuth";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import {
  getMySubscription,
  getMySavedPaymentMethods,
  removeSavedPaymentMethod,
  createCustomerPortalSession,
  cancelSubscription,
  type SavedPaymentMethod,
} from "@/lib/subscription.functions";

export const Route = createFileRoute("/my-plan")({
  head: () => ({
    meta: [
      { title: "My plan | RitaJet" },
      {
        name: "description",
        content: "See your RitaJet plan, how much of each allowance is left and when a claimed offer runs out.",
      },
      { property: "og:title", content: "My RitaJet plan" },
      { property: "og:description", content: "Your allowances, your balance and your offer countdown in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyPlanPage,
});

const METERS = [
  { key: "flashcards", cap: "max_flashcards", label: "Flashcards", tone: "#e4dcf3", bar: "#7c5fd3" },
  { key: "summaries", cap: "max_summaries", label: "Summaries", tone: "#fbe3c8", bar: "#e08a2e" },
  { key: "ai_questions", cap: "max_ai_questions", label: "Lecture questions", tone: "#d9ecf7", bar: "#3f8fc0" },
  { key: "archive_questions", cap: "max_archive_questions", label: "Archive questions", tone: "#e6f0d8", bar: "#6aa62c" },
  { key: "all_in_one_lectures", cap: "max_all_in_one_lectures", label: "All-in-One lectures", tone: "#f6ddd5", bar: "#d1795e" },
] as const;

function useCountdown(iso: string | null | undefined) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!iso) return;
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, [iso]);
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor((ms % 86_400_000) / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
  };
}

function MyPlanPage() {
  const { user } = useAuth();
  const plan = usePlan();
  const settings = useSiteSettings();
  const raw = plan.data as any;
  const left = useCountdown(raw?.offer_expires_at);

  const planRow = raw?.plan ?? null;
  const grants = raw?.grants ?? {};
  const usage = raw?.usage ?? {};

  const queryClient = useQueryClient();
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);

  const [cardToRemove, setCardToRemove] = useState<SavedPaymentMethod | null>(null);
  const [removingCard, setRemovingCard] = useState(false);

  const { data: subscription, refetch: refetchSub } = useQuery({
    queryKey: ["my-subscription", user?.id],
    enabled: !!user?.id,
    queryFn: () => getMySubscription(),
  });

  const { data: cards, refetch: refetchCards } = useQuery({
    queryKey: ["my-payment-methods", user?.id],
    enabled: !!user?.id,
    queryFn: () => getMySavedPaymentMethods(),
  });

  const handleRemoveCard = async () => {
    if (!cardToRemove) return;
    setRemovingCard(true);
    setCancelNotice(null);
    try {
      await removeSavedPaymentMethod({
        data: {
          cardId: cardToRemove.id,
          paddlePaymentMethodId: cardToRemove.paddle_payment_method_id,
          paddleCustomerId: cardToRemove.paddle_customer_id,
          paddleSubscriptionId: subscription?.paddle_subscription_id,
        },
      });
      await Promise.all([refetchCards(), refetchSub()]);
      setCardToRemove(null);
      setCancelNotice("Your card was removed and auto-renewal has been cancelled.");
    } catch (err: any) {
      setCancelNotice(err instanceof Error ? err.message : "Failed to remove card.");
    } finally {
      setRemovingCard(false);
    }
  };

  const handleOpenPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await createCustomerPortalSession();
      if (res?.url) {
        window.open(res.url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      console.warn("Could not open customer portal:", err);
      window.open("https://paddle.net", "_blank", "noopener,noreferrer");
    } finally {
      setPortalLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription?.paddle_subscription_id) return;
    setCancelling(true);
    setCancelNotice(null);
    try {
      await cancelSubscription({
        data: { paddleSubscriptionId: subscription.paddle_subscription_id },
      });
      await refetchSub();
      setShowCancelConfirm(false);
      setCancelNotice("Your subscription will cancel at the end of the billing period.");
    } catch (err: any) {
      setCancelNotice(err instanceof Error ? err.message : "Failed to cancel subscription.");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-12 md:px-8 md:py-16">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#23201d] px-4 py-1.5 text-[12px] font-black uppercase tracking-[0.16em] text-white">
          <Gauge size={13} /> My plan
        </span>
        <h1 className="mt-5 font-display text-4xl font-black leading-tight tracking-tight md:text-5xl">
          {plan.planName}
        </h1>
        <p className="mt-3 max-w-xl text-[16px] font-semibold text-[#6b655c]">
          {user
            ? "Everything you have left, at a glance. Numbers update the moment you make something."
            : "Sign in to see your allowances."}
        </p>

        {left && (
          <section
            className="mt-8 overflow-hidden rounded-[30px] p-7 text-white"
            style={{
              background: "linear-gradient(135deg,#c62828 0%,#7d0d1c 100%)",
              boxShadow: "0 26px 50px -30px rgba(198,40,40,0.9)",
            }}
          >
            <p className="inline-flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.18em] text-white/80">
              <Flame size={13} /> Special offer active
            </p>
            <p className="mt-3 font-display text-3xl font-black">
              {left.days}d {left.hours}h {left.minutes}m left
            </p>
            <p className="mt-2 text-[15px] font-semibold text-white/80">
              The extra credits from your claimed offer stay on your account until then, then quietly drop off.
            </p>
            {settings.offers_page_enabled && (
              <Link
                to="/offers"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[14px] font-black text-[#7d0d1c]"
              >
                <Timer size={15} /> Back to special offers
              </Link>
            )}
          </section>
        )}

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {METERS.map((m) => {
            const base = planRow?.[m.cap];
            const cap =
              plan.isAdmin || base === null || base === undefined
                ? null
                : Number(base) + Number(grants?.[m.key] ?? 0);
            const used = Number(usage?.[m.key] ?? 0);
            const pct = cap ? Math.min(100, Math.round((used / cap) * 100)) : 0;
            return (
              <div key={m.key} className="rounded-[26px] border border-black/[0.06] bg-white p-6">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a29a8d]">{m.label}</p>
                <p className="mt-2 text-[26px] font-black leading-none">
                  {cap === null ? "∞" : Math.max(0, cap - used)}
                  <span className="ms-2 text-[13px] font-bold text-[#a29a8d]">
                    {cap === null ? "unlimited" : `left of ${cap}`}
                  </span>
                </p>
                <div className="mt-4 h-2.5 overflow-hidden rounded-full" style={{ background: m.tone }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: m.bar }} />
                </div>
                <p className="mt-2 text-[12.5px] font-bold text-[#a29a8d]">{used} used so far</p>
              </div>
            );
          })}
        </section>

        {/* Subscription & Card Management */}
        {user && (
          <section className="mt-8 overflow-hidden rounded-[26px] border border-black/[0.08] bg-white p-6 md:p-8 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-700">
                  <CreditCard size={22} />
                </div>
                <div>
                  <h2 className="text-[19px] font-black leading-tight text-[#23201d]">
                    Billing & Subscription
                  </h2>
                  <p className="mt-0.5 text-[13.5px] font-semibold text-[#8c8275]">
                    {subscription?.cancel_at_period_end
                      ? "Cancelling at end of billing cycle"
                      : subscription?.status === "active"
                        ? "Active recurring subscription"
                        : "Manage payment methods, invoices, or subscriptions"}
                  </p>
                </div>
              </div>

              {subscription && (
                <span
                  className={`rounded-full px-3.5 py-1 text-[12px] font-black uppercase tracking-wider ${
                    subscription.cancel_at_period_end
                      ? "bg-amber-100 text-amber-800"
                      : subscription.status === "active"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {subscription.cancel_at_period_end ? "Pending Cancellation" : subscription.status}
                </span>
              )}
            </div>

            <div className="mt-6 grid gap-4 border-t border-black/[0.06] pt-6 sm:grid-cols-2">
              <div>
                <span className="text-[11.5px] font-black uppercase tracking-wider text-[#a29a8d]">
                  {subscription?.cancel_at_period_end ? "Access valid until" : "Next renewal date"}
                </span>
                <p className="mt-1 text-[16px] font-black text-[#23201d]">
                  {subscription?.current_period_end
                    ? new Date(subscription.current_period_end).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : planRow?.price_cents === 0
                      ? "Free Plan (No renewal)"
                      : "Active"}
                </p>
              </div>

              <div>
                <span className="text-[11.5px] font-black uppercase tracking-wider text-[#a29a8d]">
                  Payment Partner
                </span>
                <p className="mt-1 text-[14px] font-semibold text-[#6b655c]">
                  Paddle.com (Merchant of Record)
                </p>
              </div>
            </div>

            {/* Saved Payment Method Section */}
            <div className="mt-6 border-t border-black/[0.06] pt-6">
              <span className="text-[11.5px] font-black uppercase tracking-wider text-[#a29a8d]">
                Saved Payment Method
              </span>

              {cards && cards.length > 0 ? (
                <div className="mt-3 grid gap-3">
                  {cards.map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-black/[0.08] bg-[#fbf5e9]/50 p-4 transition-all hover:bg-[#fbf5e9]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="grid h-11 w-11 place-items-center rounded-xl bg-white border border-black/[0.06] text-[#23201d] shadow-sm">
                          <CreditCard size={20} className="text-amber-700" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-[15px] font-black capitalize text-[#23201d]">
                              {c.card_brand} •••• {c.card_last4}
                            </p>
                            {subscription?.cancel_at_period_end ? (
                              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10.5px] font-bold text-amber-800">
                                Auto-renewal stopped
                              </span>
                            ) : (
                              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-800">
                                Active card
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[12.5px] font-semibold text-[#8c8275]">
                            {c.card_exp_month && c.card_exp_year
                              ? `Expires ${String(c.card_exp_month).padStart(2, "0")}/${c.card_exp_year}`
                              : "Card on file"}
                            {" • "}
                            <span>Encrypted in Paddle vault</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCardToRemove(c)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-3.5 py-1.5 text-[12.5px] font-bold text-red-600 hover:bg-red-50 transition-colors shadow-sm"
                        >
                          <Trash2 size={13} /> Remove Card
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-black/[0.06] bg-[#fbf5e9]/30 p-4">
                  <p className="text-[13.5px] font-semibold text-[#8c8275]">
                    No payment cards stored on file.
                  </p>
                </div>
              )}
            </div>

            {/* Remove Card Confirmation Dialog */}
            {cardToRemove && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50/70 p-5 shadow-sm">
                <p className="text-[14.5px] font-black text-red-950">
                  Remove {cardToRemove.card_brand.toUpperCase()} •••• {cardToRemove.card_last4}?
                </p>
                <p className="mt-1.5 text-[13.5px] font-medium leading-relaxed text-red-800/90">
                  Removing this card will cancel auto-renewal so you will not be charged again. You will keep full access to your plan and allowances until your current billing period ends on{" "}
                  <strong>
                    {subscription?.current_period_end
                      ? new Date(subscription.current_period_end).toLocaleDateString()
                      : "the renewal date"}
                  </strong>
                  .
                </p>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={handleRemoveCard}
                    disabled={removingCard}
                    className="rounded-full bg-red-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {removingCard ? "Removing card…" : "Cancel Auto-Renewal & Remove Card"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardToRemove(null)}
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-[13px] font-bold text-[#23201d] hover:bg-gray-50 transition-colors"
                  >
                    Keep Card
                  </button>
                </div>
              </div>
            )}

            {cancelNotice && (
              <div className="mt-5 rounded-2xl bg-amber-50 p-4 border border-amber-200/80 text-[13.5px] font-bold text-amber-900 flex items-center gap-2">
                <AlertCircle size={17} className="shrink-0" />
                <span>{cancelNotice}</span>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-black/[0.06] pt-6">
              <button
                type="button"
                onClick={handleOpenPortal}
                disabled={portalLoading}
                className="inline-flex items-center gap-2 rounded-full bg-[#23201d] px-5 py-2.5 text-[13.5px] font-black text-white hover:bg-black transition-colors disabled:opacity-50"
              >
                {portalLoading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <ExternalLink size={15} />
                )}
                Manage Cards & Invoices
              </button>

              {subscription && !subscription.cancel_at_period_end && subscription.status === "active" && (
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50/70 px-5 py-2.5 text-[13.5px] font-bold text-red-700 hover:bg-red-100 transition-colors"
                >
                  <XCircle size={15} /> Cancel Subscription
                </button>
              )}

              <a
                href="https://paddle.net"
                target="_blank"
                rel="noreferrer"
                className="text-[13px] font-semibold text-[#8c8275] hover:text-[#23201d] underline ml-auto"
              >
                Look up charges on paddle.net
              </a>
            </div>

            {/* Cancel Confirmation Dialog */}
            {showCancelConfirm && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50/60 p-5">
                <p className="text-[14.5px] font-black text-red-950">
                  Are you sure you want to cancel your subscription?
                </p>
                <p className="mt-1.5 text-[13.5px] font-medium leading-relaxed text-red-800/90">
                  You will keep full access to your plan until the end of your billing cycle on{" "}
                  <strong>
                    {subscription?.current_period_end
                      ? new Date(subscription.current_period_end).toLocaleDateString()
                      : "the renewal date"}
                  </strong>
                  . Your card will not be charged again.
                </p>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={handleCancelSubscription}
                    disabled={cancelling}
                    className="rounded-full bg-red-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {cancelling ? "Cancelling…" : "Yes, cancel subscription"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(false)}
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-[13px] font-bold text-[#23201d] hover:bg-gray-50 transition-colors"
                  >
                    Keep my subscription
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 rounded-full bg-[#23201d] px-6 py-3.5 text-[15px] font-black text-white"
          >
            <Sparkles size={16} /> See plans & packs
          </Link>
          {settings.offers_page_enabled && (
            <Link
              to="/offers"
              className="inline-flex items-center gap-2 rounded-full bg-[#c62828] px-6 py-3.5 text-[15px] font-black text-white"
            >
              <Flame size={16} /> Special offers
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
