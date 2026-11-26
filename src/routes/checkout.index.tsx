import { createFileRoute, Link } from "@tanstack/react-router";
import { ProHeader } from "@/components/home/procreate/ProHeader";
import { CheckoutDesign } from "@/components/checkout/CheckoutDesign";
import { SUPPORT_EMAIL } from "@/lib/legal-content";

export const Route = createFileRoute("/checkout/")({
  head: () => ({
    meta: [
      { title: "Secure checkout — Uzyra" },
      {
        name: "description",
        content:
          "Finish your Uzyra purchase on a secure page: see exactly what your plan or credit pack includes before you pay.",
      },
      { property: "og:title", content: "Secure checkout — Uzyra" },
      {
        property: "og:description",
        content: "Pay securely for your Uzyra plan or one-time credit pack.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    plan: typeof s.plan === "string" ? s.plan : "",
    billing: s.billing === "yearly" || s.billing === "once" ? s.billing : "three_months",
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
          <h1 className="text-[26px] font-semibold">We could not open the payment form</h1>
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

// Look only for now (Nov 2026): the payment form is drawn but not linked to Paddle yet. The
// Paddle-linked page is in git history (src/routes/checkout.index.tsx at 770d665).
function CheckoutPage() {
  const { plan } = Route.useSearch();
  return <CheckoutDesign slug={plan} />;
}
