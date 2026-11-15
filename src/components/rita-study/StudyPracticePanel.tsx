import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Loader2, MessageCircleQuestion, RotateCcw, X } from "lucide-react";
import type { PracticeAction } from "@/lib/study/study-actions";
import {
  PRACTICE_NOTE,
  cardStyleLabel,
  practiceFailureView,
  practiceTitle,
  quizScore,
  retryWrong,
  type CardStyle,
  type StudyCard,
  type StudyMcq,
} from "@/lib/study/study-practice";
import { PracticeSave } from "./PracticeSave";
import { quizDoneSound, rightAnswerSound, wrongAnswerSound } from "./tech-sound";
import "./study-practice.css";

export type PracticeView = {
  id: string;
  action: PracticeAction;
  status: "loading" | "error" | "ready";
  cards: StudyCard[];
  questions: StudyMcq[];
  message: string;
  /** Why it failed (the server's code), so the window can say the real reason. */
  code?: string;
  /** Where it was made (the lesson or book title) and the selected text, for saving it. */
  source?: { title: string; quote: string };
  /** Flashcards: the style on screen, the styles this selection offers, and the cards each made. */
  style?: CardStyle;
  styles?: CardStyle[];
  counts?: Partial<Record<CardStyle, number>>;
};

/** The practice in a dialog (the book reader). The lesson page shows the same body in its window. */
export function StudyPracticePanel({
  view,
  open,
  onOpenChange,
  onRetry,
  onSwitch,
  onReturnFocus,
}: {
  view: PracticeView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  /** Makes another kind of practice from the same selection (questions instead of cards). */
  onSwitch: (action: PracticeAction) => void;
  onReturnFocus: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="st-practice-backdrop" />
        <Dialog.Content
          className="edith-premium st-practice"
          dir="rtl"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onReturnFocus();
          }}
        >
          <header className="st-practice-head">
            <div>
              <Dialog.Title className="st-practice-title">{practiceTitle(view)}</Dialog.Title>
              <Dialog.Description className="st-practice-note">{PRACTICE_NOTE}</Dialog.Description>
            </div>
            <Dialog.Close
              className="rita-btn rita-btn-icon rita-btn-quiet"
              aria-label="إغلاق التدريب"
            >
              <X size={20} aria-hidden="true" />
            </Dialog.Close>
          </header>
          <StudyPracticeBody
            view={view}
            onRetry={onRetry}
            onSwitch={onSwitch}
            onClose={() => onOpenChange(false)}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * The practice itself: getting ready, what went wrong (with the right next step), or the cards and
 * questions. Shared by the dialog (book reader) and the floating window (lesson page). Mounted
 * again for each new practice, so its place in the cards starts over.
 */
