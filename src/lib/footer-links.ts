export type FooterColumn = { heading: string; links: { label: string; to: string }[] };

export function footerColumns(ar: boolean, offersEnabled: boolean): FooterColumn[] {
  return [
    {
      heading: ar ? "يوزرا" : "Uzyra",
      links: [
        { label: ar ? "تحدّث مع يوزرا" : "Talk to Uzyra", to: "/rita" },
        { label: ar ? "محادثة حيّة" : "Live conversation", to: "/rita-live" },
        { label: ar ? "دروس يوزرا" : "Uzyra's lessons", to: "/rita-lessons" },
      ],
    },
    {
      heading: ar ? "أدوات الدراسة" : "Study tools",
      links: [
        { label: ar ? "البطاقات" : "Flashcards", to: "/study" },
        { label: ar ? "مختبر المحاضرات" : "Lecture Lab", to: "/study/lectures" },
        { label: ar ? "قائمة المهام" : "To-do list", to: "/study/todo" },
        { label: ar ? "جدول الامتحانات" : "Exam schedule", to: "/study/exams" },
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
