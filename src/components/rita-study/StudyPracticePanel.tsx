import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import type { PracticeAction } from "@/lib/study/study-actions";
import { practiceFailureView, type StudyCard, type StudyMcq } from "@/lib/study/study-practice";
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
};

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
  const cards = view.action === "make_cards";
  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
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
              <Dialog.Title className="st-practice-title">
                {cards ? "فلاش كاردز" : "تمارين اختيار"}
              </Dialog.Title>
              <Dialog.Description className="st-practice-note">
                من الجزء اللي حدّدته · متاحة خلال زيارة الدرس الحالية
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="rita-btn rita-btn-icon rita-btn-quiet"
              aria-label="إغلاق التدريب"
            >
              <X size={20} aria-hidden="true" />
            </Dialog.Close>
          </header>
          <div className="st-practice-body" aria-busy={view.status === "loading"}>
            {view.status === "loading" && (
              <p role="status" className="st-practice-loading">
                <Loader2
                  size={22}
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                {cards ? "بنجهّز البطاقات…" : "بنجهّز التمارين…"}
              </p>
            )}
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
                        <button
                          type="button"
                          className="rita-btn rita-btn-primary"
                          onClick={onRetry}
                        >
                          جرّب مرة ثانية
                        </button>
                      )}
                      {!failure.retry && !failure.alternative && (
                        <button
                          type="button"
                          className="rita-btn rita-btn-quiet"
                          onClick={() => onOpenChange(false)}
                        >
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
                />
              ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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

function Questions({
  questions,
  index,
  answers,
  onMove,
  onAnswer,
}: {
  questions: StudyMcq[];
  index: number;
  answers: Record<number, number>;
  onMove: (index: number) => void;
  onAnswer: (option: number) => void;
}) {
  const question = questions[index];
  if (!question) return <p>ما في تمارين لهالجزء. حدّد جزءًا ثانيًا من الدرس.</p>;
  const chosen = answers[index];
  const answered = chosen !== undefined;
  return (
    <>
      <p className="st-practice-note" role="status">
        السؤال {index + 1} من {questions.length}
      </p>
      <fieldset className="st-practice-question">
        <legend dir="auto">{question.question}</legend>
        <div className="st-practice-options">
          {question.options.map((option, optionIndex) => (
            <button
              key={optionIndex}
              type="button"
              dir="auto"
              className="st-practice-option"
              disabled={answered}
              aria-pressed={chosen === optionIndex}
              onClick={() => onAnswer(optionIndex)}
            >
              <span>{option}</span>
              {answered && optionIndex === question.answer && <strong>الإجابة الصحيحة</strong>}
              {answered && chosen === optionIndex && chosen !== question.answer && (
                <strong>إجابتك</strong>
              )}
            </button>
          ))}
        </div>
      </fieldset>
      {answered && (
        <div className="st-practice-feedback" role="status">
          <p className="font-semibold">{chosen === question.answer ? "صح!" : "الإجابة الصحيحة:"}</p>
          {chosen !== question.answer && <p dir="auto">{question.options[question.answer]}</p>}
          <p dir="auto" className="mt-2">
            {question.why}
          </p>
        </div>
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
