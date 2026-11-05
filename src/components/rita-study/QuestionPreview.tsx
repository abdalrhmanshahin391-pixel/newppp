import { useEffect, useId, useReducer, useRef } from "react";
import { useTranslation } from "react-i18next";
import * as Popover from "@radix-ui/react-popover";
import { Bookmark, Check, ChevronLeft, ChevronRight, Flag, Info, X } from "lucide-react";
import { UzyraWordmark } from "@/components/brand/UzyraWordmark";
import {
  createPreview,
  previewReducer,
  previewResult,
  type PreviewLanguage,
} from "./question-preview";
import "./question-preview.css";

/** A removable, client-only design preview. Answers live only while this window is mounted. */
export function QuestionPreview() {
  const { i18n } = useTranslation();
  const lang: PreviewLanguage = i18n.language?.startsWith("ar") ? "ar" : "en";
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const [state, dispatch] = useReducer(previewReducer, undefined, () => createPreview());
  const result = previewResult(state);
  const currentIndex = state.current;
  const question = state.questions[state.current];
  const attempt = state.attempts[state.current];
  const correct = attempt.choice === question.answer;
  const heading = useRef<HTMLHeadingElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const baseId = useId();
  const questionId = `${baseId}-question`;
  const prompt = question.question[lang];
  const separator = lang === "ar" ? prompt.indexOf(": ") : -1;
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    scroller.current?.scrollTo({ top: 0, behavior: "instant" });
    heading.current?.focus({ preventScroll: true });
  }, [currentIndex]);

  return (
    <div className="qp" dir={lang === "ar" ? "rtl" : "ltr"} lang={lang}>
      <div className="qp-toolbar">
        <div
          className="qp-position"
          aria-label={t(
            `السؤال ${state.current + 1} من ${result.total}`,
            `Question ${state.current + 1} of ${result.total}`,
          )}
        >
          <span>{t("معاينة الأسئلة", "QUESTION PREVIEW")}</span>
          <strong dir="ltr">
            Q{state.current + 1}
            <small> / {result.total}</small>
          </strong>
        </div>
        <nav className="qp-arrows" aria-label={t("التنقّل بين الأسئلة", "Question navigation")}>
          <button
            type="button"
            className="qp-icon"
            aria-label={t("السؤال السابق", "Previous question")}
            disabled={state.current === 0}
            onClick={() => dispatch({ type: "go", index: state.current - 1 })}
          >
            {lang === "ar" ? <ChevronRight /> : <ChevronLeft />}
          </button>
          <button
            type="button"
            className="qp-icon qp-next"
            aria-label={t("السؤال التالي", "Next question")}
            disabled={state.current === result.total - 1}
            onClick={() => dispatch({ type: "go", index: state.current + 1 })}
          >
            {lang === "ar" ? <ChevronLeft /> : <ChevronRight />}
          </button>
          <button
            type="button"
            className="qp-icon"
            aria-label={t("علّم السؤال للمراجعة", "Flag question")}
            aria-pressed={attempt.flagged}
            onClick={() => dispatch({ type: "flag" })}
          >
            <Flag fill={attempt.flagged ? "currentColor" : "none"} />
          </button>
        </nav>
        <div className="qp-brand">
          <UzyraWordmark size={20} />
        </div>
        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              type="button"
              className="qp-icon qp-save"
              aria-label={t("حفظ التمارين", "Save exercises")}
            >
              <Bookmark />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              role="region"
              aria-label={t("حفظ التمارين", "Save exercises")}
              className="qp-save-menu"
              sideOffset={8}
              collisionPadding={16}
              dir={lang === "ar" ? "rtl" : "ltr"}
            >
              <div>
                <strong>{t("حفظ التمارين", "Save exercises")}</strong>
                <Popover.Close
                  className="qp-menu-close"
                  aria-label={t("أغلق قائمة الحفظ", "Close save menu")}
                >
                  <X size={16} />
                </Popover.Close>
              </div>
              <p>
                {t(
                  "مكان الحفظ لسا مش محدد. هاد الزر للمعاينة بس، وما انحفظ إشي.",
                  "The save destination is not set yet. This is a preview; nothing has been saved.",
                )}
              </p>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>

      <div className="qp-scroll" ref={scroller}>
        <div className="qp-layout">
          <main className="qp-main" aria-label={t("حلّ السؤال", "Answer the question")}>
            <div className="qp-prompt">
              <h2 ref={heading} id={questionId} tabIndex={-1} dir="auto">
                {separator >= 0 ? (
                  <>
                    {prompt.slice(0, separator + 2)}
                    <bdi dir="ltr">{prompt.slice(separator + 2)}</bdi>
                  </>
                ) : (
                  prompt
                )}
              </h2>
            </div>
            <fieldset
              className="qp-options"
              aria-labelledby={questionId}
              disabled={attempt.submitted}
            >
              <legend className="qp-sr">{t("اختار إجابة واحدة", "Choose one answer")}</legend>
              {question.options.map((option, index) => {
                const picked = attempt.choice === index;
                const outcome = attempt.submitted
                  ? index === question.answer
                    ? "correct"
                    : picked
                      ? "wrong"
                      : undefined
                  : undefined;
                return (
                  <label
                    key={option}
                    className="qp-option"
                    data-picked={picked || undefined}
                    data-outcome={outcome}
                    dir="ltr"
                  >
                    <input
                      type="radio"
                      name={`${baseId}-${question.id}`}
                      checked={picked}
                      onChange={() => dispatch({ type: "choose", choice: index })}
                      value={index}
                    />
                    <span className="qp-letter" aria-hidden="true">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="qp-option-text">{option}</span>
                    {outcome && (
                      <span className="qp-outcome">
                        {outcome === "correct" ? <Check size={18} /> : <X size={18} />}
                        <span className="qp-sr">
                          {outcome === "correct"
                            ? t("الإجابة الصحيحة", "Correct answer")
                            : t("إجابتك غير صحيحة", "Your answer is incorrect")}
                        </span>
                      </span>
                    )}
                  </label>
                );
              })}
            </fieldset>
            {!attempt.submitted ? (
              <button
                type="button"
                className="qp-submit"
                disabled={attempt.choice === null}
                onClick={() => dispatch({ type: "submit" })}
              >
                {t("تأكيد الإجابة", "Submit Answer")}
              </button>
            ) : (
              <div className="qp-feedback" data-correct={correct} role="status">
                <strong>
                  {correct ? <Check size={19} /> : <X size={19} />}
                  {correct
                    ? t("إجابة صحيحة", "Correct answer")
                    : t("إجابة غير صحيحة", "Incorrect answer")}
                </strong>
                <p dir={lang === "ar" ? "rtl" : "ltr"}>
                  {lang === "ar"
                    ? question.why.ar
                        .split(/(-?[A-Za-z]+(?:[ /.-]+[A-Za-z]+)*\.?)/g)
                        .map((part, index) =>
                          /[A-Za-z]/.test(part) ? (
                            <bdi dir="ltr" key={index}>
                              {part}
                            </bdi>
                          ) : (
                            part
                          ),
                        )
                    : question.why.en}
                </p>
              </div>
            )}
            {attempt.submitted && state.current < result.total - 1 && (
              <button
                type="button"
                className="qp-submit"
                onClick={() => dispatch({ type: "go", index: state.current + 1 })}
              >
                {t("السؤال التالي", "Next Question")}
                {lang === "ar" ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
              </button>
            )}
          </main>

          <aside className="qp-aside" aria-label={t("التقدّم والأسئلة", "Progress and questions")}>
            <section
              className="qp-progress"
              aria-label={t("نتيجتك في المعاينة", "Your preview results")}
            >
              <div className="qp-progress-title">
                <strong>{t("تقدّمك", "Your progress")}</strong>
                <span dir="ltr">
                  {result.answered} / {result.total}
                </span>
              </div>
              <div
                className="qp-progress-track"
                role="progressbar"
                aria-label={t("الأسئلة المكتملة", "Answered questions")}
                aria-valuemin={0}
                aria-valuemax={result.total}
                aria-valuenow={result.answered}
              >
                {state.attempts.map((a, index) => (
                  <span
                    key={index}
                    data-state={
                      !a.submitted
                        ? "empty"
                        : a.choice === state.questions[index].answer
                          ? "correct"
                          : "wrong"
                    }
                  />
                ))}
              </div>
              <div className="qp-score" aria-live="polite">
                <span>{t("الإجابات الصحيحة", "Correct answers")}</span>
                <strong dir={result.accuracy === null ? undefined : "ltr"}>
                  {result.accuracy === null
                    ? t("لسا ما جاوبت", "Not answered yet")
                    : `${result.correct} / ${result.answered} (${result.accuracy}%)`}
                </strong>
              </div>
            </section>
            <section className="qp-navigator">
              <h3>{t("الأسئلة", "Questions")}</h3>
              <nav aria-label={t("اختار سؤال", "Choose a question")}>
                {state.attempts.map((a, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={t(
                      `السؤال ${index + 1}${a.submitted ? (a.choice === state.questions[index].answer ? "، صحيح" : "، غير صحيح") : "، بدون إجابة"}${a.flagged ? "، للمراجعة" : ""}`,
                      `Question ${index + 1}${a.submitted ? (a.choice === state.questions[index].answer ? ", correct" : ", incorrect") : ", unanswered"}${a.flagged ? ", flagged" : ""}`,
                    )}
                    aria-current={state.current === index ? "step" : undefined}
                    data-state={
                      !a.submitted
                        ? "empty"
                        : a.choice === state.questions[index].answer
                          ? "correct"
                          : "wrong"
                    }
                    onClick={() => dispatch({ type: "go", index })}
                  >
                    {index + 1}
                    {a.flagged && <Flag size={10} fill="currentColor" aria-hidden="true" />}
                  </button>
                ))}
              </nav>
            </section>
            {result.answered === result.total && (
              <p className="qp-complete" role="status">
                <Check size={18} />
                {t("خلصت الأسئلة الثلاثة", "All three questions completed")}
              </p>
            )}
            <p className="qp-preview-note">
              <Info size={15} aria-hidden="true" />
              {t(
                "تجربة تصميم فقط. إجاباتك ما بتنحفظ وما بتأثر على تقدّم الدرس.",
                "Design preview only. Answers are not saved and do not affect lesson progress.",
              )}
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
