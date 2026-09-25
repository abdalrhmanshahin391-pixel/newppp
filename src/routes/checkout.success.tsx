import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { ProHeader } from "@/components/home/procreate/ProHeader";
import { supabase } from "@/integrations/supabase/legacy-client";
import { useAuth } from "@/hooks/useAuth";
import { SUPPORT_EMAIL } from "@/lib/legal-content";

import { activatePlanAfterCheckout } from "@/lib/plans.functions";
import { saveCheckoutPaymentMethod } from "@/lib/subscription.functions";

export const Route = createFileRoute("/checkout/success")({
  head: () => ({
    meta: [
      { title: "Payment successful — RitaJet" },
      {
        name: "description",
        content: "Your RitaJet purchase is confirmed and your study plan is being activated.",
      },
      { property: "og:title", content: "Payment successful — RitaJet" },
      { property: "og:description", content: "Your RitaJet purchase is confirmed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    plan: typeof search.plan === "string" ? search.plan : "",
    free: search.free === "true" || search.free === true,
  }),
  component: SuccessPage,
});

function SuccessPage() {
  const { plan: slug, free: isFree } = Route.useSearch();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [polling, setPolling] = useState(true);
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    if (!user) {
      setPolling(false);
      return;
    }
    let cancelled = false;

    // Immediately trigger server plan activation so the user doesn't have to wait on webhooks
    if (slug) {
      void activatePlanAfterCheckout({ data: { planSlug: slug } })
        .then(() => {
          if (!cancelled) {
            setGranted(true);
            setPolling(false);
            void qc.invalidateQueries({ queryKey: ["my-plan-usage"] });
            void qc.invalidateQueries({ queryKey: ["my-subscription"] });
            void qc.invalidateQueries({ queryKey: ["my-payment-methods"] });
          }
        })
        .catch((err) => {
          console.warn("Immediate plan activation attempt:", err);
        });
    }

    // Save payment method used in checkout if present in session
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        const raw = window.sessionStorage.getItem("rita_last_payment_method");
        if (raw) {
          const parsed = JSON.parse(raw);
          window.sessionStorage.removeItem("rita_last_payment_method");
          void saveCheckoutPaymentMethod({ data: parsed }).catch((err) =>
            console.warn("saveCheckoutPaymentMethod from success page failed:", err),
          );
        }
      }
    } catch (e) {
      console.warn("Failed reading cached payment method:", e);
    }

    let attempts = 0;
    const tick = async () => {
      if (cancelled) return;
      attempts++;
      const { data } = await (supabase.from as any)("user_plans")
        .select("plan_slug")
        .eq("user_id", user.id)
        .maybeSingle();
      const ok = slug ? (data as any)?.plan_slug === slug : !!(data as any)?.plan_slug;
      if (cancelled) return;
      if (ok) {
        setGranted(true);
        setPolling(false);
        return;
      }
      if (attempts < 15) setTimeout(tick, 1500);
      else setPolling(false);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [user, slug]);

  return (
    <div
      className="rita-cream min-h-screen bg-black text-white"
      style={{ fontFamily: "var(--font-grotesk)" }}
    >
      <ProHeader variant="solid" />

      <main className="mx-auto max-w-[560px] px-6 pb-28 pt-28 text-center md:px-10">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-white/10 bg-white/[0.06]">
          <CheckCircle2 className="rita-accent h-8 w-8" />
        </div>
        <h1 className="mt-7 text-[34px] font-bold leading-[1.06] md:text-[40px]">
          {isFree ? "Plan activated!" : "Payment received"}
        </h1>
        <p className="mt-4 text-[16px] leading-[1.6] text-white/50">
          {isFree
            ? "Congratulations! Your plan has been unlocked and added to your RitaJet account with zero payment required."
            : "Thank you — a receipt is on its way to your email from Paddle, our payment partner."}
        </p>

        <div className="mt-9 rounded-[28px] border border-white/10 bg-[#131313] p-7 text-left">
          {polling && !granted ? (
            <p className="flex items-center gap-3 text-[15px] font-semibold text-white/50">
              <Loader2 className="h-4 w-4 animate-spin" /> Activating your plan…
            </p>
          ) : granted ? (
            <div className="grid gap-4">
              <p className="text-[15.5px] font-semibold text-white">Your plan is ready.</p>
              <Link to="/" className="rita-btn rita-btn-primary gap-2 self-start">
                Go to Home <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 text-[15px] text-white/55">
              <p>
                Your payment went through. The plan can take a few seconds to appear — refresh this
                page in a moment, or open your account.
              </p>
              <Link to="/my-plan" className="rita-btn rita-btn-secondary gap-2 self-start">
                My plan <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>

        <p className="mt-6 text-[13px] text-white/35">
          Need help?{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="rita-accent hover:underline">
            {SUPPORT_EMAIL}
          </a>{" "}
          — we reply within 2 working days.
        </p>
      </main>
    </div>
  );
}
