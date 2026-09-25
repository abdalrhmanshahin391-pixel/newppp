import { Link } from "@tanstack/react-router";

import { useLang } from "@/components/LanguageProvider";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { SUPPORT_EMAIL } from "@/lib/legal-content";
import { RitaBrand } from "@/components/brand/RitaBrand";

type Col = { heading: string; links: { label: string; to: string }[] };

/**
 * RitaJet footer — cream paper, warm ink, green as the only accent.
 * Wordmark and tagline on the left, four link columns on the right,
 * then a quiet bottom row.
 */
export function SiteFooter() {
  const { lang } = useLang();
  const ar = lang === "ar";
  const settings = useSiteSettings();

  const columns: Col[] = [
    {
      heading: ar ? "أدوات الدراسة" : "Study tools",
      links: [
        { label: ar ? "البطاقات" : "Flashcards", to: "/study" },
        { label: ar ? "مختبر الذاكرة" : "Memory Lab", to: "/study/match" },
        { label: ar ? "ملخّصات PDF" : "PDF summaries", to: "/study/pdf" },
        { label: ar ? "قائمة المهام" : "To-do list", to: "/study/todo" },
      ],
    },
    {
      heading: ar ? "مع الذكاء الاصطناعي" : "With AI",
      links: [
        { label: ar ? "الكل في واحد" : "All in one", to: "/study/all-in-one" },
        { label: "Tutorial", to: "/tutorial" },
        { label: ar ? "مختبر المحاضرات" : "Lecture Lab", to: "/study/lectures" },
        { label: ar ? "الألمانية" : "German Lab", to: "/german" },
      ],
    },
    {
      heading: ar ? "المجتمع" : "Community",
      links: [
        { label: ar ? "بطاقات مشتركة" : "Shared flashcards", to: "/share" },
        { label: ar ? "شارك مجموعة" : "Share a deck", to: "/share/new" },
        { label: ar ? "الصفوف والمجموعات" : "Classrooms & groups", to: "/spaces" },
      ],
    },
    {
      heading: ar ? "الحساب والدعم" : "Account & support",
      links: [
        { label: ar ? "الخطط والأسعار" : "Plans & pricing", to: "/pricing" },
        ...(settings.offers_page_enabled
          ? [{ label: ar ? "عروض خاصة" : "Special offers", to: "/offers" }]
          : []),
        { label: ar ? "دليل الاستخدام" : "Tutorial", to: "/tutorial" },
        { label: ar ? "تواصل معنا" : "Talk to the team", to: "/support" },
      ],
    },
  ];

  return (
    <footer
      className="mt-auto"
      style={{
        fontFamily: "var(--font-grotesk)",
        background: "var(--pro-page)",
        color: "var(--pro-ink)",
        borderTop: "1px solid color-mix(in oklab, var(--pro-ink) 10%, transparent)",
      }}
    >
      <div className="mx-auto max-w-[1240px] px-6 py-16 md:px-10 md:py-20">
        <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,2.1fr)]">
          <div className="min-w-0">
            <RitaBrand size={52} />
            <p className="rita-ink-soft mt-2 max-w-[22rem] text-[16px] leading-relaxed">
              {ar
                ? "بطاقات وملخّصات وأسئلة من مادّتك أنت — في مكان واحد هادئ."
                : "Flashcards, summaries and practice questions from your own material — in one calm place."}
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="rita-accent mt-6 inline-block text-[15px] font-semibold hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {columns.map((col) => (
              <nav key={col.heading} className="min-w-0">
                <h3 className="text-[15px] font-bold tracking-[-0.01em]">{col.heading}</h3>
                <ul className="mt-4 space-y-3">
                  {col.links.map((l) => (
                    <li key={l.to + l.label}>
                      <Link
                        to={l.to as any}
                        className="rita-ink-soft text-[15px] transition-colors hover:!text-[color:var(--rita-green-deep)]"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div
          className="mt-14 pt-7 md:mt-16"
          style={{ borderTop: "1px solid color-mix(in oklab, var(--pro-ink) 10%, transparent)" }}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <p className="rita-ink-soft max-w-md text-[13.5px] leading-relaxed">
              © {new Date().getFullYear()} {settings.site_name || "RitaJet"}.{" "}
              {ar ? "جميع الحقوق محفوظة." : "All rights reserved."}
            </p>
            <div className="rita-ink-soft flex flex-wrap gap-x-8 gap-y-2 text-[13.5px]">
              <Link to="/support" className="transition-colors hover:!text-[color:var(--rita-green-deep)]">
                {ar ? "مركز المساعدة" : "Help Center"}
              </Link>
              <Link to="/my-plan" className="transition-colors hover:!text-[color:var(--rita-green-deep)]">
                {ar ? "خطتي" : "My plan"}
              </Link>
              <Link to="/register" className="transition-colors hover:!text-[color:var(--rita-green-deep)]">
                {ar ? "إنشاء حساب" : "Create account"}
              </Link>
              <Link to="/terms" className="transition-colors hover:!text-[color:var(--rita-green-deep)]">Terms</Link>
              <Link to="/privacy-policy" className="transition-colors hover:!text-[color:var(--rita-green-deep)]">Privacy</Link>
              <Link to="/refund-policy" className="transition-colors hover:!text-[color:var(--rita-green-deep)]">Refunds</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
