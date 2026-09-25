import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Flame,
  HelpCircle,
  Hourglass,
  Layers,
  Repeat,
  RotateCcw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import { studyDashboard, type Dashboard } from "@/lib/review.functions";
import { useAuth } from "@/hooks/useAuth";
import { useTutorialLang, type TutorialLang } from "@/components/tutorials/ToolTutorial";

export const Route = createFileRoute("/study/progress")({
  head: () => ({
    meta: [
      { title: "My Progress & SM-2 Analytics — RitaJet" },
      {
        name: "description",
        content:
          "Advanced memory analytics, SuperMemo SM-2 grade distribution, hard cards, lapsed leeches, and workload forecasts.",
      },
      { property: "og:title", content: "My Progress & SM-2 Analytics — RitaJet" },
      {
        property: "og:description",
        content: "Mastery, accuracy, hard and wrong cards breakdown in one clinical dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProgressPage,
});

function MetricCard({
  icon,
  label,
  value,
  subtext,
  tone,
  textColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  tone: string;
  textColor?: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-[24px] border border-black/[0.07] bg-white p-5 shadow-xs transition-transform hover:-translate-y-0.5 duration-200">
      <div className="flex items-center justify-between">
        <span
          className="grid h-10 w-10 place-items-center rounded-2xl shadow-xs"
          style={{ background: tone, color: textColor ?? "#23201d" }}
        >
          {icon}
        </span>
      </div>
      <div className="mt-4">
        <p className="font-display text-[2.2rem] font-black leading-none tracking-tight text-[#23201d]">
          {value}
        </p>
        <p className="mt-1.5 text-[13.5px] font-bold text-[#4a453d]">{label}</p>
        {subtext && (
          <p className="mt-0.5 text-[11px] font-semibold text-[#8a8070]">{subtext}</p>
        )}
      </div>
    </div>
  );
}

function ProgressPage() {
  const { user } = useAuth();
  const [lang, setLang] = useTutorialLang();
  const isAr = lang === "ar";
  const dashboard = useServerFn(studyDashboard);

  const { data, isLoading } = useQuery<Dashboard>({
    queryKey: ["study-dashboard", user?.id ?? "anon"],
    enabled: !!user,
    queryFn: () => dashboard(),
  });

  const maxCards = Math.max(1, ...(data?.daily ?? []).map((d) => d.cards));
  const weakest = (data?.subjects ?? [])
    .filter((s) => s.reviews >= 3)
    .slice()
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);

  // Grade breakdown calculations
  const totalGrades = Math.max(1, data?.grades?.total ?? 0);
  const againPct = Math.round(((data?.grades?.again ?? 0) / totalGrades) * 100);
  const hardPct = Math.round(((data?.grades?.hard ?? 0) / totalGrades) * 100);
  const goodPct = Math.round(((data?.grades?.good ?? 0) / totalGrades) * 100);
  const easyPct = Math.round(((data?.grades?.easy ?? 0) / totalGrades) * 100);

  return (
    <div
      className="min-h-screen bg-[#fbf5e9] px-4 py-8 md:px-8"
      dir={isAr ? "rtl" : "ltr"}
    >
      <div className="mx-auto w-full max-w-[76rem]">
        {/* Top bar with back button & language toggle */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            to="/study"
            className="inline-flex items-center gap-2 text-sm font-black text-[#6d6355] transition-colors hover:text-[#23201d]"
          >
            <ArrowLeft size={16} className={isAr ? "rotate-180" : ""} />
            {isAr ? "الرجوع إلى موادي وبطاقاتي" : "back to my subjects"}
          </Link>

          {/* Obvious Language Switcher */}
          <div
            className="inline-flex items-center rounded-full border border-black/[0.09] bg-white p-1 shadow-xs"
            dir="ltr"
          >
            <button
              type="button"
              onClick={() => setLang("en")}
              className={`rounded-full px-3 py-1 text-[12px] font-black uppercase transition-all ${
                lang === "en"
                  ? "bg-[#23201d] text-white shadow-xs"
                  : "text-[#6b655c] hover:text-[#23201d]"
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLang("ar")}
              className={`rounded-full px-3 py-1 text-[12px] font-black transition-all ${
                lang === "ar"
                  ? "bg-[#23201d] text-white shadow-xs"
                  : "text-[#6b655c] hover:text-[#23201d]"
              }`}
            >
              العربية
            </button>
          </div>
        </div>

        {/* Header Title */}
        <div className="mt-5">
          <h1 className="font-display text-[2.4rem] md:text-[2.8rem] font-black leading-tight tracking-tight text-[#23201d]">
            {isAr ? "تحليلات تقدمي الدراسي والذاكرة" : "My Progress & Memory Analytics"}
          </h1>
          <p className="mt-1 text-[15px] md:text-[16px] font-semibold text-[#6d6355]">
            {isAr
              ? "تشخيص دقيق لخوارزمية SuperMemo SM-2، توزيع الصعوبة، والبطاقات الصعبة والمستعصية."
              : "Advanced SuperMemo SM-2 diagnostics, difficulty curves, hard cards, and retention metrics."}
          </p>
        </div>

        {!user && (
          <div className="mt-8 rounded-[28px] border border-black/[0.08] bg-white p-8 text-center">
            <p className="text-base font-bold text-[#6d6355]">
              {isAr ? "يرجى تسجيل الدخول لعرض إحصائياتك الكاملة." : "Sign in to see your full progress."}
            </p>
          </div>
        )}

        {user && isLoading && (
          <div className="mt-8 rounded-[28px] border border-black/[0.08] bg-white p-8 text-center">
            <p className="text-base font-bold text-[#6d6355] animate-pulse">
              {isAr ? "جارٍ تجميع بياناتك وحساب فترات SM-2..." : "Adding up your reviews & SM-2 stability metrics…"}
            </p>
          </div>
        )}

        {user && data && (
          <>
            {/* 1. TOP 5-METRICS GRID: Mastered, Learning, Hard, Wrong/Leeches, New */}
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <MetricCard
                icon={<Award size={18} />}
                label={isAr ? "بطاقات متقنة" : "Cards Mastered"}
                value={data.totals.mastered}
                subtext={isAr ? "الفاصل > 21 يوماً" : "Interval > 21 days"}
                tone="#d8ecdd"
                textColor="#215237"
              />

              <MetricCard
                icon={<Target size={18} />}
                label={isAr ? "قيد التعلم النشط" : "Still Learning"}
                value={data.totals.learning}
                subtext={isAr ? "تكرار متباعد منتظم" : "In active repetition"}
                tone="#d6e8f6"
                textColor="#1f4c6d"
              />

              <MetricCard
                icon={<AlertTriangle size={18} />}
                label={isAr ? "بطاقات صعبة" : "Hard Cards"}
                value={data.totals.hard}
                subtext={isAr ? "تحتاج جهداً إضافياً" : "Struggling or Hard rated"}
                tone="#fef3c7"
                textColor="#92400e"
              />

              <MetricCard
                icon={<XCircle size={18} />}
                label={isAr ? "أخطاء ومستعصية (Leeches)" : "Wrong / Lapsed"}
                value={data.totals.wrong}
                subtext={isAr ? "فشل متكرر يستوجب الإعادة" : "Repeated failures"}
                tone="#fee2e2"
                textColor="#991b1b"
              />

              <MetricCard
                icon={<Layers size={18} />}
                label={isAr ? "غير مبدوءة (جديدة)" : "Not Started"}
                value={data.totals.new}
                subtext={isAr ? "في قائمة الانتظار" : "Awaiting first review"}
                tone="#e4dcf3"
                textColor="#4a3877"
              />
            </div>

            {/* 2. ACTIONABLE REMEDIATION BANNER */}
            {(data.totals.wrong > 0 || data.totals.hard > 0) && (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-amber-300/80 bg-amber-50/70 p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-200 text-amber-900 font-black">
                    ⚡
                  </span>
                  <div>
                    <h4 className="text-sm font-black text-amber-950">
                      {isAr ? "جلسة استدراك موجهة للبطاقات المتعثرة" : "Targeted Remediation Available"}
                    </h4>
                    <p className="text-xs text-amber-900/80">
                      {isAr
                        ? `لديك ${data.totals.wrong} بطاقة مستعصية و ${data.totals.hard} بطاقة صعبة تحتاج تثبيتاً قبل الامتحانات.`
                        : `You have ${data.totals.wrong} lapsed cards and ${data.totals.hard} hard cards that benefit from focused reinforcement.`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    to="/study"
                    className="inline-flex items-center gap-1.5 rounded-full bg-amber-800 px-4 py-2 text-xs font-black text-white transition-opacity hover:opacity-90 shadow-xs"
                  >
                    <RotateCcw size={13} />
                    {isAr ? "مراجعة البطاقات الصعبة الآن" : "Drill Hard Cards Now"}
                  </Link>
                </div>
              </div>
            )}

            {/* 3. SM-2 GRADE DISTRIBUTION PANEL */}
            <div className="mt-6 rounded-[26px] border border-black/[0.06] bg-white p-6 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] pb-4">
                <div>
                  <h2 className="font-display text-xl font-black text-[#23201d]">
                    {isAr ? "توزيع تقييمات خوارزمية SM-2" : "SuperMemo SM-2 Grade Distribution"}
                  </h2>
                  <p className="text-sm font-semibold text-[#6d6355]">
                    {isAr
                      ? "نسب اختياراتك للأزرار الأربعة أثناء جلسات المذاكرة السابقة."
                      : "How you rated your recall across all completed review events."}
                  </p>
                </div>
                <span className="text-xs font-black text-[#8a8070]">
                  {data.grades.total} {isAr ? "تقييماً مسجلاً" : "total reviews recorded"}
                </span>
              </div>

              {/* Stacked Progress Bar */}
              {data.grades.total > 0 ? (
                <div className="mt-5">
                  <div className="flex h-4 overflow-hidden rounded-full bg-black/[0.06]">
                    <div
                      title={`Again: ${data.grades.again} (${againPct}%)`}
                      className="bg-[#ef4444] transition-all"
                      style={{ width: `${againPct}%` }}
                    />
                    <div
                      title={`Hard: ${data.grades.hard} (${hardPct}%)`}
                      className="bg-[#f59e0b] transition-all"
                      style={{ width: `${hardPct}%` }}
                    />
                    <div
                      title={`Good: ${data.grades.good} (${goodPct}%)`}
                      className="bg-[#10b981] transition-all"
                      style={{ width: `${goodPct}%` }}
                    />
                    <div
                      title={`Easy: ${data.grades.easy} (${easyPct}%)`}
                      className="bg-[#0ea5e9] transition-all"
                      style={{ width: `${easyPct}%` }}
                    />
                  </div>

                  {/* The 4 Grade Legend Cards */}
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl border border-red-200/70 bg-red-50/60 p-3.5 text-center">
                      <div className="text-[11px] font-black uppercase tracking-wider text-red-700">
                        {isAr ? "أعد (10 دقائق)" : "Again (10 min)"}
                      </div>
                      <div className="mt-1 font-display text-[22px] font-black text-red-900">
                        {data.grades.again}
                      </div>
                      <div className="text-[11px] font-bold text-red-700/80">{againPct}% {isAr ? "من التقييمات" : "of ratings"}</div>
                    </div>

                    <div className="rounded-2xl border border-amber-200/70 bg-amber-50/60 p-3.5 text-center">
                      <div className="text-[11px] font-black uppercase tracking-wider text-amber-700">
                        {isAr ? "صعب (1 يوم)" : "Hard (1 day)"}
                      </div>
                      <div className="mt-1 font-display text-[22px] font-black text-amber-900">
                        {data.grades.hard}
                      </div>
                      <div className="text-[11px] font-bold text-amber-700/80">{hardPct}% {isAr ? "من التقييمات" : "of ratings"}</div>
                    </div>

                    <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-3.5 text-center">
                      <div className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
                        {isAr ? "جيد (6 أيام)" : "Good (6 days)"}
                      </div>
                      <div className="mt-1 font-display text-[22px] font-black text-emerald-900">
                        {data.grades.good}
                      </div>
                      <div className="text-[11px] font-bold text-emerald-700/80">{goodPct}% {isAr ? "من التقييمات" : "of ratings"}</div>
                    </div>

                    <div className="rounded-2xl border border-sky-200/70 bg-sky-50/60 p-3.5 text-center">
                      <div className="text-[11px] font-black uppercase tracking-wider text-sky-700">
                        {isAr ? "سهل (8+ أيام)" : "Easy (8+ days)"}
                      </div>
                      <div className="mt-1 font-display text-[22px] font-black text-sky-900">
                        {data.grades.easy}
                      </div>
                      <div className="text-[11px] font-bold text-sky-700/80">{easyPct}% {isAr ? "من التقييمات" : "of ratings"}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm font-semibold text-[#8a8070]">
                  {isAr
                    ? "لم تقم بتقييم بطاقات بعد. ابدأ جلسة مراجعة ذكية لرؤية توزيع الأزرار."
                    : "No reviews rated yet. Complete a smart review session to see your grade distribution."}
                </p>
              )}
            </div>

            {/* 4. MEMORY SCIENCE & CLINICAL METRICS (True Recall, Ease Factor, Time) */}
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {/* True Recall */}
              <div className="rounded-[26px] border border-black/[0.06] bg-white p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a79c8c]">
                    {isAr ? "دقة الاسترجاع الحقيقي" : "True Recall Accuracy"}
                  </p>
                  <p className="mt-2 font-display text-[3.2rem] font-black leading-none text-[#23201d]">
                    {data.retention.total >= 5 ? `${data.retention.percent}%` : "—"}
                  </p>
                </div>
                <p className="mt-3 text-sm font-semibold text-[#6d6355] leading-relaxed">
                  {data.retention.total >= 5
                    ? isAr
                      ? `تم استرجاع ${data.retention.recalled} بطاقة بنجاح من أصل ${data.retention.total} بطاقة بعد نوم الذاكرة.`
                      : `${data.retention.recalled} of ${data.retention.total} mature sleeping cards came back to you accurately.`
                    : isAr
                      ? "راجع بعض البطاقات المستحقة بعد نومها لعدة أيام ليظهر هذا المؤشر الحقيقي."
                      : "Review a few mature cards after interval sleep to calibrate this retention metric."}
                </p>
              </div>

              {/* Average Ease Factor */}
              <div className="rounded-[26px] border border-black/[0.06] bg-white p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a79c8c]">
                    {isAr ? "متوسط معامل السهولة (SM-2 Ease)" : "Average Ease Factor (EF)"}
                  </p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <p className="font-display text-[3.2rem] font-black leading-none text-[#23201d]">
                      {data.stats.avgEase}
                    </p>
                    <span className="text-xs font-bold text-[#8a8070]">
                      {data.stats.avgEase >= 2.4
                        ? isAr ? "استقرار مثالي" : "Healthy retention"
                        : isAr ? "مفاهيم مكثفة" : "Dense concepts"}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-sm font-semibold text-[#6d6355] leading-relaxed">
                  {isAr
                    ? "المعدل الطبيعي هو 2.50. المعدلات الأقل تشير إلى محتوى طبي دقيق يتطلب تكراراً أسرع لتثبيته."
                    : "Standard baseline is 2.50. Lower values indicate challenging clinical concepts requiring tighter revision cycles."}
                </p>
              </div>

              {/* Total Revision Time & Streak */}
              <div className="rounded-[26px] border border-black/[0.06] bg-white p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a79c8c]">
                    {isAr ? "وقت المذاكرة والالتزام" : "Revision Time & Consistency"}
                  </p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <p className="font-display text-[3.2rem] font-black leading-none text-[#23201d]">
                      {data.stats.totalHours}
                    </p>
                    <span className="text-xs font-bold text-[#8a8070]">{isAr ? "ساعة مذاكرة" : "hours studied"}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm font-semibold text-[#6d6355]">
                  <span className="flex items-center gap-1.5 font-bold text-[#7a4b16]">
                    <Flame size={15} className="text-orange-500 fill-orange-500" />
                    {data.streak} {isAr ? "أيام متتالية" : "day streak"}
                  </span>
                  <span>
                    {data.stats.goalMetDays} {isAr ? "أيام حُقق فيها الهدف" : "goals met"}
                  </span>
                </div>
              </div>
            </div>

            {/* 5. NEXT 30 DAYS WORKLOAD FORECAST */}
            <div className="mt-6 rounded-[26px] border border-black/[0.06] bg-white p-6 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-xl font-black text-[#23201d]">
                    {isAr ? "العبء المتوقع — الـ 30 يوماً القادمة" : "Workload Forecast — Next 30 Days"}
                  </h2>
                  <p className="text-sm font-semibold text-[#6d6355]">
                    {isAr
                      ? "توزيع البطاقات المستحقة قادماً حتى لا تتراكم عليك المراجعة فجأة."
                      : "Your projected repetition queue so nothing piles up by surprise."}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex h-28 items-end gap-[3px]">
                {data.forecast.map((f) => {
                  const peak = Math.max(1, ...data.forecast.map((x) => x.cards));
                  const isHigh = f.cards >= peak * 0.7 && f.cards > 5;
                  return (
                    <span
                      key={f.day}
                      title={`${f.day}: ${f.cards} cards`}
                      className={`flex-1 rounded-t-[4px] transition-colors ${
                        isHigh ? "bg-[#2f7d55]" : "bg-[#e6d9c2] hover:bg-[#d8c7ac]"
                      }`}
                      style={{ height: `${Math.max(4, (f.cards / peak) * 100)}%` }}
                    />
                  );
                })}
              </div>
            </div>

            {/* 6. DAILY ACTIVITY: LAST 30 DAYS */}
            <section className="mt-6 rounded-[26px] border border-black/[0.06] bg-white p-6 shadow-xs">
              <h2 className="font-display text-xl font-black text-[#23201d]">
                {isAr ? "نشاطك الفعلي في آخر 30 يوماً" : "Daily Activity — Last 30 Days"}
              </h2>
              <p className="text-sm font-semibold text-[#6d6355]">
                {isAr
                  ? "عدد البطاقات التي تمت مراجعتها كل يوم والدقائق المستغرقة فيها."
                  : "Cards reviewed each day and the minutes dedicated to them."}
              </p>
              {data.daily.length === 0 ? (
                <p className="mt-6 text-sm font-bold text-[#a79c8c]">
                  {isAr
                    ? "لا توجد مراجعات مسجلة في هذا الشهر. ابدأ جلسة اليوم لتسجيل نشاطك."
                    : "No reviews yet — start a session today to begin logging activity."}
                </p>
              ) : (
                <div className="mt-6 flex h-40 items-end gap-1.5">
                  {data.daily.map((d) => (
                    <div key={d.day} className="group flex flex-1 flex-col items-center gap-1">
                      <div
                        title={`${d.day}: ${d.cards} cards · ${d.minutes} min`}
                        className="w-full rounded-t-md bg-[var(--rita-green)] transition-all hover:brightness-110"
                        style={{ height: `${Math.max(4, (d.cards / maxCards) * 140)}px` }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 7. SUBJECT ACCURACY & WEAKEST SUBJECTS */}
            <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <section className="rounded-[26px] border border-black/[0.06] bg-white p-6 shadow-xs">
                <h2 className="font-display text-xl font-black text-[#23201d]">
                  {isAr ? "نسبة الدقة والإتقان لكل مادة" : "Accuracy per Subject"}
                </h2>
                {data.subjects.length === 0 ? (
                  <p className="mt-4 text-sm font-bold text-[#a79c8c]">
                    {isAr ? "لم تُقيّم بطاقات في المواد بعد." : "Nothing graded yet."}
                  </p>
                ) : (
                  <ul className="mt-4 grid gap-3.5">
                    {data.subjects.map((s) => (
                      <li key={s.subject}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="truncate font-black text-[#23201d]">{s.subject}</span>
                          <span className="shrink-0 font-bold text-[#6d6355]">
                            {s.accuracy}% · {s.reviews} {isAr ? "مراجعة" : "reviews"} ({s.mastered} {isAr ? "متقنة" : "mastered"})
                          </span>
                        </div>
                        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-black/[0.07]">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${s.accuracy}%`,
                              background:
                                s.accuracy >= 80
                                  ? "var(--rita-green)"
                                  : s.accuracy >= 60
                                    ? "#f0a95c"
                                    : "#d1795e",
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-[26px] border border-black/[0.06] bg-white p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#f6ddd5] text-[#7d3421]">
                      <TrendingDown size={16} />
                    </span>
                    <h2 className="font-display text-xl font-black text-[#23201d]">
                      {isAr ? "أضعف 3 موضوعات" : "Weakest Three Topics"}
                    </h2>
                  </div>
                  {weakest.length === 0 ? (
                    <p className="mt-4 text-sm font-bold text-[#a79c8c]">
                      {isAr
                        ? "راجع بضع بطاقات أخرى وستحدد لك ريتا المواد ذات التذكر المتذبذب."
                        : "Review a few more cards and Rita will identify topics with fluctuating recall."}
                    </p>
                  ) : (
                    <ul className="mt-4 grid gap-2.5">
                      {weakest.map((s) => (
                        <li
                          key={s.subject}
                          className="flex items-center justify-between gap-3 rounded-2xl bg-[#fbf5e9] px-4 py-3"
                        >
                          <span className="truncate text-sm font-black text-[#23201d]">
                            {s.subject}
                          </span>
                          <span className="shrink-0 text-sm font-black text-[#7d3421]">
                            {s.accuracy}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Link
                  to="/study"
                  className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-[var(--rita-green)] py-3 text-[15px] font-black text-[color:var(--rita-green-ink)] transition-opacity hover:opacity-90 shadow-xs"
                >
                  {isAr ? "مراجعة هذه المواد الآن ←" : "Study these now →"}
                </Link>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
