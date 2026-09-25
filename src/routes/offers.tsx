import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Gift, KeyRound, Loader2, Sparkles, Timer } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/legacy-client";
import { useAuth } from "@/hooks/useAuth";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { getPublicOfferMeta, claimOfferAction } from "@/lib/offer-center.functions";
import toolkitArt from "@/assets/toolkit-girl-study.webp.asset.json";

export const Route = createFileRoute("/offers")({
  head: () => ({
    meta: [
      { title: "Get your free study toolkit | RitaJet" },
      {
        name: "description",
        content:
          "Get free access to the RitaJet toolkit: flashcards, summaries and practice questions dropped straight into your account.",
      },
      { property: "og:title", content: "Get your free RitaJet toolkit" },
      {
        property: "og:description",
        content: "One tap adds a study pack to your account. Free for three months, one per student.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OffersPage,
});

type Offer = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  accent: string;
  badge: string;
  bullets: string[];
  duration_days: number;
  requires_code: boolean;
  claimed: boolean;
  expires_at: string | null;
  plan: Record<string, any> | null;
};

export function leftFrom(iso: string | null | undefined) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return { days, hours, minutes };
}

/** Soft sage green used for ticks and buttons, so a card's own accent never
 * drags the page back to the old loud red look. */
const SAGE = "var(--rita-green-deep)";

function OffersPage() {
  const { user } = useAuth();
  const settings = useSiteSettings();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [code, setCode] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [claimedMap, setClaimedMap] = useState<Record<string, boolean>>({});
  const [cardErrors, setCardErrors] = useState<Record<string, string | null>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["offers-list", user?.id ?? "anon"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("offers_list");
      if (error) throw error;
      return (data ?? []) as Offer[];
    },
  });

  const { data: publicMeta } = useQuery({
    queryKey: ["public-offer-meta"],
    queryFn: () => getPublicOfferMeta(),
    staleTime: 30_000,
  });

  async function claim(offer: Offer) {
    if (!user) return navigate({ to: "/login" });
    setBusy(offer.id);
    setCardErrors((errs) => ({ ...errs, [offer.id]: null }));
    try {
      const configuredCode = publicMeta?.[offer.id]?.code;
      const typed = (code[offer.id] ?? "").trim();
      const codeToUse = typed || (configuredCode ? configuredCode.trim() : "");

      const result = await claimOfferAction({
        data: {
          offerId: offer.id,
          code: codeToUse || undefined,
        },
      });

      if (result.alreadyClaimed) {
        toast.info(result.message || "This offer is active on your account.");
      } else {
        toast.success("🎉 It's yours — added to your account!");
      }

      setClaimedMap((m) => ({ ...m, [offer.id]: true }));
      setCode((c) => ({ ...c, [offer.id]: "" }));
      await qc.invalidateQueries({ queryKey: ["offers-list"] });
      await qc.invalidateQueries({ queryKey: ["my-plan-usage"] });
    } catch (e: any) {
      const msg = e?.message || "Could not claim this offer. Please check the code and try again.";
      setCardErrors((errs) => ({ ...errs, [offer.id]: msg }));
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  const offers = data ?? [];

  // The whole page can be switched off from the admin area.
  if (!settings.offers_page_enabled) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-4 py-24 text-center">
          <h1 className="font-display text-3xl font-black">No offers right now</h1>
          <p className="mt-3 text-[16px] text-muted-foreground">
            Special offers are closed at the moment. Everything else is waiting for you inside.
          </p>
          <Link to="/study" className="rita-btn rita-btn-primary mt-7 inline-flex">
            Start learning
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-12 md:px-8 md:py-16">
        <section className="grid items-center gap-10 md:grid-cols-[1.05fr_1fr]">
          <div>
            <span
              className="inline-flex items-center gap-2 rounded-full bg-[color:var(--rita-green-soft)] px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.16em]"
              style={{ color: SAGE }}
            >
              <Gift size={14} /> Free toolkit
            </span>
            <h1 className="mt-5 font-display text-4xl font-black leading-[1.06] tracking-tight md:text-5xl">
              Get free access
              <br />
              to the study toolkit.
            </h1>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-muted-foreground">
              Flashcards, one-page summaries and practice questions land in your account the moment you
              tap. No card, one per student, and it works right away in every Rita mode.
            </p>
          </div>
          <img
            src={toolkitArt.url}
            alt="A student studying with flashcards, a checklist and a calendar around her"
            width={1600}
            height={1008}
            className="w-full rounded-[32px] border border-black/5 bg-white object-cover shadow-[0_24px_50px_-30px_rgba(43,38,32,0.4)]"
          />
        </section>

        {isLoading ? (
          <p className="mt-14 text-[15px] font-semibold text-muted-foreground">Loading the good stuff…</p>
        ) : offers.length === 0 ? (
          <div className="mt-14 rounded-[30px] border border-black/5 bg-white p-10 text-center shadow-[0_20px_40px_-30px_rgba(43,38,32,0.35)]">
            <p className="text-[17px] font-black">No offers running right now.</p>
            <p className="mt-2 text-[15px] text-muted-foreground">Check back soon — new packs land often.</p>
          </div>
        ) : (
          <div className="mt-14 grid gap-7 md:grid-cols-2">
            {offers.map((o) => (
              <OfferCard
                key={o.id}
                offer={{
                  ...o,
                  claimed: o.claimed || !!claimedMap[o.id],
                }}
                code={code[o.id] ?? ""}
                onCode={(v) => {
                  setCardErrors((errs) => ({ ...errs, [o.id]: null }));
                  setCode((c) => ({ ...c, [o.id]: v }));
                }}
                busy={busy === o.id}
                onClaim={() => claim(o)}
                signedIn={!!user}
                meta={publicMeta?.[o.id]}
                error={cardErrors[o.id] ?? null}
              />
            ))}
          </div>
        )}

        <p className="mt-14 text-[13px] text-muted-foreground">
          Offers only work from this page. Credits are added on top of your plan and stop counting when the
          free period is over.
        </p>
      </main>
    </div>
  );
}

function OfferCard({
  offer,
  code,
  onCode,
  busy,
  onClaim,
  signedIn,
  meta,
  error,
}: {
  offer: Offer;
  code: string;
  onCode: (v: string) => void;
  busy: boolean;
  onClaim: () => void;
  signedIn: boolean;
  meta?: { code: string | null; showPlaceholder: boolean };
  error?: string | null;
}) {
  const left = leftFrom(offer.expires_at);
  const months = Math.round(offer.duration_days / 30);
  const hasAutoCode = meta?.showPlaceholder !== false && !!meta?.code;

  return (
    <article className="relative overflow-hidden rounded-[30px] border border-black/5 bg-white p-7 shadow-[0_24px_50px_-34px_rgba(43,38,32,0.45)]">
      {offer.badge && (
        <span
          className="inline-flex items-center rounded-full bg-[color:var(--rita-green-soft)] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em]"
          style={{ color: SAGE }}
        >
          {offer.badge}
        </span>
      )}

      {offer.image_url && (
        <img
          src={offer.image_url}
          alt={offer.title}
          loading="lazy"
          className="mt-5 h-40 w-full rounded-[22px] object-cover"
        />
      )}

      <h2 className="mt-5 font-display text-2xl font-black leading-tight">{offer.title}</h2>
      {offer.subtitle && <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{offer.subtitle}</p>}

      <ul className="mt-5 space-y-2.5">
        {(offer.bullets ?? []).map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-[14px] font-semibold text-[#3a342c]">
            <Check size={16} strokeWidth={3} className="mt-0.5 shrink-0" style={{ color: SAGE }} />
            {b}
          </li>
        ))}
      </ul>

      <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#f6f0e6] px-3.5 py-1.5 text-[12px] font-semibold text-muted-foreground">
        <Timer size={13} /> Valid{" "}
        {months > 0 ? `${months} month${months > 1 ? "s" : ""}` : `${offer.duration_days} days`} from the moment
        you claim
      </p>

      {offer.claimed ? (
        <div className="mt-6 rounded-[24px] bg-[color:var(--rita-green-soft)] p-5">
          <p className="text-[15px] font-black" style={{ color: SAGE }}>
            Claimed 🎉
          </p>
          <p className="mt-1 text-[14px] font-semibold text-muted-foreground">
            {left
              ? `${left.days}d ${left.hours}h ${left.minutes}m left before it runs out.`
              : "This offer is active on your account."}
          </p>
          <Link
            to="/my-plan"
            className="rita-btn rita-btn-primary mt-4 inline-flex"
          >
            <Sparkles size={15} /> See it in My plan
          </Link>
        </div>
      ) : (
        <div className="mt-6">
          {error && (
            <div className="mb-3.5 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-[13px] font-bold text-rose-800 animate-in fade-in slide-in-from-top-1 duration-200">
              <span className="shrink-0 text-base leading-none">⚠️</span>
              <p className="flex-1 leading-snug">{error}</p>
            </div>
          )}

          {offer.requires_code && (
            <label className="mb-3 flex items-center gap-2 rounded-2xl border border-black/10 bg-[#fdf7ee] px-4 py-2.5 focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600 transition-all">
              <KeyRound size={15} className="shrink-0 text-muted-foreground" />
              <input
                value={code}
                onChange={(e) => onCode(e.target.value.toUpperCase())}
                placeholder={
                  hasAutoCode
                    ? meta?.code || "YSMU"
                    : "Enter promo code"
                }
                className="w-full bg-transparent text-[14px] font-bold tracking-wider text-[#2b2620] placeholder:text-[#b6ada0] focus:outline-none"
              />
              {!code && hasAutoCode && (
                <span className="shrink-0 rounded-md bg-emerald-100 px-2 py-0.5 text-[10.5px] font-black uppercase tracking-wider text-emerald-800">
                  Ready
                </span>
              )}
            </label>
          )}

          <button
            type="button"
            onClick={onClaim}
            disabled={busy}
            className="rita-btn rita-btn-primary inline-flex disabled:opacity-60 cursor-pointer shadow-xs hover:shadow-md transition-all active:scale-[0.99]"
          >
            {busy ? <Loader2 size={17} className="animate-spin" /> : <Gift size={17} />}
            {signedIn ? "Get it free" : "Sign in and get it free"}
          </button>

          {!offer.requires_code && (
            <details className="mt-3 text-[13px] font-semibold text-muted-foreground">
              <summary className="cursor-pointer">Got a code instead?</summary>
              <input
                value={code}
                onChange={(e) => onCode(e.target.value.toUpperCase())}
                placeholder={
                  hasAutoCode
                    ? meta?.code || "YSMU"
                    : "Enter promo code"
                }
                className="mt-2 w-full rounded-2xl border border-black/10 bg-[#fdf7ee] px-4 py-2.5 text-[14px] font-bold tracking-wider text-[#2b2620] placeholder:text-[#b6ada0] focus:outline-none"
              />
            </details>
          )}
        </div>
      )}
    </article>
  );
}
