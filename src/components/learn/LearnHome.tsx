import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  CalendarDays,
  Flame,
  Languages,
  Layers,
  MessagesSquare,
  TrendingUp,
  Users,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { ImageSlot } from "@/components/learn/ImageSlot";
import { useLessonPath } from "@/components/learn/useLessonPath";
import { useAuth } from "@/hooks/useAuth";
import { useStudyOverview } from "@/lib/use-review";
import { TOOLS, type ToolDef } from "@/lib/site-tools";
import {
  cardsLabel,
  dayPart,
  firstName,
  goalPercent,
  lessonsDone,
  pickContinue,
  type ContinueChoice,
} from "@/lib/learn-home";

type Lang = "en" | "ar";
type Bi = { en: string; ar: string };

type Row = {
  key: string;
  slot: string;
  name: Bi;
  line: Bi;
  to: string;
  params?: Record<string, string>;
  search?: Record<string, string>;
  ai?: boolean;
  chip?: string | null;
};

type SectionDef = { id: string; title: Bi; rows: Row[] };

const SECTION_IDS = ["rita", "study", "plan", "together", "german"] as const;

function rowOf(tool: ToolDef): Row {
  return {
    key: tool.key,
    slot: tool.key,
    name: tool.name,
    line: tool.line,
    to: tool.to,
    params: tool.params,
    ai: tool.column === "ai",
  };
}

const tool = (key: string) => TOOLS.find((t) => t.key === key)!;

/** Every destination in one list: Rita first, then the study tools, grouped by what they are for. */
function buildSections(chips: { flashcards: string | null; lessons: string | null }): SectionDef[] {
  return [
    {
      id: "rita",
      title: { en: "Talk to Rita", ar: "تحدث مع ريتا" },
      rows: [
        {
          key: "rita-conversations",
          slot: "rita-conversations",
          name: { en: "Free conversation", ar: "محادثة حرة" },
          line: {
            en: "Talk about anything. Rita answers out loud and corrects you gently.",
            ar: "تحدث عن أي شيء. ريتا ترد بصوتها وتصحح لك بلطف.",
          },
          to: "/rita-conversations",
        },
        {
          key: "rita-lessons",
          slot: "rita-lessons",
          name: { en: "Lessons", ar: "الدروس" },
          line: {
            en: "Short lessons with clear goals. Earn stars as you reach them.",
            ar: "دروس قصيرة بأهداف واضحة. اكسب نجومًا كلما حققتها.",
          },
          to: "/rita-lessons",
          chip: chips.lessons,
        },
      ],
    },
    {
      id: "study",
      title: { en: "Study with your own material", ar: "ادرس بمادتك الخاصة" },
      rows: [
        { ...rowOf(tool("flashcards")), chip: chips.flashcards },
        rowOf(tool("memory-lab")),
        rowOf(tool("pdf-summary")),
        rowOf(tool("all-in-one")),
        rowOf(tool("question-bank")),
        rowOf(tool("lecture-lab")),
      ],
    },
    {
      id: "plan",
      title: { en: "Plan your time", ar: "نظّم وقتك" },
      rows: [rowOf(tool("todo")), rowOf(tool("exams"))],
    },
    {
      id: "together",
      title: { en: "Study together", ar: "ادرس مع غيرك" },
      rows: [rowOf(tool("shared-decks")), rowOf(tool("spaces"))],
    },
    {
      id: "german",
      title: { en: "German", ar: "الألمانية" },
      rows: [rowOf(tool("german-lab"))],
    },
  ];
}

const RAIL: { id: (typeof SECTION_IDS)[number]; label: Bi; icon: typeof Layers }[] = [
  { id: "rita", label: { en: "Talk to Rita", ar: "تحدث مع ريتا" }, icon: MessagesSquare },
  { id: "study", label: { en: "My study space", ar: "مساحتي الدراسية" }, icon: Layers },
  { id: "plan", label: { en: "Plan", ar: "الخطة" }, icon: CalendarDays },
  { id: "together", label: { en: "Together", ar: "مع غيري" }, icon: Users },
  { id: "german", label: { en: "German", ar: "الألمانية" }, icon: Languages },
];

/** Which section is under the top of the screen, for the highlight in the side list. */
function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState<string>(ids[0] ?? "");
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!elements.length) return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const first = ids.find((id) => visible.has(id));
        if (first) setActive(first);
      },
      { rootMargin: "-96px 0px -55% 0px" },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

