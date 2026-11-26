import { useCallback, useId, useRef, useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { LanguageFlag } from "@/components/language/LanguageFlag";
import { useUiLanguage } from "@/components/language/useUiLanguage";
import { useDismiss } from "@/components/header/useDismiss";
import { MenuPanel, useInMenuGroup, useMenuTrigger } from "@/components/header/MenuGroup";
import { VOICE_SESSION_ERROR, useLearningLanguage } from "@/hooks/useLearningLanguage";

/**
 * The language switcher in the top bar: the code of the language being learned, and a menu with
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
  const inGroup = useInMenuGroup();
  useDismiss(open && !inGroup, close, root);
  const trigger = useMenuTrigger({ id: "language", open, onOpenChange });

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
    return <div aria-hidden="true" className="rh-language-tool invisible" />;
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
        ref={trigger.ref}
        type="button"
        data-rh-trigger
        onClick={trigger.onClick}
        onPointerEnter={trigger.onPointerEnter}
        onKeyDown={trigger.onKeyDown}
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        data-open={open ? "true" : "false"}
        className="rh-language-tool"
      >
        {language ? (
          <LanguageFlag language={language} size={22} />
        ) : (
          <span className="rh-lang-noflag" aria-hidden="true" />
        )}
        <bdi className="rh-lang-code">{code === "ar" ? "ع" : code?.toUpperCase() || "…"}</bdi>
        <ChevronDown size={14} className="rh-chevron" aria-hidden="true" />
      </button>

      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>

      <MenuPanel
        id="language"
        open={open}
        panelId={menuId}
        width={288}
        label={text("Learning language", "لغة التعلّم")}
        fallbackClassName="rh-card rh-lang-card"
      >
        <div className="uz-mp-body">
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
                  data-mp-item
                  className="rh-item rh-lang-row disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <LanguageFlag language={item} size={28} />
                  <span className="rh-lang-names">
                    <span className="rh-lang-native">
                      <bdi lang={item.code}>{item.name_native}</bdi>
                    </span>
                    {item.name_ar && item.name_ar !== item.name_native && (
                      <span className="rh-lang-sub">{item.name_ar}</span>
                    )}
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
                    "End your conversation with Uzyra first, then switch language.",
                    "أنهِ محادثتك مع يوزرا أولاً، ثم بدّل اللغة.",
                  )
                : text(
                    "Could not change the language. Try again.",
                    "تعذّر تغيير اللغة. حاول مرة أخرى.",
                  )}
            </p>
          ) : null}
        </div>
      </MenuPanel>
    </div>
  );
}
