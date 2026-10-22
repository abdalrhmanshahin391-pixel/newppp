import { useId } from "react";
import { useExplanationLanguage } from "@/hooks/useExplanationLanguage";
import {
  EXPLANATION_LANGUAGES,
  explanationHint,
  explanationLabel,
  nextExplanationIndex,
  type ExplanationLanguage,
} from "@/lib/explanation-language";

type Ui = "en" | "ar";

/**
 * "Rita explains in": Arabic, English, or like the learner speaks. A radio group of three, so it
 * works with the keyboard (arrows move, the choice follows focus) and reads well to a screen
 * reader. During a conversation the choice reaches Rita straight away; the page's own words tell
 * the learner it applies from her next answer.
 */
export function ExplanationLanguageControl({
  ui = "en",
  live,
  onChange,
}: {
  ui?: Ui;
  /** A conversation is running: the hint says "from her next answer". */
  live: boolean;
  onChange?: (value: ExplanationLanguage) => void;
}) {
  const { value, setValue } = useExplanationLanguage();
  const labelId = useId();
  const hintId = useId();

  function choose(next: ExplanationLanguage) {
    if (next === value) return;
    setValue(next);
    onChange?.(next);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = nextExplanationIndex(index, event.key, document.documentElement.dir === "rtl");
    if (target === null) return;
    event.preventDefault();
    const next = EXPLANATION_LANGUAGES[target];
    choose(next);
    const group = event.currentTarget.parentElement;
    window.requestAnimationFrame(() =>
      group?.querySelector<HTMLElement>(`[data-value="${next}"]`)?.focus(),
    );
  }

  return (
    <div className="mt-4 w-full max-w-sm text-start">
      <p id={labelId} dir="auto" className="text-[14px] font-semibold text-[var(--pp-muted)]">
        {ui === "ar" ? "ريتا بتشرح بـ" : "Rita explains in"}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={hintId}
        className="rita-choice mt-2"
      >
        {EXPLANATION_LANGUAGES.map((option, index) => (
          <button
            key={option}
            type="button"
            role="radio"
            data-value={option}
            aria-checked={value === option}
            tabIndex={value === option ? 0 : -1}
            lang={option === "automatic" ? ui : option}
            onClick={() => choose(option)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {explanationLabel(option, ui)}
          </button>
        ))}
      </div>
      <p
        id={hintId}
        dir="auto"
        role="status"
        aria-live="polite"
        className="mt-2 text-[14px] leading-[1.4] text-[var(--pp-muted)]"
      >
        {explanationHint(value, ui, live)}
      </p>
    </div>
  );
}