function SideList({ lang }: { lang: Lang }) {
  const active = useActiveSection(SECTION_IDS);
  const item =
    "inline-flex min-h-11 shrink-0 touch-manipulation items-center gap-2.5 rounded-lg border-2 px-3.5 text-[15px] font-semibold transition-colors duration-150 active:scale-[0.98] whitespace-nowrap lg:w-full";
  return (
    <nav
      aria-label={lang === "ar" ? "أقسام التعلم" : "Learning sections"}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:-mx-8 md:px-8 lg:sticky lg:top-6 lg:mx-0 lg:flex-col lg:self-start lg:overflow-visible lg:px-0 lg:pb-0"
    >
      {RAIL.map(({ id, label, icon: Icon }) => {
        const on = active === id;
        return (
          <a
            key={id}
            href={`#${id}`}
            aria-current={on ? "location" : undefined}
            className={`${item} ${
              on
                ? "border-[var(--pp-ink)] bg-[var(--pp-accent-soft)] text-[var(--pp-ink)]"
                : "border-transparent text-[#4b4a5c] hover:bg-[var(--pp-grey)] hover:text-[var(--pp-ink)]"
            }`}
          >
            <Icon size={19} strokeWidth={2} aria-hidden="true" />
            {label[lang]}
          </a>
        );
      })}
      <Link
        to="/study/progress"
        className={`${item} border-transparent text-[#4b4a5c] hover:bg-[var(--pp-grey)] hover:text-[var(--pp-ink)] lg:mt-2`}
      >
        <TrendingUp size={19} strokeWidth={2} aria-hidden="true" />
        {lang === "ar" ? "تقدمي" : "Progress"}
      </Link>
    </nav>
  );
}

function ToolRow({ row, lang }: { row: Row; lang: Lang }) {
  return (
    <Link
      to={row.to}
      params={row.params as never}
      search={row.search as never}
      data-learn-row={row.key}
      className="group flex min-h-[104px] touch-manipulation items-stretch rounded-2xl border-2 border-[var(--pp-ink)] bg-white outline-none transition-[background-color,transform] duration-150 hover:bg-[var(--pp-grey)] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--pp-ink)] active:scale-[0.99]"
    >
      <ImageSlot slot={row.slot} lang={lang} />
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-3 pe-2 ps-1 sm:ps-3">
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="text-[18px] font-bold leading-snug tracking-[-0.01em]">
            {row.name[lang]}
          </span>
          {row.ai ? (
            <span className="rounded-md border-2 border-[var(--pp-ink)] px-1.5 text-[12px] font-bold leading-5">
              AI
            </span>
          ) : null}
          {row.chip ? (
            <span className="rounded-md bg-[var(--pp-accent-soft)] px-2 text-[13.5px] font-semibold leading-6">
              {row.chip}
            </span>
          ) : null}
        </span>
        <span className="line-clamp-2 text-[15px] leading-[1.45] text-[#4b4a5c]">
          {row.line[lang]}
        </span>
      </span>
      <ArrowRight
        size={20}
        aria-hidden="true"
        className="me-4 hidden shrink-0 self-center text-[#4b4a5c] sm:block rtl:rotate-180"
      />
    </Link>
  );
}

