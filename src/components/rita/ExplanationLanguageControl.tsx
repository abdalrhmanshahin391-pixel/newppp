import { useId, type CSSProperties } from "react";
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
 * "Uzyra explains in": Arabic, English, or like the learner speaks. A radio group of three, so it
 * works with the keyboard (arrows move, the choice follows focus) and reads well to a screen
 * reader. During a conversation the choice reaches Uzyra straight away; the page's own words tell
 * the learner it applies from her next answer.
 *
 * `segmented` (the free conversation): one track with a black pill that slides under the choice.
 */
export function ExplanationLanguageControl({
  ui = "en",
  live,
  onChange,
  variant = "choice",
}: {
  ui?: Ui;
  /** A conversation is running: the hint says "from her next answer". */
  live: boolean;
  onChange?: (value: ExplanationLanguage) => void;
  variant?: "choice" | "segmented";
}) {
  const segmented = variant === "segmented";
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
    <div className={segmented ? "xl-seg-wrap" : "mt-4 w-full max-w-sm text-start"}>
      <p
        id={labelId}
        dir="auto"
        className={segmented ? "xl-seg-label" : "text-[14px] font-semibold text-[var(--pp-muted)]"}
      >
        {ui === "ar" ? "يوزرا بتشرح بـ" : "Uzyra explains in"}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={hintId}
        className={segmented ? "xl-seg" : "rita-choice mt-2"}
        style={
          segmented
            ? ({ "--xl-at": EXPLANATION_LANGUAGES.indexOf(value) } as CSSProperties)
            : undefined
        }
      >
        {segmented && <span className="xl-seg-pill" aria-hidden="true" />}
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
        className={
          segmented ? "xl-seg-hint" : "mt-2 text-[14px] leading-[1.4] text-[var(--pp-muted)]"
        }
      >
        {explanationHint(value, ui, live)}
      </p>
    </div>
  );
}
