import { showsGermanLab } from "./learning-language";

export type FooterColumn = { heading: string; links: { label: string; to: string }[] };

export function footerColumns(
  ar: boolean,
  learningLanguage: string | null,
  offersEnabled: boolean,
): FooterColumn[] {
  return [
    {
      heading: ar ? "ريتا" : "Rita",
      links: [
        { label: ar ? "تحدّث مع ريتا" : "Talk to Rita", to: "/rita" },
        { label: ar ? "محادثة حيّة" : "Live conversation", to: "/rita-live" },
        { label: ar ? "دروس ريتا" : "Rita's lessons", to: "/rita-lessons" },
        ...(showsGermanLab(learningLanguage)
          ? [{ label: ar ? "الألمانية" : "German Lab", to: "/german" }]
          : []),
      ],
    },
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
        { label: ar ? "مختبر المحاضرات" : "Lecture Lab", to: "/study/lectures" },
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
        ...(offersEnabled ? [{ label: ar ? "عروض خاصة" : "Special offers", to: "/offers" }] : []),
        { label: ar ? "تواصل معنا" : "Talk to the team", to: "/support" },
      ],
    },
  ];
}
