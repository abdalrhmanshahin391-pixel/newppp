import { Link } from "@tanstack/react-router";
import { Check, Loader2, MessageCircleQuestion, Play, RotateCcw } from "lucide-react";
import type { LessonStep } from "@/lib/rita-lesson-engine";
import { ChatText } from "@/components/rita/ChatText";
import { LessonStars } from "./LessonArt";
import { useState, type ReactNode } from "react";
import type { LessonRunHandle } from "./useLessonRun";

/**
 * The lesson inside the conversation: what is being taught now, as a card in the chat. The intro,
 * the explanation of each part (rule, table, examples) and the end of the lesson live here; the
 * questions open in the exercise window. Every button sends one event to the lesson engine, which
 * decides what comes next.
 */
export function LessonFlow({
  run,
  callActive,
  nextLessonId,
}: {
  run: LessonRunHandle;
  callActive: boolean;
  nextLessonId: string | null;
}) {
  const view = run.view;
  const step = run.step;
  if (!view || !step) return null;
  return (
    <section dir="rtl" className="flex flex-col gap-4" aria-label="الدرس">
      <SectionTrail step={step} />
      {step.offer_end && <OfferEnd run={run} />}
      {step.phase === "intro" && (
        <article className="rita-lesson-card">
          <p className="text-[13px] font-semibold text-[var(--pp-accent-text)]">درس اليوم</p>
          <h2 className="mt-1 text-[24px] font-bold leading-tight">
            {view.title_ar || view.title}
          </h2>
          {view.title_ar && view.title && (
            <p className="text-[15px] font-semibold text-[var(--pp-muted)]">
              <bdi dir="ltr">{view.title}</bdi>
            </p>
          )}
          {view.intro_ar && (
            <ChatText text={view.intro_ar} className="mt-3 text-[16px] leading-relaxed" />
          )}
          <p className="mt-2 text-[14px] text-[var(--pp-muted)]">
            حوالي {view.estimated_minutes} دقيقة · {partsLabel(view.section_count)}، وبعد كل شرح
            تمارين قصيرة
          </p>
          <PrimaryAction run={run} label="ابدأ الدرس" event="ready" icon={<Play size={16} />} />
        </article>
      )}
      {step.phase === "explain" && <ExplainCard step={step} run={run} callActive={callActive} />}
      {(step.phase === "guided" ||
        step.phase === "practice" ||
        step.phase === "remediation" ||
        step.phase === "section_result") &&
        !step.paused && (
          <p className="rita-lesson-note" role="status">
            التمرين مفتوح فوق. جاوب هناك، وبترجع هون بعد ما يخلص الجزء.
          </p>
        )}
      {step.phase === "wrap" && step.summary && (
        <article className="rita-lesson-card">
          <p className="text-[13px] font-semibold text-[var(--pp-accent-text)]">ملخص الدرس</p>
          <ChatText text={step.summary.summary_ar} className="mt-2 text-[17px] leading-relaxed" />
          {step.summary.summary_en && (
            <p className="mt-1 text-[15px] text-[var(--pp-muted)]" dir="ltr">
              {step.summary.summary_en}
            </p>
          )}
          <PrimaryAction run={run} label="خلصنا الدرس" event="ready" icon={<Check size={16} />} />
        </article>
      )}
      {step.phase === "done" && <DoneCard run={run} step={step} nextLessonId={nextLessonId} />}
      {run.failed && !exerciseShowing(step) && (
        <div role="alert" className="rita-ex-alert">
          <span>ما وصل طلبك. جرّب كمان مرة.</span>
          <button
            type="button"
            className="rita-btn rita-btn-soft rita-btn-sm gap-1.5"
            onClick={() => void run.retry()}
          >
            <RotateCcw size={15} aria-hidden="true" />
            أعد الإرسال
          </button>
        </div>
      )}
    </section>
  );
}

function exerciseShowing(step: LessonStep) {
  return (
    ["guided", "practice", "remediation", "section_result"].includes(step.phase) && !step.paused
  );
}

function partsLabel(count: number) {
  if (count === 1) return "جزء واحد";
  if (count === 2) return "جزئين";
  return `${count} أجزاء`;
}

function PrimaryAction({
  run,
  label,
  event,
  icon,
}: {
  run: LessonRunHandle;
  label: string;
  event: "ready" | "no_question";
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      className="rita-btn rita-btn-primary mt-4 gap-2"
      disabled={run.busy}
      onClick={() => void run.send({ type: event })}
    >
      {run.busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : icon}
      {label}
    </button>
  );
}

/** Finished parts, one quiet line each, so the learner sees how far they are. */
function SectionTrail({ step }: { step: LessonStep }) {
  if (!step.section || step.section.index === 0) return null;
  const done = step.section.index;
  return (
    <p className="text-[14px] font-semibold text-[var(--pp-muted)]">
      <Check size={14} className="inline align-[-2px]" aria-hidden="true" /> خلصت {done} من{" "}
      {step.section.count} أجزاء
    </p>
  );
}

