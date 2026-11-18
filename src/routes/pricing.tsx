import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown } from "lucide-react";
import { ProHeader } from "@/components/home/procreate/ProHeader";
import { supabase } from "@/integrations/supabase/legacy-client";
import { OfferRibbon, discountPercent, offerLive } from "@/components/pricing/offer";
import { myPlanUsage, listPlans, type PlanRow } from "@/lib/plans.functions";
import { useAuth } from "@/hooks/useAuth";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { updateSiteSettings } from "@/lib/site-settings.functions";
import { useQueryClient } from "@tanstack/react-query";

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
      { title: "Uzyra plans: flashcards, summaries and AI questions" },
      {
        name: "description",
        content:
          "Pick the Uzyra plan that matches your semester: a free start, an everyday study plan, or the exam-season plan with the biggest AI allowance.",
      },
      { property: "og:title", content: "Choose your smart study plan | Uzyra" },
      {
        property: "og:description",
        content: "Simple plans for flashcards, PDF summaries, AI questions and your to-do board.",
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

type Billing = "three_months" | "yearly" | "once";

/** One row of the comparison table: a label and how to read the plan's allowance. */
type Row = { label: string; value: (p: FullPlan) => number | string | null | false };

const allowance = (n: number | null | undefined, on = true): number | null | false =>
  !on || n === 0 ? false : n === undefined ? false : n;

/** The comparison table, grouped like the cards: every value comes from the plan in the admin. */
const conversationAllowance = (p: FullPlan) => `${((p.free_talk_seconds ?? 0) / 60).toLocaleString()} minutes of free conversation ${p.free_talk_period === "lifetime" ? "per account" : "per month"}`;

const COMPARE: { title: string; rows: Row[] }[] = [
  { title: "Voice learning", rows: [{label: "Free conversation time",value: conversationAllowance}] },
  {
    title: "Study tools",
    rows: [
      { label: "Flashcards", value: (p) => allowance(p.max_flashcards) },
      { label: "PDF summaries", value: (p) => allowance(p.max_summaries) },
    ],
  },
  {
    title: "AI questions",
    rows: [
      {
        label: "Lecture questions",
        value: (p) => allowance(p.max_ai_questions, p.feature_lecture_qgen !== false),
      },
      {
        label: "All-in-One lectures",
        value: (p) => allowance(p.max_all_in_one_lectures, p.feature_all_in_one !== false),
      },
      {
        label: "Archive questions with explanations",
        value: (p) => allowance(p.max_archive_questions, p.feature_archive_qgen !== false),
      },
    ],
  },
  {
    title: "Organise",
    rows: [
      { label: "To-do tasks", value: (p) => allowance(p.max_todo_tasks) },
      { label: "Calendar entries", value: (p) => allowance(p.max_calendar_items) },
    ],
  },
  {
    title: "Classrooms",
    rows: [
      { label: "Classrooms you create", value: (p) => allowance(p.max_groups) },
      { label: "Join classrooms", value: () => null },
    ],
  },
];

/** Questions under the table. Edit the wording here; keep every answer true for Uzyra. */
const QUESTIONS: { q: string; a: string; packs?: boolean }[] = [
  {
    q: "Can I start for free?",
    a: "Yes. The free plan needs no payment. Move to a paid plan when you need more.",
  },
  {
    q: "What is the difference between 3 months and yearly?",
    a: "It is the same plan, paid for 3 months or for a whole year. Yearly costs less per month.",
  },
  {
    q: "Can I cancel any time?",
    a: "Yes. Subscriptions can be cancelled any time.",
  },
  {
    q: "Do credit packs expire?",
    a: "No. A pack is paid once and never expires. When it runs out, buy it again and the credits add on top.",
    packs: true,
  },
  {
    q: "Where do I see what I have left?",
    a: "Your balance and allowances are in Settings, under Plan.",
  },
];

/**
 * Sample plans for /pricing?demo=1: three plans shaped like the reference page (names, prices and
 * list lengths) so the layout can be seen before real plans are written. Never sold: the buttons
 * do nothing in the preview.
 */
const DEMO_PLANS: FullPlan[] = [
  {
    slug: "demo-free",
    free_talk_seconds: 600,
    free_talk_period: "lifetime",
    name: "Free",
    tagline: "For trying Uzyra. No card needed.",
    price_cents: 0,
    yearly_cents: 0,
    max_flashcards: 100,
    max_summaries: 3,
    max_ai_questions: 50,
    max_todo_tasks: 20,
    max_calendar_items: 20,
    max_groups: 1,
    max_all_in_one_lectures: 0,
    max_all_in_one_questions: 0,
    max_archive_questions: 0,
    todo_full: false,
    rich_cards: false,
    feature_lecture_qgen: true,
    feature_archive_qgen: false,
    feature_all_in_one: false,
    sort: 1,
    billing_kind: "monthly",
    published: true,
    currency: "USD",
    cta_label: "Try for free",
    perks: ["Make your own flashcards", "100 AI credits to start", "1 classroom"],
  },
  {
    slug: "demo-pro",
    free_talk_seconds: 21600,
    free_talk_period: "monthly",
    name: "Pro",
    tagline: "For one person, billed yearly.",
    highlight: true,
    price_cents: 2000,
    yearly_cents: 6400,
    max_flashcards: 3000,
    max_summaries: 60,
    max_ai_questions: 3000,
    max_todo_tasks: null,
    max_calendar_items: null,
    max_groups: 5,
    max_all_in_one_lectures: 30,
    max_all_in_one_questions: 0,
    max_archive_questions: 500,
    todo_full: true,
    rich_cards: true,
    feature_lecture_qgen: true,
    feature_archive_qgen: true,
    feature_all_in_one: true,
    sort: 2,
    billing_kind: "monthly",
    published: true,
    currency: "USD",
    cta_label: "Try for free",
    perks: [
      "3-day free trial. Cancel before day 3 and pay nothing.",
      "Everything in Free",
      "3,000 AI credits a month",
      "5 classrooms",
    ],
  },
  {
    slug: "demo-team",
    free_talk_seconds: 36000,
    free_talk_period: "monthly",
    name: "Team",
    tagline: "For a team, per seat, billed yearly.",
    price_cents: 3200,
    yearly_cents: 10200,
    max_flashcards: null,
    max_summaries: null,
    max_ai_questions: 5000,
    max_todo_tasks: null,
    max_calendar_items: null,
    max_groups: null,
    max_all_in_one_lectures: 100,
    max_all_in_one_questions: 0,
    max_archive_questions: 2000,
    todo_full: true,
    rich_cards: true,
    feature_lecture_qgen: true,
    feature_archive_qgen: true,
    feature_all_in_one: true,
    sort: 3,
    billing_kind: "monthly",
    published: true,
    currency: "USD",
    cta_label: "Try for free",
    perks: [
      "3-day free trial. Cancel before day 3 and pay nothing.",
      "Everything in Pro",
      "5,000 AI credits a month per seat",
      "Unlimited classrooms",
      "Shared decks and team calendar",
    ],
  },
];

function PricingPage() {
  const loaderData = Route.useLoaderData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [billing, setBilling] = useState<Billing>("three_months");
  const usageFn = useServerFn(myPlanUsage);
  const settings = useSiteSettings();
  const saveSettings = useServerFn(updateSiteSettings);
  const qc = useQueryClient();
  const [savingPacks, setSavingPacks] = useState(false);
  // /pricing?demo=1 shows the sample plans (read after hydration so server and client agree).
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    setDemo(new URLSearchParams(window.location.search).has("demo"));
  }, []);

  const { data: realPlans = loaderData?.plans ?? [], isLoading: loadingPlans } = useQuery({
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

  const plans = demo ? DEMO_PLANS : realPlans;
  const isLoading = !demo && loadingPlans;
  const isAdmin = !!(mine as any)?.is_admin;
  const packsVisible = settings.credit_packs_enabled || isAdmin;
  const lifetime = billing === "once";
  const yearly = billing === "yearly";

  const togglePacks = async () => {
    setSavingPacks(true);
    try {
      await saveSettings({ data: { credit_packs_enabled: !settings.credit_packs_enabled } });
      await qc.invalidateQueries({ queryKey: ["site-settings"] });
    } finally {
      setSavingPacks(false);
    }
  };

  const published = plans.filter((p) => p.published !== false);
  const live = published.filter(
    (p) => (p.billing_kind ?? "monthly") === (lifetime ? "lifetime" : "monthly"),
  );
  const hasPacks = packsVisible && published.some((p) => p.billing_kind === "lifetime");

  // The biggest yearly saving against four 3-month periods, for the "Save" note in the switch.
  const yearlySave = Math.max(
    0,
    ...published
      .filter((p) => (p.billing_kind ?? "monthly") === "monthly" && p.price_cents && p.yearly_cents)
      .map((p) => Math.round((1 - p.yearly_cents / (p.price_cents * 4)) * 100)),
  );

  const priceOf = (p: FullPlan) =>
    lifetime ? (p.once_cents ?? 0) : yearly ? (p.yearly_cents ?? 0) : (p.price_cents ?? 0);

  const buy = (p: FullPlan) => {
    if (demo) return; // sample plans are not for sale
    if (!user) {
      navigate({
        to: "/register",
        search: { next: `/checkout?plan=${p.slug}&billing=${billing}` } as any,
      });
      return;
    }
    navigate({ to: "/checkout", search: { plan: p.slug, billing } as any });
  };

  const switchOptions: { k: Billing; label: string; note?: string }[] = [
    { k: "three_months", label: "3 months" },
    { k: "yearly", label: "Yearly", note: yearlySave > 0 ? `Save ${yearlySave}%` : undefined },
    ...(hasPacks ? [{ k: "once" as const, label: "Pay once" }] : []),
  ];
  const columns = { gridTemplateColumns: `repeat(${Math.max(live.length, 1)}, minmax(0, 1fr))` };
  const tableColumns = {
    gridTemplateColumns: `minmax(0, 1.3fr) repeat(${Math.max(live.length, 1)}, minmax(0, 1fr))`,
  };

  return (
    <div
      className="rita-cream min-h-screen bg-black text-white"
      style={{ fontFamily: "var(--font-grotesk)" }}
    >
      <ProHeader variant="solid" />

      <main className="mx-auto max-w-[1194px] px-4 pb-28 pt-28 sm:px-6 md:pt-[136px]">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <h1 className="text-[36px] font-[450] leading-[1.06] tracking-[-0.035em] md:text-[46px]">
            Plans and pricing
          </h1>
          <div
            role="radiogroup"
            aria-label="Billing"
            className="inline-flex w-fit rounded-full bg-[var(--pro-card)] p-1 md:mb-1"
          >
            {switchOptions.map((o) => (
              <button
                key={o.k}
                type="button"
                role="radio"
                aria-checked={billing === o.k}
                onClick={() => setBilling(o.k)}
                className={`rounded-full px-3.5 py-1.5 text-[13.5px] leading-[20px] transition-colors duration-150 ${
                  billing === o.k
                    ? "bg-[var(--pro-page)] text-[var(--pro-ink)] shadow-[0_1px_2px_rgba(18,17,23,0.08)]"
                    : "text-white/45 hover:text-white/75"
                }`}
              >
                {o.label}
                {o.note && <span className="rita-accent ms-1">{o.note}</span>}
              </button>
            ))}
          </div>
        </div>

        {lifetime && (
          <p className="mt-4 max-w-xl text-[14.5px] leading-[1.5] text-white/45">
            Yours for life. Use them at your own pace; when a pack runs out, buy it again and the
            credits add on top.
          </p>
        )}

        {isLoading && (
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[555px] animate-pulse rounded-[24px] bg-[var(--pro-card)]"
              />
            ))}
          </div>
        )}

        {!isLoading && live.length === 0 && (
          <p className="mt-10 rounded-[24px] bg-[var(--pro-card)] p-10 text-center text-[14.5px] text-white/45">
            No plans are published yet.
          </p>
        )}

        {!isLoading && live.length > 0 && (
          <div className="mt-10 grid gap-4 max-md:!grid-cols-1" style={columns}>
            {live.map((p) => {
              const priceCents = priceOf(p);
              const isMine = mine?.plan?.slug === p.slug;
              const best = !!p.highlight;
              const liveOffer = offerLive(p.offer_ends_at);
              const off =
                lifetime || yearly || !liveOffer
                  ? 0
                  : discountPercent(p.compare_cents, p.price_cents);
              const lines = [conversationAllowance(p), ...(p.perks && p.perks.length > 0 ? p.perks : cardLines(p)).slice(0, 7)];
              return (
                <article
                  key={p.slug}
                  className={`relative flex min-h-[555px] flex-col overflow-hidden rounded-[24px] p-9 bg-[var(--pro-card)]`}
                >
                  <OfferRibbon
                    label={p.ribbon_label}
                    color={p.ribbon_color}
                    endsAt={p.offer_ends_at}
                  />
                  <div className="flex min-h-[26px] items-center justify-between gap-3">
                    <h2 className="text-[17px] font-medium leading-[1.5] tracking-[-0.01em]">
                      {p.name}
                    </h2>
                    {isMine ? (
                      <span className="rounded-full bg-white/[0.1] px-2.5 py-0.5 text-[12.5px] font-medium leading-[18.75px] text-white/80">
                        Your plan
                      </span>
                    ) : best && !p.ribbon_label ? (
                      <span className="rita-accent rita-accent-soft rounded-full px-2.5 py-0.5 text-[12.5px] font-medium leading-[18.75px]">
                        Popular
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-5 flex flex-wrap items-baseline gap-x-1.5">
                    <span className="text-[44px] font-[450] leading-[1.5] tracking-[-0.04em]">
                      {money(priceCents, p.currency)}
                    </span>
                    <span className="text-[15px] leading-[1.5] text-white/40">
                      {priceCents === 0 ? "" : lifetime ? "once" : yearly ? "/year" : "/3 months"}
                    </span>
                    {off > 0 && (
                      <span className="ms-1 text-[15px] text-white/30 line-through">
                        {money(p.compare_cents ?? 0, p.currency)}
                      </span>
                    )}
                  </div>

                  <p className="mt-2 min-h-[22px] text-[14.5px] leading-[1.5] text-white/45">
                    {p.tagline}
                  </p>

                  <ul className="mb-9 mt-9 grid gap-2.5">
                    {lines.map((text) => (
                      <li
                        key={text}
                        className="flex items-start gap-3 text-[14px] leading-[1.5] text-white/85"
                      >
                        <Check
                          size={15}
                          strokeWidth={1.75}
                          className="mt-[3px] shrink-0 text-white/70"
                          aria-hidden
                        />
                        {text}
                      </li>
                    ))}
                  </ul>

                  {!lifetime && priceCents === 0 ? (
                    <Link
                      to={user ? "/study" : "/register"}
                      className={`mt-auto flex h-12 items-center justify-center rounded-full text-[14.5px] font-medium transition-transform duration-150 active:scale-[0.98] bg-[var(--pro-ink)] text-[var(--pro-page)]`}
                    >
                      {p.cta_label || "Start free"}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => buy(p)}
                      className={`mt-auto h-12 rounded-full text-[14.5px] font-medium transition-transform duration-150 active:scale-[0.98] bg-[var(--pro-ink)] text-[var(--pro-page)]`}
                    >
                      {p.cta_label ||
                        (lifetime
                          ? isMine
                            ? `Top up ${p.name}`
                            : `Buy ${p.name}`
                          : `Get ${p.name}`)}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {!isLoading && live.length > 0 && (
          <section aria-label="Compare plans" className="mt-16 overflow-x-auto md:mt-20">
            <div className="min-w-[620px]">
              <div className="grid" style={tableColumns}>
                <span />
                {live.map((p) => (
                  <span
                    key={p.slug}
                    className="text-center font-mono text-[11px] uppercase leading-[16.5px] tracking-[0.14em] text-white/40"
                  >
                    {p.name.toUpperCase()}
                  </span>
                ))}
              </div>

              {COMPARE.map((group) => (
                <div key={group.title} className="mt-[60px]">
                  <h2 className="mb-6 text-[28px] font-[450] leading-[1.06] tracking-[-0.035em] md:text-[34px]">
                    {group.title}
                  </h2>
                  {group.rows.map((row) => (
                    <div
                      key={row.label}
                      className="grid border-t border-white/[0.08]"
                      style={tableColumns}
                    >
                      <span className="flex h-[50px] items-center pe-4 text-[14px] text-white/85">
                        {row.label}
                      </span>
                      {live.map((p) => {
                        const v = row.value(p);
                        return (
                          <span
                            key={p.slug}
                            className={`flex h-[50px] items-center justify-center text-[13px] text-white/85 ${
                              p.highlight
                                ? "bg-[color-mix(in_oklab,var(--pro-ink)_6%,transparent)]"
                                : "bg-[color-mix(in_oklab,var(--pro-ink)_3%,transparent)]"
                            }`}
                          >
                            {v === false ? (
                              <span className="sr-only">Not included</span>
                            ) : v === null ? (
                              row.label === "Join classrooms" ? (
                                <Check size={15} strokeWidth={1.75} aria-label="Included" />
                              ) : (
                                "Unlimited"
                              )
                            ) : (
                              typeof v === "string" ? v : v.toLocaleString("en-US")
                            )}
                          </span>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-20 grid gap-8 md:mt-[100px] md:grid-cols-[minmax(0,0.56fr)_minmax(0,1fr)]">
          <div>
            <h2 className="text-[28px] font-[450] leading-[1.06] tracking-[-0.035em] md:text-[34px]">
              Questions
            </h2>
            <p className="mt-3 text-[14px] leading-[1.625] text-white/45">
              Plans, billing and where to find your allowance.
            </p>
          </div>
          <div className="border-b border-white/[0.08]">
            {QUESTIONS.filter((item) => !item.packs || hasPacks).map((item) => (
              <details key={item.q} className="group border-t border-white/[0.08]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-[17px] text-[15px] font-medium leading-[1.5] [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown
                    size={16}
                    strokeWidth={1.5}
                    className="shrink-0 text-white/35 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                    aria-hidden
                  />
                </summary>
                <p className="max-w-[60ch] pb-5 text-[14px] leading-[1.625] text-white/55">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {isAdmin && (
          <section className="mt-20 flex flex-wrap items-center justify-between gap-4 rounded-[24px] bg-[var(--pro-card)] p-7">
            <div>
              <p className="text-[12.5px] font-medium text-white/40">Admin only</p>
              <p className="mt-1 text-[15px] font-medium">
                Credit packs:{" "}
                <span
                  className={settings.credit_packs_enabled ? "text-[#4ade80]" : "text-[#f87171]"}
                >
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
              className="h-10 rounded-full bg-[var(--pro-ink)] px-5 text-[14px] font-medium text-[var(--pro-page)] disabled:opacity-60"
            >
              {savingPacks
                ? "Saving…"
                : settings.credit_packs_enabled
                  ? "Hide for everyone"
                  : "Show to everyone"}
            </button>
          </section>
        )}

        {mine && (
          <section className="mt-6 flex flex-wrap items-center gap-4 rounded-[24px] bg-[var(--pro-card)] p-7">
            <div className="min-w-0">
              <h2 className="text-[17px] font-medium">You are on {mine.plan?.name}</h2>
              <p className="mt-1 text-[14px] text-white/45">
                Your balance, allowances and any offer countdown live on their own page.
              </p>
            </div>
            <Link
              to="/settings"
              search={{ section: "plan" }}
              className="ms-auto flex h-11 items-center rounded-full bg-[var(--pro-ink)] px-5 text-[14.5px] font-medium text-[var(--pro-page)]"
            >
              Open my plan
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}

/** The card's short list when the admin wrote no perks: the plan's allowances. */
function cardLines(p: FullPlan): string[] {
  return [
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
      text: cap(p.max_archive_questions, "archive questions"),
    },
    { on: p.max_todo_tasks !== 0, text: cap(p.max_todo_tasks, "to-do tasks") },
    { on: p.max_groups !== 0, text: cap(p.max_groups, "classrooms you create") },
  ]
    .filter((l) => l.on)
    .map((l) => l.text);
}