export function StudyPracticeBody({
  view,
  onRetry,
  onSwitch,
  onStyle,
  onClose,
  onExplain,
}: {
  view: PracticeView;
  onRetry: () => void;
  onSwitch: (action: PracticeAction) => void;
  /** Makes (or shows again) the cards of another style from the same selection. */
  onStyle?: (style: CardStyle) => void;
  onClose: () => void;
  /** Asks Uzyra to explain a practice question more (the lesson page, where Uzyra is). */
  onExplain?: (question: StudyMcq, chosen: number | undefined) => void;
}) {
  const cards = view.action === "make_cards";
  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const styles = cards && onStyle && view.styles && view.styles.length > 1 ? view.styles : null;
  return (
    <div className="st-practice-body" aria-busy={view.status === "loading"}>
      {styles && view.style && (
        <StyleSwitch
          styles={styles}
          value={view.style}
          counts={view.counts ?? {}}
          busy={view.status === "loading"}
          onChange={onStyle!}
        />
      )}
      {view.status === "loading" &&
        (cards ? (
          <CardsLoading style={view.style} />
        ) : (
          <p role="status" className="st-practice-loading">
            <Loader2
              size={22}
              className="animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            بنجهّز التمارين…
          </p>
        ))}
      {view.status === "error" &&
        (() => {
          const failure = practiceFailureView(view.code, view.message);
          return (
            <div role="alert">
              <p className="mb-4" dir="auto">
                {failure.message}
              </p>
              <div className="flex flex-wrap gap-2">
                {failure.alternative && (
                  <button
                    type="button"
                    className="rita-btn rita-btn-primary"
                    onClick={() => onSwitch(failure.alternative!)}
                  >
                    اعمل أسئلة اختيار
                  </button>
                )}
                {failure.retry && (
                  <button type="button" className="rita-btn rita-btn-primary" onClick={onRetry}>
                    جرّب مرة ثانية
                  </button>
                )}
                {!failure.retry && !failure.alternative && (
                  <button type="button" className="rita-btn rita-btn-quiet" onClick={onClose}>
                    إغلاق
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      {view.status === "ready" &&
        (cards ? (
          <Cards
            cards={view.cards}
            index={cardIndex}
            revealed={revealed}
            onReveal={() => setRevealed(!revealed)}
            onMove={(next) => {
              setCardIndex(next);
              setRevealed(false);
            }}
          />
        ) : (
          <Questions
            questions={view.questions}
            index={questionIndex}
            answers={answers}
            onMove={setQuestionIndex}
            onAnswer={(option) =>
              setAnswers((current) =>
                current[questionIndex] !== undefined
                  ? current
                  : { ...current, [questionIndex]: option },
              )
            }
            onRetryWrong={() => {
              const again = retryWrong(view.questions, answers);
              setAnswers(again.answers);
              setQuestionIndex(again.first);
            }}
            onExplain={onExplain}
          />
        ))}
      {view.status === "ready" && view.source && (
        <PracticeSave
          kind={cards ? "cards" : "questions"}
          cards={view.cards}
          questions={view.questions}
          source={view.source}
        />
      )}
    </div>
  );
}

/**
 * «كلمات مهمة | جمل كاملة»: a segmented switch; the blue pill slides to the chosen side. Each side
 * shows how many cards it made once it has made them.
 */
function StyleSwitch({
  styles,
  value,
  counts,
  busy,
  onChange,
}: {
  styles: CardStyle[];
  value: CardStyle;
  counts: Partial<Record<CardStyle, number>>;
  busy: boolean;
  onChange: (style: CardStyle) => void;
}) {
  const at = Math.max(0, styles.indexOf(value));
  return (
    <div
      role="radiogroup"
      aria-label="نوع البطاقات"
      className="st-styles"
      style={{ "--st-styles-n": styles.length, "--st-styles-at": at } as React.CSSProperties}
    >
      <span className="st-styles-pill" aria-hidden="true" />
      {styles.map((style) => {
        const count = counts[style];
        const chosen = style === value;
        return (
          <button
            key={style}
            type="button"
            role="radio"
            aria-checked={chosen}
            disabled={busy && !chosen}
            className="st-styles-option"
            onClick={() => {
              if (!chosen) onChange(style);
            }}
          >
            {cardStyleLabel(style)}
            {count !== undefined && <span className="st-styles-count">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** While the cards are made: three shimmering card shapes and what is being picked. */
function CardsLoading({ style }: { style?: CardStyle }) {
  return (
    <div className="st-cards-loading" role="status">
      <p className="st-cards-loading-text">
        {style === "sentences"
          ? "بنجهّز الجمل ومعانيها…"
          : style === "terms"
            ? "بنطلّع الكلمات المهمة…"
            : "بنجهّز البطاقات…"}
      </p>
      <div className="st-cards-skeleton" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function Cards({
  cards,
  index,
  revealed,
  onReveal,
  onMove,
}: {
  cards: StudyCard[];
  index: number;
  revealed: boolean;
  onReveal: () => void;
  onMove: (index: number) => void;
}) {
  const card = cards[index];
  if (!card) return <p>ما في بطاقات لهالجزء. حدّد جزءًا ثانيًا من الدرس.</p>;
  return (
    <>
      <p className="st-practice-note" role="status">
        البطاقة {index + 1} من {cards.length}
      </p>
      <div className="st-practice-card">
        <p dir="auto" className="st-practice-front">
          {card.front}
        </p>
        <button
          type="button"
          className="rita-btn rita-btn-secondary"
          aria-expanded={revealed}
          aria-controls="study-card-answer"
          onClick={onReveal}
        >
          {revealed ? "إخفاء الإجابة" : "اكشف الإجابة"}
        </button>
        <div id="study-card-answer" hidden={!revealed}>
          <p dir="auto" className="st-practice-answer">
            {card.back}
          </p>
          {card.note && (
            <p dir="auto" className="st-practice-note mt-2">
              {card.note}
            </p>
          )}
        </div>
      </div>
      <nav className="st-practice-nav" aria-label="التنقل بين البطاقات">
        <button
          type="button"
          className="rita-btn rita-btn-soft"
          disabled={index === 0}
          onClick={() => onMove(index - 1)}
        >
          السابقة
        </button>
        <button
          type="button"
          className="rita-btn rita-btn-primary"
          disabled={index === cards.length - 1}
          onClick={() => onMove(index + 1)}
        >
          التالية
        </button>
      </nav>
    </>
  );
}

const LETTERS = ["أ", "ب", "ج", "د"];

/**
 * The practice questions: progress dots on top (filled green or red once answered), the question,
 * four options with letters. Answering plays a short right or wrong sound (the study sound switch
 * mutes it), marks the right option green and a wrong pick red, and opens "why": the right answer,
 * why it is right and, for a wrong pick, what that option got wrong. When every question is
 * answered: the score, and "try the wrong ones again".
 */
function Questions({
  questions,
  index,
  answers,
  onMove,
  onAnswer,
  onRetryWrong,
  onExplain,
}: {
  questions: StudyMcq[];
  index: number;
  answers: Record<number, number>;
  onMove: (index: number) => void;
  onAnswer: (option: number) => void;
  onRetryWrong: () => void;
  /** Ask Uzyra to explain this question more (only where Uzyra is on the page). */
  onExplain?: (question: StudyMcq, chosen: number | undefined) => void;
}) {
  const question = questions[index];
  if (!question) return <p>ما في تمارين لهالجزء. حدّد جزءًا ثانيًا من الدرس.</p>;
  const chosen = answers[index];
  const answered = chosen !== undefined;
  const right = answered && chosen === question.answer;
  const score = quizScore(questions, answers);
  const wrongReason = answered && !right ? question.whyNot?.[chosen] : "";
  return (
    <>
      <div className="st-quiz-top">
        <p className="st-practice-note" role="status">
          السؤال {index + 1} من {questions.length}
        </p>
        <ol className="st-quiz-dots" aria-label="الأسئلة">
          {questions.map((item, dot) => {
            const pick = answers[dot];
            const state = pick === undefined ? "open" : pick === item.answer ? "right" : "wrong";
            return (
              <li key={dot}>
                <button
                  type="button"
                  className="st-quiz-dot"
                  data-state={state}
                  aria-current={dot === index ? "step" : undefined}
                  aria-label={`السؤال ${dot + 1}${state === "right" ? "، صح" : state === "wrong" ? "، غلط" : ""}`}
                  onClick={() => onMove(dot)}
                />
              </li>
            );
          })}
        </ol>
      </div>
      <fieldset className="st-practice-question">
        <legend dir="auto">{question.question}</legend>
        <div className="st-practice-options">
          {question.options.map((option, optionIndex) => {
            const state = !answered
              ? undefined
              : optionIndex === question.answer
                ? "right"
                : optionIndex === chosen
                  ? "wrong"
                  : "rest";
            return (
              <button
                key={optionIndex}
                type="button"
                className="st-practice-option st-quiz-option"
                data-state={state}
                disabled={answered}
                aria-pressed={chosen === optionIndex}
                onClick={() => {
                  if (optionIndex === question.answer) rightAnswerSound();
                  else wrongAnswerSound();
                  const next = { ...answers, [index]: optionIndex };
                  const after = quizScore(questions, next);
                  if (after.done)
                    window.setTimeout(() => quizDoneSound(after.right / after.total), 520);
                  onAnswer(optionIndex);
                }}
              >
                <span className="st-quiz-letter" aria-hidden="true">
                  {state === "right" ? (
                    <Check size={16} strokeWidth={3} />
                  ) : state === "wrong" ? (
                    <X size={16} strokeWidth={3} />
                  ) : (
                    LETTERS[optionIndex]
                  )}
                </span>
                <span className="st-quiz-text" dir="auto">
                  {option}
                </span>
                {state === "right" && <span className="sr-only">الإجابة الصحيحة</span>}
                {state === "wrong" && <span className="sr-only">إجابتك</span>}
              </button>
            );
          })}
        </div>
      </fieldset>
      {answered && (
        <section
          className="st-practice-feedback st-quiz-why"
          data-state={right ? "right" : "wrong"}
          role="status"
        >
          <p className="st-quiz-verdict">
            {right ? "صح، برافو!" : "مش هيك. الصح:"}
            {!right && (
              <span className="st-quiz-right" dir="auto">
                {question.options[question.answer]}
              </span>
            )}
          </p>
          {question.why && (
            <div className="st-quiz-reason">
              <span className="st-quiz-label">ليش؟</span>
              <p dir="auto">{question.why}</p>
            </div>
          )}
          {wrongReason && (
            <div className="st-quiz-reason is-wrong">
              <span className="st-quiz-label">ليش «{question.options[chosen]}» غلط؟</span>
              <p dir="auto">{wrongReason}</p>
            </div>
          )}
          {onExplain && (
            <button
              type="button"
              className="rita-btn rita-btn-soft st-quiz-more"
              onClick={() => onExplain(question, chosen)}
            >
              <MessageCircleQuestion size={18} aria-hidden="true" />
              اشرحلي أكثر
            </button>
          )}
        </section>
      )}
      {score.done && (
        <section className="st-quiz-score" aria-live="polite">
          <p>
            <strong>
              {score.right} من {score.total}
            </strong>{" "}
            {score.right === score.total
              ? "كلهم صح!"
              : score.right >= score.total / 2
                ? "ممتاز، ضايل شوي."
                : "ولا يهمك، جرّب مرة ثانية."}
          </p>
          {score.right < score.total && (
            <button type="button" className="rita-btn rita-btn-primary" onClick={onRetryWrong}>
              <RotateCcw size={18} aria-hidden="true" />
              عيد اللي غلطت فيهم
            </button>
          )}
        </section>
      )}
      <nav className="st-practice-nav" aria-label="التنقل بين الأسئلة">
        <button
          type="button"
          className="rita-btn rita-btn-soft"
          disabled={index === 0}
          onClick={() => onMove(index - 1)}
        >
          السابق
        </button>
        <button
          type="button"
          className="rita-btn rita-btn-primary"
          disabled={index === questions.length - 1}
          onClick={() => onMove(index + 1)}
        >
          التالي
        </button>
      </nav>
    </>
  );
}
