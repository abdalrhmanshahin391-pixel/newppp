// Uzyra's column beside a book: her cube in the middle before the first question, then a quiet
// conversation, with written answers to what the reader asked from the circle. No call here: Uzyra
// answers in writing.
// The look is the home page's (Nov 2026): white, the home's field of black marks behind the intro
// (it wakes under the pointer or a finger and rests a moment after), a small «يوزرا · مساعدة
// القراءة» line, a light headline whose words come in one after another, the hint, and the three
// steps. The marks fade out once the conversation starts. Styles: `.uz-rc-book` in book-reader.css.
import { useRef, type CSSProperties } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { ChatText } from "@/components/rita/ChatText";
import { RitaCube } from "@/components/rita-study/RitaCube";
import { FlyingCube, StickyScroll } from "@/components/rita-study/RitaColumn";
import { UzyraMark } from "@/components/brand/UzyraMark";
import { useDotField } from "@/components/page-hero/useDotField";
import type { OrbLevels } from "@/components/rita-live/VoiceOrb";

export type BookAnswer = {
  id: string;
  label: string;
  quote: string;
  page: number;
  state: "loading" | "done" | "failed";
  text: string;
};

const TITLE = "اقرأ، حدّد، واسأل يوزرا.";
const STEPS = ["حدّد النص", "اكبس الدائرة", "اشرح · معنى ونطق · بطاقات"];

export function BookRitaColumn({
  answers,
  onRetry,
  hint,
  thinking = false,
}: {
  answers: BookAnswer[];
  onRetry: (answer: BookAnswer) => void;
  hint: string;
  /** The cube thinks without an answer on the way (the book is still opening). */
  thinking?: boolean;
}) {
  const levels = useRef<OrbLevels>({ input: 0, output: 0 });
  const column = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const chatting = answers.length > 0;
  const busy = thinking || answers.some((answer) => answer.state === "loading");
  const last = answers[answers.length - 1];
  useDotField(column, canvas, "#121117", chatting ? "still" : "rest");
  const words = TITLE.split(" ");
  return (
    <main
      ref={column}
      className="edith-premium uz-rc uz-rc-book text-[var(--pp-ink)]"
      data-phase={chatting ? "chat" : "intro"}
    >
      <canvas ref={canvas} className="uz-rcb-field" aria-hidden="true" />
      <p className="sr-only" role="status" aria-live="polite">
        {thinking ? hint : busy ? "يوزرا بتكتب…" : ""}
      </p>
      {chatting ? (
        <StickyScroll follow={`${answers.length}:${last?.state}:${last?.text.length ?? 0}`}>
          <div className="uz-rc-chat">
            {answers.map((answer) => (
              <div key={answer.id} className="contents">
                <div className="uz-rc-you uz-msg-in">
                  <span className="uz-rc-tag">{answer.label}</span>
                  <span dir="auto">«{answer.quote}»</span>
                </div>
                <div className="uz-rc-rita uz-msg-in" data-answer-page={answer.page}>
                  <div className="uz-rc-meta">
                    <span className="uz-rc-avatar" aria-hidden="true">
                      <UzyraMark />
                    </span>
                    <span className="uz-rc-meta-text">
                      {["يوزرا", `صفحة ${answer.page}`, answer.state === "loading" ? "بتكتب…" : ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  {answer.state === "loading" ? (
                    <Loader2 size={16} className="mx-auto animate-spin" aria-hidden="true" />
                  ) : answer.state === "failed" ? (
                    <div className="grid justify-items-center gap-2">
                      <p className="uz-rc-error" role="alert" dir="auto">
                        {answer.text}
                      </p>
                      <button
                        type="button"
                        className="rita-btn rita-btn-soft rita-btn-sm gap-1"
                        onClick={() => onRetry(answer)}
                      >
                        <RotateCcw size={13} aria-hidden="true" /> جرّب مرة ثانية
                      </button>
                    </div>
                  ) : (
                    <div data-reply-text="">
                      <ChatText text={answer.text} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </StickyScroll>
      ) : (
        <div className="uz-rc-hero">
          <p className="uz-rcb-kicker">
            <span className="uz-rcb-dot" aria-hidden="true" />
            يوزرا · مساعدة القراءة
          </p>
          <div className="uz-rc-spot is-hero" data-cube-spot="hero" />
          {thinking ? (
            <p className="uz-rc-word" dir="auto">
              {hint}
            </p>
          ) : (
            <>
              <p className="uz-rcb-title">
                <span className="sr-only">{TITLE}</span>
                <span aria-hidden="true">
                  {words.map((word, i) => (
                    <span key={i} className="uz-rcb-word" style={{ "--i": i } as CSSProperties}>
                      {word}
                      {i < words.length - 1 ? " " : ""}
                    </span>
                  ))}
                </span>
              </p>
              <p className="uz-rcb-lead" dir="auto">
                {hint}
              </p>
              <ol className="uz-rcb-steps" aria-label="كيف بتسأل يوزرا">
                {STEPS.map((step, i) => (
                  <li key={step}>
                    <b aria-hidden="true">{String(i + 1).padStart(2, "0")}</b>
                    {step}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
      <div className="uz-rc-dock">
        <div className="uz-rc-spot is-dock" data-cube-spot="dock" />
        {chatting && <p className="uz-rc-word is-small">{hint}</p>}
      </div>
      <FlyingCube chatting={chatting}>
        <RitaCube levelsRef={levels} mode={busy ? "thinking" : "idle"} label="يوزرا" />
      </FlyingCube>
    </main>
  );
}
