// Uzyra's column beside a book: the same look as the study page's (her cube in the middle before
// the first question, then a quiet conversation), with written answers to what the reader asked
// from the circle. No call here: Uzyra answers in writing.
import { useRef } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { ChatText } from "@/components/rita/ChatText";
import { RitaCube } from "@/components/rita-study/RitaCube";
import { FlyingCube, StickyScroll } from "@/components/rita-study/RitaColumn";
import { UzyraMark } from "@/components/brand/UzyraMark";
import { UzyraWordmark } from "@/components/brand/UzyraWordmark";
import type { OrbLevels } from "@/components/rita-live/VoiceOrb";

export type BookAnswer = {
  id: string;
  label: string;
  quote: string;
  page: number;
  state: "loading" | "done" | "failed";
  text: string;
};

export function BookRitaColumn({
  answers,
  onRetry,
  hint,
}: {
  answers: BookAnswer[];
  onRetry: (answer: BookAnswer) => void;
  hint: string;
}) {
  const levels = useRef<OrbLevels>({ input: 0, output: 0 });
  const chatting = answers.length > 0;
  const busy = answers.some((answer) => answer.state === "loading");
  const last = answers[answers.length - 1];
  return (
    <main
      className="edith-premium uz-rc text-[var(--pp-ink)]"
      data-phase={chatting ? "chat" : "intro"}
      style={{ fontFamily: "var(--font-grotesk)" }}
    >
      <p className="sr-only" role="status" aria-live="polite">
        {busy ? "يوزرا بتكتب…" : ""}
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
                <div className="uz-rc-rita uz-msg-in">
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
          <UzyraWordmark size={12} withMark={false} className="uz-rc-brand" />
          <div className="uz-rc-spot is-hero" data-cube-spot="hero" />
          <p className="uz-rc-word">{hint}</p>
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
