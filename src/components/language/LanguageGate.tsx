import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { LanguageChooserCard } from "@/components/language/LanguagePicker";
import { useAuth } from "@/hooks/useAuth";
import { useLearningLanguage } from "@/hooks/useLearningLanguage";
import { showsGermanLab } from "@/lib/learning-language";

function useUi(): "en" | "ar" {
  const { i18n } = useTranslation();
  return (i18n.language ?? "").startsWith("ar") ? "ar" : "en";
}

/**
 * Pages that show language-specific material (flashcards, lessons, shared decks) ask a signed-in
 * learner to choose a language first. Guests and learners who have chosen see the page.
 */
export function LanguageGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { code, ready } = useLearningLanguage();
  if (!user || !ready || code !== null) return <>{children}</>;
  return (
    <div className="edith-premium min-h-screen bg-white text-[var(--pp-ink)]">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-10 md:py-14">
        <LanguageChooserCard />
      </main>
    </div>
  );
}

/** The German Lab is for learners of German; anyone else is offered the switch instead. */
export function GermanOnlyGate({ children }: { children: ReactNode }) {
  const ui = useUi();
  const { code, languages, ready, pending, error, setLanguage } = useLearningLanguage();
  if (!ready || showsGermanLab(code)) return <>{children}</>;
  const german = languages.find((language) => language.code === "de");
  const text = (en: string, ar: string) => (ui === "ar" ? ar : en);
  return (
    <div className="edith-premium min-h-screen bg-white text-[var(--pp-ink)]">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-10 md:py-14">
        <section className="rounded-[20px] bg-[var(--pp-grey)] p-5 md:p-6">
          <h1 className="rh-app-title font-bold tracking-[-0.03em]">
            {text("The German Lab is for learners of German", "مختبر الألمانية لمتعلّمي الألمانية")}
          </h1>
          <p className="mt-2 max-w-[48ch] text-[15px] leading-[1.45] text-[#4b4a5c]">
            {text(
              "You are learning a different language now. Switch to German to open it. Your other languages stay saved.",
              "أنت تتعلّم لغة ثانية الآن. بدّل للألمانية لتفتحه. باقي لغاتك محفوظة.",
            )}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {german ? (
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => void setLanguage("de")}
                className="rita-btn rita-btn-primary gap-2 disabled:opacity-40"
              >
                {pending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : null}
                {text("Switch to Deutsch", "بدّل إلى Deutsch")}
              </button>
            ) : null}
            <Link to="/learn" className="rita-btn rita-btn-secondary">
              {text("Back to learning", "رجوع للتعلّم")}
            </Link>
          </div>
          {error ? (
            <p role="alert" className="mt-3 text-[14px] text-red-700">
              {text(
                "Could not change the language. Try again.",
                "تعذّر تغيير اللغة. حاول مرة أخرى.",
              )}
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
