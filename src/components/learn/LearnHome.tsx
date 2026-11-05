import { useTranslation } from "react-i18next";
import { SiteHeader } from "@/components/SiteHeader";
import { useLessonPath } from "@/components/learn/useLessonPath";
import { useAuth } from "@/hooks/useAuth";
import { useLearningLanguage } from "@/hooks/useLearningLanguage";
import { LanguageChooserCard } from "@/components/language/LanguagePicker";
import { showsGermanLab } from "@/lib/learning-language";
import { useStudyOverview } from "@/lib/use-review";
import { lessonsDone } from "@/lib/learn-home";
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
      <main className="uz-learn-main">
        <h1 className="sr-only">{lang === "ar" ? "التعلّم" : "Learn"}</h1>
        {user && learning.ready && learning.code === null ? (
          <div className="mb-10">
            <LanguageChooserCard />
          </div>
        ) : null}
        <LearnSections lang={lang} showGerman={showsGermanLab(learning.code)} chips={chips} />
      </main>
    </div>
  );
}