function ExplainCard({
  step,
  run,
  callActive,
}: {
  step: LessonStep;
  run: LessonRunHandle;
  callActive: boolean;
}) {
  const [asked, setAsked] = useState(false);
  const explain = step.explain;
  const section = step.section;
  if (!explain || !section) return null;
  return (
    <article className="rita-lesson-card" aria-labelledby="lesson-explain-title">
      <p className="text-[13px] font-semibold text-[var(--pp-muted)]">
        الجزء {section.index + 1} من {section.count}
      </p>
      <h2 id="lesson-explain-title" className="mt-1 text-[22px] font-bold leading-tight">
        {section.title_ar || section.title}
      </h2>
      {section.title_ar && (
        <p className="text-[15px] font-semibold text-[var(--pp-muted)]">
          <bdi dir="ltr">{section.title}</bdi>
        </p>
      )}
      <ChatText text={explain.rule_ar} className="mt-3 text-[17px] leading-relaxed" />
      {explain.table.length > 0 && (
        <table className="rita-lesson-table" dir="ltr">
          <tbody>
            {explain.table.map((row) => (
              <tr key={`${row.left}-${row.right}`}>
                <th scope="row">{row.left}</th>
                <td>{row.right}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {explain.examples.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {explain.examples.map((example) => (
            <li key={example.text} className="rita-lesson-example">
              <span dir="ltr" lang="en" className="self-start font-semibold">
                {example.text}
              </span>
              {example.note_ar && (
                <ChatText
                  text={example.note_ar}
                  className="self-start text-[14px] text-[var(--pp-muted)]"
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-5 text-[16px] font-semibold">عندك سؤال قبل ما نتمرن؟</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rita-btn rita-btn-primary gap-2"
          disabled={run.busy}
          onClick={() => void run.send({ type: "no_question" })}
        >
          {run.busy ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <Play size={16} />
          )}
          فهمت، يلا نتمرن
        </button>
        <button
          type="button"
          className="rita-btn rita-btn-soft gap-2"
          disabled={run.busy}
          onClick={() => {
            setAsked(true);
            void run.send({ type: "question" });
          }}
        >
          <MessageCircleQuestion size={16} aria-hidden="true" />
          عندي سؤال
        </button>
      </div>
      {asked && (
        <p role="status" className="mt-3 text-[15px] text-[var(--pp-muted)]">
          {callActive
            ? "احكي سؤالك لريتا هلأ، وبعد ما تجاوب اضغط «فهمت، يلا نتمرن»."
            : "ابدأ المكالمة واسأل ريتا بصوتك، أو كمّل للتمرين إذا الأمور واضحة."}
        </p>
      )}
    </article>
  );
}

function OfferEnd({ run }: { run: LessonRunHandle }) {
  return (
    <article className="rita-lesson-card" role="alertdialog" aria-label="نكمل الدرس؟">
      <p className="text-[17px] font-bold">طلعنا شوي عن الدرس. نكمل ولا ننهيه هلأ؟</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rita-btn rita-btn-primary"
          disabled={run.busy}
          onClick={() => void run.send({ type: "resume" })}
        >
          نكمل الدرس
        </button>
        <button
          type="button"
          className="rita-btn rita-btn-soft"
          disabled={run.busy}
          onClick={() => void run.send({ type: "end" })}
        >
          ننهيه هلأ
        </button>
      </div>
    </article>
  );
}

function DoneCard({
  run,
  step,
  nextLessonId,
}: {
  run: LessonRunHandle;
  step: LessonStep;
  nextLessonId: string | null;
}) {
  const stars = step.summary?.stars ?? 0;
  const ended = run.view?.status === "abandoned";
  return (
    <article className="rita-lesson-card text-center">
      {ended ? (
        <p className="text-[20px] font-bold">
          وقّفنا الدرس. مكانك ما بينحسب، وبتقدر تبدأه من جديد.
        </p>
      ) : (
        <>
          <div className="flex justify-center">
            <LessonStars stars={stars} size={40} />
          </div>
          <p className="mt-2 text-[24px] font-bold">
            {stars === 3 ? "ممتاز!" : stars === 2 ? "شغل حلو!" : "خلصت الدرس"}
          </p>
          <p className="mt-1 text-[15px] text-[var(--pp-muted)]">
            {step.summary?.score ?? 0}% صح من أول مرة
          </p>
        </>
      )}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {nextLessonId && !ended && (
          <Link
            to="/rita-live"
            search={{ lesson: nextLessonId }}
            className="rita-btn rita-btn-primary"
          >
            الدرس التالي
          </Link>
        )}
        <button
          type="button"
          className="rita-btn rita-btn-soft gap-2"
          disabled={run.busy}
          onClick={() => void run.restart()}
        >
          <RotateCcw size={16} aria-hidden="true" />
          أعد الدرس
        </button>
      </div>
    </article>
  );
}
