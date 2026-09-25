import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  Clock3,
  Loader2,
  LockKeyhole,
  RefreshCcw,
  RotateCcw,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import { ProHeader } from "@/components/home/procreate/ProHeader";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { supabase } from "@/integrations/supabase/legacy-client";
import { useAuth } from "@/hooks/useAuth";
import { usePaddleCheckout, type PaymentMethodSelection } from "@/hooks/usePaddleCheckout";
import { getPaddlePriceId, getPaddleEnvironment } from "@/lib/paddle";
import { checkPromoCode } from "@/lib/promo.functions";
import { claimFreePlanWithPromo } from "@/lib/plans.functions";
import { SUPPORT_EMAIL } from "@/lib/legal-content";

export const Route = createFileRoute("/checkout/")({
  head: () => ({
    meta: [
      { title: "Secure checkout — RitaJet" },
      {
        name: "description",
        content:
          "Finish your RitaJet purchase on a secure page: see exactly what your plan or credit pack includes before you pay.",
      },
      { property: "og:title", content: "Secure checkout — RitaJet" },
      {
        property: "og:description",
        content: "Pay securely for your RitaJet plan or one-time credit pack.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    plan: typeof s.plan === "string" ? s.plan : "",
    billing:
      s.billing === "yearly" || s.billing === "once"
        ? s.billing
        : "three_months",
  }),
  component: CheckoutPage,
  errorComponent: CheckoutFallback,
});

/** The checkout must never fall through to the global "page didn't load" screen. */
function CheckoutFallback() {
  return (
    <div className="rita-cream min-h-screen bg-background text-foreground">
      <ProHeader variant="solid" />
      <main className="mx-auto grid min-h-[70vh] max-w-[38rem] place-items-center px-6 text-center">
        <div>
          <h1 className="text-[28px] font-semibold">We could not open the payment form</h1>
          <p className="mt-3 text-[15px] text-muted-foreground">
            Nothing was charged. Refresh this page to try again, or email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="rita-accent underline">
              {SUPPORT_EMAIL}
            </a>{" "}
            and we will help you finish.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rita-btn rita-btn-primary"
            >
              Try again
            </button>
            <Link to="/pricing" className="rita-btn rita-btn-secondary">
              Back to plans
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

const FRAME = "rita-checkout-frame";
const SYMBOL: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JOD: "JD " };
const money = (cents: number, currency = "USD") =>
  `${SYMBOL[currency] ?? `${currency} `}${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
const cap = (n: number | null | undefined, unit: string) =>
  n === null || n === undefined ? `Unlimited ${unit}` : `${n.toLocaleString()} ${unit}`;

type Promo = { code: string; label: string; discountCents: number; totalCents: number };

function CheckoutPage() {
  const { plan: slug, billing } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const {
    openCheckout,
    closeCheckout,
    status: checkoutStatus,
    loading: checkoutLoading,
    isLoaded: checkoutLoaded,
    isClosed: checkoutClosed,
    error: paddleError,
  } = usePaddleCheckout();

  const [localError, setLocalError] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [promo, setPromo] = useState<Promo | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [claimingFree, setClaimingFree] = useState(false);
  const opened = useRef("");

  const { data: plan, isLoading } = useQuery({
    queryKey: ["checkout-plan", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error: e } = await (supabase.from as any)("plans")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (e) throw new Error(e.message);
      return data as any;
    },
  });

  const goSignIn = () =>
    navigate({
      to: "/login",
      search: { next: `/checkout?plan=${slug}&billing=${billing}` } as any,
    });

  const priceId: string | null = plan
    ? billing === "once"
      ? plan.paddle_price_once
      : billing === "yearly"
        ? plan.paddle_price_yearly
        : plan.paddle_price_monthly
    : null;

  const cents: number = plan
    ? billing === "once"
      ? (plan.once_cents ?? 0)
      : billing === "yearly"
        ? (plan.yearly_cents ?? 0)
        : (plan.price_cents ?? 0)
    : 0;

  const start = useCallback(
    async (
      discountCode?: string,
      methodRestriction: PaymentMethodSelection = "all",
      displayMode: "inline" | "overlay" = "inline",
    ) => {
      if (!plan || !user || !priceId) return;
      setLocalError(null);
      try {
        closeCheckout();
        // Cross-verify price with Paddle catalog
        try {
          const resolved = await getPaddlePriceId(priceId);
          if (resolved.amountCents && resolved.amountCents !== cents) {
            console.warn(
              `[Checkout Price Discrepancy] Plan ${plan.slug} advertised at ${cents} cents, but Paddle price is ${resolved.amountCents} cents.`,
            );
          }
        } catch {
          // Non-blocking lookup check
        }

        await openCheckout({
          priceId,
          customerEmail: user.email ?? undefined,
          customData: { userId: user.id, planSlug: plan.slug },
          successUrl: `${window.location.origin}/checkout/success?plan=${plan.slug}`,
          discountCode,
          frameTarget: FRAME,
          displayMode,
          methodRestriction,
        });
      } catch (e: any) {
        setLocalError(
          e instanceof Error && e.message
            ? e.message
            : "We could not open the payment form. Please try again.",
        );
      }
    },
    [plan, user, priceId, openCheckout, closeCheckout],
  );

  // Auto-open inline checkout on all devices (PC, iPad, mobile)
  useEffect(() => {
    if (!plan || !user) return;
    if (!priceId) {
      setLocalError("This plan is not on sale yet. Please try another one or contact support.");
      return;
    }
    const key = `${plan.slug}:${billing}`;
    if (opened.current === key) return;
    opened.current = key;

    void start();
  }, [plan, user, priceId, billing, start]);

  const applyCode = async () => {
    const code = codeInput.trim();
    if (!code || !priceId) return;
    setChecking(true);
    setPromoError(null);
    try {
      const { paddlePriceId, environment } = await getPaddlePriceId(priceId);
      const result = await checkPromoCode({
        data: {
          code,
          environment,
          paddlePriceId,
          externalPriceId: priceId,
          planSlug: plan?.slug,
          billing: (billing as any) || "three_months",
          cents,
        },
      });
      setPromo(result);
      setCodeInput("");
      if (result.totalCents === 0) {
        closeCheckout();
      } else {
        await start(result.code);
      }
    } catch (e) {
      setPromo(null);
      setPromoError(e instanceof Error ? e.message : "That code could not be used.");
    } finally {
      setChecking(false);
    }
  };

  const claimFreeAccess = async () => {
    if (!promo || !plan || !user) return;
    setClaimingFree(true);
    setLocalError(null);
    try {
      await claimFreePlanWithPromo({
        data: {
          code: promo.code,
          planSlug: plan.slug,
          billing: (billing as any) || "three_months",
        },
      });
      navigate({
        to: "/checkout/success",
        search: { plan: plan.slug, free: "true" } as any,
      });
    } catch (e: any) {
      setLocalError(
        e instanceof Error ? e.message : "Could not activate free plan. Please try again.",
      );
    } finally {
      setClaimingFree(false);
    }
  };

  const removeCode = async () => {
    setPromo(null);
    setPromoError(null);
    await start();
  };

  const perks = plan
    ? [
        { on: plan.max_flashcards !== 0, text: cap(plan.max_flashcards, "flashcards") },
        { on: plan.max_summaries !== 0, text: cap(plan.max_summaries, "PDF summaries") },
        { on: plan.max_ai_questions !== 0, text: cap(plan.max_ai_questions, "lecture questions") },
        {
          on: plan.max_all_in_one_lectures !== 0,
          text: cap(plan.max_all_in_one_lectures, "All-in-One lectures"),
        },
        {
          on: plan.max_archive_questions !== 0,
          text: cap(plan.max_archive_questions, "Archive questions"),
        },
      ].filter((p) => p.on)
    : [];

  const total = promo ? promo.totalCents : cents;
  const period = billing === "once" ? "one-time" : billing === "yearly" ? "per year" : "for 3 months";
  const activeError = localError || paddleError;

  return (
    <div className="rita-cream min-h-screen bg-background text-foreground">
      <PaymentTestModeBanner />
      <ProHeader variant="solid" />

      <main className="mx-auto max-w-[1120px] w-full px-5 pb-28 pt-24 md:px-10 md:pt-28">
        <Link
          to="/pricing"
          className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={15} /> Back to plans
        </Link>

        <h1 className="mt-7 text-center text-[32px] font-semibold leading-[1.08] md:text-[44px]">
          Secure checkout
        </h1>
        <p className="mx-auto mt-4 max-w-[36rem] text-center text-[15.5px] leading-[1.6] text-muted-foreground md:text-[16.5px]">
          Pay with Apple Pay, card, or PayPal. Your details are encrypted and handled by Paddle, our secure payment partner.
        </p>

        <div className="mt-11 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22.5rem]">
          {/* ---------------------------------------------- payment form */}
          <section className="overflow-hidden rounded-[20px] border border-border bg-card p-4 sm:p-6 shadow-sm md:p-9">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-2 text-[13px] font-semibold">
              <LockKeyhole size={14} className="rita-accent" /> Secure payment
            </div>

            {getPaddleEnvironment() === "sandbox" && (
              <div className="mt-3 flex items-center gap-2 rounded-[12px] bg-amber-500/10 border border-amber-500/20 px-3.5 py-2 text-[12.5px] font-medium text-amber-700 dark:text-amber-300">
                <span>💡 <strong>Test Mode:</strong> Use test card <code className="font-mono font-bold">4242 4242 4242 4242</code>, any future date, and CVC <code className="font-mono font-bold">123</code>.</span>
              </div>
            )}

            {!authLoading && !user && (
              <div className="mt-5 rounded-[14px] border border-border bg-muted/60 px-5 py-5">
                <p className="text-[15px] font-semibold">Sign in to pay</p>
                <p className="mt-1 text-[14px] text-muted-foreground">
                  Your plan is added to your RitaJet account, so we need to know who you are before
                  the card form opens.
                </p>
                <button type="button" onClick={goSignIn} className="rita-btn rita-btn-primary mt-4">
                  Sign in and continue
                </button>
              </div>
            )}

            {activeError && (
              <div className="mt-5 rounded-[14px] border border-destructive/25 bg-destructive/10 px-5 py-4 text-[14px] font-semibold text-destructive">
                <p>{activeError}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => void start(promo?.code, "all", "inline")}
                    className="rita-btn rita-btn-primary text-[13px] py-2 px-4"
                  >
                    <RotateCcw size={14} /> Try again
                  </button>
                  <button
                    type="button"
                    onClick={() => void start(promo?.code, "all", "overlay")}
                    className="rita-btn rita-btn-secondary text-[13px] py-2 px-4"
                  >
                    Open secure popup
                  </button>
                  <Link to="/pricing" className="text-[13px] text-muted-foreground underline ml-2">
                    Back to plans
                  </Link>
                </div>
              </div>
            )}

            {!isLoading && !plan && (
              <div className="mt-5 rounded-[14px] border border-border bg-muted/60 px-5 py-5">
                <p className="text-[15px] font-semibold">Choose a plan first</p>
                <p className="mt-1 text-[14px] text-muted-foreground">
                  We could not match this link to one of our plans.
                </p>
                <Link to="/pricing" className="rita-btn rita-btn-primary mt-4">
                  See the plans
                </Link>
              </div>
            )}

            {/* Free 100% Promo Claim Banner */}
            {promo && promo.totalCents === 0 ? (
              <div className="mt-6 rounded-[20px] border border-primary/30 bg-primary/5 p-6 md:p-8 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-primary">
                  <Sparkles size={28} />
                </div>
                <h2 className="mt-4 text-[22px] font-bold text-foreground">
                  100% Free Plan Unlocked!
                </h2>
                <p className="mx-auto mt-2 max-w-[28rem] text-[14.5px] leading-relaxed text-muted-foreground">
                  Promo code <strong className="text-foreground">{promo.code}</strong> covers 100% of this plan. No credit card, PayPal, or payment details are required.
                </p>

                {localError && (
                  <p className="mt-3 text-[14px] font-semibold text-destructive">{localError}</p>
                )}

                <button
                  type="button"
                  onClick={claimFreeAccess}
                  disabled={claimingFree}
                  className="rita-btn rita-btn-primary mt-6 mx-auto py-3 px-8 text-[15px] font-bold gap-2"
                >
                  {claimingFree ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Activating your access…
                    </>
                  ) : (
                    <>
                      Claim free access <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            ) : (
              <>
                {/* Loading state indicator */}
                {!activeError && user && plan && checkoutLoading && (
                  <p className="mt-6 flex items-center gap-2 text-[15px] font-semibold text-muted-foreground">
                    <Loader2 size={16} className="animate-spin text-primary" /> Preparing your secure payment form…
                  </p>
                )}

                {/* Reopen action if checkout was ever closed */}
                {!activeError && user && plan && checkoutClosed && (
                  <div className="mt-6 rounded-[18px] border border-border bg-muted/30 p-6 text-center">
                    <p className="text-[15px] font-bold text-foreground">Payment form was closed</p>
                    <button
                      type="button"
                      onClick={() => void start(promo?.code, "all")}
                      className="rita-btn rita-btn-primary mt-3 py-2.5 px-5 text-[14px] font-bold"
                    >
                      <RotateCcw size={14} className="inline mr-1.5" /> Re-open payment form
                    </button>
                  </div>
                )}

                {/* Paddle inline container (active when inline checkout is rendered) */}
                <div className={`${FRAME} mt-5 ${user && plan && checkoutLoaded ? "min-h-[26rem]" : ""}`} />
              </>
            )}

            <p className="mt-6 border-t border-border pt-5 text-[13px] leading-relaxed text-muted-foreground">
              By paying you agree to our{" "}
              <Link to="/terms" className="rita-accent hover:underline">
                Terms
              </Link>
              ,{" "}
              <Link to="/privacy-policy" className="rita-accent hover:underline">
                Privacy notice
              </Link>{" "}
              and{" "}
              <Link to="/refund-policy" className="rita-accent hover:underline">
                Refund policy
              </Link>
              . Our order process is conducted by our online reseller Paddle.com, the Merchant of
              Record for all our orders; Paddle handles billing enquiries and returns. Questions?{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="rita-accent hover:underline">
                {SUPPORT_EMAIL}
              </a>
            </p>
          </section>

          {/* --------------------------------------------- order summary */}
          <aside className="rounded-[20px] border border-border bg-card p-7 shadow-sm lg:sticky lg:top-24">
            <p className="text-[11px] font-bold uppercase text-muted-foreground">
              Order details
            </p>

            {isLoading && <div className="mt-5 h-24 animate-pulse rounded-[14px] bg-muted" />}

            {!isLoading && !plan && (
              <p className="mt-4 text-[15px] font-semibold text-muted-foreground">
                We could not find that plan.{" "}
                <Link to="/pricing" className="rita-accent underline">
                  Choose one here
                </Link>
                .
              </p>
            )}

            {plan && (
              <>
                <div className="mt-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[20px] font-bold leading-tight">{plan.name}</p>
                    <p className="mt-1 text-[13.5px] text-muted-foreground">{period}</p>
                  </div>
                  <span className="text-[19px] font-bold">{money(cents, plan.currency)}</span>
                </div>

                <ul className="mt-5 grid gap-2 border-t border-border pt-5">
                  {perks.map((p) => (
                    <li
                      key={p.text}
                      className="flex items-start gap-2 text-[14px] font-medium text-foreground/75"
                    >
                      <Check size={15} className="rita-accent mt-[3px] shrink-0" /> {p.text}
                    </li>
                  ))}
                </ul>

                {/* promo code */}
                <div className="mt-6 border-t border-border pt-5">
                  {promo ? (
                    <div className="flex items-center justify-between gap-3 rounded-[14px] border border-border bg-muted px-4 py-3">
                      <span className="flex min-w-0 items-center gap-2 text-[13.5px] font-semibold">
                        <Tag size={14} className="rita-accent" />
                        <span className="truncate">{promo.code}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="rita-accent text-[13.5px] font-bold">
                          −{money(promo.discountCents, plan.currency)}
                        </span>
                        <button
                          onClick={removeCode}
                          aria-label="Remove promo code"
                          className="text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <X size={15} />
                        </button>
                      </span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        value={codeInput}
                        onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === "Enter" && applyCode()}
                        placeholder="Add promo code"
                        maxLength={32}
                        className="min-w-0 flex-1 rounded-[12px] border border-input bg-background px-4 py-3 text-[14px] font-semibold outline-none placeholder:text-muted-foreground focus:border-primary"
                      />
                      <button
                        onClick={applyCode}
                        disabled={checking || !codeInput.trim()}
                        className="rita-btn rita-btn-secondary disabled:opacity-40"
                      >
                        {checking ? "…" : "Apply"}
                      </button>
                    </div>
                  )}
                  {promoError && (
                    <p className="mt-2 text-[13px] font-semibold text-[#ff9f8f]">{promoError}</p>
                  )}
                </div>

                <div className="mt-5 flex items-end justify-between border-t border-border pt-5">
                  <div>
                    <span className="text-[14px] font-semibold text-muted-foreground">Total due today</span>
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                      Paddle calculates applicable taxes at checkout.
                    </p>
                  </div>
                  <span className="text-[26px] font-bold leading-none">
                    {money(total, plan.currency)}
                  </span>
                </div>

                {billing === "once" ? (
                  <p className="mt-5 rounded-[14px] border border-border bg-muted/60 px-4 py-3 text-[13px] font-medium text-muted-foreground">
                    One-time payment. Lifetime access with no recurring charges.
                  </p>
                ) : (
                  <p className="mt-5 rounded-[14px] border border-border bg-muted/60 px-4 py-3 text-[13px] font-medium text-muted-foreground">
                    Renews automatically {billing === "yearly" ? "every year" : "every 3 months"}. Cancel anytime in your account.
                  </p>
                )}
              </>
            )}

            <ul className="mt-7 grid gap-3 border-t border-border pt-6 text-[13.5px] font-medium text-muted-foreground">
              <li className="flex items-center gap-2">
                <LockKeyhole size={15} className="rita-accent" /> Secure payment, encrypted
              </li>
              <li className="flex items-center gap-2">
                <RefreshCcw size={15} className="rita-accent" /> 30-day money-back guarantee
              </li>
              <li className="flex items-center gap-2">
                <BadgeCheck size={15} className="rita-accent" /> Cancel a subscription any time
              </li>
              <li className="flex items-center gap-2">
                <Clock3 size={15} className="rita-accent" /> Support replies in 2 working days
              </li>
            </ul>
          </aside>
        </div>
      </main>
    </div>
  );
}
