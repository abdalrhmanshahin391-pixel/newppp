import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { LanguageFlag } from "@/components/language/LanguageFlag";
import { useUiLanguage } from "@/components/language/useUiLanguage";
import { VOICE_SESSION_ERROR, useLearningLanguage } from "@/hooks/useLearningLanguage";
import { languageLabel } from "@/lib/learning-language";

type Ui = "en" | "ar";

const text = (ui: Ui, en: string, ar: string) => (ui === "ar" ? ar : en);

/**
 * The learner's language choice as a radio list (Settings and the first-time chooser). The top
 * bar has its own compact switcher (`LanguageMenu`); both change the language through the same
 * hook, so the whole site follows.
 */
export function LanguagePicker({ onChosen }: { onChosen?: (code: string) => void }) {
  const ui = useUiLanguage();
  const { code, languages, ready, pending, error, setLanguage } = useLearningLanguage();
  const [announce, setAnnounce] = useState("");

  async function choose(next: string) {
    const language = languages.find((l) => l.code === next);
    const done = await setLanguage(next);
    if (!done || !language) return;
    setAnnounce(
      ui === "ar"
        ? `صرت تتعلّم ${language.name_ar}. باقي لغاتك محفوظة.`
        : `Now learning ${language.name_native}. Your other languages stay saved.`,
    );
    onChosen?.(next);
  }

  if (!ready) {
    return (
      <div role="status" aria-label={text(ui, "Loading", "جارٍ التحميل")} className="grid gap-3">
        <div className="h-14 animate-pulse rounded-2xl bg-[var(--pp-grey)]" />
        <div className="h-14 animate-pulse rounded-2xl bg-[var(--pp-grey)]" />
      </div>
    );
  }

  if (languages.length === 0) {
    return (
      <p className="text-[15px] text-[var(--pp-muted)]">
        {text(ui, "No languages are available yet.", "لا توجد لغات متاحة بعد.")}
      </p>
    );
  }

  return (
    <div>
      <div
        role="radiogroup"
        aria-label={text(ui, "Learning language", "لغة التعلّم")}
        className="grid max-w-xl gap-3"
      >
        {languages.map((language) => {
          const selected = language.code === code;
          return (
            <button
              key={language.code}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={pending !== null}
              onClick={() => void choose(language.code)}
              className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-start transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
                selected
                  ? "border-[var(--pp-accent)] bg-[var(--pp-accent-soft)]"
                  : "border-[var(--pp-ink)] bg-white hover:bg-[var(--pp-accent-soft)]"
              }`}
            >
              <LanguageFlag language={language} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[18px] font-bold leading-tight">
                  <bdi lang={language.code}>{language.name_native}</bdi>
                </span>
                <span className="mt-0.5 block truncate text-[14px] text-[var(--pp-muted)]">
                  {languageLabel(language, ui)}
                </span>
              </span>
              <span className="grid size-6 place-items-center" aria-hidden="true">
                {pending === language.code ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : selected ? (
                  <Check size={20} className="text-[var(--pp-accent-text)]" />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
      <p
        role="status"
        aria-live="polite"
        className="mt-3 text-[14px] text-[var(--pp-muted)] empty:hidden"
      >
        {error ? "" : announce}
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-[14px] text-red-700">
          {error === VOICE_SESSION_ERROR
            ? text(
                ui,
                "End your conversation with Rita first, then switch language.",
                "أنهِ محادثتك مع ريتا أولاً، ثم بدّل اللغة.",
              )
            : text(
                ui,
                "Could not change the language. Try again.",
                "تعذّر تغيير اللغة. حاول مرة أخرى.",
              )}
        </p>
      ) : null}
    </div>
  );
}

/** First-time chooser, shown in place of a learning page until a language is picked. */
export function LanguageChooserCard() {
  const ui = useUiLanguage();
  return (
    <section
      aria-labelledby="language-chooser-title"
      className="rounded-[20px] bg-[var(--pp-grey)] p-5 md:p-6"
    >
      <h2
        id="language-chooser-title"
        className="rh-app-h2 text-[22px] font-bold tracking-[-0.02em]"
      >
        {text(ui, "What do you want to learn?", "شو بدك تتعلم؟")}
      </h2>
      <p className="mt-2 max-w-[48ch] text-[15px] leading-[1.45] text-[#4b4a5c]">
        {text(
          ui,
          "Your cards, lessons and conversations stay separate for each language. Switch any time.",
          "بطاقاتك ودروسك ومحادثاتك بتنفصل لكل لغة. بتقدر تبدّل بأي وقت.",
        )}
      </p>
      <p className="mt-2 max-w-[48ch] text-[14px] leading-[1.45] text-[var(--pp-muted)]">
        {text(
          ui,
          "Anything you already saved moves into the language you pick now.",
          "كل ما حفظته من قبل رح ينتقل للغة اللي بتختارها الآن.",
        )}
      </p>
      <div className="mt-5">
        <LanguagePicker />
      </div>
    </section>
  );
}
