import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  CircleHelp,
  FileText,
  Gamepad2,
  GraduationCap,
  Languages,
  Layers,
  ListChecks,
  Phone,
  Users,
  type LucideIcon,
} from "lucide-react";
import { periodSuffix, planBillingMonths } from "@/lib/plan-billing";
import { ProHeader } from "@/components/home/procreate/ProHeader";
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
      return { plans: undefined };
    }
  },
  head: () => ({
    meta: [
      { title: "Uzyra plans: talk with Uzyra every day, and every study tool" },
      {
        name: "description",
        content:
          "Start free, or get Uzyra for $23 a month: 30 minutes of voice calls with Uzyra every day, path lessons, book study, lecture questions and every study tool.",
      },
      { property: "og:title", content: "Choose your smart study plan | Uzyra" },
      {
        property: "og:description",
        content: "30 minutes with Uzyra every day, path lessons, book study and every study tool.",
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

/** The card's first line: the plan's voice time, by how often it renews. */
const conversationAllowance = (p: FullPlan) => {
  const minutes = ((p.free_talk_seconds ?? 0) / 60).toLocaleString();
  if (p.free_talk_period === "daily") return `${minutes} minutes of calls with Uzyra every day`;
  if (p.free_talk_period === "lifetime") return `${minutes} minutes of calls to try Uzyra`;
  return `${minutes} minutes of calls with Uzyra a month`;
};

/** Everything a paid plan gives, under the cards. Keep every line true for Uzyra. */
const SERVICES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Phone,
    title: "Voice calls with Uzyra",
    text: "Talk freely in Jordanian Arabic and the language you learn. 30 minutes every day.",
  },
  {
    icon: GraduationCap,
    title: "Path lessons",
    text: "Lessons made from real books, level by level, explained by Uzyra out loud.",
  },
  {
    icon: BookOpen,
    title: "Book study",
    text: "Read a guide with Uzyra beside it: ask about a line, translate a page, hear it explained.",
  },
  {
    icon: ListChecks,
    title: "Path exercises",
    text: "Questions and film clips between lessons, with sounds, a score and another try.",
  },
  {
    icon: CircleHelp,
    title: "Lecture questions",
    text: "Turn a lecture PDF into exam-style questions with short explanations.",
  },
  {
    icon: FileText,
    title: "PDF summaries",
    text: "Short summaries of your lecture files, ready to revise from.",
  },
  {
    icon: Layers,
    title: "All-in-One",
    text: "Every question type from one lecture, in one place.",
  },
  {
    icon: Gamepad2,
    title: "Flashcards and word games",
    text: "Make cards, review them, and practise words with Wordcraft and the memory game.",
  },
  {
    icon: Languages,
    title: "German tools",
    text: "Labs for words, listening and speaking.",
  },
  {
    icon: Calendar,
    title: "To-do and calendar",
    text: "Plan your week and your exam dates.",
  },
  {
    icon: Users,
    title: "Classrooms",
    text: "Create classrooms or join one and study with your group.",
  },
];

/** Questions under the services. Edit the wording here; keep every answer true for Uzyra. */
const QUESTIONS: { q: string; a: string; packs?: boolean }[] = [
  {
    q: "Can I start for free?",
    a: "Yes. The free plan needs no payment. Move to a paid plan when you need more.",
  },
  {
    q: "How does the daily call time work?",
    a: "Uzyra gives you 30 minutes of calls every day. Free conversation, path lessons and book study all use the same time, counted from when a call starts until it ends. It comes back whole every day at midnight (Amman time); minutes you don't use are not carried over.",
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

  const fetchPlans = useServerFn(listPlans);
  const {
    data: realPlans,
    isLoading: loadingPlans,
    isError: plansError,
    isFetching: fetchingPlans,
    refetch: refetchPlans,
  } = useQuery({
    queryKey: ["plans"],
    initialData: loaderData?.plans,
    staleTime: 60_000,
    queryFn: async () => (await fetchPlans()) as FullPlan[],
  });

  const { data: mine } = useQuery({
    queryKey: ["my-plan-usage", user?.id ?? "anon"],
    queryFn: () => usageFn({}),
    enabled: !!user,
  });

  const plans = demo ? DEMO_PLANS : (realPlans ?? []);
  const showPlansError = !demo && plansError && !realPlans;
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

  // The biggest yearly saving against a year of the plan's own periods, for the switch's note.
  const recurring = published.filter((p) => (p.billing_kind ?? "monthly") === "monthly");
  const yearlySave = Math.max(
    0,
    ...recurring
      .filter((p) => p.price_cents && p.yearly_cents)
      .map((p) =>
        Math.round((1 - p.yearly_cents / ((p.price_cents * 12) / planBillingMonths(p))) * 100),
      ),
  );
  const hasYearly = recurring.some((p) => (p.yearly_cents ?? 0) > 0);
  // Uzyra renews every month; the switch says "Monthly" once every paid plan does.
  const allMonthly = recurring
    .filter((p) => (p.price_cents ?? 0) > 0)
    .every((p) => planBillingMonths(p) === 1);

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
    { k: "three_months", label: allMonthly ? "Monthly" : "3 months" },
    ...(hasYearly
      ? [
          {
            k: "yearly" as const,
            label: "Yearly",
            note: yearlySave > 0 ? `Save ${yearlySave}%` : undefined,
          },
        ]
      : []),
    ...(hasPacks ? [{ k: "once" as const, label: "Pay once" }] : []),
  ];
  const columns = { gridTemplateColumns: `repeat(${Math.max(live.length, 1)}, minmax(0, 1fr))` };

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
          {switchOptions.length > 1 && (
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
          )}
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

        {showPlansError && (
          <div role="alert" className="mt-10 rounded-[24px] bg-[var(--pro-card)] p-8 text-center">
            <p>We couldn’t load plans right now.</p>
            <button
              type="button"
              className="rh-btn mt-4 mx-auto"
              disabled={fetchingPlans}
              onClick={() => void refetchPlans()}
            >
              {fetchingPlans ? "Loading plans…" : "Try again"}
            </button>
          </div>
        )}

        {!isLoading && !showPlansError && live.length === 0 && (
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
              const lines = [
                conversationAllowance(p),
                ...(p.perks && p.perks.length > 0 ? p.perks : cardLines(p)).slice(0, 7),
              ];
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
                      {priceCents === 0
                        ? ""
                        : lifetime
                          ? "once"
                          : yearly
                            ? "/year"
                            : periodSuffix(p)}
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
          <section aria-labelledby="services-title" className="mt-16 md:mt-20">
            <h2
              id="services-title"
              className="text-[28px] font-[450] leading-[1.06] tracking-[-0.035em] md:text-[34px]"
            >
              Everything in Uzyra
            </h2>
            <p className="mt-3 max-w-xl text-[14.5px] leading-[1.5] text-white/45">
              One plan, every tool. The free plan has a taste of each.
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SERVICES.map(({ icon: Icon, title, text }) => (
                <li key={title} className="rounded-[24px] bg-[var(--pro-card)] p-7">
                  <Icon size={20} strokeWidth={1.75} className="text-white/70" aria-hidden />
                  <h3 className="mt-4 text-[17px] font-medium leading-[1.4] tracking-[-0.01em]">
                    {title}
                  </h3>
                  <p className="mt-1.5 text-[14px] leading-[1.55] text-white/55">{text}</p>
                </li>
              ))}
            </ul>
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
