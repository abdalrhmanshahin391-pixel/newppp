import { Link } from "@tanstack/react-router";

import { useLang } from "@/components/LanguageProvider";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { SUPPORT_EMAIL } from "@/lib/legal-content";
import { EdithWordmark } from "@/components/brand/EdithWordmark";
import { BRAND_NAME } from "@/lib/brand";

type Col = { heading: string; links: { label: string; to: string }[] };

/**
 * EdithLab footer: black surface, white ink. Wordmark and tagline on the
 * left, four link columns on the right, then a quiet bottom row.
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
      className="edith-dark mt-auto bg-black text-white"
      style={{ fontFamily: "var(--font-grotesk)", borderTop: "1px solid rgb(255 255 255 / 0.1)" }}
    >
      <div className="mx-auto max-w-[1240px] px-6 py-16 md:px-10 md:py-24">
        <div className="grid gap-14 md:grid-cols-[minmax(0,1fr)_minmax(0,2.1fr)]">
          <div className="min-w-0">
            <Link to="/" aria-label={`${BRAND_NAME} home`} className="inline-block">
              <EdithWordmark size={36} />
            </Link>
            <p className="mt-4 max-w-[22rem] text-[16px] leading-relaxed text-white/60">
              {ar
                ? "بطاقات وملخّصات وأسئلة من مادّتك أنت، في مكان واحد هادئ."
                : "Flashcards, summaries and practice questions from your own material, in one calm place."}
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="mt-6 inline-block text-[15px] font-semibold text-white underline decoration-white/30 underline-offset-4 transition-colors hover:decoration-white"
            >
              {SUPPORT_EMAIL}
            </a>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
            {columns.map((col) => (
              <nav key={col.heading} className="min-w-0" aria-label={col.heading}>
                <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-white">{col.heading}</h3>
                <ul className="mt-5 space-y-3.5">
                  {col.links.map((l) => (
                    <li key={l.to + l.label}>
                      <Link to={l.to as any} className="edith-link text-[15px]">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-16 border-t border-white/10 pt-7 md:mt-20">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <p className="max-w-md text-[13.5px] leading-relaxed text-white/50">
              © {new Date().getFullYear()} {BRAND_NAME}.{" "}
              {ar ? "جميع الحقوق محفوظة." : "All rights reserved."}
            </p>
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-[13.5px]">
              <Link to="/support" className="edith-link">
                {ar ? "مركز المساعدة" : "Help Center"}
              </Link>
              <Link to="/my-plan" className="edith-link">
                {ar ? "خطتي" : "My plan"}
              </Link>
              <Link to="/register" className="edith-link">
                {ar ? "إنشاء حساب" : "Create account"}
              </Link>
              <Link to="/terms" className="edith-link">Terms</Link>
              <Link to="/privacy-policy" className="edith-link">Privacy</Link>
              <Link to="/refund-policy" className="edith-link">Refunds</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