function Section({ section, lang }: { section: SectionDef; lang: Lang }) {
  return (
    <section id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-24">
      <h2
        id={`${section.id}-title`}
        className="text-[22px] font-bold leading-tight tracking-[-0.02em]"
      >
        {section.title[lang]}
      </h2>
      <ul className="mt-3 grid gap-3">
        {section.rows.map((row) => (
          <li key={row.key}>
            <ToolRow row={row} lang={lang} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The one suggested next step. */
function NextUp({
  choice,
  loading,
  lang,
}: {
  choice: ContinueChoice;
  loading: boolean;
  lang: Lang;
}) {
  if (loading) {
    return (
      <div
        role="status"
        aria-label={lang === "ar" ? "جارٍ التحميل" : "Loading"}
        className="h-[116px] animate-pulse rounded-[20px] bg-[var(--pp-grey)]"
      />
    );
  }
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  let title = "";
  let detail = "";
  let cta = "";
  let to = "/rita";
  let search: Record<string, string> | undefined;
  switch (choice.kind) {
    case "signin":
      title = t("Sign in to keep your progress", "سجّل الدخول لتحفظ تقدمك");
      detail = t(
        "Your cards, lessons and streak are saved to your account.",
        "بطاقاتك ودروسك وسلسلة أيامك تُحفظ في حسابك.",
      );
      cta = t("Sign in", "تسجيل الدخول");
      to = "/login";
      break;
    case "lesson": {
      const name = lang === "ar" && choice.titleAr ? choice.titleAr : choice.title;
      title = choice.started
        ? t(`Continue: ${name}`, `تابع: ${name}`)
        : t(`Start your next lesson: ${name}`, `ابدأ درسك التالي: ${name}`);
      detail = choice.started
        ? t("Pick up where you stopped.", "أكمل من حيث توقفت.")
        : t("It takes a few minutes and Rita guides you.", "تستغرق بضع دقائق وريتا ترشدك.");
      cta = choice.started ? t("Continue lesson", "تابع الدرس") : t("Start lesson", "ابدأ الدرس");
      to = "/rita-lessons";
      search = { lesson: choice.lessonId };
      break;
    }
    case "review":
      title = t(`Review ${cardsLabel(choice.due)}`, `راجع ${choice.due} بطاقة`);
      detail = t(
        "They are due now. A few minutes keeps them from slipping.",
        "حان موعدها الآن. بضع دقائق تمنعك من نسيانها.",
      );
      cta = t("Start review", "ابدأ المراجعة");
      to = "/study";
      break;
    default:
      title = t("Talk to Rita for five minutes", "تحدث مع ريتا خمس دقائق");
      detail = t(
        "Say anything out loud. She answers and gently corrects you.",
        "قل أي شيء بصوتك. ترد عليك وتصحح لك بلطف.",
      );
      cta = t("Talk to Rita", "تحدث مع ريتا");
      to = "/rita";
  }
  return (
    <section
      aria-labelledby="next-up-title"
      className="flex flex-col gap-4 rounded-[20px] bg-[var(--pp-grey)] p-5 md:flex-row md:items-center md:justify-between md:p-6"
    >
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-[#4b4a5c]">{t("Next up", "خطوتك التالية")}</p>
        <h2
          id="next-up-title"
          className="mt-1 text-[24px] font-bold leading-tight tracking-[-0.02em] break-words"
        >
          {title}
        </h2>
        <p className="mt-1 text-[15px] leading-[1.45] text-[#4b4a5c]">{detail}</p>
      </div>
      <Link
        to={to}
        search={search as never}
        className="rita-btn rita-btn-primary min-h-12 shrink-0 gap-2 self-start whitespace-nowrap md:self-center"
      >
        {cta}
        <ArrowRight size={18} aria-hidden="true" className="rtl:rotate-180" />
      </Link>
    </section>
  );
}

function TodayPanel({
  lang,
  signedIn,
  overview,
  lessons,
}: {
  lang: Lang;
  signedIn: boolean;
  overview: ReturnType<typeof useStudyOverview>;
  lessons: ReturnType<typeof useLessonPath>;
}) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const shell = "rounded-[20px] bg-[var(--pp-grey)] p-5";
  const heading = (
    <h2 className="text-[18px] font-bold tracking-[-0.01em]">{t("Today", "اليوم")}</h2>
  );

  if (!signedIn) {
    return (
      <aside aria-label={t("Today", "اليوم")} className={shell}>
        {heading}
        <p className="mt-2 text-[15px] leading-[1.45] text-[#4b4a5c]">
          {t(
            "Sign in to see what is due, your daily goal and your streak.",
            "سجّل الدخول لترى ما يحين موعده وهدفك اليومي وسلسلة أيامك.",
          )}
        </p>
        <Link to="/login" className="rita-btn rita-btn-secondary mt-4 min-h-12 w-full">
          {t("Sign in", "تسجيل الدخول")}
        </Link>
      </aside>
    );
  }

  if (overview.isLoading) {
    return (
      <aside aria-label={t("Today", "اليوم")} className={shell}>
        {heading}
        <div role="status" aria-label={t("Loading", "جارٍ التحميل")} className="mt-4 grid gap-3">
          <div className="h-10 w-24 animate-pulse rounded-lg bg-white" />
          <div className="h-3 w-full animate-pulse rounded-full bg-white" />
          <div className="h-5 w-40 animate-pulse rounded-md bg-white" />
        </div>
      </aside>
    );
  }

  if (overview.isError || !overview.data) {
    return (
      <aside aria-label={t("Today", "اليوم")} className={shell}>
        {heading}
        <p role="alert" className="mt-2 text-[15px] leading-[1.45] text-[#4b4a5c]">
          {t("We could not load your numbers.", "تعذّر تحميل أرقامك.")}
        </p>
        <button
          type="button"
          onClick={() => void overview.refetch()}
          className="rita-btn rita-btn-secondary mt-4 min-h-12 w-full"
        >
          {t("Try again", "حاول مرة أخرى")}
        </button>
      </aside>
    );
  }

  const { due, streak, goal, today } = overview.data;
  const percent = goalPercent(today.cards, goal);
  const path = lessonsDone(lessons.lessons);
  const fresh = due === 0 && today.cards === 0 && streak === 0;

  return (
    <aside aria-label={t("Today", "اليوم")} className={shell}>
      {heading}
      <p className="mt-3 text-[40px] font-bold leading-none tracking-[-0.03em]">{due}</p>
      <p className="mt-1 text-[15px] text-[#4b4a5c]">
        {due === 1 ? t("card due now", "بطاقة حان موعدها") : t("cards due now", "بطاقة حان موعدها")}
      </p>

      <div className="mt-5">
        <div className="flex items-center justify-between text-[15px] font-semibold">
          <span>{t("Daily goal", "الهدف اليومي")}</span>
          <span className="tabular-nums">
            {today.cards}/{goal}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={t("Daily goal", "الهدف اليومي")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="mt-2 h-3 overflow-hidden rounded-full border-2 border-[var(--pp-ink)] bg-white"
        >
          <div
            className="h-full bg-[var(--pp-accent)] transition-[width] duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <dl className="mt-5 grid gap-2 text-[15px]">
        <div className="flex items-center justify-between gap-3">
          <dt className="inline-flex items-center gap-2 text-[#4b4a5c]">
            <Flame size={18} aria-hidden="true" />
            {t("Streak", "سلسلة الأيام")}
          </dt>
          <dd className="font-semibold tabular-nums">
            {streak} {streak === 1 ? t("day", "يوم") : t("days", "أيام")}
          </dd>
        </div>
        {path.total > 0 ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[#4b4a5c]">{t("Lessons done", "الدروس المنجزة")}</dt>
            <dd className="font-semibold tabular-nums">
              {path.done}/{path.total}
            </dd>
          </div>
        ) : null}
      </dl>

      {fresh ? (
        <p className="mt-4 border-t border-[var(--pp-line)] pt-4 text-[14.5px] leading-[1.45] text-[#4b4a5c]">
          {t(
            "Nothing yet. Talk to Rita or add your first flashcards and this fills in.",
            "لا شيء بعد. تحدث مع ريتا أو أضف أول بطاقاتك وستمتلئ هذه اللوحة.",
          )}
        </p>
      ) : null}
    </aside>
  );
}

/** /learn: Rita and every study tool in one place, with the learner's day beside it. */
export function LearnHome() {
  const { i18n } = useTranslation();
  const lang: Lang = (i18n.language ?? "").startsWith("ar") ? "ar" : "en";
  const { user, profile, loading: authLoading } = useAuth();
  const signedIn = Boolean(user);
  const overview = useStudyOverview();
  const lessons = useLessonPath(signedIn);

  // The greeting needs the learner's own clock, so it is set after the page has loaded.
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => setHour(new Date().getHours()), []);

  const name = firstName(profile?.full_name, user?.email);
  const part = hour === null ? null : dayPart(hour);
  const hello = (() => {
    if (!signedIn || !name) {
      return lang === "ar" ? "أين تريد الدراسة اليوم؟" : "Where do you want to study today?";
    }
    const en =
      part === "morning"
        ? "Good morning"
        : part === "afternoon"
          ? "Good afternoon"
          : "Good evening";
    const ar = part === "morning" ? "صباح الخير" : part === "afternoon" ? "أهلًا بك" : "مساء الخير";
    if (part === null) return lang === "ar" ? `أهلًا بك، ${name}` : `Welcome back, ${name}`;
    return lang === "ar" ? `${ar}، ${name}` : `${en}, ${name}`;
  })();

  const lessonsReady = lessons.status === "ready" || lessons.status === "error";
  const waiting = authLoading || (signedIn && (overview.isLoading || !lessonsReady));
  const choice = pickContinue({
    signedIn,
    lessons: lessons.lessons,
    due: overview.data?.due ?? null,
  });

  const path = lessonsDone(lessons.lessons);
  const sections = buildSections({
    flashcards: overview.data && overview.data.due > 0 ? `${overview.data.due} due` : null,
    lessons: path.total > 0 ? `${path.done} of ${path.total} done` : null,
  });

  return (
    <div
      className="edith-premium min-h-screen bg-white text-[var(--pp-ink)]"
      style={{ fontFamily: "var(--font-grotesk)" }}
    >
      <SiteHeader />

      <main className="mx-auto max-w-[1280px] px-4 pb-28 pt-8 md:px-8 md:pt-10">
        <h1 className="rh-app-title max-w-[24ch] font-bold tracking-[-0.03em]">{hello}</h1>

        <div className="mt-6">
          <NextUp choice={choice} loading={waiting} lang={lang} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[12.5rem_minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
          <SideList lang={lang} />
          <div className="lg:sticky lg:top-6 lg:col-start-3 lg:row-start-1 lg:self-start">
            <TodayPanel lang={lang} signedIn={signedIn} overview={overview} lessons={lessons} />
          </div>
          <div className="min-w-0 space-y-10 lg:col-start-2 lg:row-start-1">
            {sections.map((section) => (
              <Section key={section.id} section={section} lang={lang} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
