import { useTranslation } from "react-i18next";
import { SiteHeader } from "@/components/SiteHeader";
import { useLessonPath } from "@/components/learn/useLessonPath";
import { useAuth } from "@/hooks/useAuth";
import { useLearningLanguage } from "@/hooks/useLearningLanguage";
import { LanguageChooserCard } from "@/components/language/LanguagePicker";
import { useStudyOverview } from "@/lib/use-review";
import { lessonsDone } from "@/lib/learn-home";
import { PageHero } from "@/components/page-hero/PageHero";
import { LearnSections, type Bi } from "./LearnHomeView";

/** Data is loaded at the page boundary; section selection never remounts these hooks. */
export function LearnHome() {
  const { i18n } = useTranslation();
  const lang = (i18n.language ?? "").startsWith("ar") ? "ar" : "en";
  const { user } = useAuth();
  const overview = useStudyOverview();
  const lessons = useLessonPath(Boolean(user));
  const learning = useLearningLanguage();
  const path = lessonsDone(lessons.lessons);
  const chips: { flashcards: Bi | null; lessons: Bi | null } = {
    flashcards:
      overview.data && overview.data.due > 0
        ? { en: `${overview.data.due} due`, ar: `${overview.data.due} مستحقة` }
        : null,
    lessons:
      path.total > 0
        ? { en: `${path.done} of ${path.total} done`, ar: `${path.done} من ${path.total} منجزة` }
        : null,
  };
  return (
    <div className="edith-premium edith-light rh-learn-home uz-learn min-h-screen">
      <SiteHeader />
      <PageHero
        kicker={lang === "ar" ? "ابدأ التعلّم" : "Start learning"}
        title={lang === "ar" ? "احكي، تعلّم، وتدرّب." : "Talk, learn and practise."}
        lead={
          lang === "ar"
            ? "احكي مع يوزرا، خذ درس قصير، أو ادرس بمادتك الخاصة."
            : "Talk with Uzyra, take a short lesson, or study with your own material."
        }
      />
      <main className="uz-learn-main">
        {user && learning.ready && learning.code === null ? (
          <div className="mb-10">
            <LanguageChooserCard />
          </div>
        ) : null}
        <LearnSections lang={lang} chips={chips} />
      </main>
    </div>
  );
}
