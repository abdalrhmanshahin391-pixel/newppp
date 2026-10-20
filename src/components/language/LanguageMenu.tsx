import { useCallback, useId, useRef, useState } from "react";
import { Check, ChevronDown, Globe, Loader2 } from "lucide-react";
import { LanguageFlag } from "@/components/language/LanguageFlag";
import { useUiLanguage } from "@/components/language/useUiLanguage";
import { useDismiss } from "@/components/header/useDismiss";
import { VOICE_SESSION_ERROR, useLearningLanguage } from "@/hooks/useLearningLanguage";
import { languageLabel } from "@/lib/learning-language";

/**
 * The language switcher in the top bar: the flag of the language being learned, and a menu with
 * the others. Signed-in learners only (the parent decides).
 */
export function LanguageMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const ui = useUiLanguage();
  const { code, language, languages, ready, pending, error, setLanguage } = useLearningLanguage();
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [announce, setAnnounce] = useState("");
  const text = (en: string, ar: string) => (ui === "ar" ? ar : en);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  useDismiss(open, close, root);

  async function choose(next: string) {
    if (next === code) {
      close();
      return;
    }
    const target = languages.find((item) => item.code === next);
    const done = await setLanguage(next);
    if (!done || !target) return;
    setAnnounce(
      ui === "ar"
        ? `صرت تتعلّم ${target.name_ar}. باقي لغاتك محفوظة.`
        : `Now learning ${target.name_native}. Your other languages stay saved.`,
    );
    close();
    root.current?.querySelector<HTMLElement>("[data-rh-trigger]")?.focus();
  }

  if (!ready) {
    return <div aria-hidden="true" className="h-9 w-14 animate-pulse rounded-lg bg-white/10" />;
  }

  const label = language
    ? text(
        `Learning language: ${language.name_native}. Change`,
        `لغة التعلّم: ${language.name_ar}. غيّر`,
      )
    : text("Choose a language to learn", "اختر لغة تتعلّمها");

  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        data-rh-trigger
        onClick={() => onOpenChange(!open)}
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        data-open={open ? "true" : "false"}
        className={`rh-avatar-btn ${language ? "" : "rh-lang-choose"}`}
      >
        {language ? (
          <LanguageFlag language={language} size={28} onDark />
        ) : (
          <>
            <Globe size={18} aria-hidden="true" />
            <span className="rh-lang-choose-text">{text("Choose language", "اختر لغة")}</span>
          </>
        )}
        <ChevronDown size={16} aria-hidden="true" className="rh-chevron" />
      </button>

      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>

      {open && (
        <div
          id={menuId}
          className="rh-card rh-lang-card"
          aria-label={text("Learning language", "لغة التعلّم")}
        >
          <p className="rh-lang-title">{text("Learning language", "لغة التعلّم")}</p>
          <div role="radiogroup" aria-label={text("Learning language", "لغة التعلّم")}>
            {languages.map((item) => {
              const selected = item.code === code;
              return (
                <button
                  key={item.code}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={pending !== null}
                  onClick={() => void choose(item.code)}
                  className="rh-item rh-lang-row disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <LanguageFlag language={item} size={28} />
                  <span className="rh-lang-names">
                    <span className="rh-lang-native">
                      <bdi lang={item.code}>{item.name_native}</bdi>
                    </span>
                    <span className="rh-lang-sub">{languageLabel(item, ui)}</span>
                  </span>
                  <span className="rh-lang-mark" aria-hidden="true">
                    {pending === item.code ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : selected ? (
                      <Check size={20} />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
          {error ? (
            <p role="alert" className="rh-lang-error">
              {error === VOICE_SESSION_ERROR
                ? text(
                    "End your conversation with Rita first, then switch language.",
                    "أنهِ محادثتك مع ريتا أولاً، ثم بدّل اللغة.",
                  )
                : text(
                    "Could not change the language. Try again.",
                    "تعذّر تغيير اللغة. حاول مرة أخرى.",
                  )}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
