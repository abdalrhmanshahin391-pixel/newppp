import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Check, Minus } from "lucide-react";
import { ProHeader } from "@/components/home/procreate/ProHeader";
import { supabase } from "@/integrations/supabase/legacy-client";
import { OfferRibbon, discountPercent, offerLive } from "@/components/pricing/offer";
import { myPlanUsage, listPlans, type PlanRow } from "@/lib/plans.functions";
import { useAuth } from "@/hooks/useAuth";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { updateSiteSettings } from "@/lib/site-settings.functions";
import { useQueryClient } from "@tanstack/react-query";
import { EditableImage } from "@/components/site/EditableImage";
import monthlyArt from "@/assets/pricing-monthly-objects.jpg.asset.json";
import packsArt from "@/assets/pricing-packs-green.jpg.asset.json";
import packStarter from "@/assets/pack-starter-dark.jpg.asset.json";
import packStudy from "@/assets/pack-study-dark.jpg.asset.json";
import packExam from "@/assets/pack-exam-dark.jpg.asset.json";


export const Route = createFileRoute("/pricing")({
  loader: async () => {
    try {
      const plans = (await listPlans()) as FullPlan[];
      return { plans };
    } catch {
      return { plans: [] as FullPlan[] };
    }
  },
  head: () => ({
    meta: [
      { title: "Rita plans — flashcards, summaries and AI questions" },
      {
        name: "description",
        content:
          "Pick the Rita plan that matches your semester: a free start, an everyday study plan, or the exam-season plan with the biggest AI allowance.",
      },
      { property: "og:title", content: "Choose your smart study plan — RitaJet" },
      {
        property: "og:description",
        content:
          "Simple plans for flashcards, PDF summaries, AI questions and your to-do board.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

type FullPlan = PlanRow & {
  currency?: string;
  cta_label?: string | null;
  perks?: string[] | null;
  published?: boolean;
  highlight?: boolean;
  feature_ai_import?: boolean;
  feature_review?: boolean;
  feature_lecture_qgen?: boolean;
  feature_archive_qgen?: boolean;
  feature_all_in_one?: boolean;
  billing_kind?: "monthly" | "lifetime";
  once_cents?: number;
  paddle_price_monthly?: string | null;
  paddle_price_yearly?: string | null;
  paddle_price_once?: string | null;
  ribbon_label?: string | null;
  ribbon_color?: string | null;
  compare_cents?: number | null;
  offer_ends_at?: string | null;
};

const SYMBOL: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JOD: "JD " };

function money(cents: number, currency = "USD") {
  const sym = SYMBOL[currency] ?? `${currency} `;
  if (cents === 0) return `${sym}0`;
  return `${sym}${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function cap(n: number | null | undefined, unit: string) {
  return n === null || n === undefined ? `Unlimited ${unit}` : `${n.toLocaleString()} ${unit}`;
}

const PACK_ART = [packStarter.url, packStudy.url, packExam.url];

function PricingPage() {
  const loaderData = Route.useLoaderData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [yearly, setYearly] = useState(false);
  const [kind, setKind] = useState<"monthly" | "lifetime" | null>(null);
  const usageFn = useServerFn(myPlanUsage);
  const settings = useSiteSettings();
  const saveSettings = useServerFn(updateSiteSettings);
  const qc = useQueryClient();
  const [savingPacks, setSavingPacks] = useState(false);

  const { data: plans = loaderData?.plans ?? [], isLoading } = useQuery({
    queryKey: ["plans"],
    initialData: loaderData?.plans && loaderData.plans.length > 0 ? loaderData.plans : undefined,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<FullPlan[]> => {
      const { data, error } = await (supabase.from as any)("plans").select("*").order("sort");
      if (error) throw new Error(error.message);
      return (data ?? []) as FullPlan[];
    },
  });

  const { data: mine } = useQuery({
    queryKey: ["my-plan-usage", user?.id ?? "anon"],
    queryFn: () => usageFn({}),
    enabled: !!user,
  });

  const isAdmin = !!(mine as any)?.is_admin;
  const packsVisible = settings.credit_packs_enabled || isAdmin;

  const togglePacks = async () => {
    setSavingPacks(true);
    try {
      await saveSettings({ data: { credit_packs_enabled: !settings.credit_packs_enabled } });
      await qc.invalidateQueries({ queryKey: ["site-settings"] });
    } finally {
      setSavingPacks(false);
    }
  };

  const live = plans.filter(
    (p) => p.published !== false && (p.billing_kind ?? "monthly") === (kind ?? "monthly"),
  );

  const buy = (p: FullPlan) => {
    const billing = kind === "lifetime" ? "once" : yearly ? "yearly" : "three_months";
    if (!user) {
      navigate({ to: "/register", search: { next: `/checkout?plan=${p.slug}&billing=${billing}` } as any });
      return;
    }
    navigate({ to: "/checkout", search: { plan: p.slug, billing } as any });
  };

  return (
    <div
      className="rita-cream min-h-screen bg-black text-white"
      style={{ fontFamily: "var(--font-grotesk)" }}
    >
      <ProHeader variant="solid" />

       <section className="relative pt-24 md:pt-28">
         <div className="relative mx-auto flex max-w-[1120px] flex-col items-center px-6 pt-6 text-center md:px-10 md:pt-8">
          <h1 className="sr-only">RitaJet study plans and pricing</h1>
          {kind && (
            <button
              type="button"
              onClick={() => setKind(null)}
              className="rita-btn rita-btn-secondary mt-8 gap-2"
            >
              <ArrowLeft size={15} />
              {kind === "monthly" ? "Subscription plans" : "One-time packs"} · change
            </button>
          )}

          {kind === "monthly" && (
             <div className="mt-6 inline-flex rounded-full border border-white/10 bg-white/[0.06] p-1">
              {[
                { k: false, label: "3 Months" },
                { k: true, label: "Yearly · save more" },
              ].map((o) => (
                <button
                  key={String(o.k)}
                  type="button"
                  onClick={() => setYearly(o.k)}
                  className={`rounded-full px-5 py-2 text-[13.5px] font-semibold transition-colors ${
                     yearly === o.k ? "rita-accent-bg" : "text-white/55 hover:text-white"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {kind === "lifetime" && (
            <p className="mt-5 max-w-xl text-[14.5px] font-medium text-white/50">
              Yours for life — use them at your own pace. When a pack runs out, buy it again and
              the credits add on top.
            </p>
          )}
        </div>
      </section>

      {!kind && (
        <section className="mx-auto grid max-w-[1120px] gap-6 px-6 pb-32 pt-8 md:grid-cols-2 md:px-10 md:pt-10">
          {[
            {
              k: "monthly" as const,
               art: monthlyArt.url,
              title: "Subscription plans",
              copy: "A steady allowance for cards, summaries and AI questions. Choose 3 months or yearly. Cancel any time.",
              cta: "See plans",
            },
            {
              k: "lifetime" as const,
               art: packsArt.url,
              title: "Credit packs — pay once",
              copy: "200 flashcards, 100 questions and more. Use them whenever you like, they never expire.",
              cta: "See packs",
            },
          ]
            .filter((b) => b.k !== "lifetime" || packsVisible)
            .map((b) => (
            <article
              key={b.k}
               className="group flex min-h-[650px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#131313] text-left transition-transform hover:-translate-y-1 md:rounded-[34px]"
            >
                <div className="p-8 md:p-10">
                  <p className="text-[19px] font-bold md:text-[21px]">RitaJet <span className="rita-accent font-normal">Study</span></p>
                  <h2 className="mt-5 max-w-[25rem] text-[34px] font-bold leading-[1.06] md:text-[43px]">{b.title}</h2>
                  <p className="mt-5 max-w-[28rem] text-[16px] leading-[1.6] text-white/50 md:text-[17px]">{b.copy}</p>
                  <button type="button" onClick={() => setKind(b.k)} className="rita-btn rita-btn-primary mt-7 gap-2">
                    {b.cta} <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
                <div className="mt-auto px-5 pb-5 md:px-7 md:pb-7">
                  <div className="overflow-hidden rounded-[22px] md:rounded-[26px]">
                    <EditableImage
                      imageKey={`pricing.${b.k}`}
                      fallback={b.art}
                      alt={b.k === "monthly" ? "A study desk with a calendar, flashcards, a clock and a pencil" : "An organized collection of reusable RitaJet study credits"}
                      width={1536}
                      height={1024}
                      loading="eager"
                      className="aspect-[3/2] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    />
                  </div>
                </div>
             </article>
            ))}
        </section>
      )}

      {!kind && isAdmin && (
        <section className="mx-auto -mt-16 max-w-[1120px] px-6 pb-16 md:px-10">
           <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-white/10 bg-[#131313] p-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">Admin only</p>
              <p className="mt-1 text-[15px] font-bold text-white">
                Credit packs — pay once:{" "}
                <span className={settings.credit_packs_enabled ? "text-[#1f7a4d]" : "text-[#a4321f]"}>
                  {settings.credit_packs_enabled ? "visible to everyone" : "hidden from students"}
                </span>
              </p>
              <p className="mt-1 text-[13.5px] text-white/45">
                You always see the packs. This switch decides whether students can.
              </p>
            </div>
            <button
              type="button"
              onClick={togglePacks}
              disabled={savingPacks}
              className="rita-btn rita-btn-secondary disabled:opacity-60"
            >
              {savingPacks
                ? "Saving…"
                : settings.credit_packs_enabled
                  ? "Hide for everyone"
                  : "Show to everyone"}
            </button>
          </div>
        </section>
      )}

      <main className="mx-auto max-w-[1120px] px-6 pb-24 pt-12 md:px-10">
        {kind && (
        <>
        {isLoading && (

          <div className="grid gap-6 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[30rem] animate-pulse rounded-[20px] bg-white/[0.07]" />
            ))}
          </div>
        )}

        {!isLoading && live.length === 0 && (
          <p className="rounded-[20px] border border-dashed border-white/15 bg-white/[0.05] p-10 text-center font-semibold text-white/50">
            No plans are published yet.
          </p>
        )}

         <div className="grid items-stretch gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {live.map((p, i) => {
            const lifetime = kind === "lifetime";
            const priceCents = lifetime
              ? (p.once_cents ?? 0)
              : yearly
                ? (p.yearly_cents ?? 0)
                : (p.price_cents ?? 0);
            const isMine = mine?.plan?.slug === p.slug;
            const best = !!p.highlight;

            const liveOffer = offerLive(p.offer_ends_at);
            const off = lifetime || yearly || !liveOffer ? 0 : discountPercent(p.compare_cents, p.price_cents);
            const semesterSave =
              !lifetime && yearly && p.price_cents && p.yearly_cents
                ? Math.max(0, Math.round((1 - p.yearly_cents / (p.price_cents * 4)) * 100))
                : 0;
            return (
              <article
                key={p.slug}
                 className={`relative flex min-h-[610px] flex-col overflow-hidden rounded-[28px] border bg-[#131313] p-8 transition-transform hover:-translate-y-1 md:rounded-[32px] md:p-9 ${
                   best ? "rita-accent-border" : "border-white/10"
                }`}
              >
                <OfferRibbon label={p.ribbon_label} color={p.ribbon_color} endsAt={p.offer_ends_at} />
                {best && !p.ribbon_label && (
                    <span className="absolute right-5 top-5 rounded-full rita-accent-bg px-3.5 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em]">
                    Most popular
                  </span>
                )}
                {isMine && (
                    <span className="absolute left-5 top-5 rounded-full bg-white px-3.5 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] rita-ink">
                    Your plan
                  </span>
                )}

                {lifetime && (
                  <EditableImage
                    imageKey={`pricing.pack${i % 3}`}
                    fallback={PACK_ART[i % PACK_ART.length] as string}
                    alt=""
                    width={768}
                    height={512}
                    className="-mx-8 -mt-8 mb-7 h-44 w-[calc(100%+4rem)] max-w-none object-cover md:-mx-9 md:-mt-9 md:w-[calc(100%+4.5rem)]"
                  />
                )}

                 <p className={`${lifetime ? "" : "mt-2"} text-[19px] font-bold md:text-[21px]`}>RitaJet <span className="rita-accent font-normal">{p.name}</span></p>

                {p.tagline && (
                    <p className="mt-5 min-h-12 text-[16px] font-medium leading-[1.5] text-white/50">
                    {p.tagline}
                  </p>
                )}

                 <div className="mt-7 flex flex-wrap items-end gap-x-2 gap-y-2">
                    <span className="text-[48px] font-bold leading-none md:text-[54px]">
                    {money(priceCents, p.currency)}
                  </span>
                   <span className="pb-1.5 text-[14px] font-medium text-white/35">
                    {priceCents === 0 ? "free" : lifetime ? "once" : yearly ? "/ year" : "/ 3 months"}
                  </span>
                  {off > 0 && (
                    <span className="mb-1.5 inline-flex items-center gap-1.5">
                       <span className="text-[15px] font-semibold text-white/30 line-through">
                        {money(p.compare_cents ?? 0, p.currency)}
                      </span>
                      <span
                        className="rounded-full rita-accent-bg px-2.5 py-1 text-[11.5px] font-black"
                      >
                        −{off}%
                      </span>
                    </span>
                  )}
                  {semesterSave > 0 && (
                     <span className="rita-accent-soft rita-accent mb-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-black">
                      save {semesterSave}% vs 3 months
                    </span>
                  )}
                </div>


                 <div className="mb-8 mt-8 border-t border-white/10 pt-6">
                   <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/35">What is included</p>
                   <ul className="mt-4 grid gap-3">
                  {[
                    { on: p.max_flashcards !== 0, text: cap(p.max_flashcards, "flashcards") },
                    { on: p.max_summaries !== 0, text: cap(p.max_summaries, "PDF summaries") },
                    {
                      on: p.feature_lecture_qgen !== false && p.max_ai_questions !== 0,
                      text: cap(p.max_ai_questions, "lecture questions"),
                    },
                    {
                      on: p.feature_all_in_one !== false && p.max_all_in_one_lectures !== 0,
                      text: cap(p.max_all_in_one_lectures, "All-in-One lectures"),
                    },
                    {
                      on: p.feature_archive_qgen !== false && p.max_archive_questions !== 0,
                      text: cap(p.max_archive_questions, "Archive questions with full explanations"),
                    },
                    { on: p.max_todo_tasks !== 0, text: cap(p.max_todo_tasks, "to-do tasks") },
                    {
                      on: p.max_calendar_items !== 0,
                      text: cap(p.max_calendar_items, "calendar entries"),
                    },
                    { on: p.max_groups !== 0, text: cap(p.max_groups, "classrooms you create") },
                    { on: true, text: "Join unlimited classrooms" },
                  ]
                    .filter((l) => l.on)
                    .map((l) => (
                      <Line key={l.text} on text={l.text} />
                    ))}
                   </ul>
                 </div>



                {!lifetime && priceCents === 0 ? (
                  <Link
                    to={user ? "/study" : "/register"}
                     className={`rita-btn mt-auto ${best ? "rita-btn-primary" : "rita-btn-secondary"}`}
                  >
                    {p.cta_label || "Start free"}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => buy(p)}
                     className={`rita-btn mt-auto disabled:opacity-60 ${best ? "rita-btn-primary" : "rita-btn-secondary"}`}
                  >
                    {p.cta_label ||
                      (lifetime
                        ? isMine
                          ? `Top up ${p.name}`
                          : `Buy ${p.name} — ${money(priceCents, p.currency)}`
                        : `Get ${p.name}`)}
                  </button>
                )}
              </article>
            );
          })}
        </div>
        </>
        )}



        {mine && (
           <section className="mt-16 flex flex-wrap items-center gap-4 rounded-[28px] border border-white/10 bg-[#131313] p-8">
            <div className="min-w-0">
              <h2 className="text-[18px] font-bold">You are on {mine.plan?.name}</h2>
              <p className="mt-1 text-[14px] font-medium text-white/45">
                Your balance, allowances and any offer countdown now live on their own page.
              </p>
            </div>
            <Link
              to="/my-plan"
              className="rita-btn rita-btn-primary ms-auto"
            >
              Open my plan
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}

function Line({ on, text }: { on?: boolean; text: string }) {
  return (
    <li className={`flex items-start gap-2.5 text-[15px] ${on ? "font-medium text-white/75" : "text-white/30 line-through"}`}>
      <span
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${on ? "rita-accent-soft" : "bg-white/[0.06]"}`}
      >
        {on ? <Check size={12} strokeWidth={3.5} className="rita-accent" /> : <Minus size={12} className="text-white/30" />}
      </span>
      {text}
    </li>
  );
}
